import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';

// Photo-guided waterfront fronts, registered to the municipal mesh planes.
// Roofs, rear elevations and courtyard holes remain the measured source, not boxes.
export const WATERFRONT_FRONTAGES={
 // City Hall blue from 2024 reference photography (sunlit wall ~sRGB 159,173,188): bluer than the old #b0bdc7.
 216:{name:'Helsinki City Hall',width:70.7,height:16.4,s:25.43,d:234.6,bays:23,color:'#a6b5c8'},
 18:{name:'Swedish Embassy',width:41.84,height:16.2,s:109.62,d:234.5,bays:13,color:'#bc8d6d'},
 24:{name:'Supreme Court',width:39.5,height:16.9,s:177.85,d:233.1,bays:13,color:'#c1b8a1'},
 23:{name:'Presidential Palace main court front',width:51,height:14.65,s:218.9,d:214.65,bays:17,color:'#d4cbb2'},
};
// Allas Sea Pool complex (Katajanokanlaituri) municipal shells whose photo
// atlases render as dark smeared boxes. 2024 street-level photography from the
// Kauppatori/Pohjoisranta corner shows dark-brown timber cladding with a lighter
// roof deck, and a pale ochre timber block beside the SkyWheel. These shells keep
// their measured geometry but drop the smeared texture for flat photo-guided
// colours (sRGB hex); no windows are inferred from the smeared pixels.
// Confidence: Allas timber = medium (photo, part identity by position);
// pale block BID_af955f0d = low-medium (identity inferred from bearing only).
export const CLEAN_WATERFRONT_SHELLS={
 'BID_5e10e2e5-9b57-4911-aed5-a9e9c998c485':{name:'Allas main timber building',wall:'#5b4a3e',roof:'#6a6158'},
 'BID_61fc6e9a-3347-4a73-bd26-3d4a06362e45':{name:'Allas pool-side timber wing',wall:'#5b4a3e',roof:'#6a6158'},
 'BID_f29019e0-5810-433e-93a4-e5fcad2fe71a':{name:'Allas low timber annex',wall:'#5b4a3e',roof:'#4d4640'},
 'BID_2fb99b3c-fb6c-468b-a1b1-df8dcd568130':{name:'Allas stack/tower',wall:'#4a3f37',roof:'#3f3a36'},
 'BID_eb2927ff-17a4-47bf-9c03-e7f31567f406':{name:'Allas small annex',wall:'#5b4a3e',roof:'#4d4640'},
 'BID_af955f0d-d963-41e3-a563-9dee154dfddf':{name:'Pale timber pavilion by SkyWheel (RATU 64595)',wall:'#a8957a',roof:'#5e5953'},
 // Three low floating/quay units at x270-282,z306-321 (incl. RATU 71800): the same
 // photo shows a dark charcoal-clad low building with a dark roof at this bearing.
 // Confidence: low-medium (identity by bearing; far, partly occluded in the photo).
 'BID_c6be6cac-848f-47e9-898e-44bc97d39d25':{name:'Dark clad basin pavilion (south unit)',wall:'#3f4244',roof:'#2e3134'},
 'BID_021b53b4-2086-4639-9c47-740b7617928c':{name:'Dark clad basin pavilion (RATU 71800)',wall:'#3f4244',roof:'#2e3134'},
 'BID_38ece0be-1767-44a6-abd7-19df6a24688a':{name:'Dark clad basin pavilion (north unit)',wall:'#3f4244',roof:'#2e3134'},
};
const hexRGB=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function cleanWaterfrontShell(part){
 const c=CLEAN_WATERFRONT_SHELLS[part?.id];return c?{...c,wallRGB:hexRGB(c.wall),roofRGB:hexRGB(c.roof)}:null;
}
export function isWaterfrontFront(ratu,f){
 if(ratu===221)return (f.normal.z>.98&&Math.abs(f.d-233.61)<.6)||(f.normal.x>.98&&f.d>-22&&f.d<-17)||(f.normal.x<-.98&&Math.abs(f.d-64.92)<.4);
 if(ratu===335)return f.normal.z>.98&&f.d>233.3&&f.d<234;
 if(ratu===410)return Math.abs(f.normal.z)>.95&&(f.d>482||f.d< -396);
 const c=WATERFRONT_FRONTAGES[ratu];
 if(!c||f.normal.z<.98)return false;
 return ratu===23?f.d>208&&f.d<216&&f.y1>8:f.d>c.d-3&&f.d<c.d+1;
}
const material=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function palette(color){return {wall:material(color),trim:material('#dbd7c9'),glass:material('#29434c',.25,.3),stone:material('#827e75'),iron:material('#334441',.6,.5),copper:material('#55716a',.5,.4)};}
function window(b,m,x,y,w,h,z=.2){
 b.box(w,h,.12,m.glass,x,y,z);
 for(const dx of [-w/2-.085,w/2+.085])b.box(.14,h+.22,.22,m.trim,x+dx,y,z+.08);
 for(const yy of [y-h/2-.08,y+h/2+.08])b.box(w+.3,.14,.24,m.trim,x,yy,z+.08);
 b.box(.055,h,.1,m.trim,x,y,z+.12);b.box(w,.06,.1,m.trim,x,y+h*.17,z+.12);
 b.box(w+.42,.12,.4,m.trim,x,y-h/2-.16,z+.14);
}
function archWindow(b,m,x,y,w,h,z=.2){
 const r=w/2,shape=new THREE.Shape();shape.moveTo(-r,-h/2);shape.lineTo(r,-h/2);shape.lineTo(r,h/2-r);shape.absarc(0,h/2-r,r,0,Math.PI);shape.closePath();
 b.add(new THREE.ShapeGeometry(shape),m.glass,x,y,z);
 for(const side of [-1,1])b.box(.12,h-r,.18,m.trim,x+side*(r+.07),y-r/2,z+.04);
 b.add(new THREE.TorusGeometry(r+.06,.07,6,24,Math.PI),m.trim,x,y+h/2-r,z+.07);
 b.box(.06,h,.1,m.trim,x,y,z+.08);b.box(w,.06,.1,m.trim,x,y+h/2-r,z+.08);b.box(w+.3,.14,.32,m.trim,x,y-h/2,z+.08);
}
function pediment(b,m,x,y,w,h,z){
 const shape=new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(0,h)]);
 b.add(new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false}),m.wall,x,y,z);
 b.box(w+.3,.18,.42,m.trim,x,y,z+.12);
 for(const sign of [-1,1]){const a=new THREE.Vector3(x+sign*w/2,y,z+.22),v=new THREE.Vector3(x,y+h,z+.22).sub(a),g=new THREE.CylinderGeometry(.09,.09,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...a.addScaledVector(v,.5).toArray());b.add(g,m.trim);}
}
function balustrade(b,m,x,y,z,w){
 b.box(w,.16,.4,m.trim,x,y+1,z);b.box(w,.16,.4,m.trim,x,y,z);
 for(let s=-w/2+.2;s<w/2;s+=.43){b.cylinder(.085,.1,.8,m.trim,x+s,y+.5,z,8);}
}
function column(b,m,x,z,y,h,r=.3){
 b.box(r*2.9,.22,r*2.9,m.trim,x,y+.11,z);b.cylinder(r*.85,r,h-.6,m.trim,x,y+h/2,z,20);b.box(r*2.9,.25,r*2.9,m.trim,x,y+h-.14,z);
}
function bake(b,s,d,angle=.052){
 const group=b.finish();group.position.set(Math.cos(angle)*s+Math.sin(angle)*d,0,-Math.sin(angle)*s+Math.cos(angle)*d);group.rotation.y=angle;group.updateMatrixWorld(true);
 for(const mesh of group.children)mesh.geometry.applyMatrix4(group.matrixWorld);return group.children;
}
export function createWaterfrontFront(ratu){
 if(ratu===221)return createEsplanadeCorner();
 if(ratu===335)return createUschakoffFront();
 if(ratu===410)return createMarketHallEnds();
 const c=WATERFRONT_FRONTAGES[ratu];if(!c)return [];
 const b=architectureBuilder(),m=palette(c.color),w=c.width,h=c.height;
 // City Hall: 2024 reference photography of the front
 // shows a pink-grey granite plinth (~sRGB 134,120,117), not grey stone.
 if(ratu===216)m.stone.color.set('#8a7a74');
 b.box(w,h,.45,m.wall,0,h/2,-.23);b.box(w,ratu===216?1.1:.75,.55,m.stone,0,ratu===216?.55:.375,-.05);
 if(ratu===216){
  // Horizontal rustication courses across the rendered wall (same photo). Raised
  // wall-coloured strips catch light; course spacing is photo-estimated.
  for(let y=1.45;y<h-1.3;y+=.56)if(Math.abs(y-5.4)>.3&&Math.abs(y-10.7)>.3)b.box(w,.05,.05,m.wall,0,y,.02);
 }
 const rows=ratu===18?[[3.5,2.8],[8.9,3.5],[13.5,1.9]]:ratu===23?[[2.7,3.3],[7.5,3.25],[12,2.25]]:[[3,2.8],[8.1,3.2],[13.25,2.8]];
 for(const y of [.85,5.4,10.7,h-.9,h-.35,h])b.box(w+.2,y===h?.24:.16,y===h?.7:.4,m.trim,0,y,.12);
 for(let i=0;i<c.bays;i++){
  const x=-w/2+1.6+i*(w-3.2)/(c.bays-1);
  for(const [j,[y,wh]] of rows.entries())if(ratu===23&&j===0)archWindow(b,m,x,y,1.4,wh);else window(b,m,x,y,ratu===216?1.12:1.35,wh);
  // City Hall's pale fabric window awnings (same photography): on every
  // window except the ground floor behind the central portico. Trim batch,
  // so no extra draw call. Projection/slope are estimated.
  if(ratu===216)for(const [j,[y,wh]] of rows.entries()){
   if(j===0&&Math.abs(x)<9.6)continue;
   const g=new THREE.BoxGeometry(1.55,.035,.86);g.rotateX(.66);b.add(g,m.trim,x,y+wh/2+.02,.58);
   for(const side of [-1,1]){const cheek=new THREE.BoxGeometry(.025,.42,.6);cheek.rotateX(.62);b.add(cheek,m.trim,x+side*.74,y+wh/2-.1,.5);}
  }
  if(ratu===24){b.box(1.9,.22,.4,m.trim,x,9.99,.26);for(const y of [6.4,11.8])for(const dx of [-.94,.94])b.box(.16,2.7,.32,m.trim,x+dx,y+1,.25);if(Math.abs(i-6)<=1)pediment(b,m,x,10.03,2.1,.6,.38);}
 }
 if(ratu===216){
  // Six lower columns, upper paired order and the broad central pediment.
  const cw=18.4;b.box(cw,.45,2.8,m.trim,0,5.65,1.15);
  for(let i=0;i<6;i++){column(b,m,-8+i*3.2,2.1,.45,4.95,.3);b.box(.42,9.85,.5,m.trim,-8+i*3.2,10.65,.4);}
  balustrade(b,m,0,5.9,2.25,cw);pediment(b,m,0,h+.15,19,2.05,.25);
  for(const edge of [-1,1])for(const dx of [0,1.05,3.7,4.75])b.box(.43,10.3,.48,m.trim,edge*(w/2-.65-dx),10.8,.25);
  for(let x=-w/2+.2;x<w/2;x+=.42)b.box(.18,.18,.4,m.trim,x,h-.45,.4);
  // Forecourt masts and their animated flags are owned by city-hall-flag.js.
 }
 if(ratu===18){
  balustrade(b,m,0,h+.15,.1,w);for(let i=0;i<14;i++)b.box(.46,1.35,.5,m.trim,-w/2+i*w/13,h+.65,.1);
  b.box(2.3,4,.16,material('#564330'),0,2.5,.4);for(const x of [-1.75,1.75])column(b,m,x,1.3,.5,4.1,.28);
  b.box(4.3,.18,2,m.copper,0,4.7,.95);
 }
 if(ratu===24){balustrade(b,m,0,5.65,1.25,6.8);b.box(6.8,.35,1.65,m.trim,0,5.55,.65);balustrade(b,m,0,h+.2,.1,10);}
 if(ratu===23){
  b.box(18,.45,2.1,m.trim,0,5.2,.95);
  for(let i=0;i<6;i++){const x=-7.6+i*3.04;column(b,m,x,1.8,5.4,8.65,.32);for(const side of [-1,1])b.add(new THREE.TorusGeometry(.14,.055,6,12),m.trim,x+side*.24,13.8,2.05);}
  pediment(b,m,0,14.55,18.8,2.0,1.8);
  b.box(18,.1,.1,m.iron,0,6.5,1.95);for(let x=-9;x<=9;x+=.3)b.box(.04,1.1,.04,m.iron,x,5.98,1.95);
  // Open-front sentry boxes: the guards stand in the recess, not inside a solid block.
  for(const x of [-5,5]){b.box(.78,2.6,.09,m.trim,x,1.4,4.57);for(const side of [-1,1])b.box(.09,2.6,.7,m.trim,x+side*.36,1.4,4.9);b.add(new THREE.ConeGeometry(1.05,.5,4),m.copper,x,2.95,4.9);}
 }
 return bake(b,c.s,c.d);
}

// Pohjoisesplanadi 15–17 is ONE municipal building ID but TWO visually
// distinct street fronts. Do not turn it into one repeated cream window grid.
// Surveyed south plane: n=(.057,0,.998), d=233.61, s=-64.76..-18.61.
// August 2024 street-level photography:
// seven-bay pale west front; eight-bay yellow east front; rusticated ground
// floor, dark shop glazing, sill panels, corbels and separate roof cornices.
function esplanadeElevation(width,height,bays,color,ornate=false){
 const b=architectureBuilder(),m=palette(color);m.glass.color.set('#344542');
 b.box(width,height,.40,m.wall,0,height/2,-.22);
 b.box(width,.62,.5,m.stone,0,.31,-.06);
 for(let y=.85;y<4.65;y+=.36)b.box(width,.035,.065,m.stone,0,y,.012);
 for(const y of [4.55,4.84,5.5,10.4,height-.7,height-.34,height])b.box(width+.12,y===height?.22:.13,y===height?.62:.34,m.trim,0,y,.15);
 const spacing=(width-2.3)/(bays-1);
 for(let i=0;i<bays;i++){
  const x=-width/2+1.15+i*spacing;
  window(b,m,x,2.28,1.45,2.7);
  window(b,m,x,7.6,1.36,2.75);
  window(b,m,x,12.23,1.26,2.35);
  b.box(1.94,.17,.48,m.trim,x,9.24,.30);
  b.box(1.62,.16,.34,m.trim,x,13.6,.23);
  b.box(1.7,.62,.1,m.trim,x,5.02,.12);b.box(1.38,.38,.12,m.wall,x,5.02,.2);
  // Separate sill corbels, not black pixels mistaken for window openings.
  for(const dx of [-.60,.60])b.box(.14,.26,.30,m.trim,x+dx,10.85,.26);
  if(ornate){
   for(const y of [5.65,10.6])for(const dx of [-1.0,1.0])b.box(.18,3.55,.24,m.trim,x+dx,y+1.65,.2);
   if(i>=2&&i<=4)pediment(b,m,x,9.4,2.15,.63,.3);
   const awning=new THREE.BoxGeometry(1.85,.09,1.1);awning.rotateX(-.2);b.add(awning,m.trim,x,3.82,.64);
  }
 }
 for(const side of [-1,1])for(let y=5.5;y<height-.8;y+=.46)b.box(.6,.28,.27,m.trim,side*(width/2-.3),y,.13);
 if(ornate){for(let x=-width/2+.2;x<width/2;x+=.4)b.box(.15,.23,.42,m.trim,x,height-.43,.22);}
 return b;
}
function createEsplanadeCorner(){
 const angle=Math.atan2(.057,.998),meshes=[];
 // Split position is inferred from the photographed colour/roof break.
 for(const c of [{s0:-64.76,s1:-44,h:15.56,bays:7,color:'#d3d0c4',ornate:true},{s0:-44,s1:-18.61,h:14.56,bays:8,color:'#d7c696'}]){
  meshes.push(...bake(esplanadeElevation(c.s1-c.s0,c.h,c.bays,c.color,c.ornate),(c.s0+c.s1)/2,233.64,angle));
 }
 // Return elevations follow measured planes and stop at the courtyard;
 // window spacing is interpreted where the reference photography obscures individual bays.
 meshes.push(...bake(esplanadeElevation(41.12,14.56,12,'#d7c696'),(-233.61-192.49)/2,-18.60,Math.atan2(.998,-.057)));
 meshes.push(...bake(esplanadeElevation(39.33,15.56,12,'#d3d0c4',true),(192.86+232.19)/2,64.95,Math.atan2(-.999,.05)));
 return meshes;
}
function createUschakoffFront(){
 const width=27.32,b=esplanadeElevation(width,13.1,9,'#d9c793'),m=palette('#d9c793');
 // Low classical central order visible across Havis Amanda; preserve the
// municipal roof rather than adding an unrelated mansard or tower.
 for(const x of [-4.8,-1.6,1.6,4.8])b.box(.45,8.0,.5,m.trim,x,8.35,.35);
 pediment(b,m,0,13.18,11.1,1.6,.2);
 return bake(b,(-110.55-83.23)/2,233.81,Math.atan2(.053,.999));
}
export function createPalaceWingDetails(face){
 const width=face.s1-face.s0,height=face.y1-face.y0;
 if(width<4||face.y0>1||face.y1<4||face.y1>7.5||height<3)return [];
 const b=architectureBuilder(),m=palette('#d4cbb2'),count=Math.max(1,Math.round(width/3.4));
 for(let i=0;i<count;i++)archWindow(b,m,-width/2+(i+.5)*width/count,2.65,1.35,3.1);
 b.box(width,.2,.45,m.trim,0,face.y1-.2,.2);balustrade(b,m,0,face.y1+.1,.15,width);
 return bake(b,(face.s0+face.s1)/2,face.d+.04,Math.atan2(face.normal.x,face.normal.z));
}
function createMarketHallEnds(){
 const meshes=[];
 for(const side of [-1,1]){
  const b=architectureBuilder(),m=palette('#984f3d'),w=16;
  // Stepped gable composition follows the photographed three-portal end face.
  b.box(w,5.9,.35,m.wall,0,2.95,-.18);b.box(5.4,4.0,.35,m.wall,0,7.9,-.18);
  b.box(w,.45,.48,m.stone,0,.225,0);
  for(let y=.9;y<6;y+=.9)b.box(w,.12,.48,m.trim,0,y,.08);
  for(const x of [-7.7,-5.5,-2.9,2.9,5.5,7.7]){b.box(.48,6,.55,m.wall,x,3,.15);for(let y=1;y<6;y+=.9)b.box(.62,.16,.65,m.trim,x,y,.2);}
  for(const x of [-4.1,0,4.1]){
   window(b,m,x,1.7,x===0?2.8:2.1,2.7,.28);
   const radius=x===0?1.4:1.05,arch=new THREE.TorusGeometry(radius,.14,6,24,Math.PI);b.add(arch,m.trim,x,3.0,.46);
   const glass=new THREE.CircleGeometry(radius,24,0,Math.PI);b.add(glass,m.glass,x,3.0,.35);
  }
  window(b,m,0,7.15,3.6,3.5,.22);
  for(let y=5.65;y<8.9;y+=.52)b.box(3.6,.04,.12,m.trim,0,y,.38);
  for(const x of [-1.2,-.6,.6,1.2])b.box(.045,3.5,.12,m.trim,x,7.15,.38);
  pediment(b,m,0,9.15,5.8,1.35,.25);
  for(const x of [-5.4,5.4])pediment(b,m,x,5.85,5.5,1.4,.22);
  for(const x of [-7.8,-2.85,2.85,7.8]){b.cylinder(.14,.24,.6,m.trim,x,6.45,.15,12);b.add(new THREE.SphereGeometry(.19,10,6),m.trim,x,6.87,.15);}
  // North and south ends share the principal composition; ornament dimensions
  // are interpreted, not a scan. The original roof remains above this frontage.
  meshes.push(...bake(b,side*7.95,side===1?483.3:-397.6,.052+(side===-1?Math.PI:0)));
 }
 return meshes;
}
