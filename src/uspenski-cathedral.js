import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Uspenski Cathedral (Uspenskin katedraali, A. Gornostayev, 1862–68) on the
// Katajanokka rock. Registration, orientation, footprint outline and the height
// envelope come from the municipal record RATU 1691 (city.pack footprint and the
// buildings3d LoD2 shell, whose photo-textured version this replaces). Brick
// ornament, window rhythm, cupola profiles and the hill are photo-guided
// interpretations
//
// Local frame: +X points (almost) east toward the apses, +Z (almost) south toward
// the bell tower. World = centre + rotateY(angle) * local; y is metres above the
// flattened street level (the municipal shell stands on y≈0.12).
export const USPENSKI={
 ratu:1691,address:'Kanavakatu 1 (municipal: Pormestarinrinne 1)',
 // Minimum-area rectangle of the municipal footprint's main block (z<190.5, x<440).
 x:426.48,z:176.40,angle:.059,halfX:13.72,halfZ:13.76,
 terrace:5.4,            // rock plateau above Kanavakatu: 48.3 m envelope − ~43 m church height
 crossTop:48.3,          // municipal LoD2 maximum 48.27 m
 crossing:[.45,.1]       // main drum axis: LoD2 top cluster at world (427.1,176.5)
};
// Hill outline in world XZ, traced to stay clear of every mapped road/pavement
// polygon (Kanavakatu, Kanavaranta, Pormestarinrinne, park stairs) and of the
// neighbouring Kanavaranta 7 building. Style of the edge that starts at a vertex:
// cliff = bare granite face (Kanavakatu side), wall = retaining granite wall
// (Pormestarinrinne side), slope = grassed bank.
export const USPENSKI_HILL=[
 [401,163,'slope'],[409,150,'slope'],[430,148,'slope'],[446,150,'wall'],[452,158,'wall'],[453,172,'wall'],[453,192,'slope'],
 [450,206,'slope'],[443,217,'slope'],[431,227,'cliff'],[418,232,'cliff'],[408,227,'cliff'],[404,217,'cliff'],[401,205,'cliff'],
 // West: the mapped open-rock outcrop (Avokallio, KANAVAPUISTO) down toward Kanavaranta.
 [386,206.5,'cliff'],[372,205,'cliff'],[364,197,'cliff'],[363,187,'cliff'],[368,179,'slope'],[386,175,'slope'],[395,166,'slope']
];
// Trees on the rock (world x, z, scale): west/south-west slopes and north bank, per photos.
export const USPENSKI_TREES=[[388,195,1],[380,190,.9],[372,197,.8],[404,212,1.1],[414,221,1],[428,220,1.15],[440,211,1],[447,197,.9],[411,161,1],[421,154,1.1],[438,154,.9],[392,173,.9],[379,183,.8],[398,184,1]];
const RAMP={cliff:1.3,wall:.7,slope:8};
// Granite stair cut into the south-west rock from the KANAVAPUISTO path (world x≈394).
export const USPENSKI_STAIR={x:394,z0:205.8,z1:195,width:3.2,steps:16};

function masonry(color,{course,block,mortar,strength=.5,key}){
 const m=new THREE.MeshStandardMaterial({color,roughness:.9});
 // Procedural running bond in object space, faded out by screen-space footprint
 // so distant walls do not shimmer. No image textures.
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vMasonPos;\nvarying vec3 vMasonNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMasonPos=position;vMasonNormal=normal;');
  shader.fragmentShader='varying vec3 vMasonPos;\nvarying vec3 vMasonNormal;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 {
  vec3 an=abs(vMasonNormal);
  float along=an.x>an.z?vMasonPos.z:vMasonPos.x;
  vec2 q=an.y>.75?vMasonPos.xz/vec2(${block.toFixed(3)},${course.toFixed(3)}):vec2(along/${block.toFixed(3)},vMasonPos.y/${course.toFixed(3)});
  float row=floor(q.y);q.x+=mod(row,2.)*.5;
  vec2 cell=floor(q),f=abs(fract(q)-.5);
  float fw=max(fwidth(q.x),fwidth(q.y));
  float fade=1.-smoothstep(.12,.45,fw);
  float jx=${(.018/block).toFixed(4)},jy=${(.018/course).toFixed(4)};
  float seam=max(smoothstep(.5-jx*1.6,.5-jx*.6,f.x),smoothstep(.5-jy*1.6,.5-jy*.6,f.y));
  float h=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
  diffuseColor.rgb*=mix(1.,.86+h*.24,fade*${strength.toFixed(2)});
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${mortar.join(',')}),seam*fade*.55);
 }`);
 };
 m.customProgramCacheKey=()=>`uspenski-masonry-${key}`;
 return m;
}
function materials(){
 return {
  brick:masonry('#7d4034',{course:.16,block:.3,mortar:[.56,.5,.46],key:'brick'}),
  trim:masonry('#9a5b4b',{course:.16,block:.3,mortar:[.62,.56,.52],strength:.35,key:'trim'}),
  granite:masonry('#8a837c',{course:.55,block:1.1,mortar:[.36,.34,.32],strength:.8,key:'granite'}),
  copper:new THREE.MeshStandardMaterial({color:'#88b8ad',metalness:.25,roughness:.6}),
  gold:new THREE.MeshStandardMaterial({color:'#e2b14a',metalness:.7,roughness:.28,emissive:'#3a2a08'}),
  glass:new THREE.MeshStandardMaterial({color:'#1f272b',metalness:.35,roughness:.3}),
  iron:new THREE.MeshStandardMaterial({color:'#2f3533',metalness:.5,roughness:.6}),
  hill:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96})
 };
}
function builder(){
 const batches=new Map();
 function add(g,mat,x=0,y=0,z=0,ry=0){
  if(g.index)g=g.toNonIndexed();if(g.attributes.uv)g.deleteAttribute('uv');if(g.attributes.uv1)g.deleteAttribute('uv1');
  if(!g.attributes.normal)g.computeVertexNormals();
  if(ry)g.rotateY(ry);g.translate(x,y,z);
  if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);return g;
 }
 const box=(w,h,d,mat,x,y,z,ry=0)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z,ry);
 // Axis-aligned box from bounds (local frame), bottom at y0.
 const block=(x0,x1,z0,z1,y0,y1,mat)=>box(x1-x0,y1-y0,z1-z0,mat,(x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
 const cyl=(rt,rb,h,mat,x,y,z,n=16,open=false,t0=0,tl=Math.PI*2)=>add(new THREE.CylinderGeometry(rt,rb,h,n,1,open,t0,tl),mat,x,y+h/2,z);
 function lathe(profile,mat,x,y,z,n=24){return add(new THREE.LatheGeometry(profile.map(([r,v])=>new THREE.Vector2(Math.max(.001,r),v)),n),mat,x,y,z);}
 function finish(name){
  const group=new THREE.Group();group.name=name;
  for(const [mat,list] of batches){const g=mergeGeometries(list);g.computeBoundingSphere();list.forEach(x=>x.dispose());const mesh=new THREE.Mesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  batches.clear();return group;
 }
 return {add,box,block,cyl,lathe,finish};
}

// A wall face: origin point, outward normal. `s` runs along the face, y is height.
function face(ox,oz,nx,nz){return {ox,oz,nx,nz,tx:-nz,tz:nx,ry:Math.atan2(nx,nz)};}
const at=(f,s,out=0)=>[f.ox+f.tx*s+f.nx*out,f.oz+f.tz*s+f.nz*out];
function archShape(w,h){const s=new THREE.Shape(),r=w/2;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.closePath();return s;}

function makeKit(b,m){
 // Recessed-looking arched window: dark glazing, brick trim arch, jambs and sill.
 function win(f,s,y,w,h,{trim=m.trim,depth=.06,sill=true,bars=true}={}){
  const [x,z]=at(f,s,depth);b.add(new THREE.ShapeGeometry(archShape(w,h),6),m.glass,x,y,z,f.ry);
  const [ax,az]=at(f,s,depth+.05);b.add(new THREE.TorusGeometry(w/2+.09,.1,4,10,Math.PI),trim,ax,y+h-w/2,az,f.ry);
  for(const side of [-1,1]){const [jx,jz]=at(f,s+side*(w/2+.09),depth+.05);b.box(.2,h-w/2,.2,trim,jx,y+(h-w/2)/2,jz,f.ry);}
  if(sill){const [sx,sz]=at(f,s,depth+.1);b.box(w+.5,.16,.3,trim,sx,y-.08,sz,f.ry);}
  if(bars&&w>.8){const [mx,mz]=at(f,s,depth+.02);b.box(.06,h-.1,.05,trim,mx,y+(h-.1)/2,mz,f.ry);b.box(w,.06,.05,trim,mx,y+h*.55,mz,f.ry);}
 }
 // Corbel-table frieze below cornices (small brick blocks), a Byzantine-revival
 // detail visible along all eaves of the cathedral.
 function frieze(f,s0,s1,y,step=.62){const n=Math.max(1,Math.floor((s1-s0)/step));for(let i=0;i<=n;i++){const [x,z]=at(f,s0+(s1-s0)*i/n,.12);b.box(.22,.34,.22,m.trim,x,y-.17,z,f.ry);}}
 function band(f,s0,s1,y,h=.32,out=.14){const [x,z]=at(f,(s0+s1)/2,out/2);b.box(Math.abs(s1-s0),h,out+.02,m.trim,x,y,z,f.ry);}
 // Pilaster strip.
 function pilaster(f,s,y0,y1,w=.45){const [x,z]=at(f,s,.08);b.box(w,y1-y0,.18,m.trim,x,(y0+y1)/2,z,f.ry);}
 function onion(x,y,z,r,h,mat=m.gold,n=16){
  const p=[[0,0],[.45,0],[.52,.05],[.8,.18],[1,.36],[.98,.5],[.84,.65],[.58,.8],[.3,.91],[.1,.98],[0,1.02]];
  b.lathe(p.map(([u,v])=>[u*r,v*h]),mat,x,y,z,n);
 }
 // Russian Orthodox cross: upright, short titulus, main bar and slanted foot bar.
 function cross(x,y,z,H){
  const t=Math.max(.05,H*.055);b.box(t,H,t,m.gold,x,y+H/2,z);
  b.box(t,t,H*.62,m.gold,x,y+H*.72,z);b.box(t,t,H*.34,m.gold,x,y+H*.88,z);
  const foot=new THREE.BoxGeometry(t,t,H*.36);foot.rotateX(.38);b.add(foot,m.gold,x,y+H*.3,z);
  b.lathe([[0,0],[t*1.6,0],[t*1.9,t*1.2],[0,t*2.4]],m.gold,x,y-t*.6,z,8);
 }
 // Square tent roof (shatyor) with a slight concave flare at the eaves.
 function tent(x,y,z,half,h,mat=m.copper,n=4){
  const r=half*Math.SQRT2,p=[[r*1.02,0],[r*.84,h*.12],[r*.55,h*.42],[r*.28,h*.72],[.06,h]];
  const g=new THREE.LatheGeometry(p.map(([u,v])=>new THREE.Vector2(u,v)),n,Math.PI/4);b.add(g,mat,x,y,z);
 }
 return {win,frieze,band,pilaster,onion,cross,tent};
}

function buildChurch(m){
 const b=builder(),k=makeKit(b,m),T=USPENSKI.terrace,[cx,cz]=USPENSKI.crossing;
 // ---- Main body: cross arms over lower corner bays (municipal outline, local frame).
 const arm={nsX:[-5.3,6.2],nsZ:[-12.2,12.6],weX:[-11.7,12.6],weZ:[-5.6,5.8]},bay={x:[-11.6,12.6],z:[-12,12.4]};
 const ARM=22.5,BAY=17,RIDGE=25.8,GABLE=28.8;
 b.block(bay.x[0],bay.x[1],bay.z[0],bay.z[1],0,BAY,m.brick);
 b.block(arm.nsX[0],arm.nsX[1],arm.nsZ[0],arm.nsZ[1],0,ARM,m.brick);
 b.block(arm.weX[0],arm.weX[1],arm.weZ[0],arm.weZ[1],0,ARM,m.brick);
 // Granite socle and continuous string courses: slightly oversized copies of the
 // three volumes read as projecting bands.
 for(const [y0,y1,mat,grow] of [[0,T+.9,m.granite,.25],[T+.9,T+1.2,m.trim,.32],[12.6,12.95,m.trim,.22],[BAY-.45,BAY,m.trim,.3]]){
  b.block(bay.x[0]-grow,bay.x[1]+grow,bay.z[0]-grow,bay.z[1]+grow,y0,y1,mat);
  b.block(arm.nsX[0]-grow,arm.nsX[1]+grow,arm.nsZ[0]-grow,arm.nsZ[1]+grow,y0,y1,mat);
  b.block(arm.weX[0]-grow,arm.weX[1]+grow,arm.weZ[0]-grow,arm.weZ[1]+grow,y0,y1,mat);
 }
 b.block(arm.nsX[0]-.3,arm.nsX[1]+.3,arm.nsZ[0]-.3,arm.nsZ[1]+.3,ARM-.5,ARM,m.trim);
 b.block(arm.weX[0]-.3,arm.weX[1]+.3,arm.weZ[0]-.3,arm.weZ[1]+.3,ARM-.5,ARM,m.trim);
 // Pitched copper roofs over the arms and low hipped roofs over the corner bays.
 function prism(len,width,rise,mat,x,y,z,alongX){
  const s=new THREE.Shape([new THREE.Vector2(-width/2,0),new THREE.Vector2(width/2,0),new THREE.Vector2(0,rise)]);
  const g=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});g.translate(0,0,-len/2);if(alongX)g.rotateY(Math.PI/2);b.add(g,mat,x,y,z);
 }
 prism(arm.nsZ[1]-arm.nsZ[0]+.4,arm.nsX[1]-arm.nsX[0]+.7,RIDGE-ARM,m.copper,cx,ARM,(arm.nsZ[0]+arm.nsZ[1])/2,false);
 prism(arm.weX[1]-arm.weX[0]+.4,arm.weZ[1]-arm.weZ[0]+.7,RIDGE-ARM,m.copper,(arm.weX[0]+arm.weX[1])/2,ARM,cx*0+.1,true);
 for(const x of [(bay.x[0]+arm.nsX[0])/2,(bay.x[1]+arm.nsX[1])/2])for(const z of [(bay.z[0]+arm.weZ[0])/2,(bay.z[1]+arm.weZ[1])/2])k.tent(x,BAY,z,3.3,1.6,m.copper);
 // ---- Arm facades: pediment gable, great arched window, paired lower windows.
 const armFaces=[
  {f:face(cx,arm.nsZ[0],0,-1),half:(arm.nsX[1]-arm.nsX[0])/2,name:'north'},
  {f:face(cx,arm.nsZ[1],0,1),half:(arm.nsX[1]-arm.nsX[0])/2,name:'south'},
  {f:face(arm.weX[0],.1,-1,0),half:(arm.weZ[1]-arm.weZ[0])/2,name:'west'},
  {f:face(arm.weX[1],.1,1,0),half:(arm.weZ[1]-arm.weZ[0])/2,name:'east'}
 ];
 for(const {f,half,name} of armFaces){
  const s=new THREE.Shape([new THREE.Vector2(-half-.2,0),new THREE.Vector2(half+.2,0),new THREE.Vector2(0,GABLE-ARM)]);
  const g=new THREE.ExtrudeGeometry(s,{depth:.7,bevelEnabled:false});g.translate(0,0,-.55);const [gx,gz]=at(f,0);b.add(g,m.brick,gx,ARM,gz,f.ry);
  // Raking cornices of the gable.
  const len=Math.hypot(half+.3,GABLE-ARM),ang=Math.atan2(GABLE-ARM,half+.3);
  for(const side of [-1,1]){const r=new THREE.BoxGeometry(len,.32,.5);r.rotateZ(side*ang);const [rx,rz]=at(f,side*(half+.3)/2,.05);b.add(r,m.trim,rx,ARM+(GABLE-ARM)/2+.1,rz,f.ry);}
  const [ox,oz]=at(f,0,.12);b.add(new THREE.TorusGeometry(.95,.14,5,18),m.trim,ox,ARM+2.2,oz,f.ry);
  const [cx2,cz2]=at(f,0,.08);b.add(new THREE.CircleGeometry(.85,14),m.glass,cx2,ARM+2.2,cz2,f.ry);
  k.frieze(f,-half+.3,half-.3,ARM-.5);
  for(const sd of [-half+.25,half-.25])k.pilaster(f,sd,T+1.2,ARM-.5,.55);
  if(name!=='east'){k.win(f,0,15,2.7,5.6);for(const sd of [-3.7,3.7])k.win(f,sd,15.4,.95,3.6);}
  else k.win(f,0,16.8,2.2,3.8);
  if(name==='west'){for(const sd of [-3.9,3.9])k.win(f,sd,T+2.6,1,3.6);}
  else if(name!=='east'){for(const sd of [-3.8,-1.3,1.3,3.8])k.win(f,sd,T+2.8,1,3.6);}
  k.band(f,-half,half,11.2,.22,.1);
  for(let i=0;i<7;i++){const [ax,az]=at(f,-3.6+i*1.2,.1);b.add(new THREE.TorusGeometry(.5,.08,3,8,Math.PI),m.trim,ax,11.4,az,f.ry);}
 }
 // ---- Corner bays: two storeys of narrow paired arched windows on each outer face.
 const bayFaces=[];
 for(const [x0,x1] of [[bay.x[0],arm.nsX[0]],[arm.nsX[1],bay.x[1]]]){bayFaces.push([face((x0+x1)/2,bay.z[0],0,-1),(x1-x0)]);bayFaces.push([face((x0+x1)/2,bay.z[1],0,1),(x1-x0)]);}
 for(const [z0,z1] of [[bay.z[0],arm.weZ[0]],[arm.weZ[1],bay.z[1]]])bayFaces.push([face(bay.x[0],(z0+z1)/2,-1,0),z1-z0]);
 for(const [f,w] of bayFaces){
  const s0=-w/2+.45,s1=w/2-.45;k.frieze(f,s0,s1,BAY-.45);
  for(const sd of [-.62,.62]){k.win(f,sd,T+2.8,.78,3.2);k.win(f,sd,13.3,.78,2.9);}
 }
 // ---- Eight flanking towers (tents + gilded onions) on the arm corners; LoD2 stubs.
 const TOWERS=[[-6.25,-12.4],[7.25,-12.4],[-6.0,12.8],[7.1,12.8],[-12.1,-6.65],[-12.1,6.75],[11.6,-6.9],[11.4,6.7]];
 const TW=2.6,TOP=23.6;let cupolas=0;
 for(const [x,z] of TOWERS){
  b.box(TW,TOP,TW,m.brick,x,TOP/2,z);
  b.box(TW+.3,T+.9,TW+.3,m.granite,x,(T+.9)/2,z);
  for(const y of [12.6,BAY-.45,ARM-.5])b.box(TW+.24,.36,TW+.24,m.trim,x,y+.18,z);
  b.box(TW+.45,.35,TW+.45,m.trim,x,TOP+.17,z);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,f=face(x+Math.sin(a)*TW/2,z+Math.cos(a)*TW/2,Math.sin(a),Math.cos(a));k.win(f,0,ARM+.1,.62,1.55,{sill:false,bars:false});k.win(f,0,18.2,.5,2.4,{sill:false,bars:false});}
  k.tent(x,TOP+.34,z,TW/2+.2,3.9);
  b.cyl(.22,.26,.4,m.copper,x,TOP+3.95,z,8);
  k.onion(x,TOP+4.3,z,.46,1.2);k.cross(x,TOP+5.45,z,1.05);cupolas++;
 }
 // ---- Four satellite drums in the re-entrant corners of the cross.
 const SAT=5.75;
 for(const dx of [-SAT,SAT])for(const dz of [-SAT,SAT]){
  const x=cx+dx,z=cz+dz;
  b.box(2.9,23.3-BAY,2.9,m.brick,x,(BAY+23.3)/2,z);b.box(3.2,.3,3.2,m.trim,x,23.3,z);
  b.cyl(1.3,1.3,3.9,m.brick,x,23.3,z,16);
  for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6,f=face(x+Math.sin(a)*1.3,z+Math.cos(a)*1.3,Math.sin(a),Math.cos(a));k.win(f,0,24,.44,2,{sill:false,bars:false,depth:.02});}
  b.cyl(1.55,1.45,.35,m.trim,x,27.2,z,16);
  b.lathe([[1.5,0],[1.55,.3],[1.3,.8],[.85,1.2],[.35,1.45],[.18,1.55]],m.copper,x,27.55,z,16);
  b.cyl(.2,.22,.35,m.copper,x,29.05,z,8);
  k.onion(x,29.35,z,.6,1.5);k.cross(x,30.8,z,1.25);cupolas++;
 }
 // ---- Central drum and helmet dome (LoD2: ring r≈7 at 34 m, lantern 42–48 m).
 const DR=5.7,D0=23.2,D1=34.2;
 b.cyl(DR,DR,D1-D0,m.brick,cx,D0,cz,32);
 b.cyl(DR+.35,DR+.35,.6,m.trim,cx,D0,cz,32);
 b.cyl(DR+.3,DR+.3,.45,m.trim,cx,32.3,cz,32);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6+Math.PI/12,f=face(cx+Math.sin(a)*DR,cz+Math.cos(a)*DR,Math.sin(a),Math.cos(a));
  k.win(f,0,25.9,1.0,5.4,{depth:.04});
  const pa=a+Math.PI/12,pf=face(cx+Math.sin(pa)*DR,cz+Math.cos(pa)*DR,Math.sin(pa),Math.cos(pa));k.pilaster(pf,0,D0+.6,D1,.55);
  // Kokoshnik arcade crowning the drum.
  const [kx,kz]=at(f,0,.02),kg=new THREE.ExtrudeGeometry(new THREE.Shape().absarc(0,0,1.3,0,Math.PI,false),{depth:.35,bevelEnabled:false,curveSegments:8});b.add(kg,m.brick,kx,D1-.1,kz,f.ry);
  const [tx,tz]=at(f,0,.38);b.add(new THREE.TorusGeometry(1.3,.12,4,12,Math.PI),m.trim,tx,D1-.1,tz,f.ry);
 }
 b.cyl(DR+.1,DR+.1,.5,m.trim,cx,D1-.5,cz,32);
 // Onion profile: pronounced bulb wider than the slender drum, then a long concave
 // taper to the lantern (photos); widest ≈7 m matches the LoD2 ring at 34–36 m.
 const dome=[[5.9,0],[6.55,.6],[6.8,1.4],[6.62,2.3],[5.95,3.2],[4.95,4.1],[3.85,4.9],[2.8,5.7],[1.95,6.5],[1.3,7.2],[.95,7.8]];
 b.lathe(dome,m.copper,cx,D1,cz,40);
 // Standing-seam ribs and a ring of small dormer kokoshniks on the dome.
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,pts=dome.map(([r,v])=>new THREE.Vector3(cx+Math.sin(a)*(r+.05),D1+v,cz+Math.cos(a)*(r+.05)));
  b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),16,.06,4,false),m.copper);
 }
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4+Math.PI/8,f=face(cx+Math.sin(a)*5.75,cz+Math.cos(a)*5.75,Math.sin(a),Math.cos(a));
  const [x,z]=at(f,0,0);b.box(1.1,1.1,.9,m.copper,x,D1+3.2,z,f.ry);
  const g=new THREE.ExtrudeGeometry(new THREE.Shape().absarc(0,0,.55,0,Math.PI,false),{depth:.9,bevelEnabled:false,curveSegments:8});g.translate(0,0,-.45);b.add(g,m.copper,x,D1+3.75,z,f.ry);
  const [gx,gz]=at(f,0,.46);b.add(new THREE.ShapeGeometry(archShape(.5,.75),4),m.glass,gx,D1+2.85,gz,f.ry);
 }
 const L0=D1+7.8;
 b.cyl(.95,.95,1.3,m.copper,cx,L0,cz,16);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,f=face(cx+Math.sin(a)*.95,cz+Math.cos(a)*.95,Math.sin(a),Math.cos(a));k.win(f,0,L0+.2,.24,.85,{sill:false,bars:false,trim:m.copper,depth:.02});}
 b.cyl(1.15,1.1,.25,m.copper,cx,L0+1.3,cz,16);
 k.onion(cx,L0+1.55,cz,1.45,2.6);
 k.cross(cx,L0+4.1,cz,USPENSKI.crossTop-(L0+4.1));cupolas++;
 // ---- East end: main apse and two side apses (municipal arcs), half-cone roofs.
 const AC=15.8,AR=5.0,AH=15.5;
 b.block(arm.weX[1]-.2,AC,-5,5,0,AH,m.brick);
 b.cyl(AR,AR,AH,m.brick,AC,0,.1,28,false,0,Math.PI);
 b.cyl(AR+.25,AR+.25,T+.9,m.granite,AC,0,.1,28,false,0,Math.PI);
 b.cyl(AR+.25,AR+.25,.45,m.trim,AC,AH-.45,.1,28,false,0,Math.PI);
 b.add(new THREE.ConeGeometry(AR+.3,3,28,1,false,0,Math.PI),m.copper,AC,AH+1.5,.1);
 prism(AC-arm.weX[1]+.4,10.6,3,m.copper,(arm.weX[1]+AC)/2,AH,.1,true);
 for(const a of [Math.PI/2-.75,Math.PI/2,Math.PI/2+.75]){const f=face(AC+Math.sin(a)*AR,.1+Math.cos(a)*AR,Math.sin(a),Math.cos(a));k.win(f,0,T+3,1.05,4,{depth:.03});k.win(f,0,11.1,.8,2.6,{depth:.03,bars:false});}
 for(const [x,z] of [[13.5,-8.2],[13.6,8.1]]){
  b.cyl(3.4,3.4,11.5,m.brick,x,0,z,24);b.cyl(3.65,3.65,T+.9,m.granite,x,0,z,24);b.cyl(3.65,3.65,.4,m.trim,x,11.1,z,24);
  b.add(new THREE.ConeGeometry(3.75,2.3,24),m.copper,x,12.65,z);
  const a=z<0?Math.PI*.75:Math.PI*.25,f=face(x+Math.sin(a)*3.4,z+Math.cos(a)*3.4,Math.sin(a),Math.cos(a));k.win(f,0,T+3,.9,3.4,{depth:.03});
 }
 // ---- West porch (municipal projection at x −13.7).
 b.block(-13.9,-11.6,-1.4,1.6,0,9.2,m.brick);b.block(-14.1,-11.6,-1.6,1.8,0,T+.9,m.granite);
 prism(2.6,3.4,1.5,m.copper,-12.75,9.2,.1,true);
 const pf=face(-13.9,.1,-1,0);k.win(pf,0,T+.9,1.6,3.3,{sill:false,bars:false});k.band(pf,-1.6,1.6,9.1,.3,.12);
 // ---- South gallery and bell tower (municipal south wing, top 25 m in LoD2).
 b.block(-1.9,3.5,12.6,22.4,0,10.5,m.brick);b.block(-2.1,3.7,12.6,22.4,0,T+.9,m.granite);b.block(-2.05,3.65,12.6,22.4,10.1,10.5,m.trim);
 prism(10,5.9,1.8,m.copper,.8,10.5,17.5,false);
 for(const [nx,x] of [[-1,-1.9],[1,3.5]])for(const z of [15,17.7,20.4]){const f=face(x,z,nx,0);k.win(f,0,T+1.8,.85,2.8);}
 const BX=.95,BZ=25.65,BW=6.7,B1=13.2,B2=20.4;
 b.box(BW,B1,BW,m.brick,BX,B1/2,BZ);b.box(BW+.3,T+.9,BW+.3,m.granite,BX,(T+.9)/2,BZ);
 b.box(BW+.35,.5,BW+.35,m.trim,BX,B1,BZ);
 b.box(BW-.8,B2-B1,BW-.8,m.brick,BX,(B1+B2)/2,BZ);
 b.box(BW+.5,.55,BW+.5,m.trim,BX,B2+.27,BZ);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,lf=face(BX+Math.sin(a)*BW/2,BZ+Math.cos(a)*BW/2,Math.sin(a),Math.cos(a)),uf=face(BX+Math.sin(a)*(BW-.8)/2,BZ+Math.cos(a)*(BW-.8)/2,Math.sin(a),Math.cos(a));
  if(i!==2)k.win(lf,0,T+3.4,1.35,3.9);k.frieze(lf,-BW/2+.3,BW/2-.3,B1-.25);
  // Low parapet of the gallery around the belfry.
  const [px,pz]=at(lf,0,-.15);b.box(BW,.8,.3,m.brick,px,B1+.65,pz,lf.ry);const [cx3,cz3]=at(lf,0,-.15);b.box(BW+.1,.16,.4,m.trim,cx3,B1+1.1,cz3,lf.ry);
  for(const sd of [-1.5,0,1.5])k.win(uf,sd,B1+1.9,.72,3.1,{sill:false,bars:false});
  for(const sd of [-2.25,-.75,.75,2.25])k.pilaster(uf,sd,B1+.25,B2,.26);
  k.frieze(uf,-(BW-.8)/2+.3,(BW-.8)/2-.3,B2);
  for(const sd of [-2,0,2]){const [dx,dz]=at(lf,sd*.95,-1.35);b.add(new THREE.ExtrudeGeometry(new THREE.Shape().absarc(0,0,.5,0,Math.PI,false),{depth:.5,bevelEnabled:false,curveSegments:8}),m.copper,dx,B2+.95,dz,lf.ry);}
 }
 k.tent(BX,B2+.55,BZ,BW/2+.1,8.4);
 b.cyl(.28,.32,.5,m.copper,BX,B2+8.8,BZ,8);k.onion(BX,B2+9.25,BZ,.66,1.6);k.cross(BX,B2+10.8,BZ,1.4);
 const group=b.finish('Uspenski Cathedral — reconstruction registered to municipal RATU 1691');
 group.userData={cupolas,bellTowerCupolas:1,towers:TOWERS.length};
 return group;
}

// ---- Rock hill: star-shaped heightfield inside USPENSKI_HILL (world coordinates).
function noise2(x,z){const h=(a,b)=>{const s=Math.sin(a*127.1+b*311.7)*43758.5453;return s-Math.floor(s);};const xi=Math.floor(x),zi=Math.floor(z),fx=x-xi,fz=z-zi,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (h(xi,zi)*(1-u)+h(xi+1,zi)*u)*(1-v)+(h(xi,zi+1)*(1-u)+h(xi+1,zi+1)*u)*v;}
const fbm=(x,z)=>noise2(x,z)*.55+noise2(x*2.1+7,z*2.1-3)*.3+noise2(x*4.3-11,z*4.3+5)*.15;
function segDist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
export function toLocal(x,z){const c=Math.cos(USPENSKI.angle),s=Math.sin(USPENSKI.angle),dx=x-USPENSKI.x,dz=z-USPENSKI.z;return [dx*c-dz*s,dx*s+dz*c];}
export function toWorld(lx,lz){const c=Math.cos(USPENSKI.angle),s=Math.sin(USPENSKI.angle);return [USPENSKI.x+lx*c+lz*s,USPENSKI.z-lx*s+lz*c];}
function onChurchApron(x,z,pad){const [lx,lz]=toLocal(x,z);return (lx>-14-pad&&lx<21+pad&&lz>-13.8-pad&&lz<13.9+pad)||(lx>-3-pad&&lx<5+pad&&lz>12&&lz<29.3+pad);}
export function hillHeight(x,z){
 const ring=USPENSKI_HILL;let wsum=0,wW=0,dmin=Infinity;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],d=segDist(x,z,a,b);dmin=Math.min(dmin,d);const w=1/(d*d+4);wsum+=w;wW+=w*RAMP[a[2]];}
 const W=wW/wsum,t=Math.min(1,dmin/W),e=t*t*(3-2*t);
 const cliff=W<3,rough=Math.sin(Math.PI*t)*(fbm(x*.35,z*.35)-.5)*(cliff?1.1:.5);
 // Steep faces break into irregular ledges (blocky jointed granite).
 const ledge=cliff?Math.min(1,Math.floor(e*3+fbm(x*.45+9,z*.45)*.95)/3):e,e2=cliff?e*.55+ledge*.45:e;
 const west=westFactor(x);
 let h=Math.max(0,USPENSKI.terrace*west*e2+rough+(t>=1&&!onChurchApron(x,z,2)?(fbm(x*.08,z*.08)-.5)*.5:0));
 const st=USPENSKI_STAIR;if(Math.abs(x-st.x)<st.width/2+.3&&z<st.z0+.5&&z>st.z1-1)h=Math.min(h,Math.max(0,stairTop(z)-.3));
 return h;
}
function westFactor(x){return .5+.5*Math.min(1,Math.max(0,(x-366)/34));}
function stairTop(z){const st=USPENSKI_STAIR,H=USPENSKI.terrace*westFactor(st.x),f=Math.min(1,Math.max(0,(st.z0-z)/(st.z0-st.z1)));return Math.ceil(f*st.steps)/st.steps*H;}
function buildHill(m){
 const ring=USPENSKI_HILL,cxz=[424,190],pts=[];
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.3));for(let j=0;j<n;j++)pts.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n,a[2]]);}
 const S=[1,.992,.982,.97,.955,.938,.918,.895,.868,.835,.795,.745,.68,.6,.5,.38,.25,.12];
 const pos=[],col=[],idx=[],N=pts.length,c=new THREE.Color();
 for(const s of S)for(const p of pts){const x=cxz[0]+(p[0]-cxz[0])*s,z=cxz[1]+(p[1]-cxz[1])*s;pos.push(x,s===1?0:hillHeight(x,z),z);}
 pos.push(cxz[0],USPENSKI.terrace,cxz[1]);
 for(let r=0;r<S.length-1;r++)for(let i=0;i<N;i++){const a=r*N+i,b=r*N+(i+1)%N,c2=(r+1)*N+i,d=(r+1)*N+(i+1)%N;idx.push(a,c2,b,b,c2,d);}
 const centre=S.length*N;for(let i=0;i<N;i++)idx.push((S.length-1)*N+i,centre,(S.length-1)*N+(i+1)%N);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 // Orientation check: normals must point up (flip winding if the ring is clockwise).
 if(g.attributes.normal.getY(centre)<0){for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}g.setIndex(idx);g.computeVertexNormals();}
 const nrm=g.attributes.normal;
 for(let i=0;i<pos.length/3;i++){
  const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],slope=1-nrm.getY(i),n=fbm(x*.6,z*.6),n2=fbm(x*.13+3,z*.13);
  if(onChurchApron(x,z,0)&&y>USPENSKI.terrace-.3)c.setRGB(.58+n*.06,.56+n*.05,.52+n*.05,THREE.SRGBColorSpace);
  else if(slope>.3||y<.35){
   // Grey granite with pink feldspar, rust-brown weathering and dark water streaks.
   const k=.8+n*.34,streak=fbm(x*.3,y*1.9+z*.3),rust=fbm(x*.21+4,z*.21-2);
   c.setRGB(.55*k,.52*k,.51*k,THREE.SRGBColorSpace);
   if(rust>.6)c.lerp(new THREE.Color().setRGB(.58*k,.43*k,.35*k,THREE.SRGBColorSpace),.6);else if(n2>.55)c.lerp(new THREE.Color().setRGB(.62*k,.5*k,.48*k,THREE.SRGBColorSpace),.5);
   if(streak>.62)c.multiplyScalar(.58);
  }
  else if(slope>.12)c.setRGB(.44+n*.1,.43+n*.08,.3+n*.06,THREE.SRGBColorSpace);
  else c.setRGB(.42+n2*.16,.46+n2*.1,.25+n*.08,THREE.SRGBColorSpace);
  col.push(c.r,c.g,c.b);
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 const mesh=new THREE.Mesh(g,m.hill);mesh.receiveShadow=true;mesh.castShadow=true;mesh.name='Uspenski rock';
 // Retaining granite walls and top railings (world-frame builder).
 const b=builder(),T=USPENSKI.terrace;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],e=ring[(i+1)%ring.length],len=Math.hypot(e[0]-a[0],e[1]-a[1]),ry=Math.atan2(e[0]-a[0],e[1]-a[1]),nx=(e[1]-a[1])/len,nz=-(e[0]-a[0])/len;
  const inward=pointInside(( a[0]+e[0])/2+nx,(a[1]+e[1])/2+nz)?1:-1,ix=nx*inward,iz=nz*inward;
  if(a[2]==='wall'){b.box(.9,T+.55,len+.9,m.granite,(a[0]+e[0])/2+ix*.45,(T+.55)/2,(a[1]+e[1])/2+iz*.45,ry);b.box(1.15,.2,len+1,m.granite,(a[0]+e[0])/2+ix*.45,T+.65,(a[1]+e[1])/2+iz*.45,ry);}
  if(a[2]==='cliff'||a[2]==='wall'){
   const off=a[2]==='wall'?.5:RAMP.cliff+.6,sx=(a[0]+e[0])/2+ix*off,sz=(a[1]+e[1])/2+iz*off,base=a[2]==='wall'?T+.75:T;
   // Posts follow the rock surface; rails run post to post so they never float.
   const n=Math.ceil(len/2.2),posts=[];
   for(let j=0;j<=n;j++){const px=a[0]+(e[0]-a[0])*j/n+ix*off,pz=a[1]+(e[1]-a[1])*j/n+iz*off,py=a[2]==='wall'?base:hillHeight(px,pz);if(Math.abs(px-USPENSKI_STAIR.x)<USPENSKI_STAIR.width/2+.6&&pz>USPENSKI_STAIR.z1-1){posts.push(null);continue;}posts.push(new THREE.Vector3(px,py,pz));b.box(.06,1.1,.06,m.iron,px,py+.55,pz);}
   for(let j=0;j<n;j++)if(posts[j]&&posts[j+1])for(const y of [.55,1.05]){const p=posts[j].clone().setY(posts[j].y+y),q=posts[j+1].clone().setY(posts[j+1].y+y),o=new THREE.Object3D();o.position.copy(p).add(q).multiplyScalar(.5);o.lookAt(q);o.updateMatrix();const g=new THREE.BoxGeometry(.05,.05,p.distanceTo(q));g.applyMatrix4(o.matrix);b.add(g,m.iron);}
  }
 }
 // Frost-split granite blocks along the Kanavakatu rock face (procedural).
 const rocks=[];let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let i=0;i<ring.length;i++){
  const a=ring[i],e=ring[(i+1)%ring.length];if(a[2]!=='cliff')continue;
  const len=Math.hypot(e[0]-a[0],e[1]-a[1]),n=Math.round(len/1.25);
  for(let j=0;j<n;j++){
   const t=(j+rnd())/n,into=.25+rnd()*1.6,px=a[0]+(e[0]-a[0])*t,pz=a[1]+(e[1]-a[1])*t,dx=cxz[0]-px,dz=cxz[1]-pz,dl=Math.hypot(dx,dz),x=px+dx/dl*into,z=pz+dz/dl*into;
   if(Math.abs(x-USPENSKI_STAIR.x)<USPENSKI_STAIR.width&&z>USPENSKI_STAIR.z1-1)continue;
   const w=.7+rnd()*1.3,h=.5+rnd()*1.1,g=new THREE.BoxGeometry(w,h,.8+rnd()*1.2).toNonIndexed();g.rotateX((rnd()-.5)*.4);g.rotateZ((rnd()-.5)*.4);g.rotateY(Math.atan2(dx,dz)+(rnd()-.5)*.6);g.translate(x,Math.max(h*.3,hillHeight(x,z)*(.2+rnd()*.45)),z);
   const q=g.attributes.position.count,cc=[],k=.72+rnd()*.35,pink=rnd();for(let v=0;v<q;v++){const f=.86+((v/6|0)%3)*.08;c.setRGB((.52+pink*.08)*k*f,(.5-pink*.03)*k*f,(.49-pink*.03)*k*f,THREE.SRGBColorSpace);cc.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));g.deleteAttribute('uv');rocks.push(g);
  }
 }
 // Low-poly birches/maples on the rock (photo-guided), merged into the same batch.
 for(const [x,z,sc] of USPENSKI_TREES){
  const y=hillHeight(x,z),hgt=5.5*sc,trunk=new THREE.CylinderGeometry(.14*sc,.24*sc,hgt*.55,6).toNonIndexed();trunk.translate(x,y+hgt*.27,z);
  const parts=[[trunk,[.36,.3,.24]]];
  for(let i=0;i<3;i++){const r=(1.9-i*.3)*sc,cr=new THREE.IcosahedronGeometry(r,1);cr.scale(1,.85,1);cr.translate(x+(rnd()-.5)*1.2*sc,y+hgt*(.62+i*.17),z+(rnd()-.5)*1.2*sc);const t2=rnd();parts.push([cr,[.25+t2*.1,.36+t2*.08,.16+t2*.04]]);}
  for(const [g,rgb] of parts){const cc=[];for(let v=0;v<g.attributes.position.count;v++){const f=.85+((v/3|0)%4)*.06;c.setRGB(rgb[0]*f,rgb[1]*f,rgb[2]*f,THREE.SRGBColorSpace);cc.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));g.deleteAttribute('uv');rocks.push(g);}
 }
 const boulders=new THREE.Mesh(mergeGeometries(rocks),m.hill);boulders.castShadow=boulders.receiveShadow=true;boulders.name='Uspenski rock face blocks';rocks.forEach(g=>g.dispose());
 // Granite stair and cheek walls (visual; the rock remains a solid obstacle).
 {const st=USPENSKI_STAIR,run=(st.z0-st.z1)/st.steps,H=stairTop(st.z1);
  for(let i=0;i<st.steps;i++){const top=H*(i+1)/st.steps;b.box(st.width,top,run+.02,m.granite,st.x,top/2,st.z0-(i+.5)*run);}
  for(const side of [-1,1])b.box(.45,H+.5,st.z0-st.z1+1.2,m.granite,st.x+side*(st.width/2+.22),(H+.5)/2,(st.z0+st.z1)/2-.6);
  b.box(st.width,H,2.5,m.granite,st.x,H/2,st.z1-1.2);}
 const extras=b.finish('Uspenski hill walls and railings');
 const group=new THREE.Group();group.name='Uspenski rock hill';group.add(mesh,boulders,extras);return group;
}
function pointInside(x,z){let inside=false;const r=USPENSKI_HILL;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}

export function createUspenskiCathedral(){
 const m=materials(),church=buildChurch(m);
 church.position.set(USPENSKI.x,0,USPENSKI.z);church.rotation.y=USPENSKI.angle;
 const hill=buildHill(m),group=new THREE.Group();group.name='Uspenski Cathedral and Katajanokka rock';group.add(hill,church);
 let triangles=0,drawCalls=0;group.traverse(o=>{if(o.isMesh){drawCalls++;const g=o.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3;}});
 group.userData={...church.userData,sourceRatu:USPENSKI.ratu,drawCalls,triangles:Math.round(triangles),accuracy:'Municipal footprint, orientation and height envelope; photo-guided architectural detail'};
 group.updateMatrixWorld(true);group.traverse(o=>{o.matrixAutoUpdate=false;});
 // Flat-terrain game: the raised rock (which contains the church footprint) is solid.
 const obstacles=[{id:'uspenski-hill',name:'Uspenski Cathedral rock',rings:[USPENSKI_HILL.map(([x,z])=>[x,z])]}];
 return {group,obstacles};
}
