// City of Espoo open 3D city model (CityGML 2.0 LOD2 from the city's WFS, CC BY 4.0): parsing,
// triangulation, texture-atlas packing and levelling for the game's textured-building tiles.
// Coordinates arrive as ETRS-GK25 (EPSG:3879) E, N and N2000 height; the game frame is
// x = E − E0, z = N0 − N, y = height above the building's lowest ground point.
import earcut from 'earcut';

const attr=(block,name)=>new RegExp(`name="${name}">\\s*<gen:value>([^<]*)<`).exec(block)?.[1];
const numbers=s=>s.trim().split(/\s+/).map(Number);
function positions(ring){
 const list=/<gml:posList[^>]*>([^<]+)</.exec(ring);
 const flat=list?numbers(list[1]):[...ring.matchAll(/<gml:pos[^>]*>([^<]+)</g)].flatMap(m=>numbers(m[1]));
 const out=[];for(let i=0;i+2<flat.length;i+=3)out.push([flat[i],flat[i+1],flat[i+2]]);return out;
}
function polygons(block){
 const out=[];
 for(const m of block.matchAll(/<gml:Polygon gml:id="([^"]+)">([\s\S]*?)<\/gml:Polygon>/g)){
  const rings=[...m[2].matchAll(/<gml:(exterior|interior)>\s*<gml:LinearRing(?: gml:id="([^"]+)")?>([\s\S]*?)<\/gml:LinearRing>/g)].map(r=>({id:r[2],points:positions(r[3])})).filter(r=>r.points.length>=3);
  if(rings.length)out.push({id:m[1],rings});
 }
 return out;
}
const KINDS={WallSurface:'wall',RoofSurface:'roof',GroundSurface:'ground',ClosureSurface:'closure',OuterCeilingSurface:'wall',OuterFloorSurface:'roof',BuildingInstallation:'installation'};

// One wfs:FeatureCollection → buildings with typed, textured polygons.
export function parseBuildings(xml){
 const buildings=[];
 for(const m of xml.matchAll(/<bldg:Building gml:id="([^"]+)">([\s\S]*?)<\/bldg:Building>/g)){
  const block=m[2],kind=new Map();
  for(const s of block.matchAll(/<bldg:(WallSurface|RoofSurface|GroundSurface|ClosureSurface|OuterCeilingSurface|OuterFloorSurface|BuildingInstallation)\b[\s\S]*?<\/bldg:\1>/g))
   for(const p of s[0].matchAll(/<gml:Polygon gml:id="([^"]+)"/g))if(!kind.has(p[1]))kind.set(p[1],KINDS[s[1]]);
  const textures=new Map(),colours=new Map();
  for(const t of block.matchAll(/<app:ParameterizedTexture>([\s\S]*?)<\/app:ParameterizedTexture>/g)){
   const uri=/<app:imageURI>([^<]+)</.exec(t[1])?.[1];if(!uri)continue;
   for(const target of t[1].matchAll(/<app:target uri="#([^"]+)">([\s\S]*?)<\/app:target>/g)){
    const uv={};for(const c of target[2].matchAll(/<app:textureCoordinates ring="#?([^"]+)">([^<]*)</g)){const v=numbers(c[2]),pairs=[];for(let i=0;i+1<v.length;i+=2)pairs.push([v[i],v[i+1]]);uv[c[1]]=pairs;}
    textures.set(target[1],{uri:uri.trim(),uv});
   }
  }
  for(const x of block.matchAll(/<app:X3DMaterial>([\s\S]*?)<\/app:X3DMaterial>/g)){
   const c=/<app:diffuseColor>([^<]+)</.exec(x[1]);if(!c)continue;
   for(const t of x[1].matchAll(/<app:target>#?([^<]+)</g))colours.set(t[1].trim(),numbers(c[1]));
  }
  const polys=polygons(block).map(p=>({...p,kind:kind.get(p.id)||(/^FtPrnt/.test(p.id)?'ground':/^Roof/.test(p.id)?'roof':'wall'),texture:textures.get(p.id)||null,color:colours.get(p.id)||null}));
  if(!polys.length)continue;
  buildings.push({id:m[1],buildingId:attr(block,'rakennustunnus'),address:attr(block,'osoite')?.replace(/,.*$/,'')||'',use:attr(block,'kayttotarkoitus')||'',storeys:+attr(block,'kerrosluku')||0,
   measuredHeight:+(/<bldg:measuredHeight[^>]*>([^<]+)</.exec(block)?.[1]||0),polys});
 }
 return buildings;
}

// ---------- Geometry ----------
export const toLocal=(origin,[e,n,h])=>[e-origin[0],h,origin[1]-n];
// Newell normal of a 3D ring (game frame).
export function ringNormal(r){let x=0,y=0,z=0;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];x+=(a[1]-b[1])*(a[2]+b[2]);y+=(a[2]-b[2])*(a[0]+b[0]);z+=(a[0]-b[0])*(a[1]+b[1]);}const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}
export function ringArea(r){let x=0,y=0,z=0;for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];x+=a[1]*b[2]-a[2]*b[1];y+=a[2]*b[0]-a[0]*b[2];z+=a[0]*b[1]-a[1]*b[0];}return Math.hypot(x,y,z)/2;}
const open=r=>r.length>3&&r[0].every((v,i)=>Math.abs(v-r.at(-1)[i])<1e-9)?r.slice(0,-1):r;
// Polygon (exterior + holes, game-frame 3D points with optional per-vertex UVs) → triangles
// [[p,uv],[p,uv],[p,uv]] wound like the exterior ring (outward for CityGML surfaces).
export function triangulate(rings,uvs=[]){
 const rs=rings.map(open),us=uvs.map((u,i)=>u?.slice(0,rs[i].length)),n=ringNormal(rs[0]),ax=Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2;
 const [i,j]=[[1,2],[2,0],[0,1]][ax],flat=[],holes=[],pts=[],tex=[];
 // Holes often carry no texture coordinates: extend the exterior's planar mapping to them.
 if(us[0]&&us.some((u,k)=>k&&!u)){const fit=affineFit(rs[0].map(p=>[p[i],p[j]]),us[0]);if(fit)rs.forEach((r,k)=>{if(!us[k])us[k]=r.map(p=>fit(p[i],p[j]));});}
 rs.forEach((r,k)=>{if(k)holes.push(pts.length);r.forEach((p,q)=>{flat.push(p[i],p[j]);pts.push(p);tex.push(us[k]?.[q]||null);});});
 const ids=earcut(flat,holes,2),out=[];
 for(let k=0;k<ids.length;k+=3){
  let t=[ids[k],ids[k+1],ids[k+2]];const [a,b,c]=t.map(q=>pts[q]),cx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),cy=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),cz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(cx*n[0]+cy*n[1]+cz*n[2]<0)t=[t[0],t[2],t[1]];
  out.push(t.map(q=>[pts[q],tex[q]]));
 }
 return out;
}
// Least-squares affine map from plane coordinates to UVs (null when degenerate).
export function affineFit(points,uvs){
 const n=Math.min(points.length,uvs.length);if(n<3)return null;const m=[[0,0,0],[0,0,0],[0,0,0]],bs=[0,0,0],bt=[0,0,0];
 for(let k=0;k<n;k++){const v=[points[k][0],points[k][1],1];for(let a=0;a<3;a++){for(let b=0;b<3;b++)m[a][b]+=v[a]*v[b];bs[a]+=v[a]*uvs[k][0];bt[a]+=v[a]*uvs[k][1];}}
 const det=q=>q[0][0]*(q[1][1]*q[2][2]-q[1][2]*q[2][1])-q[0][1]*(q[1][0]*q[2][2]-q[1][2]*q[2][0])+q[0][2]*(q[1][0]*q[2][1]-q[1][1]*q[2][0]),d=det(m);if(Math.abs(d)<1e-9)return null;
 const solve=b=>[0,1,2].map(c=>det(m.map((row,r)=>row.map((v,k)=>k===c?b[r]:v)))/d),cs=solve(bs),ct=solve(bt);
 return (x,y)=>[cs[0]*x+cs[1]*y+cs[2],ct[0]*x+ct[1]*y+ct[2]];
}
// Lowest point of the building's ground surfaces (else of any surface): the level that meets the street.
export function buildingBase(b){
 const ground=b.polys.filter(p=>p.kind==='ground'),use=ground.length?ground:b.polys;let low=Infinity;
 for(const p of use)for(const r of p.rings)for(const q of r.points)low=Math.min(low,q[2]);return low;
}
// Footprint rings in the game's 2D frame ([x,z], closed) from the ground surfaces.
export function footprints(b,origin){
 return b.polys.filter(p=>p.kind==='ground').map(p=>p.rings.map(r=>{const ring=open(r.points).map(q=>[+(q[0]-origin[0]).toFixed(2),+(origin[1]-q[1]).toFixed(2)]);ring.push(ring[0]);return ring;})).filter(rings=>rings[0].length>=4);
}

// ---------- Texture atlases ----------
// Rectangles {w,h} → shelf packing into a square atlas of `size` with `pad` pixels around each.
// Returns placements {x,y} (same order) or null when they do not fit.
export function shelfPack(rects,size,pad=2){
 const order=rects.map((r,i)=>i).sort((a,b)=>rects[b].h-rects[a].h||rects[b].w-rects[a].w),out=new Array(rects.length);
 let x=0,y=0,shelf=0;
 for(const i of order){const w=rects[i].w+2*pad,h=rects[i].h+2*pad;if(w>size||h>size)return null;
  if(x+w>size){x=0;y+=shelf;shelf=0;}if(y+h>size)return null;
  out[i]={x:x+pad,y:y+pad};x+=w;shelf=Math.max(shelf,h);}
 return out;
}
// Texel budget: each surface image is resampled to `metresPerPixel` of its world size (never above the
// source resolution); when a tile's set does not fit one atlas the density coarsens until it does.
export function planAtlas(items,{size=1024,metresPerPixel=.1,pad=2,minPixels=4}={}){
 for(let mpp=metresPerPixel;mpp<64;mpp*=1.15){
  const rects=items.map(it=>{const k=Math.min(1,Math.sqrt(it.area/(mpp*mpp)/(it.w*it.h)));return {w:Math.max(minPixels,Math.min(it.w,Math.round(it.w*k))),h:Math.max(minPixels,Math.min(it.h,Math.round(it.h*k)))};});
  const total=rects.reduce((s,r)=>s+(r.w+2*pad)*(r.h+2*pad),0);if(total>size*size*.92)continue;
  const placed=shelfPack(rects,size,pad);if(placed)return {metresPerPixel:+mpp.toFixed(3),size,rects:rects.map((r,i)=>({...r,...placed[i]}))};
 }
 throw Error('Atlas plan failed');
}
// CityGML texture coordinate (s,t; t up from the image bottom) → atlas UV (v down from the top, as
// the game's textures use flipY = false). Clamped half a texel inside the placed rectangle.
export function atlasUv([s,t],r,size){
 const u=Math.min(1,Math.max(0,s)),v=1-Math.min(1,Math.max(0,t)),hx=.5/r.w,hy=.5/r.h;
 return [(r.x+r.w*Math.min(1-hx,Math.max(hx,u)))/size,(r.y+r.h*Math.min(1-hy,Math.max(hy,v)))/size];
}
// JPEG dimensions from the SOF marker (no decoding).
export function jpegSize(buf){
 let i=2;while(i+9<buf.length){if(buf[i]!==0xff){i++;continue;}const m=buf[i+1];if(m>=0xc0&&m<=0xcf&&m!==0xc4&&m!==0xc8&&m!==0xcc)return {w:buf.readUInt16BE(i+7),h:buf.readUInt16BE(i+5)};if(m===0xd8||m===0x01||(m>=0xd0&&m<=0xd7)){i+=2;continue;}i+=2+buf.readUInt16BE(i+2);}
 return null;
}

// ---------- Street areas, centrelines, trees, districts (same WFS) ----------
// tran:road_lod2 → {id, name, part ('Ajorata' | 'Kevyt liikenne'), use (functional class), triangles [[E,N]×3]}.
export function parseStreets(xml){
 return [...xml.matchAll(/<tran:Road gml:id="([^"]+)">([\s\S]*?)<\/tran:Road>/g)].map(m=>({id:m[1],name:(attr(m[2],'tunnus')||'').replace(/^\d+/,''),part:attr(m[2],'katuosalaji')||'',use:attr(m[2],'toiminnallinenluokka')||'',
  triangles:[...m[2].matchAll(/<gml:Triangle>([\s\S]*?)<\/gml:Triangle>/g)].map(t=>positions(t[1]).slice(0,3).map(p=>[p[0],p[1]]))}));
}
// GIS:Keskilinjat → {id, name, part, use, direction (0 both ways, 1 along the drawing, 2 against), points [[E,N]]}.
export function parseCentrelines(xml){
 return [...xml.matchAll(/<GIS:Keskilinjat>([\s\S]*?)<\/GIS:Keskilinjat>/g)].map(m=>{const g=k=>new RegExp(`<GIS:${k}>([^<]*)<`).exec(m[1])?.[1]||'';
  return {id:g('LineId'),name:g('Kadunnimi'),part:g('Katuosalaji'),use:g('ToiminnallinenLuokka'),direction:+(/^(\d)/.exec(g('Kulkusuunta'))?.[1]||0),limit:parseInt(g('Nopeusrajoitus'))||0,points:positions(m[1]).map(p=>[p[0],p[1]])};}).filter(l=>l.points.length>1);
}
export function parseTrees(xml,conifer){
 return [...xml.matchAll(/gml:id="([^"]+)">[\s\S]*?<gml:pos[^>]*>([^<]+)</g)].map(m=>{const v=numbers(m[2]);return {id:m[1],e:v[0],n:v[1],conifer};});
}
// GIS:Kaupunginosat (districts, land and sea) → [{name, ring [[E,N]]}].
export function parseDistricts(xml){
 return [...xml.matchAll(/<GIS:Kaupunginosat>([\s\S]*?)<\/GIS:Kaupunginosat>/g)].map(m=>({name:/NIMI_FI>([^<]*)/.exec(m[1])?.[1]||'',
  rings:[...m[1].matchAll(/<gml:(?:exterior|interior)>([\s\S]*?)<\/gml:(?:exterior|interior)>/g)].map(r=>[...r[1].matchAll(/<gml:pos[^>]*>([^<]+)</g)].map(q=>numbers(q[1]).slice(0,2)))})).filter(d=>d.rings[0]?.length>2);
}
// Circular arc through a, b, c ([E,N]) as points every `step` metres (a straight line when they are collinear).
export function arcPoints(a,b,c,step=1.5){
 const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-9)return [a,c];
 const q=p=>p[0]*p[0]+p[1]*p[1],ux=(q(a)*(b[1]-c[1])+q(b)*(c[1]-a[1])+q(c)*(a[1]-b[1]))/d,uy=(q(a)*(c[0]-b[0])+q(b)*(a[0]-c[0])+q(c)*(b[0]-a[0]))/d,r=Math.hypot(a[0]-ux,a[1]-uy);
 const ang=p=>Math.atan2(p[1]-uy,p[0]-ux),t0=ang(a),sweep=t=>((t-t0)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
 let total=sweep(ang(c));if(sweep(ang(b))>total)total-=2*Math.PI; // b lies on the arc: pick the turning direction that passes it
 const n=Math.max(2,Math.ceil(Math.abs(total)*r/step)),out=[];for(let i=0;i<=n;i++){const t=t0+total*i/n;out.push(i===n?[c[0],c[1]]:[ux+r*Math.cos(t),uy+r*Math.sin(t)]);}
 return out;
}
// GIS:InfPark (the park register: lawns, meadows, woods, plantings, park paving) → [{id, kind, use, name, polygons [[ring [[E,N]]]]}].
// Rings are curves of line strings and circular arcs.
export function parseParks(xml){
 const ring=s=>{const out=[];for(const m of s.matchAll(/<gml:(LineStringSegment|Arc)>([\s\S]*?)<\/gml:\1>/g)){let p=[...m[2].matchAll(/<gml:pos[^>]*>([^<]+)</g)].map(q=>numbers(q[1]).slice(0,2));if(m[1]==='Arc'&&p.length===3)p=arcPoints(...p);for(const q of p)if(!out.length||Math.hypot(q[0]-out.at(-1)[0],q[1]-out.at(-1)[1])>.01)out.push(q);}return out;};
 return [...xml.matchAll(/<GIS:InfPark>([\s\S]*?)<\/GIS:InfPark>/g)].map(m=>{const g=k=>new RegExp(`<GIS:${k}>([^<]*)<`).exec(m[1])?.[1]||'';
  const polygons=[...m[1].matchAll(/<gml:PolygonPatch>([\s\S]*?)<\/gml:PolygonPatch>/g)].map(p=>[...p[1].matchAll(/<gml:(?:exterior|interior)>([\s\S]*?)<\/gml:(?:exterior|interior)>/g)].map(r=>ring(r[1])).filter(r=>r.length>2)).filter(p=>p.length);
  return {id:g('ID'),kind:g('PAVINGMATERIALTEXT').replace(/^0$/,''),use:g('PARTCLASSTEXT'),name:g('NAME'),polygons};}).filter(p=>p.kind&&p.polygons.length);
}
// Splits polylines where another line's end touches their interior (T-junctions), so a graph built
// from shared end nodes stays connected.
export function splitAtJunctions(lines,tolerance=.75){
 const cell=8,grid=new Map(),key=(x,z)=>`${Math.floor(x/cell)},${Math.floor(z/cell)}`;
 for(const l of lines)for(const p of [l.points[0],l.points.at(-1)]){const k=key(...p);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}
 const out=[];
 for(const l of lines){
  const cuts=[];
  for(let i=1;i<l.points.length;i++){const a=l.points[i-1],b=l.points[i],dx=b[0]-a[0],dz=b[1]-a[1],L2=dx*dx+dz*dz;if(!L2)continue;
   const seen=new Set();for(let x=Math.floor((Math.min(a[0],b[0])-1)/cell);x<=Math.floor((Math.max(a[0],b[0])+1)/cell);x++)for(let z=Math.floor((Math.min(a[1],b[1])-1)/cell);z<=Math.floor((Math.max(a[1],b[1])+1)/cell);z++)
    for(const p of grid.get(`${x},${z}`)||[]){if(seen.has(p))continue;seen.add(p);const t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/L2;if(t<=0||t>=1)continue;
     const q=[a[0]+dx*t,a[1]+dz*t];if(Math.hypot(q[0]-p[0],q[1]-p[1])>tolerance||Math.hypot(q[0]-a[0],q[1]-a[1])<tolerance||Math.hypot(q[0]-b[0],q[1]-b[1])<tolerance)continue;cuts.push({i,t,p});}}
  if(!cuts.length){out.push(l);continue;}
  cuts.sort((u,v)=>u.i-v.i||u.t-v.t);let cur=[l.points[0]],ci=0;
  for(let i=1;i<l.points.length;i++){while(ci<cuts.length&&cuts[ci].i===i){cur.push(cuts[ci].p);out.push({...l,points:cur});cur=[cuts[ci].p];ci++;}cur.push(l.points[i]);}
  out.push({...l,points:cur});
 }
 return out.filter(l=>l.points.length>1);
}
// Seam with a neighbouring area's graph: dead ends here move onto the neighbour's nearest dead end within
// maxGap, so the runtime merge (0.75 m snapping in src/extensions.js) joins the two networks.
export function joinSeam(graph,neighbour,maxGap=25){
 // A dead end has at most one distinct neighbouring node.
 const degree=g=>{const d=g.nodes.map(()=>new Set());for(const e of g.edges){d[e.from].add(e.to);d[e.to].add(e.from);}return d.map(s=>s.size);};
 const mine=degree(graph),theirs=degree(neighbour),ends=neighbour.nodes.map((p,i)=>({p,i})).filter(n=>theirs[n.i]===1),used=new Set();let joined=0;
 graph.nodes.forEach((p,i)=>{if(mine[i]!==1)return;let best=null,d=maxGap;for(const n of ends){if(used.has(n.i))continue;const q=Math.hypot(n.p[0]-p[0],n.p[1]-p[1]);if(q<d){d=q;best=n;}}
  if(!best)return;used.add(best.i);const to=[...best.p];graph.nodes[i]=to;
  for(const e of graph.edges){if(e.from===i)e.points[0]=to;if(e.to===i)e.points[e.points.length-1]=to;}joined++;});
 return joined;
}
