import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json' with {type:'json'};

// RATU 944 measured silhouette, not its bounding rectangle. Architectural
// details fitted from the 2015 building-history inventory, pp.32–33, 38–42.
// Current tenants and exact individual frame dimensions are not asserted.
export const LASIPALATSI_PLANES={
 street:{nx:.800602867996332,nz:-.5991953335566358,d:-657.0038015095901},
 cinema:{nx:.8006219590269531,nz:-.5991698246105555,d:-671.0946306601553},
};
export const LASIPALATSI_STREET_PROFILE=[
 [476.912654,.121],[593.019302,.121],[593.019302,4.675],
 [577.911507,4.675],[577.911507,9.241],[493.701461,9.241],
 [493.701461,12.085],[486.295465,12.085],[486.295465,7.781],[476.912654,7.781],
];
export const LASIPALATSI_CINEMA_PROFILE=[
 [557.838376,9.241],[577.882793,9.241],[577.882793,4.675],
 [592.990588,4.675],[592.990588,12.641],[557.838376,12.641],
];
export function isLasipalatsiFront(ratu,f){
 return ratu===944&&Object.values(LASIPALATSI_PLANES).some(p=>f.normal.x*p.nx+f.normal.z*p.nz>.9999&&Math.abs(f.d-p.d)<.09);
}

export function createLasipalatsiFront(){
 const m={
  render:new THREE.MeshStandardMaterial({color:'#e6e5dc',roughness:.86}),
  yellow:new THREE.MeshStandardMaterial({color:'#d4b76b',roughness:.86}),
  glass:new THREE.MeshStandardMaterial({color:'#34484b',roughness:.25,metalness:.3}),
  darkGlass:new THREE.MeshStandardMaterial({color:'#24363a',roughness:.27,metalness:.25}),
  frame:new THREE.MeshStandardMaterial({color:'#b7b6a9',roughness:.52,metalness:.3}),
  timber:new THREE.MeshStandardMaterial({color:'#867650',roughness:.62}),
  green:new THREE.MeshStandardMaterial({color:'#267b60',roughness:.88}),
  red:new THREE.MeshStandardMaterial({color:'#a94439',roughness:.88}),
  neon:new THREE.MeshStandardMaterial({color:'#b84139',emissive:'#ad3028',emissiveIntensity:.35,roughness:.4}),
  lamp:new THREE.MeshStandardMaterial({color:'#f1e8d0',emissive:'#e5d3a0',emissiveIntensity:.3,roughness:.5}),
 };
 const meshes=[];
 function flush(b,p,label){
  const group=b.finish(),angle=Math.atan2(p.nx,p.nz);
  group.rotation.y=angle;group.position.set(p.nx*p.d,0,p.nz*p.d);group.updateMatrixWorld(true);
  for(const mesh of [...group.children]){mesh.geometry.applyMatrix4(group.matrixWorld);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();group.remove(mesh);mesh.updateMatrixWorld(true);mesh.userData.landmark='Lasipalatsi';mesh.userData.elevation=label;meshes.push(mesh);}
 }
 function backing(b,outline){
  const shape=new THREE.Shape(outline.map(([s,y])=>new THREE.Vector2(s,y)));
  b.add(new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false,steps:1}),m.render,0,0,-.16);
 }
 function pane(b,s,y,w,h,{wood=false,divisions=1,horizontal=false}={}){
  b.box(w,h,.09,m.glass,s,y,.08);
  const frame=wood?m.timber:m.frame;
  for(const side of [-1,1]){b.box(.075,h+.1,.18,frame,s+side*w/2,y,.16);b.box(w+.08,.075,.18,frame,s,y+side*h/2,.16);}
  for(let j=1;j<divisions;j++)b.box(.065,h,.17,frame,s-w/2+w*j/divisions,y,.17);
  if(horizontal)b.box(w,.055,.16,frame,s,y-h*.27,.17);
 }
 function awning(b,s,y,w,colour,depth=.65){
  const cloth=new THREE.BoxGeometry(w,.07,depth);cloth.rotateX(-.18);b.add(cloth,colour,s,y,depth*.5+.12);
  b.box(w,.16,.055,colour,s,y-.12,depth+.1);
 }
 const street=architectureBuilder();backing(street,LASIPALATSI_STREET_PROFILE);
 // Shopfronts: yellow concrete lower piers/plinth, ash-toned frames and actual
 // recessed-looking glazed panels. No photocopied shops or invented tenant ads.
 for(const [lo,hi,n] of [[476.913,486.20,2],[493.79,577.80,17],[578.0,592.94,3]]){
  const width=hi-lo,step=width/n;
  street.box(width,4.02,.19,m.yellow,(lo+hi)/2,2.16,-.06);
  for(let i=0;i<n;i++){
   const s=lo+(i+.5)*step,door=i%4===2;
   pane(street,s,2.20,step-.28,3.08,{wood:true,divisions:door?3:1});
   if(door){street.box(.035,.52,.10,m.frame,s,1.61,.29);street.box(.035,.52,.10,m.frame,s+.18,1.61,.29);}
   awning(street,s,3.94,step-.15,lo<490?m.green:m.red,.36);
  }
  street.box(width,.25,.40,m.render,(lo+hi)/2,4.45,.16);
 }
 // Continuous two-storey wing ends before the cinema terrace drop.
 const upperLo=493.79,upperHi=577.80,upperCount=17,step=(upperHi-upperLo)/upperCount;
 for(let i=0;i<upperCount;i++)pane(street,upperLo+(i+.5)*step,6.68,step-.32,2.18,{divisions:3,horizontal:true});
 street.box(84.15,.20,.42,m.render,535.75,9.12,.16);
 // Southeast curved corner remains in source geometry; this plane adds only
 // its measured straight ribbon and green fabric, never a filled corner box.
 pane(street,481.55,6.11,9.10,2.1,{divisions:4});awning(street,481.55,7.40,9.15,m.green,.88);
 // Tall stair/light bay between corner restaurant and long upper ribbon.
 pane(street,490.0,8.20,6.94,7.03,{divisions:4});
 for(const y of [6.4,8.65,10.8])street.box(6.94,.075,.19,m.frame,490.0,y,.18);
 street.box(7.406,.20,.42,m.render,489.998,11.98,.18);
 // Five surviving round entrance luminaires in the long street wing.
 const entrance=539.3;
 for(let i=0;i<5;i++){
  const g=new THREE.CylinderGeometry(.24,.24,.10,18);g.rotateX(Math.PI/2);street.add(g,m.lamp,entrance+(i-2)*.57,4.80,.36);
 }
 // Thin roofline strip and modest fascia identity, not billboard typography.
 street.box(84.05,.045,.075,m.neon,535.75,8.98,.28);
 const font=new FontLoader().parse(fontData);
 function label(b,text,s,y,size,mat,depth=.04){
  const g=new TextGeometry(text,{font,size,depth,curveSegments:3,bevelEnabled:false});g.computeBoundingBox();g.translate(-(g.boundingBox.max.x+g.boundingBox.min.x)/2,0,0);b.add(g,mat,s,y,.27);
 }
 label(street,'LASIPALATSI',509.7,8.03,.52,m.neon);
 // Open terrace edge: posts/rails only, no false tall wall above the low wing.
 for(let s=578.2;s<592.9;s+=1.6)street.box(.05,1.02,.06,m.frame,s,5.2,.20);
 for(const y of [4.95,5.66])street.box(14.85,.05,.07,m.frame,585.44,y,.20);
 flush(street,LASIPALATSI_PLANES.street,'Mannerheimintie');

 const cinema=architectureBuilder();backing(cinema,LASIPALATSI_CINEMA_PROFILE);
 // Recessed Bio Rex foyer glazing and its rooftop red identity.
 pane(cinema,585.42,8.53,14.47,7.30,{divisions:9});
 for(const y of [6.58,8.46,10.34])cinema.box(14.47,.075,.18,m.frame,585.42,y,.18);
 cinema.box(15.12,.24,.5,m.render,585.44,12.51,.17);
 label(cinema,'Bio REX',585.35,13.04,1.40,m.neon,.055);
 for(const s of [580.0,583.4,586.8,590.2])cinema.box(.07,.66,.07,m.frame,s,12.94,.16);
 flush(cinema,LASIPALATSI_PLANES.cinema,'Bio Rex recessed foyer');
 return meshes;
}
