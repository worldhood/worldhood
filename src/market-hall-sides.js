import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {architectureBuilder} from './cathedral.js';

// The west (Eteläranta) elevation only. Do not replace the existing north/south
// hero ends, harbour-side elevation, or any roof. Profiles follow RATU410 mesh.
export const MARKET_HALL_SIDE_PLANES=[
 {id:'west-north-wing',nx:-.9985570654844773,nz:.05370090288840028,d:-.14983665464154328,
  profiles:[[[397.616785,.12],[434.059353,.121],[434.059353,5.232],[397.616785,5.230]]],runs:[[397.616785,434.059353]],type:'wing'},
 {id:'west-south-wing',nx:-.998600836591331,nz:.05288070687021663,d:-.48952357215557285,
  profiles:[[[445.520230,.121],[482.863479,.121],[482.863479,5.210],[446.498603,5.221],[446.498603,10.502],[445.520230,10.848]]],runs:[[446.498603,482.863479]],type:'wing'},
 {id:'west-central-portal',nx:-.9984398364352757,nz:.055838096485284705,d:2.027320292267323,
  profiles:[[[434.634906,.121],[445.540930,.121],[445.540930,10.840],[440.275696,12.702],[434.634906,10.707]]],type:'portal'},
 {id:'west-recessed-clerestory',nx:-.9985587436153476,nz:.05366968929795082,d:-4.9786741051674355,
  profiles:[[[397.578201,7.056],[434.058763,7.057],[434.058763,8.502],[397.578201,8.501]],[[446.499714,7.057],[482.833085,7.057],[482.833085,8.502],[446.499714,8.502]]],runs:[[397.578201,434.058763],[446.499714,482.833085]],type:'clerestory'},
];
export function isMarketHallSide(ratu,f){
 return ratu===410&&MARKET_HALL_SIDE_PLANES.some(p=>f.normal.x*p.nx+f.normal.z*p.nz>.99999&&Math.abs(f.d-p.d)<.025&&f.s1-f.s0>5);
}
export function createMarketHallSides(){
 const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const m={brick:mat('#914f3c'),yellow:mat('#c9ab66'),stone:mat('#c7bd9f'),frame:mat('#776d4c',.62,.1),glass:mat('#627b78',.32,.22),dark:mat('#34484a',.35,.18),base:mat('#827f70'),iron:mat('#414e4a',.6,.4)};
 const batches=new Map();
 function box(b,w,h,d,material,s,y,z=.1){b.box(w,h,d,material,s,y,z);}
 function shape(b,points,material,z=.03){const g=new THREE.ShapeGeometry(new THREE.Shape(points.map(([s,y])=>new THREE.Vector2(s,y))));b.add(g,material,0,0,z);}
 function beam(b,a,c,r,material){const p=new THREE.Vector3(...a),v=new THREE.Vector3(...c).sub(p),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...p.addScaledVector(v,.5).toArray());b.add(g,material);}
 function window(b,s,y,w,h){
  box(b,w,h,.055,m.glass,s,y,.085);
  for(const side of [-1,1]){box(b,.095,h+.12,.16,m.frame,s+side*w/2,y,.17);box(b,w+.1,.085,.16,m.frame,s,y+side*h/2,.17);}
  box(b,.045,h,.09,m.frame,s,y,.19);for(const dy of [-h/6,h/6])box(b,w,.045,.1,m.frame,s,y+dy,.19);
 }
 function masonryPanel(b,s,w){
  // Alternating stepped yellow brick diamonds / crosses observed in both the
  // west photograph and the 2022 harbour-side image; not a generic window grid.
  const h=2.08,y0=.57,rows=18,cols=12,bw=w/cols,bh=h/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const u=(col+.5)/cols,v=(row+.5)/rows,phase=v*2;
   const target=phase<1?Math.abs(phase-.5)*2:Math.abs(phase-1.5)*2;
   if(Math.abs(Math.abs(u-.5)*2-target)>.22)continue;
   const tile=new THREE.PlaneGeometry(bw*.92,bh*.85);b.add(tile,m.yellow,s-w/2+(col+.5)*bw,y0+(row+.5)*bh,.027);
  }
 }
 for(const p of MARKET_HALL_SIDE_PLANES){
  const b=architectureBuilder();for(const outline of p.profiles){const sh=new THREE.Shape(outline.map(([s,y])=>new THREE.Vector2(s,y)));b.add(new THREE.ExtrudeGeometry(sh,{depth:.16,bevelEnabled:false}),m.brick,0,0,-.16);}
  if(p.type==='wing')for(const [lo,hi] of p.runs){
   const w=hi-lo,c=(lo+hi)/2,n=26,step=w/n;
   box(b,w,.38,.24,m.base,c,.31,.055);box(b,w,.12,.23,m.frame,c,2.77,.1);
   for(let i=0;i<n;i++){const s=lo+(i+.5)*step;masonryPanel(b,s,step-.09);window(b,s,3.97,step-.14,2.13);}
   for(let i=0;i<=n;i++){const s=lo+i*step;box(b,.11,4.6,.16,m.frame,s,2.83,.14);box(b,.22,.18,.28,m.stone,s,5.08,.15);}
   box(b,w,.18,.30,m.stone,c,5.20,.09);
   // Gutter, sparse snow-guard supports and drainpipes use real depth.
   box(b,w,.11,.20,m.iron,c,5.31,.21);
   for(let s=lo+1.5;s<hi;s+=3.2)beam(b,[s,5.28,.23],[s,5.63,-.06],.023,m.iron);
   for(const s of [lo+.23,hi-.23])beam(b,[s,.27,.32],[s,5.29,.32],.056,m.iron);
  }
  if(p.type==='clerestory')for(const [lo,hi] of p.runs){
   const n=26,step=(hi-lo)/n;
   for(let i=0;i<n;i++)window(b,lo+(i+.5)*step,7.78,step-.12,1.22);
   for(const y of [7.065,8.495])box(b,hi-lo,.12,.25,m.frame,(lo+hi)/2,y,.11);
  }
  if(p.type==='portal'){
   const lo=434.634906,hi=445.540930,c=440.09,w=hi-lo,r=3.65,spring=6.65;
   // Tall arched opening with a diamond glazing lattice, framed by striped piers.
   const arch=new THREE.Shape();arch.moveTo(c-r,3.8);arch.lineTo(c+r,3.8);arch.lineTo(c+r,spring);arch.absarc(c,spring,r,0,Math.PI);arch.closePath();b.add(new THREE.ShapeGeometry(arch),m.glass,0,0,.09);
   for(const side of [-1,1]){
    box(b,1.19,10.08,.24,m.brick,c+side*4.74,5.19,.07);
    for(let y=.73;y<10.3;y+=.70)box(b,1.25,.17,.35,m.stone,c+side*4.74,y,.19);
    box(b,.18,6.58,.27,m.stone,c+side*(r+.14),3.48,.17);
   }
   // Voussoirs follow the actual arch instead of a rectangular pale trim.
   for(let i=0;i<18;i++){
    const a=i*Math.PI/18+.01,z=(i+1)*Math.PI/18-.01,R=r+.43;
    shape(b,[[c+r*Math.cos(a),spring+r*Math.sin(a)],[c+R*Math.cos(a),spring+R*Math.sin(a)],[c+R*Math.cos(z),spring+R*Math.sin(z)],[c+r*Math.cos(z),spring+r*Math.sin(z)]],i%3===1?m.brick:m.stone,.20);
   }
   for(let y=4.03;y<10.2;y+=.68){
    const half=y<=spring?r:Math.sqrt(Math.max(0,r*r-(y-spring)**2));box(b,half*2,.044,.10,m.frame,c,y,.17);
   }
   for(let s=c-r+.1;s<c+r;s+=.68){
    const top=spring+Math.sqrt(Math.max(0,r*r-(s-c)**2));box(b,.04,top-3.9,.10,m.frame,s,(top+3.9)/2,.17);
   }
   for(let s=c-r;s<c+r;s+=.68)for(let y=4.05;y<10.0;y+=.68){
    const inside=(x,yy)=>Math.abs(x-c)<r-.02&&(yy<=spring||(x-c)**2+(yy-spring)**2<(r-.02)**2);
    for(const direction of [-1,1]){const x2=s+.65,y2=y+direction*.65;if(inside(s,y)&&inside(x2,y2))beam(b,[s,y,.21],[x2,y2,.21],.018,m.frame);}
   }
   // Three central door leaves; no invented shop logos or opening-hour text.
   box(b,4.56,3.64,.10,m.dark,c,2,.10);
   for(let i=0;i<3;i++){const s=c+(i-1)*1.48;box(b,1.38,.74,.12,m.frame,s,.68,.20);for(const dx of [-.70,.70])box(b,.09,3.66,.18,m.frame,s+dx,2,.20);box(b,1.45,.1,.18,m.frame,s,3.8,.20);beam(b,[s+.40,1.3,.33],[s+.40,2,.33],.027,m.iron);}
   for(const s of [c-3.05,c+3.05]){window(b,s,2.04,1.05,3.65);box(b,1.24,.17,.3,m.stone,s,3.98,.25);}
   for(const y of [.32,4.08,10.58,10.85])box(b,w,.18,.48,m.stone,c,y,.18);
   beam(b,[lo,10.81,.20],[440.275696,12.70,.20],.105,m.stone);beam(b,[440.275696,12.70,.20],[hi,10.85,.20],.105,m.stone);
   // Central relief kept abstract: not a fake readable coat of arms or label.
   const round=new THREE.TorusGeometry(.36,.095,6,24);b.add(round,m.stone,c,11.44,.19);
   for(const side of [-1,1]){const volute=new THREE.TorusGeometry(.21,.065,6,18,Math.PI*1.45);b.add(volute,m.stone,c+side*.80,11.40,.17);}
  }
  const g=b.finish();g.rotation.y=Math.atan2(p.nx,p.nz);g.position.set(p.nx*p.d,0,p.nz*p.d);g.updateMatrixWorld(true);
  for(const mesh of [...g.children]){mesh.geometry.applyMatrix4(g.matrixWorld);g.remove(mesh);mesh.updateMatrixWorld(true);const key=Object.keys(m).find(k=>m[k].color.equals(mesh.material.color)&&m[k].roughness===mesh.material.roughness&&m[k].metalness===mesh.material.metalness)||mesh.material.uuid;if(!batches.has(key))batches.set(key,{material:mesh.material,geometries:[]});else mesh.material.dispose();batches.get(key).geometries.push(mesh.geometry);}
 }
 return [...batches.entries()].map(([key,{material,geometries}])=>{
  const geometry=mergeGeometries(geometries),mesh=new THREE.Mesh(geometry,material);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.forEach(g=>g.dispose());
  mesh.name=`Old Market Hall street side ${key}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={landmark:'Old Market Hall',coverage:'Eteläranta west side only',sourceRatu:410};return mesh;
 });
}
