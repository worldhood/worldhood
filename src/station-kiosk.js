import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Rautatientori east kiosk (municipal RATU 262), from street-level reference photography:
// an open flat steel canopy on slim posts over a small cream food kiosk with a
// red menu fascia, flanked by dark poster/info pillars. The municipal record is
// a solid 3.2 m block, so the source shell is dropped and this replaces it.
// Footprint and orientation come from the record; furniture sizes are interpreted.
export const STATION_KIOSK_RATU=262;
export const STATION_KIOSK_HEIGHT=3.16;

function frame(ring){
 // Orientation from the longest footprint edge; extents measured in that frame.
 let best=0,angle=0;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>best){best=l;angle=Math.atan2(b[1]-a[1],b[0]-a[0]);}}
 const c=Math.cos(angle),s=Math.sin(angle),local=ring.map(([x,z])=>[x*c+z*s,-x*s+z*c]);
 const u=local.map(p=>p[0]),v=local.map(p=>p[1]),cu=(Math.min(...u)+Math.max(...u))/2,cv=(Math.min(...v)+Math.max(...v))/2;
 return {x:cu*c-cv*s,z:cu*s+cv*c,heading:-angle,length:Math.max(...u)-Math.min(...u),depth:Math.max(...v)-Math.min(...v)};
}
function menuTexture(){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#a8402c';ctx.fillRect(0,0,512,256);
 // Backlit menu boards: photo-ish panels with price strips, no real branding.
 const tones=['#e9c48d','#d98f5c','#f1dcb4','#c96f45','#e7b36f','#f3e3c4'];
 for(let i=0;i<6;i++){const x=14+i*82;ctx.fillStyle=tones[i];ctx.fillRect(x,26,72,128);ctx.fillStyle='#fff6e6';ctx.fillRect(x,160,72,22);ctx.fillStyle='#5a2a1e';for(let j=0;j<3;j++)ctx.fillRect(x+6,166+j*5,40-j*8,2);}
 ctx.fillStyle='#fff3df';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.fillText('KIOSKI',256,236);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function posterTexture(seed){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;const ctx=canvas.getContext('2d');
 const palettes=[['#1f3c5a','#e8d9b0','#d0563a'],['#f2f0ea','#2a6d8f','#e3a33b'],['#2c2b33','#c9d4dc','#9fbf5a']],p=palettes[seed%palettes.length];
 ctx.fillStyle=p[0];ctx.fillRect(0,0,128,256);ctx.fillStyle=p[1];ctx.fillRect(10,18,108,130);ctx.fillStyle=p[2];ctx.beginPath();ctx.arc(64,84,34,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=p[1];for(let j=0;j<4;j++)ctx.fillRect(14,166+j*16,100-j*18,7);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function createStationKiosk(record){
 const group=new THREE.Group();group.name='Rautatientori kiosk canopy';
 if(!record?.rings?.[0])return group;
 const f=frame(record.rings[0]),c=Math.cos(f.heading),s=Math.sin(f.heading),H=STATION_KIOSK_HEIGHT,batches=new Map();
 const m={canopy:new THREE.MeshStandardMaterial({color:'#4b5250',roughness:.6,metalness:.3}),soffit:new THREE.MeshStandardMaterial({color:'#5d6463',roughness:.7,metalness:.2}),post:new THREE.MeshStandardMaterial({color:'#323837',roughness:.5,metalness:.5}),
  body:new THREE.MeshStandardMaterial({color:'#e3d6b8',roughness:.75}),trim:new THREE.MeshStandardMaterial({color:'#8c8f88',roughness:.5,metalness:.4}),glass:new THREE.MeshStandardMaterial({color:'#24343b',roughness:.15,metalness:.6}),pillar:new THREE.MeshStandardMaterial({color:'#2e3434',roughness:.6,metalness:.3})};
 // Local (u along the long edge, v across) → world.
 const place=(geo,mat,u,y,v,turn=0)=>{geo.rotateY(f.heading+turn);geo.translate(f.x+u*c+v*s,y,f.z-u*s+v*c);if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(geo);};
 const box=(w,h,d,mat,u,y,v,turn=0)=>place(new THREE.BoxGeometry(w,h,d),mat,u,y,v,turn);
 const L=f.length,D=f.depth;
 // Thin flat roof plate with a deeper fascia, slightly overhanging the posts.
 box(L,.12,D,m.canopy,0,H-.06,0);box(L-.3,.04,D-.3,m.soffit,0,H-.14,0);
 for(const sv of [-1,1]){box(L,.32,.07,m.canopy,0,H-.16,sv*(D/2-.035));box(.07,.32,D,m.canopy,sv*(L/2-.035),H-.16,0);}
 // Slim square posts: corners plus mid-span on the long sides.
 const pu=L/2-.6,pv=D/2-.6;for(const u of [-pu,0,pu])for(const v of [-pv,pv])box(.14,H-.18,.14,m.post,u,(H-.18)/2,v);
 for(const u of [-pu,0,pu])box(.1,.18,D-1.2,m.post,u,H-.27,0); // cross beams under the plate
 // Food kiosk: cream body, steel plinth, red backlit menu fascia over a glazed serving hatch.
 const kw=2.6,kd=1.7,kh=2.45,ku=-.4,kv=0;
 box(kw,.12,kd,m.trim,ku,.06,kv);box(kw,kh-.12,kd,m.body,ku,.12+(kh-.12)/2,kv);box(kw+.1,.08,kd+.1,m.trim,ku,kh+.04,kv);
 for(const side of [-1,1]){box(kw-.5,.8,.04,m.glass,ku,1.45,kv+side*(kd/2+.01));box(kw-.4,.05,.3,m.trim,ku,1.02,kv+side*(kd/2+.15));}
 const menu=menuTexture(),menuMat=menu?new THREE.MeshStandardMaterial({map:menu,roughness:.5,emissive:'#ffffff',emissiveMap:menu,emissiveIntensity:.35}):m.body;
 for(const side of [-1,1]){const g=new THREE.PlaneGeometry(kw-.1,.55);if(side<0)g.rotateY(Math.PI);place(g,menuMat,ku,2.12,kv+side*(kd/2+.025));}
 // Poster pillars and an info board either side, as in the photo.
 let seed=0;
 for(const [u,v] of [[pu-1.4,.3],[pu-2.6,-.5],[-pu+.9,.6]]){
  box(.5,2.05,.5,m.pillar,u,1.03,v);box(.56,.06,.56,m.trim,u,2.08,v);
  for(let k=0;k<4;k++){const tex=posterTexture(seed++),g=new THREE.PlaneGeometry(.38,1.5),mat=tex?new THREE.MeshStandardMaterial({map:tex,roughness:.4}):m.body;
   const a=k*Math.PI/2,lu=u+Math.sin(a)*.255,lv=v+Math.cos(a)*.255,mesh=new THREE.Mesh(g,mat);
   mesh.position.set(f.x+lu*c+lv*s,1.15,f.z-lu*s+lv*c);mesh.rotation.y=f.heading+a;group.add(mesh);}
 }
 box(.45,.8,.45,m.pillar,-pu+.2,.4,-pv+.3); // litter bin
 for(const [mat,gs]of batches){const mesh=new THREE.Mesh(mergeGeometries(gs),mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.userData={ratu:STATION_KIOSK_RATU,centre:[f.x,f.z],size:[L,D],source:'RATU 262 footprint; photo-guided canopy/kiosk, interpreted furniture'};
 return group;
}
