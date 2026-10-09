import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
// Individual street elevations fitted to RATU 588. Glass/mullion composition
// follows HKM record CB3B490A-472F-4401-AD4C-930A9C745DC4; shop tenants and
// unmeasured individual pane spacing are not asserted to be current or exact.
const planes=[
 {nx:.601,nz:.799,d:-355.24,s0:-712.61,s1:-646.47,y0:.12,y1:30.84},
 {nx:.8,nz:-.6,d:-647.11,s0:381.04,s1:428.22,y0:.12,y1:22.99},
 {nx:.8,nz:-.6,d:-650.18,s0:354.29,s1:424.8,y0:22.99,y1:30.47},
];
export function isForumFront(ratu,f){return ratu===588&&planes.some(p=>f.normal.x*p.nx+f.normal.z*p.nz>.999&&Math.abs(f.d-p.d)<.4);}
export function createForumFront(){
 const meshes=[],glass=new THREE.MeshStandardMaterial({color:'#3b474b',roughness:.26,metalness:.35}),frame=new THREE.MeshStandardMaterial({color:'#4a433a',roughness:.65,metalness:.25}),stone=new THREE.MeshStandardMaterial({color:'#c8c6ba',roughness:.8}),dark=new THREE.MeshStandardMaterial({color:'#202f32',roughness:.33,metalness:.2});
 for(const p of planes){const b=architectureBuilder(),w=p.s1-p.s0,h=p.y1-p.y0,n=Math.round(w/2.65),step=w/n;
  b.box(w,h,.20,glass,0,(p.y0+p.y1)/2,-.10);
  for(let i=0;i<=n;i++){const x=-w/2+i*step;b.box(.12,h,.32,frame,x,(p.y0+p.y1)/2,.13);b.box(.045,h,.36,stone,x+.08,(p.y0+p.y1)/2,.14);}
  for(let y=p.y0+.08;y<=p.y1;y+=1.45)b.box(w,.095,.29,frame,0,y,.10);
  for(let y=4.6;y<p.y1;y+=4.35)if(y>p.y0)b.box(w,.20,.4,frame,0,y,.14);
  if(p.y0<1){
   b.box(w,.5,.4,stone,0,.37,.08);b.box(w,.45,.85,stone,0,4.62,.3);
   for(let i=0;i<n;i++){const x=-w/2+(i+.5)*step;b.box(step-.22,3.65,.12,dark,x,2.25,.18);b.box(.07,3.7,.2,frame,x,2.25,.3);b.box(step-.08,.1,.35,stone,x,4.13,.25);}
  }
  b.box(w,.26,.65,stone,0,p.y1-.13,.2);
  const group=b.finish(),angle=Math.atan2(p.nx,p.nz),s=(p.s0+p.s1)/2;
  group.rotation.y=angle;group.position.set(Math.cos(angle)*s+Math.sin(angle)*p.d,0,-Math.sin(angle)*s+Math.cos(angle)*p.d);group.updateMatrixWorld(true);
  for(const m of group.children){m.geometry.applyMatrix4(group.matrixWorld);meshes.push(m);}
 }
 return meshes;
}
