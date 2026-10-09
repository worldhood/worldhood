import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SKY_PALETTE} from './sky.js';

// Senate Square → Aleksanterinkatu → Mikonkatu corridor: parameterised, photo-guided
// street elevations replacing the smeared municipal photo atlases. The measured
// LOD2 wall/roof triangles are kept (recoloured); every element here is clipped to
// the actual wall triangles of each coplanar face piece so nothing floats over
// courtyard gaps or roof slopes. Nothing here is a survey of ornament.
//
// Plane convention follows analyseBuilding(): a face has outward normal n=(nx,nz),
// offset d=n·p, local abscissa s=x*nz-z*nx (metres), height y. `span` is the
// façade extent in s over which the bay grid is laid out; pieces of the same
// front at slightly different d share that grid.

const srgb=hex=>new THREE.Color(hex).convertSRGBToLinear();
export const hexRGB=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);

// ---------------------------------------------------------------- geometry batch
class Batch{
 constructor(){this.geometries=[];this.triangles=0;}
 add(g,color){
  if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');
  const n=g.attributes.position.count;
  if(!g.attributes.color){const c=new Float32Array(n*3);for(let i=0;i<n;i++){c[i*3]=color.r;c[i*3+1]=color.g;c[i*3+2]=color.b;}g.setAttribute('color',new THREE.BufferAttribute(c,3));}
  this.geometries.push(g);this.triangles+=n/3;
 }
 finish(){if(!this.geometries.length)return null;const g=mergeGeometries(this.geometries);this.geometries.forEach(x=>x.dispose());g.computeBoundingSphere();return g;}
}
// Local frame of one coplanar wall piece.
class Frame{
 constructor(face){this.nx=face.normal.x;this.nz=face.normal.z;this.d=face.d;this.rot=Math.atan2(this.nx,this.nz);this.tris=face.triangles||[];this.s0=face.s0;this.s1=face.s1;this.y0=face.y0;this.y1=face.y1;}
 covered(s,y){
  for(const {local:[a,b,c]} of this.tris){
   const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;
   const p=((b[1]-c[1])*(s-c[0])+(c[0]-b[0])*(y-c[1]))/den,q=((c[1]-a[1])*(s-c[0])+(a[0]-c[0])*(y-c[1]))/den;
   if(p>=-1e-6&&q>=-1e-6&&p+q<=1+1e-6)return true;
  }
  return false;
 }
 rect(s0,s1,y0,y1,m=.12){for(const u of [0,.5,1])for(const v of [0,.5,1])if(!this.covered(s0-m+u*(s1-s0+2*m),y0-m+v*(y1-y0+2*m)))return false;return true;}
 // Horizontal runs along y that lie on real wall (0.5 m sampling), within [a,b].
 runs(y,a=this.s0,b=this.s1){
  const out=[];let start=null;
  for(let s=Math.max(a,this.s0)+.25;s<=Math.min(b,this.s1);s+=.5){
   const on=this.covered(s,y)&&this.covered(s,y+.12)&&this.covered(s,y-.12);
   if(on&&start===null)start=s-.25;else if(!on&&start!==null){out.push([start,s-.25]);start=null;}
  }
  if(start!==null)out.push([start,Math.min(b,this.s1)]);
  return out.filter(([p,q])=>q-p>.6);
 }
 place(g,s,y,e){g.rotateY(this.rot);g.translate(this.nx*(this.d+e)+this.nz*s,y,this.nz*(this.d+e)-this.nx*s);return g;}
}

// ---------------------------------------------------------------- glazing
// No environment map in the scene, so a pane 'reflects the sky' through its vertex
// colours: the top of each pane leans toward the sky's mid/horizon tones, the bottom
// toward the tinted glass colour (a cheap Fresnel-like gradient). A deterministic hash
// of the pane position adds a few percent variation, an occasional pale curtain/blind
// and a small share of warm lit interiors. Shop glazing is lit from inside.
const SKY_TOP=srgb(SKY_PALETTE.mid),SKY_LOW=srgb(SKY_PALETTE.horizon);
const CURTAIN=srgb('#d9d3c4'),WARM=srgb('#e8c58a'),SHOP_INTERIOR=srgb('#f1e4c9'),SHOP_DISPLAY=srgb('#f7eedb');
const hash=(a,b)=>{const x=Math.sin(a*12.9898+b*78.233)*43758.5453;return x-Math.floor(x);};
function tintGlass(g,h,base,s,y,shop=false){
 const pos=g.attributes.position,n=pos.count,c=new Float32Array(n*3),r=hash(s,y),r2=hash(y,s);
 const gain=.94+r*.12;
 let interior=null,mix=0;
 if(shop){interior=r>.5?SHOP_DISPLAY:SHOP_INTERIOR;mix=.62;}
 else if(r2<.14){interior=CURTAIN;mix=.55;}
 else if(r2<.22){interior=WARM;mix=.45;}
 const tmp=new THREE.Color();
 for(let i=0;i<n;i++){
  const v=Math.min(1,Math.max(0,pos.getY(i)/h+.5));          // 0 bottom .. 1 top of pane
  if(shop){tmp.copy(base).lerp(interior,.8).lerp(SKY_TOP,.3*v*v);}        // lit display behind a sky-reflecting top edge
  else{tmp.copy(base).lerp(SKY_LOW,.25+.35*v).lerp(SKY_TOP,.18*v*v);     // reflection grows toward the top
   if(interior)tmp.lerp(interior,mix*(1-.5*v));}
  tmp.multiplyScalar(gain);
  c[i*3]=tmp.r;c[i*3+1]=tmp.g;c[i*3+2]=tmp.b;
 }
 g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;
}
function glass(F,G,s,y,e,w,h,ctx,arch=false,shop=false){
 const g=arch?new THREE.ShapeGeometry(opening(w,h,true),6):new THREE.PlaneGeometry(w,h,1,2);
 G.add(F.place(tintGlass(g,h,ctx.glass,s,y,shop),s,y,e),ctx.glass);
}

// ---------------------------------------------------------------- primitives
function opening(w,h,arch){
 const sh=new THREE.Shape();
 if(arch){const r=w/2;sh.moveTo(-r,-h/2);sh.lineTo(r,-h/2);sh.lineTo(r,h/2-r);sh.absarc(0,h/2-r,r,0,Math.PI,false);sh.lineTo(-r,-h/2);}
 else{sh.moveTo(-w/2,-h/2);sh.lineTo(w/2,-h/2);sh.lineTo(w/2,h/2);sh.lineTo(-w/2,h/2);sh.lineTo(-w/2,-h/2);}
 return sh;
}
function box(F,B,s,y,e,w,h,depth,color){B.add(F.place(new THREE.BoxGeometry(w,h,depth),s,y,e),color);}
function quad(F,B,s,y,e,w,h,color,arch=false){B.add(F.place(arch?new THREE.ShapeGeometry(opening(w,h,true),6):new THREE.PlaneGeometry(w,h),s,y,e),color);}
function ring(F,B,s,y,e,w,h,t,color,arch=false){const sh=opening(w+2*t,h+2*t,arch);sh.holes.push(new THREE.Path(opening(w,h,arch).getPoints(arch?8:1)));B.add(F.place(new THREE.ShapeGeometry(sh,arch?8:1),s,y,e),color);}
function triangle(F,B,s,y,e,w,h,depth,color){const sh=new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(0,h)]);B.add(F.place(new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false}),s,y,e),color);}
function band(F,B,y,h,depth,color,a,b,e=0){for(const [p,q] of F.runs(y,a,b))box(F,B,(p+q)/2,y,e+depth/2,q-p,h,depth,color);}
function column(F,B,s,y0,h,r,e,color,segments=10){
 box(F,B,s,y0+.12,e,r*2.6,.24,r*2.6,color);
 B.add(F.place(new THREE.CylinderGeometry(r*.86,r,h-.7,segments),s,y0+.24+(h-.7)/2,e),color);
 box(F,B,s,y0+h-.2,e,r*2.4,.4,r*2.4,color);
}

// ---------------------------------------------------------------- façade elements
function windowAt(F,O,G,ctx,s,y,w,h,st){
 const arch=st.type==='arch',e=.05;
 if(!F.rect(s-w/2-.3,s+w/2+.3,y-h/2-.35,y+h/2+.45))return false;
 glass(F,G,s,y,e,w,h,ctx,arch);
 const frame=st.frame||ctx.frame;
 ring(F,O,s,y,e+.10,w,h,st.t||.11,frame,arch);
 if(ctx.detail){
  // Jambs give the opening a reveal; mullion and transom read as a real sash.
  for(const dx of [-w/2-.05,w/2+.05])box(F,O,s+dx,y-(arch?w/4:0),e+.05,.10,h-(arch?w/2:0)+.1,.14,frame);
  box(F,O,s,y-(arch?w/4:0),e+.08,.05,h-(arch?w/2:0),.05,frame);
  if(h>1.6)box(F,O,s,y+h*(st.transom||.18),e+.08,w,.05,.05,frame);
 }
 if(st.sill!==false)box(F,O,s,y-h/2-.09,e+.13,w+.36,.11,.26,ctx.trim);
 if(st.head==='lintel')box(F,O,s,y+h/2+.18,e+.11,w+.46,.17,.22,ctx.trim);
 else if(st.head==='cornice'){box(F,O,s,y+h/2+.16,e+.08,w+.5,.12,.16,ctx.trim);box(F,O,s,y+h/2+.3,e+.16,w+.7,.14,.32,ctx.trim);}
 else if(st.head==='pediment'){box(F,O,s,y+h/2+.16,e+.1,w+.5,.14,.2,ctx.trim);triangle(F,O,s,y+h/2+.23,e,w+.7,(w+.7)*.22,.22,ctx.trim);}
 else if(st.head==='arch'){box(F,O,s,y+h/2-w/2,e+.12,.14,.14,.3,ctx.trim);}
 if(st.apron)box(F,O,s,y-h/2-.45,e+.06,w-.1,.4,.08,ctx.trim);
 return true;
}
function shopBay(F,O,G,ctx,s,w,g,st){
 const riser=st.riser??.6,h=g-.75-riser,y=riser+.1+h/2,e=.04,frame=st.frame||ctx.dark;
 if(!F.rect(s-w/2-.2,s+w/2+.2,.3,g-.3))return false;
 glass(F,G,s,y,e,w,h,ctx,false,true);
 ring(F,O,s,y,e+.08,w,h,.14,frame);
 // Mullions and a transom bar so the front reads as a glazed shop, not a hole.
 const panes=Math.max(1,Math.round(w/1.35));
 for(let i=1;i<panes;i++)box(F,O,s-w/2+i*w/panes,y,e+.07,.07,h,.07,frame);
 if(h>2.2)box(F,O,s,y+h/2-.75,e+.07,w,.07,.07,frame);
 if(ctx.detail)for(const dx of [-w/2-.07,w/2+.07])box(F,O,s+dx,y,e+.04,.14,h+.3,.12,frame);
 if(riser>0)box(F,O,s,riser/2+.05,e+.1,w+.3,riser,.2,st.riserColor||ctx.dark);
 if(st.door){const dx=st.door.dx||0;box(F,O,s+dx,1.3,e+.2,1.5,2.6,.1,frame);const d=new THREE.PlaneGeometry(1.2,2.3,1,2);G.add(F.place(tintGlass(d,2.3,ctx.glass,s+dx,1.3,true),s+dx,1.3,e+.26),ctx.glass);box(F,O,s+dx,2.7,e+.3,1.9,.16,.3,ctx.trim);}
 if(st.awning&&ctx.detail){const a=new THREE.BoxGeometry(w*.9,.06,1.1);a.rotateX(-.35);O.add(F.place(a,s,g-1.0,e+.5),st.awning===true?ctx.dark:srgb(st.awning));}
 return true;
}
function bayCentres(front,span,face){
 const [a,b]=span,w=b-a;
 // A narrow fragment of an articulated front lays its bays out locally so that the
 // shared grid does not leave it blank.
 if(face&&!front.bays){const pitch=front.pitch||3.5,fw=face.s1-face.s0;if(fw<2.2*pitch&&fw>1.6){const n=Math.max(1,Math.floor(fw/pitch));return Array.from({length:n},(_,i)=>face.s0+fw/2+(i-(n-1)/2)*pitch);}}
 if(front.bays){const m=front.margin??1.6,n=front.bays;return Array.from({length:n},(_,i)=>n===1?(a+b)/2:a+m+i*(w-2*m)/(n-1));}
 const pitch=front.pitch||3.5,phase=front.phase??pitch/2,out=[];for(let s=a+phase;s<b-.4;s+=pitch)out.push(s);return out;
}

// Builds one front (or side) spec on one coplanar face piece.
export function buildFacadePiece(face,front,building,O,G,detail){
 const F=new Frame(face);
 const ctx={glass:srgb(front.glass||building.glass||'#243640'),trim:srgb(front.trim||building.trim||'#e8e3d6'),frame:srgb(front.frame||front.trim||building.frame||building.trim||'#e8e3d6'),dark:srgb(front.dark||building.dark||'#2f3133'),stone:srgb(front.stone||building.stone||'#8a857b'),wall:srgb(front.wall||building.wall),detail};
 const span=front.span||[face.s0,face.s1],top=front.top??face.y1,g=front.ground?.h??0;
 // Plinth and ground-floor treatment.
 if(front.base!==false)band(F,O,(front.base?.h||.55)/2,front.base?.h||.55,.14,ctx.stone,span[0],span[1]);
 if(front.ground?.type==='rustic'){for(let y=front.ground.from??1.0;y<g-.5;y+=front.ground.course||.62)band(F,O,y,.05,.035,srgb(front.ground.joint||'#8c8470'),span[0],span[1]);}
 if(front.ground?.fascia!==false&&front.ground?.type==='shop')band(F,O,g-.42,.62,.14,srgb(front.ground.fascia||front.dark||building.dark||'#2f3133'),span[0],span[1]);
 const centres=bayCentres(front,span,face),stats={windows:0},wmax=Math.max(.8,(face.s1-face.s0)-1.0);
 for(const [i,s] of centres.entries()){
  if(s<face.s0-.5||s>face.s1+.5)continue;
  const skip=front.skip?.includes(i);
  if(front.ground?.type==='shop'&&!skip){const w=Math.min(front.ground.w||((centres[1]-centres[0])||3.6)*.74,(centres[1]-centres[0]||4)-1.0);if(shopBay(F,O,G,ctx,s,w,g,{door:front.doors?.includes(i)?{}:null,awning:front.ground.awning,frame:front.ground.frame&&srgb(front.ground.frame)}))stats.windows++;}
  else if(front.ground?.type==='arcade'&&!skip){const w=front.ground.w||2.4,h=g-1.2;if(F.rect(s-w/2-.3,s+w/2+.3,.3,g-.3)){glass(F,G,s,.4+h/2,.05,w,h,ctx,true,true);ring(F,O,s,.4+h/2,.15,w,h,.16,ctx.trim,true);stats.windows++;}}
  else if(front.ground?.type==='windows'&&!skip){const st=front.ground.window||{};if(windowAt(F,O,G,ctx,s,st.y??(g/2+.3),st.w??1.4,st.h??2.2,{type:st.type||'rect',head:st.head||'none',sill:st.sill!==false,frame:st.frame&&srgb(st.frame),apron:st.apron}))stats.windows++;}
  for(const st of front.storeys||[]){
   if(skip&&!st.always)continue;
   const w=Math.min(st.w??1.4,wmax),h=st.h??2.1,y=st.y+h/2;
   if(y+h/2>top-.2)continue;
   if(windowAt(F,O,G,ctx,s+(st.dx||0),y,w,h,{...st,frame:st.frame&&srgb(st.frame)}))stats.windows++;
   if(st.pair){if(windowAt(F,O,G,ctx,s-st.pair,y,w,h,{...st,frame:st.frame&&srgb(st.frame)}))stats.windows++;}
  }
 }
 // Horizontal articulation: string courses, storey bands, cornice, parapet.
 for(const b of front.bands||[])band(F,O,b.y,b.h||.22,b.depth||.26,b.color?srgb(b.color):ctx.trim,span[0],span[1]);
 if(front.cornice!==false){const c=front.cornice||{};const y=c.y??top,depth=c.depth??.55;
  band(F,O,y-.38,.28,depth*.55,c.color?srgb(c.color):ctx.trim,span[0],span[1]);
  band(F,O,y-.12,.24,depth,c.color?srgb(c.color):ctx.trim,span[0],span[1]);
  if(c.dentils&&detail)for(const [p,q] of F.runs(y-.6,span[0],span[1]))for(let s=p+.25;s<q;s+=.5)box(F,O,s,y-.6,.12,.2,.18,.24,ctx.trim);
 }
 if(front.parapet)band(F,O,top+front.parapet.h/2,front.parapet.h,.3,front.parapet.color?srgb(front.parapet.color):ctx.wall,span[0],span[1]);
 // Vertical articulation: pilasters / piers between or on bays, corner quoins.
 if(front.pilasters){const p=front.pilasters,at=p.at||'between';const list=at==='bays'?centres:Array.isArray(at)?at:centres.slice(0,-1).map((s,i)=>(s+centres[i+1])/2);
  for(const s of list)if(F.rect(s-p.w/2,s+p.w/2,p.y0,p.y1,.05)){box(F,O,s,(p.y0+p.y1)/2,p.depth/2,p.w,p.y1-p.y0,p.depth,p.color?srgb(p.color):ctx.wall);if(p.capital!==false){box(F,O,s,p.y1-.12,p.depth/2+.03,p.w+.3,.24,p.depth+.06,ctx.trim);box(F,O,s,p.y0+.1,p.depth/2+.02,p.w+.2,.2,p.depth+.04,ctx.trim);}}}
 if(front.extras)front.extras({F,O,G,ctx,box,quad,glass,ring,triangle,band,column,windowAt,face,span,top,centres,srgb});
 return stats;
}

// Generic treatment for the side/rear faces of a corridor building: same colour
// family and storey levels as its street front, plain openings, no ornament.
function sideSpec(building){
 const base=building.fronts[0];
 return {pitch:3.4,phase:1.7,storeys:(base.storeys||[]).map(st=>({y:st.y,h:Math.min(st.h??2.1,2.2),w:Math.min(st.w??1.3,1.4),type:'rect',head:'none',sill:true})),ground:base.ground?.type==='shop'?{type:'windows',h:base.ground.h,window:{y:base.ground.h/2+.2,w:1.4,h:Math.min(2.6,base.ground.h-1.6)}}:(base.ground?{type:'windows',h:base.ground.h,window:{...base.ground.window,y:base.ground.h/2+.2}}:null),cornice:{depth:.35},base:base.base};
}
export function corridorFront(building,face){
 let best=null,error=Infinity;
 for(const f of building.fronts){
  const dot=f.n[0]*face.normal.x+f.n[1]*face.normal.z,offset=Math.abs(face.d-f.d);
  if(dot>.985&&offset<(f.tol??1.6)&&offset<error&&face.s1>(f.span?.[0]??-1e9)-1&&face.s0<(f.span?.[1]??1e9)+1){best=f;error=offset;}
 }
 return best;
}
export function createCorridorFacade(part,faces,building){
 const O=new Batch(),G=new Batch();let windows=0;
 for(const face of faces){
  const w=face.s1-face.s0,h=face.y1-face.y0;
  const front=corridorFront(building,face);
  if(!front&&(w<1.8||h<5||face.y0>3))continue;
  windows+=buildFacadePiece(face,front||building.side||sideSpec(building),building,O,G,!!front).windows;
 }
 const meshes=[];
 const og=O.finish(),gg=G.finish();
 if(og)meshes.push({geometry:og,material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.02})});
 if(gg)meshes.push({geometry:gg,material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.2,metalness:.08})});
 return {meshes,windows,triangles:O.triangles+G.triangles};
}

// ---------------------------------------------------------------- helpers for the table
// Evenly spaced upper storeys between the ground floor and the cornice.
export function storeys(from,to,count,win={}){
 const floor=(to-from)/count,h=win.h??Math.min(2.3,floor*.58);
 return Array.from({length:count},(_,i)=>({y:from+i*floor+(floor-h)*.5-(win.lift||0),h,w:win.w??1.35,type:win.type||'rect',head:win.head||'none',sill:win.sill!==false,t:win.t,apron:win.apron}));
}

// ---------------------------------------------------------------- the corridor table
// Planes (n, d, span, top) are measured from the municipal LOD2 mesh. Storey
// counts, window types and colours are photo-guided or source-stated;
// unverified values are deliberately plain.
const N=[-.05,-.999],S=[.05,.999],E=[1,-.05],W=[-1,.05];
const rustication=(joint='#b89a5c')=>({F,O,box,span})=>{for(let y=1.0;y<4.4;y+=.6)for(const [p,q] of F.runs(y,span[0],span[1]))box(F,O,(p+q)/2,y,.015,q-p,.05,.03,srgb(joint));};
// Empire-era storey set shared by the Senate Square south side (3 storeys: shop/
// rusticated ground, framed piano nobile, plainer upper floor).
const empireUpper=(nobile='cornice')=>[{y:5.9,h:2.55,w:1.45,head:nobile},{y:9.75,h:1.9,w:1.35,head:'none'}];
export const ALEKSANTERINKATU_BUILDINGS={
 // University of Helsinki main building (C. L. Engel 1832; Sirén 1937 wings): Senate
 // Square front with the Ionic portico and pediment; Aleksanterinkatu side in the
 // same Empire vocabulary (Sirén's wings imitate it).
 328:{name:'University main building',wall:'#e9ddb4',trim:'#f3f0e6',stone:'#8f8b80',glass:'#5f7f93',roof:'#5f6b67',
  fronts:[
   {n:E,d:-82.8,tol:1.5,span:[-107.3,-23.4],top:23.0,bays:23,margin:2.1,
    ground:{type:'windows',h:6.4,window:{y:3.3,w:1.5,h:2.9,head:'none'}},
    base:{h:.9},bands:[{y:6.45,h:.34,depth:.3},{y:13.9,h:.2,depth:.18},{y:20.3,h:.3,depth:.3}],
    storeys:[{y:8.3,h:3.3,w:1.55,type:'rect',head:'cornice',sill:true},{y:15.6,h:2.5,w:1.45,type:'rect',head:'none',sill:true}],
    cornice:{y:23.0,depth:.8,dentils:true},skip:[8,9,10,11,12,13,14],
    extras:({F,O,G,ctx,box,column,windowAt,triangle})=>{
     // Central risalit: rusticated ground floor, six Ionic columns through two
     // storeys, projecting entablature and pediment (mesh profile rises to 25 m).
     const c=(-107.3-23.4)/2,w=24.4;
     for(let y=1.0;y<6.2;y+=.62)box(F,O,c,y,.02,w,.05,.035,srgb('#9c927a'));
     for(let i=0;i<7;i++){const s=c-w/2+1.6+i*(w-3.2)/6;windowAt(F,O,G,ctx,s,3.4,1.5,3.2,{type:'arch',head:'arch',sill:true});windowAt(F,O,G,ctx,s,9.95,1.55,3.3,{type:'rect',head:'cornice',sill:true});windowAt(F,O,G,ctx,s,16.85,1.45,2.5,{type:'rect',head:'none',sill:true});if(i<6)column(F,O,c-w/2+1.6+(i+.5)*(w-3.2)/6,6.6,13.4,.62,1.25,ctx.trim,12);}
     box(F,O,c,20.0,.8,w+.6,.5,2.2,ctx.trim);box(F,O,c,20.9,.9,w+.9,.9,2.6,ctx.trim);box(F,O,c,21.55,.95,w+1.2,.3,2.9,ctx.trim);
     triangle(F,O,c,21.7,.3,w+1.0,3.1,1.9,ctx.wall);box(F,O,c,21.75,1.3,w+1.6,.3,2.4,ctx.trim);
     for(const sign of [-1,1]){const g=new THREE.BoxGeometry(13.5,.28,2.2);g.rotateZ(-sign*Math.atan2(3.1,(w+1.0)/2));O.add(F.place(g,c+sign*(w+1.0)/4,21.75+1.55,1.3),ctx.trim);}
    }},
   {n:S,d:108,tol:2.2,span:[-157.5,-81.9],top:22.7,pitch:3.55,phase:1.8,
    ground:{type:'windows',h:6.4,window:{y:3.3,w:1.5,h:2.9}},base:{h:.9},
    bands:[{y:6.45,h:.34,depth:.3},{y:13.9,h:.2,depth:.18},{y:20.3,h:.3,depth:.3}],
    storeys:[{y:8.3,h:3.3,w:1.55,head:'cornice'},{y:15.6,h:2.5,w:1.45,head:'none'}],cornice:{y:22.7,depth:.7},extras:rustication('#a89a78')},
   {n:S,d:106.71,tol:.8,span:[-138,-102.4],top:12,pitch:3.55,phase:1.8,ground:{type:'windows',h:6.4,window:{y:3.3,w:1.5,h:2.9}},base:{h:.9},bands:[{y:6.45,h:.34,depth:.3}],storeys:[{y:8.1,h:2.6,w:1.5,head:'lintel'}],cornice:{y:12,depth:.5},extras:rustication('#a89a78')},
  ]},
 // Kiseleff house (Aleksanterinkatu 28 / Unioninkatu 27; Engel 1822–24) and Sunn
 // house (26; Empire front 1833–34): warm yellow render, rusticated shop ground
 // floor, framed piano nobile with ledges, central risalit with two-storey pilasters.
 219:{name:'Kiseleff & Sunn houses',wall:'#e4c47c',trim:'#f1ece0',stone:'#6f6a66',dark:'#2d2f31',glass:'#5c7892',roof:'#55605c',
  fronts:[
   {n:N,d:-123.98,tol:1.2,span:[18.3,65.5],top:12.9,pitch:3.55,phase:1.9,base:{h:.5},
    bands:[{y:4.95,h:.42,depth:.3},{y:9.0,h:.16,depth:.14}],storeys:empireUpper(),cornice:{y:12.9,depth:.6,dentils:true},
    ground:{type:'shop',h:4.9,w:2.4,fascia:'#e4c47c'},doors:[6],extras:rustication()},
   {n:W,d:64.92,tol:1.6,span:[124.3,171.9],top:15.6,pitch:3.55,phase:1.6,base:{h:.5},
    bands:[{y:4.95,h:.42,depth:.3},{y:9.0,h:.16,depth:.14}],storeys:empireUpper(),cornice:{y:13.2,depth:.6,dentils:true},
    ground:{type:'shop',h:4.9,w:2.4,fascia:'#e4c47c'},doors:[4],pilasters:{at:[131.5,134.8,138.1],w:1.0,y0:5.0,y1:12.9,depth:.16,color:'#f1ece0'},extras:rustication()},
  ]},
 // Leijona block, Senate Square south side: Hellenius house (24, Wik 1835),
 // Burtz house (22, Wik 1836, nine axes, gateway, pale yellow, line rustication)
 // and Bock house (20, Engel 1816–19, pediment on Ionic columns, balcony).
 217:{name:'Aleksanterinkatu 20–24 (Leijona block)',wall:'#e6cf92',trim:'#f2eee4',stone:'#77726c',dark:'#33302c',glass:'#5c7892',roof:'#58635f',
  fronts:[
   {n:N,d:-124.25,tol:.9,span:[-43,7.6],top:14.8,pitch:3.4,phase:1.7,base:{h:.5},ground:{type:'windows',h:4.6,window:{y:2.5,w:1.4,h:2.4,head:'none'}},doors:[7],
    bands:[{y:4.7,h:.3,depth:.26},{y:9.6,h:.14,depth:.12}],storeys:[{y:5.6,h:2.5,w:1.4,head:'lintel'},{y:10.1,h:2.1,w:1.3,head:'none'}],cornice:{y:14.8,depth:.55,dentils:true},extras:({F,O,ctx,box,...r})=>{rustication('#b89a5c')({F,O,box,span:r.span});box(F,O,-18.2,2.3,.1,2.6,4.2,.12,ctx.dark);box(F,O,-18.2,4.55,.25,3.2,.3,.4,ctx.trim);}},
   {n:N,d:-122.64,tol:.9,span:[-53.9,-42.4],top:16.2,pitch:3.0,phase:1.5,base:{h:.5},ground:{type:'windows',h:4.6,window:{y:2.5,w:1.4,h:2.4,head:'none'}},
    bands:[{y:4.7,h:.3,depth:.26}],storeys:[{y:5.6,h:2.6,w:1.4,head:'lintel'},{y:10.3,h:2.1,w:1.3}],cornice:{y:14.4,depth:.55,dentils:true},
    extras:({F,O,ctx,box,column,triangle,span})=>{rustication('#b89a5c')({F,O,box,span});const c=(span[0]+span[1])/2;for(let i=0;i<4;i++)column(F,O,c-4.5+i*3,4.9,9.6,.42,.55,ctx.trim,10);box(F,O,c,5.0,.9,10.5,.3,1.9,ctx.trim);box(F,O,c,14.3,.7,11,.5,1.6,ctx.trim);triangle(F,O,c,14.55,.2,11.4,1.6,1.3,ctx.wall);box(F,O,c,14.6,1.0,11.8,.22,1.8,ctx.trim);}},
   {n:N,d:-123.71,tol:.9,span:[-65.6,-55.7],top:14.8,pitch:3.3,phase:1.6,base:{h:.5},ground:{type:'windows',h:4.6,window:{y:2.5,w:1.4,h:2.4,head:'none'}},
    bands:[{y:4.7,h:.3,depth:.26}],storeys:[{y:5.6,h:2.6,w:1.4,head:'lintel'},{y:10.3,h:2.1,w:1.3}],cornice:{y:14.8,depth:.55,dentils:true},extras:rustication('#b89a5c')},
  ]},
 // Elefantti block: Sederholm house (18, 1757, two storeys + attic, rusticated
 // ground floor, pedimented central risalits), Remander (16) and Brummer (14).
 22:{name:'Sederholm house / Aleksanterinkatu 14–18',wall:'#e3d4a8',trim:'#f1ece1',stone:'#6d6963',dark:'#30302d',glass:'#5c7892',roof:'#4f5a56',
  fronts:[
   {n:N,d:-124.84,tol:1.2,span:[-127.5,-73.3],top:11,pitch:3.3,phase:1.6,base:{h:.5},ground:{type:'windows',h:4.2,window:{y:2.0,w:1.3,h:2.1,head:'none'}},
    bands:[{y:4.3,h:.26,depth:.22}],storeys:[{y:5.4,h:2.2,w:1.3,head:'lintel'},{y:8.6,h:1.5,w:1.2,head:'none'}],cornice:{depth:.5},extras:rustication('#b8a06c')},
   {n:W,d:-76.64,tol:1.2,span:[122.8,186.8],top:15.3,pitch:3.3,phase:1.6,base:{h:.5},ground:{type:'windows',h:4.2,window:{y:2.0,w:1.3,h:2.1,head:'none'}},
    bands:[{y:4.3,h:.26,depth:.22}],storeys:[{y:5.4,h:2.2,w:1.3,head:'lintel'},{y:8.6,h:1.5,w:1.2,head:'none'}],cornice:{depth:.5},extras:rustication('#b8a06c')},
  ]},
 // Former Pohjoismaiden Yhdyspankki head office (Frosterus & Gripenberg 1934–36):
 // red granite, 6–7 storeys, pilasters between the Aleksanterinkatu windows;
 // bronze frames, dark shop zone with awnings (2024 photography on Unioninkatu).
 333:{name:'Aleksanterinkatu 30–34 (PYP bank)',wall:'#a88b7b',trim:'#bda597',frame:'#c4a46e',stone:'#5a4f48',dark:'#2b2a28',glass:'#5f7f93',roof:'#4d5250',
  fronts:[
   {n:N,d:-123.49,tol:1.4,span:[83.5,159.1],top:23.9,pitch:3.1,phase:1.55,base:{h:.6},ground:{type:'shop',h:5.0,fascia:'#2b2a28',awning:'#7a2b2b'},doors:[12],
    storeys:storeys(5.3,23.0,5,{w:1.75,h:2.2,head:'none',sill:true,t:.1}),cornice:{depth:.4,color:'#8d7667'},pilasters:{at:'between',w:.5,y0:5.3,y1:23.0,depth:.22,color:'#b89b8a',capital:false}},
   {n:E,d:-82.39,tol:1.4,span:[-165.2,-124],top:24,pitch:3.1,phase:1.55,base:{h:.6},ground:{type:'shop',h:5.0,fascia:'#2b2a28',awning:'#7a2b2b'},doors:[3],
    storeys:storeys(5.3,23.0,5,{w:1.75,h:2.2,head:'none',sill:true,t:.1}),cornice:{depth:.4,color:'#8d7667'}},
  ]},
 // Aleksanterinkatu 36 A / Fabianinkatu 16 (Gripenberg 1936–37, six storeys,
 // 1960s metal-panel recladding): plain grid. Colour unverified.
 336:{name:'Aleksanterinkatu 36 A / Fabianinkatu 16',wall:'#8f8a80',trim:'#a39d92',frame:'#3b3a37',stone:'#55524d',dark:'#2f3032',glass:'#5f7f93',roof:'#56605c',
  fronts:[{n:N,d:-124.32,tol:1.2,span:[172.8,189.7],top:21.1,pitch:2.9,phase:1.45,base:{h:.55},ground:{type:'shop',h:4.6},storeys:storeys(4.9,20.6,5,{w:2.0,h:1.9,head:'none',t:.08}),cornice:{depth:.3,color:'#a39d92'},bands:[{y:8.1,h:.12,depth:.06,color:'#a39d92'},{y:11.25,h:.12,depth:.06,color:'#a39d92'},{y:14.4,h:.12,depth:.06,color:'#a39d92'},{y:17.55,h:.12,depth:.06,color:'#a39d92'}]},
   {n:E,d:-172.45,tol:1.2,span:[-159.2,-124],top:21.1,pitch:2.9,phase:1.45,base:{h:.55},ground:{type:'shop',h:4.6},storeys:storeys(4.9,20.6,5,{w:2.0,h:1.9,head:'none',t:.08}),cornice:{depth:.3,color:'#a39d92'}}]},
 // Old Yhdyspankki house, Aleksanterinkatu 36 B (Nyström 1896–98): four storeys of
 // red Hanko granite, late Neo-Renaissance; arched ground floor.
 337:{name:'Aleksanterinkatu 36 B (old Yhdyspankki)',wall:'#9d6a5c',trim:'#b08274',frame:'#4d3a33',stone:'#6c4a42',dark:'#2d2f31',glass:'#5f7f93',roof:'#56605c',
  fronts:[{n:N,d:-124.4,tol:1.2,span:[189.5,233.7],top:18,pitch:3.6,phase:1.8,base:{h:.7},ground:{type:'arcade',h:5.4,w:2.3},
    bands:[{y:5.5,h:.4,depth:.32,color:'#b08274'},{y:9.9,h:.22,depth:.2,color:'#b08274'},{y:13.9,h:.22,depth:.2,color:'#b08274'}],
    storeys:[{y:6.4,h:2.5,w:1.5,head:'cornice',t:.12},{y:10.6,h:2.3,w:1.5,head:'lintel',t:.12},{y:14.5,h:2.0,w:1.4,head:'none',t:.12}],cornice:{depth:.6,color:'#b08274',dentils:true},
    extras:({F,O,box,span})=>{for(let y=1.1;y<5.1;y+=.55)for(const [p,q] of F.runs(y,span[0],span[1]))box(F,O,(p+q)/2,y,.015,q-p,.05,.04,srgb('#6a4b43'));}}]},
 // Fazer house, Kluuvikatu 3 / Aleksanterinkatu 38 (Juslén 1928–30): seven storeys,
 // granite-clad two-floor shop/café zone, chiselled render above with strong
 // verticals and horizontals. Render colour unverified (pale grey-beige).
 341:{name:'Fazer house (Kluuvikatu 3 / Aleksanterinkatu 38)',wall:'#cfc6b2',trim:'#ddd5c3',frame:'#3f3d38',stone:'#6c6862',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:N,d:-124.1,tol:1.2,span:[233.8,263.1],top:26.4,pitch:3.2,phase:1.6,base:{h:.6},ground:{type:'shop',h:4.6,fascia:'#2d2f31'},doors:[4],
    storeys:[{y:5.3,h:2.4,w:1.7,head:'none',t:.1},...storeys(8.6,25.4,5,{w:1.6,h:2.1,head:'none',t:.1})],cornice:{depth:.4},bands:[{y:8.5,h:.3,depth:.2,color:'#6c6862'}],
    pilasters:{at:'between',w:.45,y0:8.8,y1:25.4,depth:.16,color:'#ddd5c3',capital:false},
    extras:({F,O,box,span,ctx})=>{for(const [p,q] of F.runs(5.1,span[0],span[1]))box(F,O,(p+q)/2,5.1,.2,q-p,.6,.4,srgb('#eeeae0'));}},
   {n:W,d:263.72,tol:1.4,span:[132,176.7],top:26.5,pitch:3.2,phase:1.6,base:{h:.6},ground:{type:'shop',h:4.6,fascia:'#2d2f31'},doors:[3],
    storeys:[{y:5.3,h:2.4,w:1.7,head:'none',t:.1},...storeys(8.6,25.4,5,{w:1.6,h:2.1,head:'none',t:.1})],cornice:{depth:.4},bands:[{y:8.5,h:.3,depth:.2,color:'#6c6862'}],pilasters:{at:'between',w:.45,y0:8.8,y1:25.4,depth:.16,color:'#ddd5c3',capital:false}}]},
 // Aleksanterinkatu 40 (Pernaja & Sandell 1957–62, Kämp Galleria / hotel): eight
 // storeys, raster grid with copper infill panels and bronze frames; two shop floors.
 348:{name:'Aleksanterinkatu 40 (Kämp Galleria)',wall:'#5e4b3c',trim:'#8a7355',frame:'#8a7355',stone:'#4a443f',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:N,d:-125.56,tol:1.4,span:[277.9,305.9],top:24.8,pitch:3.0,phase:1.5,base:{h:.5},ground:{type:'shop',h:4.8,fascia:false},doors:[4],
    storeys:storeys(8.6,24.4,5,{w:2.3,h:2.3,head:'none',sill:false,t:.08}),cornice:{depth:.3,color:'#8a7355'},
    bands:[8.45,11.6,14.75,17.9,21.05].map(y=>({y,h:.3,depth:.18,color:'#8a7355'})),pilasters:{at:'between',w:.3,y0:8.5,y1:24.4,depth:.18,color:'#8a7355',capital:false},
    extras:({F,O,G,ctx,quad,ring,band,span})=>{band(F,O,4.85,.5,.16,ctx.frame,span[0],span[1]);for(const [p,q] of F.runs(6.3,span[0],span[1])){glass(F,G,(p+q)/2,6.3,.05,q-p-.3,2.6,ctx,false,true);ring(F,O,(p+q)/2,6.3,.14,q-p-.3,2.6,.12,ctx.frame);}}},
   {n:N,d:-127.93,tol:.6,span:[280.8,306.4],top:29.8,pitch:3.0,phase:1.5,base:false,storeys:[{y:25.6,h:2.0,w:2.3,head:'none',sill:false,t:.08}],cornice:{depth:.3,color:'#8a7355'}},
   {n:E,d:-279.07,tol:1.4,span:[-177.8,-122.9],top:24.8,pitch:3.0,phase:1.5,base:{h:.5},ground:{type:'shop',h:4.8,fascia:false},
    storeys:storeys(8.6,24.4,5,{w:2.3,h:2.3,head:'none',sill:false,t:.08}),cornice:{depth:.3,color:'#8a7355'},bands:[8.45,11.6,14.75,17.9,21.05].map(y=>({y,h:.3,depth:.18,color:'#8a7355'})),pilasters:{at:'between',w:.3,y0:8.5,y1:24.4,depth:.18,color:'#8a7355',capital:false}}]},
 // Former Kansallis-Osake-Pankki head office, Aleksanterinkatu 42 (Törnqvist 1892):
 // richly decorated Neo-Renaissance, four storeys; colour reported light yellowish
 // (unverified).
 347:{name:'Aleksanterinkatu 42 (former KOP)',wall:'#d9c99a',trim:'#efe8d6',stone:'#6e6a62',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:N,d:-127.3,tol:1.2,span:[306.1,335.7],top:19.6,pitch:3.4,phase:1.7,base:{h:.6},ground:{type:'arcade',h:5.2,w:2.2},
    bands:[{y:5.3,h:.4,depth:.3},{y:10.1,h:.2,depth:.18},{y:14.4,h:.2,depth:.18}],storeys:[{y:6.3,h:2.6,w:1.45,head:'pediment'},{y:10.8,h:2.4,w:1.45,head:'cornice'},{y:15.0,h:2.0,w:1.35,head:'none'}],cornice:{depth:.6,dentils:true},
    pilasters:{at:'between',w:.6,y0:5.5,y1:19.0,depth:.12,color:'#e2d3a6'},extras:rustication('#b19d6d')},
   {n:N,d:-121.17,tol:.8,span:[320.1,325.3],top:20.8,pitch:3.4,phase:1.7,base:{h:.6},ground:{type:'arcade',h:5.2,w:2.2},
    bands:[{y:5.3,h:.4,depth:.3},{y:10.1,h:.2,depth:.18}],storeys:[{y:6.3,h:2.6,w:1.45,head:'pediment'},{y:10.8,h:2.4,w:1.45,head:'cornice'},{y:15.0,h:2.0,w:1.35,head:'none'}],cornice:{depth:.6,dentils:true}}]},
 // Pohjola house (Aleksanterinkatu 44 / Mikonkatu 3, Gesellius–Lindgren–Saarinen
 // 1899–1901): rough grey-green soapstone above a red-granite ground floor, small-
 // paned windows, corner tower (kept from the measured roof). Ornament not modelled.
 346:{name:'Pohjola house',wall:'#8e8f82',trim:'#7c7d72',frame:'#4a4b45',stone:'#7c5a50',dark:'#34342f',glass:'#5a7483',roof:'#4a4f4d',
  fronts:[{n:N,d:-125,tol:3.2,span:[336,368],top:21.1,pitch:3.0,phase:1.5,base:{h:1.1},ground:{type:'arcade',h:5.6,w:2.2},
    storeys:[{y:6.5,h:2.3,w:1.5,head:'none'},{y:10.1,h:2.3,w:1.5,head:'none'},{y:13.7,h:2.3,w:1.5,head:'none'},{y:17.2,h:2.1,w:1.4,head:'none'}],cornice:{depth:.45,color:'#7c7d72'},bands:[{y:5.75,h:.35,depth:.3,color:'#7c5a50'}],
    extras:({F,O,box,span})=>{for(let y=1.2;y<5.5;y+=.5)for(const [p,q] of F.runs(y,span[0],span[1]))box(F,O,(p+q)/2,y,.015,q-p,.05,.05,srgb('#5e433b'));}},
   {n:N,d:-127.62,tol:.6,span:[336.6,362.2],top:24.5,pitch:3.0,phase:1.5,base:false,storeys:[{y:21.6,h:1.7,w:1.2,head:'none'}],cornice:{depth:.4,color:'#7c7d72'}},
   {n:W,d:369.1,tol:1.0,span:[128.6,176.9],top:21.1,pitch:3.0,phase:1.5,base:{h:1.1},ground:{type:'arcade',h:5.6,w:2.2},
    storeys:[{y:6.5,h:2.3,w:1.5,head:'none'},{y:10.1,h:2.3,w:1.5,head:'none'},{y:13.7,h:2.3,w:1.5,head:'none'},{y:17.2,h:2.1,w:1.4,head:'none'}],cornice:{depth:.45,color:'#7c7d72'},bands:[{y:5.75,h:.35,depth:.3,color:'#7c5a50'}]}]},
 // Aleksi 7 (Fabianinkatu 18, Ole Gripenberg 1932, former Helsingin Säästöpankki):
 // seven floors of clear-lined 1920s classicism in stone; colour unverified.
 354:{name:'Aleksanterinkatu 7 / Fabianinkatu 18',wall:'#c4bba8',trim:'#d6cfbf',frame:'#4a4640',stone:'#6c6862',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:S,d:107.36,tol:1.2,span:[-194.9,-172.1],top:24.9,pitch:3.1,phase:1.55,base:{h:.6},ground:{type:'windows',h:4.9,window:{y:2.9,w:1.9,h:3.4,head:'none'}},storeys:storeys(5.3,24.3,6,{w:1.6,h:2.0,head:'none',t:.1}),cornice:{depth:.45,color:'#d6cfbf'},bands:[{y:5.0,h:.3,depth:.22,color:'#d6cfbf'}]},
   {n:W,d:194.91,tol:1.2,span:[57,106.5],top:30,pitch:3.1,phase:1.55,base:{h:.6},ground:{type:'windows',h:4.9,window:{y:2.9,w:1.9,h:3.4,head:'none'}},storeys:storeys(5.3,24.3,6,{w:1.6,h:2.0,head:'none',t:.1}),cornice:{y:24.9,depth:.45,color:'#d6cfbf'},bands:[{y:5.0,h:.3,depth:.22,color:'#d6cfbf'}]}]},
 // Aleksanterinkatu 9 (former Elanto store, Leistén 1950–53; Kluuvi shopping centre):
 // glossy light-grey granite slabs, ribbon windows, bronze-framed two-floor display zone.
 358:{name:'Aleksanterinkatu 9 (Elanto / Kluuvi, east part)',wall:'#c6c3bb',trim:'#d2cfc7',frame:'#5a4e3e',stone:'#8a877f',dark:'#2d2d2b',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:S,d:107.46,tol:1.2,span:[-217.8,-194.8],top:23.6,pitch:3.2,phase:1.6,base:{h:.6},ground:{type:'shop',h:4.8,fascia:false},doors:[3],storeys:storeys(8.5,23.0,4,{w:2.5,h:1.9,head:'none',sill:false,t:.08}),cornice:{depth:.35,color:'#d2cfc7'},
    extras:({F,O,G,ctx,quad,ring,band,span})=>{band(F,O,4.85,.5,.16,ctx.stone,span[0],span[1]);for(const [p,q] of F.runs(6.3,span[0],span[1])){glass(F,G,(p+q)/2,6.3,.05,q-p-.3,2.4,ctx,false,true);ring(F,O,(p+q)/2,6.3,.14,q-p-.3,2.4,.12,ctx.frame);}}}]},
 355:{name:'Aleksanterinkatu 9 (Elanto / Kluuvi, main part)',wall:'#c6c3bb',trim:'#d2cfc7',frame:'#5a4e3e',stone:'#8a877f',dark:'#2d2d2b',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:S,d:107.4,tol:1.5,span:[-256.6,-217.8],top:26.5,pitch:3.2,phase:1.6,base:{h:.6},ground:{type:'shop',h:4.8,fascia:false},doors:[6],storeys:storeys(8.5,25.9,5,{w:2.5,h:1.9,head:'none',sill:false,t:.08}),cornice:{depth:.35,color:'#d2cfc7'},
    extras:({F,O,G,ctx,quad,ring,band,span})=>{band(F,O,4.85,.5,.16,ctx.stone,span[0],span[1]);for(const [p,q] of F.runs(6.3,span[0],span[1])){glass(F,G,(p+q)/2,6.3,.05,q-p-.3,2.4,ctx,false,true);ring(F,O,(p+q)/2,6.3,.14,q-p-.3,2.4,.12,ctx.frame);}}}]},
 356:{name:'Aleksanterinkatu 9 (courtyard part)',wall:'#c6c3bb',trim:'#d2cfc7',frame:'#5a4e3e',stone:'#8a877f',dark:'#2d2d2b',glass:'#5f7f93',roof:'#515b58',fronts:[{n:S,d:1e6,span:[0,0],storeys:storeys(5.4,22.9,5,{w:1.6,h:2.0})}]},
 // Aleksanterinkatu 11 (Lindqvist 1907–09 raised and simplified 1949–50; Jung's
 // functionalist corner 1936–37): seven storeys, smooth render. Colour unverified.
 351:{name:'Aleksanterinkatu 11',wall:'#d2cab8',trim:'#e4ded0',frame:'#3f3d38',stone:'#6c6862',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:S,d:108,tol:1.2,span:[-323,-278],top:27.8,pitch:3.2,phase:1.6,base:{h:.55},ground:{type:'shop',h:4.9},doors:[7],storeys:storeys(5.3,27.2,6,{w:1.7,h:2.1,head:'none',t:.1}),cornice:{depth:.4}},
   {n:E,d:-279.07,tol:1.2,span:[-105.3,-63.4],top:27.6,pitch:3.2,phase:1.6,base:{h:.55},ground:{type:'shop',h:4.9},storeys:storeys(5.3,27.2,6,{w:1.7,h:2.1,head:'none',t:.1}),cornice:{depth:.4}}]},
 // Lundqvist building, Aleksanterinkatu 13 / Mikonkatu 5 (Lindqvist 1898–1900):
 // red brick and granite, very large iron-mullioned windows, five storeys + attic,
 // corner tower with steep gables (measured roof retained).
 352:{name:'Lundqvist building (Aleksanterinkatu 13)',wall:'#8c4f3f',trim:'#a8a39a',frame:'#3b3734',stone:'#7d7a74',dark:'#2d2f31',glass:'#5f7f93',roof:'#4f5553',
  fronts:[{n:S,d:107.9,tol:1.2,span:[-367.9,-323],top:23.1,pitch:4.2,phase:2.1,base:{h:.8},ground:{type:'shop',h:4.8,fascia:false},doors:[2],
    storeys:[{y:8.9,h:3.0,w:2.9,head:'none',t:.12},{y:12.9,h:3.0,w:2.9,head:'none',t:.12},{y:16.9,h:2.8,w:2.9,head:'arch',type:'arch',t:.12}],cornice:{depth:.5,color:'#a8a39a'},bands:[{y:8.6,h:.3,depth:.2,color:'#7d7a74'},{y:20.4,h:.25,depth:.2,color:'#a8a39a'}],
    pilasters:{at:'between',w:.7,y0:8.7,y1:20.3,depth:.14,color:'#9a5b4a',capital:false},
    extras:({F,O,G,ctx,quad,ring,band,span})=>{band(F,O,4.85,.5,.18,ctx.stone,span[0],span[1]);for(const [p,q] of F.runs(6.5,span[0],span[1])){glass(F,G,(p+q)/2,6.5,.05,q-p-.4,2.6,ctx,false,true);ring(F,O,(p+q)/2,6.5,.14,q-p-.4,2.6,.14,ctx.frame);}}},
   {n:W,d:369.37,tol:1.2,span:[61.3,103.1],top:23.1,pitch:4.2,phase:2.1,base:{h:.8},ground:{type:'shop',h:4.8,fascia:false},
    storeys:[{y:8.9,h:3.0,w:2.9,head:'none',t:.12},{y:12.9,h:3.0,w:2.9,head:'none',t:.12},{y:16.9,h:2.8,w:2.9,head:'arch',type:'arch',t:.12}],cornice:{depth:.5,color:'#a8a39a'},bands:[{y:8.6,h:.3,depth:.2,color:'#7d7a74'},{y:20.4,h:.25,depth:.2,color:'#a8a39a'}],pilasters:{at:'between',w:.7,y0:8.7,y1:20.3,depth:.14,color:'#9a5b4a',capital:false},
    extras:({F,O,G,ctx,quad,ring,band,span})=>{band(F,O,4.85,.5,.18,ctx.stone,span[0],span[1]);for(const [p,q] of F.runs(6.5,span[0],span[1])){glass(F,G,(p+q)/2,6.5,.05,q-p-.4,2.6,ctx,false,true);ring(F,O,(p+q)/2,6.5,.14,q-p-.4,2.6,.14,ctx.frame);}}}]},
 // Aleksanterinkatu 15: Salama house (15 A, corner, red granite, eight storeys) and
 // Atlas house (15 B, Neo-Renaissance render, eight storeys), seen ahead across Mikonkatu.
 404:{name:'Aleksanterinkatu 15 (Salama & Atlas houses)',wall:'#d5c9ad',trim:'#e9e3d4',stone:'#6c6862',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:S,d:106.7,tol:1.8,span:[-445.3,-405],top:29.9,pitch:3.3,phase:1.65,base:{h:.55},ground:{type:'shop',h:4.9},storeys:storeys(5.3,28.5,7,{w:1.5,h:2.1,head:'lintel'}),cornice:{depth:.55}},
   {n:S,d:106.7,tol:1.8,span:[-405,-382.4],top:29.9,pitch:3.2,phase:1.6,wall:'#9c6e60',trim:'#b08476',frame:'#4d3a33',base:{h:.6},ground:{type:'shop',h:4.9,fascia:'#2d2f31'},storeys:storeys(5.3,28.5,7,{w:1.6,h:2.1,head:'none',t:.1}),cornice:{depth:.4,color:'#b08476'}},
   {n:E,d:-383.37,tol:1.4,span:[-103.1,-60.9],top:21.3,pitch:3.2,phase:1.6,wall:'#9c6e60',trim:'#b08476',frame:'#4d3a33',base:{h:.6},ground:{type:'shop',h:4.9,fascia:'#2d2f31'},storeys:storeys(5.3,20.6,4,{w:1.6,h:2.1,head:'none',t:.1}),cornice:{depth:.4,color:'#b08476'}}]},
 // Aleksanterinkatu 46 (SW corner of Mikonkatu), seen ahead-left at the corridor end.
 // Identity, storey count and colour UNVERIFIED: plain pale render with shop floor.
 320:{name:'Aleksanterinkatu 46',wall:'#cfc5ae',trim:'#e3ddcf',frame:'#3f3d38',stone:'#6c6862',dark:'#2d2f31',glass:'#5f7f93',roof:'#515b58',
  fronts:[{n:N,d:-125.3,tol:1.6,span:[385,423.1],top:28.3,pitch:3.3,phase:1.65,base:{h:.55},ground:{type:'shop',h:4.9},storeys:storeys(5.3,27.5,6,{w:1.6,h:2.1,head:'none',t:.1}),cornice:{depth:.4}},
   {n:N,d:-132.71,tol:.7,span:[382.1,401.9],top:30.7,pitch:3.3,phase:1.65,base:false,storeys:[{y:28.0,h:1.6,w:1.4,head:'none'}],cornice:{depth:.3}}]},
};
export function corridorBuilding(ratu){return ALEKSANTERINKATU_BUILDINGS[ratu]||null;}
