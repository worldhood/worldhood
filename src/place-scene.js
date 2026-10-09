import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createPlaceLandmarks} from './place-landmarks.js';
import {createPhotoPanels} from './photo-panels.js';

// Draws a photo-matched place built by scripts/place-build.mjs (public/cities/<id>/places/<place>.json):
// paving with the real materials and patterns, raised tram platforms with kerbs and warning strips,
// glass shelters, lattice overhead-line masts, the square's lamp masts, the fountain, flagpoles, bus
// canopies, tree guards and the hero landmarks (src/place-landmarks.js). Everything is original
// procedural geometry; colours and dimensions come from the place's reference description.
// Draw calls: one per paving kind plus a handful of merged batches.

const C=hex=>new THREE.Color(hex);
const hash=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x);};

// ---------- Paving textures (canvas, generated on the fly; metres per texture tile in `size`) ----------
function canvasTexture(size,draw){
 if(typeof document==='undefined')return null; // tests and build scripts: geometry only
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');draw(g,512/size,512);
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.userData.size=size;return t;
}
const stoneFill=(g,palette,x,y,w,h,r,seed)=>{const k=hash(seed,x+y);g.fillStyle=palette[Math.floor(k*palette.length)];g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h);g.fill();
 g.fillStyle=`rgba(255,255,255,${.05+.08*hash(x,y)})`;g.fillRect(x+w*.15,y+h*.12,w*.5,h*.25);};
export const PAVING_LOOKS={
 // Grey granite setts laid in fan-shaped arcs (the main square), 1.2 m fans.
 'fan-setts':{size:2.4,joint:'#4c4b48',stones:['#7b7a76','#86837d','#6f6e6b','#8d8780','#77736e','#918b85','#6a6a68'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const fan=1.2*px,s=.1*px;
  for(let row=-1;row<4;row++)for(let col=-1;col<3;col++){const cx=col*fan+(row%2?fan/2:0)+fan/2,cy=row*fan*.5+fan*.55;
   for(let r=s*.8;r<fan*.62;r+=s*1.05){const steps=Math.max(3,Math.floor(Math.PI*r/(s*1.05)));for(let i=0;i<steps;i++){const a=Math.PI+(i+.5)/steps*Math.PI,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    g.save();g.translate(x,y);g.rotate(a+Math.PI/2);stoneFill(g,this.stones,-s*.46,-s*.44,s*.92,s*.88,s*.15,row*7+col+i);g.restore();}}}}},
 // Straight courses of small grey setts (paths and roadways round the City Hall).
 'setts':{size:1.2,joint:'#4a4946',stones:['#77756f','#827f78','#6c6b67','#8a857e','#706e69'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const w=.13*px,h=.1*px;for(let y=0;y<n;y+=h){const o=(Math.round(y/h)%2)*w/2;for(let x=-w;x<n;x+=w)stoneFill(g,this.stones,x+o+1,y+1,w-2,h-2,2,y*3+x);}}},
 // Rounded fieldstone cobbles, grey-brown (older north part of the square).
 'cobbles':{size:1.5,joint:'#4b463f',stones:['#7a7066','#857a6e','#6e675f','#91857a','#6a6058','#7f776e','#988c80'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const s=.15*px;for(let y=0;y<n+s;y+=s*.86)for(let x=0;x<n+s;x+=s){const k=hash(x,y),o=(Math.round(y/(s*.86))%2)*s/2;
   g.fillStyle=this.stones[Math.floor(k*this.stones.length)];g.beginPath();g.ellipse(x+o+(k-.5)*s*.2,y,(s*.44)*(.85+.3*k),s*.4,k*3,0,Math.PI*2);g.fill();
   g.fillStyle='rgba(255,255,255,.1)';g.beginPath();g.ellipse(x+o-s*.1,y-s*.12,s*.18,s*.1,0,0,Math.PI*2);g.fill();}}},
 // Pinkish-red granite slabs 60 x 30 cm in running bond (Hämeenkatu pavements and platforms).
 'red-granite':{size:2.4,joint:'#6d5853',stones:['#a5847b','#9c7b72','#ab8a80','#a07e76','#b08f86','#97766f'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const w=.6*px,h=.3*px;for(let y=0;y<n;y+=h){const o=(Math.round(y/h)%2)*w/2;for(let x=-w;x<n;x+=w){g.fillStyle=this.stones[Math.floor(hash(x+o,y)*this.stones.length)];g.fillRect(x+o+1,y+1,w-2,h-2);
   for(let i=0;i<40;i++){g.fillStyle=hash(i,x+y)>.5?'rgba(40,30,30,.25)':'rgba(240,225,220,.25)';g.fillRect(x+o+hash(i*3,y)*w,y+hash(x,i*7)*h,1.5,1.5);}}}}},
 // Dark grey rectangular stone blocks of the tram and bus lane.
 'tram-blocks':{size:1.2,joint:'#3d3e3f',stones:['#5d5f61','#55575a','#64666a','#5a5c5e','#6a6b6d'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const w=.2*px,h=.1*px;for(let y=0;y<n;y+=h){const o=(Math.round(y/h)%2)*w/2;for(let x=-w;x<n;x+=w)stoneFill(g,this.stones,x+o+1,y+1,w-2,h-2,1,x*5+y);}}},
 'grey-blocks':{size:1.8,joint:'#3f4041',stones:['#626466','#5a5c5f','#6b6d6f','#57595b'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const w=.3*px,h=.3*px;for(let y=0;y<n;y+=h)for(let x=0;x<n;x+=w)stoneFill(g,this.stones,x+1,y+1,w-2,h-2,1,x+y*9);}},
 'grey-pavers':{size:1.6,joint:'#6c6b67',stones:['#8f8d88','#878580','#96938d','#8a8883'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);const w=.2*px;for(let y=0;y<n;y+=w)for(let x=0;x<n;x+=w)stoneFill(g,this.stones,x+1,y+1,w-2,w-2,1,x*3+y);}},
 'stone-dust':{size:3,joint:'#b3a68d',stones:['#a89a80','#bcae94','#9f927a'],draw(g,px,n){
  g.fillStyle=this.joint;g.fillRect(0,0,n,n);for(let i=0;i<9000;i++){g.fillStyle=this.stones[i%3];g.fillRect(hash(i,1)*n,hash(1,i)*n,2,2);}}}
};
const textures=new Map();
function addBands(m,angle){
  // The square's grid of lighter double granite bands every 8.4 m, aligned with the street grid.
  m.onBeforeCompile=sh=>{sh.uniforms.bandAngle={value:angle};sh.vertexShader='varying vec3 vWorldP;\n'+sh.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorldP=(modelMatrix*vec4(transformed,1.0)).xyz;');
   sh.fragmentShader='uniform float bandAngle;varying vec3 vWorldP;\n'+sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 gp=mat2(cos(bandAngle),-sin(bandAngle),sin(bandAngle),cos(bandAngle))*vWorldP.xz;vec2 f=abs(fract(gp/8.4+.5)-.5)*8.4;
    float band=step(min(f.x,f.y),.26);float course=step(.5,fract(min(f.x,f.y)/.13));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.232,.22)*mix(.9,1.06,course),band*.85);`);};
  m.customProgramCacheKey=()=>'fan-setts-bands';
}
// Photo paving (rectified from reference photos, npm run place:textures) where the place has one for this kind.
let photoGround=new Map();
function pavingMaterial(kind,angle){
 const photo=photoGround.get(kind);
 if(photo){const m=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  if(photo.map)m.map=photo.map;else if(typeof document!=='undefined')new THREE.TextureLoader().load(photo.url,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;photo.map=t;m.map=t;m.needsUpdate=true;});
  if(kind==='fan-setts')addBands(m,angle);return m;}
 if(!textures.has(kind)){const look=PAVING_LOOKS[kind];textures.set(kind,canvasTexture(look.size,look.draw.bind(look)));}
 const look=PAVING_LOOKS[kind];
 const map=textures.get(kind),m=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':look.stones[0],roughness:kind==='red-granite'?.75:.92,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 if(kind==='fan-setts')addBands(m,angle);
 return m;
}
// Flat polygon (with holes) on the ground at height y, UVs in rotated world metres.
function groundShape(rings,y,angle,size){
 const sh=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(p[0],-p[1])));for(const h of rings.slice(1))sh.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],-p[1]))));
 const g=new THREE.ShapeGeometry(sh);g.rotateX(-Math.PI/2);g.translate(0,y,0);worldUV(g,angle,size);return g;
}
function worldUV(g,angle,size){const p=g.attributes.position,uv=new Float32Array(p.count*2),c=Math.cos(angle),s=Math.sin(angle);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);uv[i*2]=(x*c+z*s)/size;uv[i*2+1]=(-x*s+z*c)/size+p.getY(i)/size;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;}

// ---------- Merged vertex-coloured batches for the solid furniture ----------
class Batch{constructor(){this.parts=[];}
 add(g,hex){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);if(!g.attributes.normal)g.computeVertexNormals();
  const col=C(hex),c=new Float32Array(g.attributes.position.count*3);for(let i=0;i<c.length;i+=3)c.set([col.r,col.g,col.b],i);g.setAttribute('color',new THREE.BufferAttribute(c,3));this.parts.push(g);return g;}
 mesh(material,name){if(!this.parts.length)return null;const m=new THREE.Mesh(mergeGeometries(this.parts),material);this.parts.forEach(g=>g.dispose());m.name=name;m.castShadow=true;m.receiveShadow=true;return m;}}
const box=(w,h,d,x,y,z,yaw=0)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(0,h/2,0);g.rotateY(yaw);g.translate(x,y,z);return g;};
const cyl=(r0,r1,h,x,y,z,seg=8)=>{const g=new THREE.CylinderGeometry(r1,r0,h,seg);g.translate(x,y+h/2,z);return g;};
// Local frame helper: place geometry built around the origin (forward +Z) at x,z turned by yaw.
const at=(g,x,y,z,yaw)=>{g.rotateY(yaw);g.translate(x,y,z);return g;};

// Black open-lattice overhead-line mast with a street light, as on Hämeenkatu.
function mastGeometry(H,colour,B){
 const w=.46,bar=.06,parts=[];
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])parts.push(box(bar,H-1.8,bar,sx*w/2,1.8,sz*w/2));
 for(let y=2.6;y<H;y+=1.4){parts.push(box(w,bar,bar,0,y,w/2),box(w,bar,bar,0,y,-w/2),box(bar,bar,w,w/2,y,0),box(bar,bar,w,-w/2,y,0));
  for(const s of [1,-1]){const d=box(bar*.8,1.48,bar*.8,0,0,0);d.translate(0,-.74,0);d.rotateZ(s*.32);d.translate(0,y+.7,w/2*s);parts.push(d);}}
 parts.push(box(.62,1.8,.62,0,0,0),box(.08,.08,1.4,0,H-1.2,.7),box(.3,.12,.62,0,H-1.32,1.3));
 for(const g of parts)B.add(g,colour);
}
function lampMastGeometry(H,colour,globe,B,G){
 B.add(cyl(.55,.3,1,0,0,0,10),'#a4a39d');B.add(cyl(.16,.1,H-1,0,1,0,10),colour);
 for(const y of [6.2,6.9])for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;B.add(box(.22,.42,.2,Math.cos(a)*.24,y,Math.sin(a)*.24,-a),'#7d8386');}
 B.add(box(2.2,.1,.1,0,H-.25,0),colour);B.add(box(.1,.1,2.2,0,H-.25,0),colour);
 for(const [x,z] of [[1,0],[-1,0],[0,1],[0,-1]]){const d=new THREE.SphereGeometry(.38,12,6,0,Math.PI*2,0,Math.PI/2);d.translate(x,H-.42,z);G.add(d,globe);B.add(cyl(.05,.05,.3,x,H-.45,z,6),colour);}
}

export function createPlace(place,{textureUrl=f=>f}={}){
 const group=new THREE.Group();group.name=`Place: ${place.name}`;const angle=(place.gridAngle||0)*Math.PI/180,col={...place.colours};
 const obstacles=[],B=new Batch(),G=new Batch(),glass=new Batch();
 // Paving: one mesh per kind.
 photoGround=new Map((place.groundTextures||[]).map(g=>[g.kind,{url:textureUrl(g.texture),size:g.size[0]}]));
 const byKind=new Map();for(const p of place.paving||[]){if(!byKind.has(p.kind))byKind.set(p.kind,[]);byKind.get(p.kind).push(p.rings);}
 for(const [kind,list] of byKind){if(!PAVING_LOOKS[kind])continue;const size=photoGround.get(kind)?.size||PAVING_LOOKS[kind].size,g=mergeGeometries(list.map(r=>groundShape(r,.092,angle,size)));
  const m=new THREE.Mesh(g,pavingMaterial(kind,angle));m.receiveShadow=true;m.name=`Paving: ${kind}`;m.renderOrder=1;group.add(m);}
 // Tram platforms: raised red granite, light kerb along the track edge with a dimpled warning strip.
 const granite=pavingMaterial('red-granite',angle),kerb=new THREE.MeshStandardMaterial({color:col.kerb||'#c9c7c1',roughness:.8});
 for(const p of place.platforms||[]){
  const sh=new THREE.Shape(p.ring.map(q=>new THREE.Vector2(q[0],-q[1]))),g=new THREE.ExtrudeGeometry(sh,{depth:p.height,bevelEnabled:false});g.rotateX(-Math.PI/2);worldUV(g,angle,photoGround.get('red-granite')?.size||PAVING_LOOKS['red-granite'].size);
  const m=new THREE.Mesh(g,[granite,kerb]);m.receiveShadow=true;m.castShadow=true;m.name=`Platform ${p.stop}`;group.add(m);
  const e=p.edge,[sx,sz]=p.side;
  for(let i=1;i<e.length;i++){const a=e[i-1],b=e[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);if(l<.1)continue;
   const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;B.add(at(box(.3,.012,l,0,0,0),mx+sx*.15,p.height,mz+sz*.15,yaw),col.kerb||'#c9c7c1');B.add(at(box(.4,.014,l,0,0,0),mx+sx*.62,p.height,mz+sz*.62,yaw),col.warning||'#8d8e8c');
   // Railing along the back edge (black posts with a steel top rail), clear of the platform ends.
   if(i>1&&i<e.length-1){const w=p.width;for(let k=0;k<l;k+=2.2){const t=k/l;B.add(cyl(.035,.035,.95,a[0]+dx*t+sx*(w-.15),p.height,a[1]+dz*t+sz*(w-.15),6),col.shelterFrame||'#1c1e20');}
    B.add(at(box(.05,.05,l,0,0,0),mx+sx*(w-.15),p.height+.92,mz+sz*(w-.15),yaw),'#9aa0a3');}}
 }
 // Shelters: black frame, glass back and ends, thin flat roof, bench.
 for(const s of place.shelters||[]){
  const base=s.base||0,L=s.length,D=Math.max(1.5,s.depth),H=s.height||2.7,f=col.shelterFrame||'#1c1e20';
  // Local frame: +X along the shelter, +Z towards the track (back wall at -Z).
  const toTrack=s.back?[-s.back[0],-s.back[1]]:[0,1],flip=(-Math.sin(s.yaw)*toTrack[0]+Math.cos(s.yaw)*toTrack[1])>0?1:-1;
  const put=(g)=>{g.scale(1,1,flip);g.rotateY(-s.yaw);g.translate(s.x,base,s.z);return g;};
  for(const x of [-L/2+.1,-L/4,0,L/4,L/2-.1])B.add(put(box(.08,H,.08,x,0,-D/2+.1)),f);
  for(const x of [-L/2+.1,L/2-.1])B.add(put(box(.08,H,.08,x,0,D/2-.15)),f);
  B.add(put(box(L+.4,.12,D+.3,0,H,0)),col.shelterRoof||'#2a2c2e');B.add(put(box(L*.45,.06,.45,-L*.15,.45,-D/2+.4)),'#6b5a48');
  glass.add(put(box(L-.2,H-.15,.02,0,.08,-D/2+.1)),col.shelterGlass||'#a9bcc2');for(const x of [-L/2+.1,L/2-.1])glass.add(put(box(.02,H-.15,D-.3,x,.08,-.05)),col.shelterGlass||'#a9bcc2');
  obstacles.push({name:'Tram shelter',rings:[rectRing(s.x,s.z,s.yaw,L,.6,-(D/2-.1)*flip)]});
 }
 // Overhead-line masts (instanced: one lattice template).
 if(place.masts?.length){const mb=new Batch();mastGeometry(place.mastHeight||10,col.mast||'#1b1d1f',mb);const t=mb.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.3}),'Overhead-line masts');
  const inst=new THREE.InstancedMesh(t.geometry,t.material,place.masts.length),o=new THREE.Object3D();
  place.masts.forEach((m,i)=>{o.position.set(m.x,0,m.z);o.rotation.set(0,m.yaw,0);o.updateMatrix();inst.setMatrixAt(i,o.matrix);obstacles.push({name:'Overhead-line mast',rings:[rectRing(m.x,m.z,0,.7,.7,0)]});});
  inst.castShadow=inst.receiveShadow=true;inst.name='Overhead-line masts';inst.computeBoundingSphere();group.add(inst);}
 // Square lamp masts with four dome lamps.
 for(const l of place.lamps||[]){const lb=new Batch(),lg=new Batch();lampMastGeometry(place.lampHeight||10,col.lampMast||'#9ea4a8',col.lampGlobe||'#f2f1ec',lb,lg);
  for(const b of [lb,lg])for(const g of b.parts)g.translate(l.x,0,l.z);B.parts.push(...lb.parts);G.parts.push(...lg.parts);obstacles.push({name:'Lamp mast',rings:[rectRing(l.x,l.z,0,1.1,1.1,0)]});}
 // Fountain: granite basin, water, cast-iron tiers.
 const f=place.fountain;if(f){const R=f.radius,iron=col.fountainIron||'#24302c';
  const rim=new THREE.LatheGeometry([new THREE.Vector2(R+.05,0),new THREE.Vector2(R+.05,.48),new THREE.Vector2(R,.56),new THREE.Vector2(R-.38,.56),new THREE.Vector2(R-.45,.5),new THREE.Vector2(R-.45,0)],48);rim.translate(f.x,0,f.z);B.add(rim,col.fountainRim||'#a8a49c');
  const water=new THREE.CircleGeometry(R-.44,40);water.rotateX(-Math.PI/2);water.translate(f.x,.38,f.z);B.add(water,'#6b7a7c');
  const prof=[[0,0],[.75,0],[.6,.25],[.38,.4],[.32,1.2],[1.75,1.55],[1.85,1.75],[.25,1.8],[.2,2.7],[.95,3],[1,3.15],[.18,3.2],[.14,3.9],[.32,4.1],[.08,f.height]].map(([r,y])=>new THREE.Vector2(r,y));
  const t=new THREE.LatheGeometry(prof,20);t.translate(f.x,.35,f.z);B.add(t,iron);obstacles.push({name:'Fountain',rings:[circleRing(f.x,f.z,R+.05,20)]});}
 // Flagpoles along the City Hall front.
 const fp=place.flagpoles;if(fp)for(let i=0;i<fp.count;i++){const t=fp.count>1?i/(fp.count-1):.5,x=fp.from[0]+(fp.to[0]-fp.from[0])*t,z=fp.from[1]+(fp.to[1]-fp.from[1])*t;B.add(cyl(.07,.04,fp.height,x,0,z,8),col.flagpole||'#eeeeea');B.add(new THREE.SphereGeometry(.1,8,6).translate(x,fp.height,z),'#d8c27a');}
 // Bus terminal canopies: green-grey steel on paired columns, glass wings rising from a central spine.
 const bc=place.busCanopies;if(bc){const dx=bc.to[0]-bc.from[0],dz=bc.to[1]-bc.from[1],len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),unit=len/bc.count,w=bc.width,H=bc.height;
  for(let i=0;i<bc.count;i++){const t=(i+.5)/bc.count,cx=bc.from[0]+dx*t,cz=bc.from[1]+dz*t;
   for(const s of [-.5,.5]){B.add(at(cyl(.16,.16,H-1.2,0,0,unit*s*.7,8),cx,0,cz,yaw),col.canopyFrame||'#6d7a76');obstacles.push({name:'Canopy column',rings:[circleRing(cx+Math.sin(yaw)*unit*s*.7,cz+Math.cos(yaw)*unit*s*.7,.25,8)]});}
   B.add(at(box(.5,.5,unit,0,H-1.3,0),cx,0,cz,yaw),col.canopyFrame||'#6d7a76');
   for(const side of [-1,1]){glass.add(at(wingGlass(w/2*side,unit*.98,H-1.05,H),cx,0,cz,yaw),col.canopyGlass||'#5f6e70');
    for(const sz of [-.49,0,.49])for(const g of wingRib(w/2*side,H-1.05,H,unit*sz))B.add(at(g,cx,0,cz,yaw),col.canopyFrame||'#6d7a76');}}}
 // Young street trees stand in black three-post guards over square cast-iron grates.
 for(const t of place.trees||[])if(t.planted>=2012&&t.height<8&&t.family!=='blossom'){for(let k=0;k<3;k++){const a=k*2.094+.4;B.add(cyl(.03,.03,1.7,t.p[0]+Math.cos(a)*.38,0,t.p[1]+Math.sin(a)*.38,5),'#1e2022');}
  for(const y of [.45,1.55]){const r=new THREE.TorusGeometry(.38,.018,4,14);r.rotateX(Math.PI/2);r.translate(t.p[0],y,t.p[1]);B.add(r,'#1e2022');}
  B.add(at(box(1.9,.02,1.9,0,0,0),t.p[0],.093,t.p[1],-(place.gridAngle||0)*Math.PI/180),'#2b2c2d');}
 const solid=B.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.15}),'Place furniture');if(solid)group.add(solid);
 const lamps=G.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.4,emissive:'#fffbe8',emissiveIntensity:.25}),'Place lamp globes');if(lamps)group.add(lamps);
 const glassMesh=glass.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.08,metalness:.1,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide}),'Place glass');if(glassMesh){glassMesh.castShadow=false;glassMesh.renderOrder=4;group.add(glassMesh);}
 const landmarks=createPlaceLandmarks(place.landmarks||[],{heights:place.heights});group.add(landmarks.group);obstacles.push(...landmarks.obstacles);
 const panels=createPhotoPanels(place.photoPanels||[],{ringOf:p=>p.ring,urlOf:p=>textureUrl(p.texture),loader:typeof document==='undefined'?null:new THREE.TextureLoader()});group.add(panels);
 group.userData={place:place.place,paving:place.paving?.length||0,platforms:place.platforms?.length||0,shelters:place.shelters?.length||0,masts:place.masts?.length||0,lamps:place.lamps?.length||0,landmarks:landmarks.group.userData,photoPanels:panels.userData.panels};
 return {group,obstacles};
}
// One glass wing of a canopy: from the spine (x = 0, height y0) curving up to the edge (x = half, height y1),
// running along local Z for `len` metres.
const wingY=(t,y0,y1)=>y0+(y1-y0)*Math.pow(t,1.6);
function wingGlass(half,len,y0,y1,steps=6){const pos=[];
 for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps,xa=half*a,xb=half*b,ya=wingY(a,y0,y1),yb=wingY(b,y0,y1);
  pos.push(xa,ya,-len/2,xb,yb,-len/2,xb,yb,len/2,xa,ya,-len/2,xb,yb,len/2,xa,ya,len/2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;}
function wingRib(half,y0,y1,z,steps=6){const out=[];
 for(let i=0;i<steps;i++){const a=i/steps,b=(i+1)/steps,xa=half*a,xb=half*b,ya=wingY(a,y0,y1),yb=wingY(b,y0,y1),l=Math.hypot(xb-xa,yb-ya);
  const g=new THREE.BoxGeometry(l,.12,.1);g.rotateZ(Math.atan2(yb-ya,xb-xa));g.translate((xa+xb)/2,(ya+yb)/2-.06,z);out.push(g);}
 return out;}
export function rectRing(x,z,yaw,L,D,offset=0){const c=Math.cos(yaw),s=Math.sin(yaw),nx=-s,nz=c,pts=[[-L/2,-D/2],[L/2,-D/2],[L/2,D/2],[-L/2,D/2],[-L/2,-D/2]];return pts.map(([u,v])=>[+(x+c*u+nx*(v+offset)).toFixed(2),+(z+s*u+nz*(v+offset)).toFixed(2)]);}
export function circleRing(x,z,r,n=16){const out=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;out.push([+(x+Math.cos(a)*r).toFixed(2),+(z+Math.sin(a)*r).toFixed(2)]);}return out;}
