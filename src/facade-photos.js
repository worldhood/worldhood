// Geometry for matching street-level reference photos to the buildings they show.
// Pure functions shared by scripts/facade-photos.mjs and tests. Game frame: x east,
// z south; a compass heading h (0 = north, 90 = east) points along (sin h, -cos h).

export const slugify=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const rad=d=>d*Math.PI/180;
export const bearingOf=(dx,dz)=>(Math.atan2(dx,-dz)*180/Math.PI+360)%360;
export const angleDiff=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d;};

// Centre line of a street from its carriageway polygons: polygon centroids ordered along the
// street's main axis. Approximate, but plenty for choosing photos and fronting buildings.
export function streetLine(polygons,{from=-Infinity,to=Infinity}={}){
 const pts=polygons.map(p=>{const r=p.rings[0].slice(0,p.rings[0].length-(p.rings[0].length>1&&p.rings[0][0]+''===p.rings[0].at(-1)+''?1:0));let x=0,z=0;for(const q of r){x+=q[0];z+=q[1];}return [x/r.length,z/r.length];}).filter(([x])=>x>=from&&x<=to);
 if(pts.length<2)return pts;
 const mx=pts.reduce((a,p)=>a+p[0],0)/pts.length,mz=pts.reduce((a,p)=>a+p[1],0)/pts.length;
 let sxx=0,sxz=0,szz=0;for(const [x,z] of pts){sxx+=(x-mx)**2;sxz+=(x-mx)*(z-mz);szz+=(z-mz)**2;}
 const t=.5*Math.atan2(2*sxz,sxx-szz),ax=[Math.cos(t),Math.sin(t)];
 return pts.sort((a,b)=>(a[0]*ax[0]+a[1]*ax[1])-(b[0]*ax[0]+b[1]*ax[1])).map(p=>p.map(v=>+v.toFixed(1)));
}

// Where a point is relative to the street: distance along it, offset from it, which side,
// and (for a camera heading) whether it looks along the street, against it or to a side.
export function alongStreet(line,x,z,heading){
 let best=null,run=0;
 for(let i=1;i<line.length;i++){
  const [a,b]=[line[i-1],line[i]],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(!l)continue;
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(l*l))),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);
  if(!best||d<best.offset)best={offset:d,s:run+t*l,bearing:bearingOf(dx,dz),cross:dx*(z-a[1])-dz*(x-a[0])};
  run+=l;
 }
 const out={s:+best.s.toFixed(1),offset:+best.offset.toFixed(1),streetBearing:+best.bearing.toFixed(1)};
 if(heading!=null){const rel=((heading-best.bearing)%360+360)%360;out.view=rel<45||rel>315?'forward':rel>135&&rel<225?'backward':rel<180?'right':'left';}
 return out;
}

// Buildings with a wall facing the street within `reach` metres of its centre line: the longest
// run of wall roughly parallel to the street whose outward side faces it.
export function frontingBuildings(buildings,line,{reach=24,parts=null}={}){
 const height=parts?new Map(parts.map(p=>[p.id,p.height])):null,out=[];
 for(const b of buildings){
  const ring=b.rings[0];let area=0;for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];
  let front=null;
  for(let i=1;i<ring.length;i++){
   const [a,c]=[ring[i-1],ring[i]],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);if(len<3)continue;
   const m=[(a[0]+c[0])/2,(a[1]+c[1])/2],st=alongStreet(line,m[0],m[1]);if(st.offset>reach)continue;
   if(angleDiff(bearingOf(dx,dz)%180,st.streetBearing%180)>25&&angleDiff(bearingOf(dx,dz)%180,st.streetBearing%180)<155)continue;
   // Outward normal: rings may wind either way, so orient it by the signed area.
   const n=area>0?[dz/len,-dx/len]:[-dz/len,dx/len],toStreet=alongStreet(line,m[0]+n[0]*4,m[1]+n[1]*4).offset<st.offset;
   if(!toStreet)continue;
   if(!front||len>front.length)front={a:a.map(v=>+v.toFixed(1)),b:c.map(v=>+v.toFixed(1)),length:+len.toFixed(1),facing:+bearingOf(n[0],n[1]).toFixed(0),s:st.s,offset:st.offset};
  }
  if(front)out.push({id:b.id,address:b.address||'',name:b.name||'',height:height?.get(b.id)??b.height,front});
 }
 return out.sort((a,b)=>a.front.s-b.front.s);
}

// Photos that show a building's street front: camera in front of the wall, wall centre inside
// a ~70° field of view, not too far. Best first (closer, more frontal, newer).
export function photosShowing(building,photos,{fov=70,maxDistance=90}={}){
 const {a,b,facing}=building.front,m=[(a[0]+b[0])/2,(a[1]+b[1])/2],n=[Math.sin(rad(facing)),-Math.cos(rad(facing))];
 return photos.map(p=>{
  const dx=m[0]-p.x,dz=m[1]-p.z,d=Math.hypot(dx,dz),off=angleDiff(bearingOf(dx,dz),p.heading),front=-(dx*n[0]+dz*n[1]);
  if(d>maxDistance||d<4||off>fov/2||front<2)return null;
  const oblique=angleDiff(p.heading,(facing+180)%360);
  return {id:p.id,distance:+d.toFixed(0),offAxis:+off.toFixed(0),oblique:+oblique.toFixed(0),captured:p.captured,score:d/30+off/25+oblique/60-(+p.captured.slice(0,4)-2015)*.15};
 }).filter(Boolean).sort((x,y)=>x.score-y.score).map(({score,...p})=>p);
}

// One photo per `spacing` metres for each view (forward, backward, left, right): newest daylight
// summer shot wins. Mapillary times are UTC; the hour window suits Nordic daylight.
export function pickPhotos(photos,{spacing=35}={}){
 const best=new Map(),rank=p=>{const month=+p.captured.slice(5,7),hour=p.hourUtc??10;return +p.captured.slice(0,4)+(month>=4&&month<=9?1.5:0)+(hour>=6&&hour<=15?2:0);};
 for(const p of photos){const key=`${p.view}:${Math.floor(p.s/spacing)}`,cur=best.get(key);if(!cur||rank(p)>rank(cur))best.set(key,p);}
 return [...best.values()].sort((a,b)=>a.s-b.s);
}
