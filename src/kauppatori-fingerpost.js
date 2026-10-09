import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createBreakableSigns} from './breakable-signs.js';

// Exact visible wording: August 2024 street-level photography. Orthogonal
// arms corroborated by September 2022 photography. “Zoo” is text, NOT a numeral/distance.
export const KAUPPATORI_CYCLE_DESTINATIONS = Object.freeze([
  {fi:'Makasiiniterminaali',sv:'Magasinsterminalen',distance:'0,4',direction:'south',y:4.85,width:1.8},
  {fi:'Olympiaterminaali',sv:'Olympiaterminalen',distance:'0,8',direction:'south',y:4.60,width:1.8},
  {fi:'Kaivopuisto',sv:'Brunnsparken',distance:'1',direction:'south',y:4.35,width:1.45},
  {fi:'Hakaniemi',sv:'Hagnäs',distance:'2',direction:'north',y:4.60,width:1.25},
  {fi:'Kulosaari',sv:'Brändö',distance:'5',direction:'north',y:4.35,width:1.25},
  {fi:'Erottaja',sv:'Skillnaden',distance:'0,5',direction:'west',y:4.08,width:1.25},
  {fi:'Lauttasaari',sv:'Drumsö',distance:'4',direction:'west',y:3.83,width:1.25},
  {fi:'Katajanokan terminaali',sv:'Skatuddens terminal',distance:'1',direction:'east',y:4.08,width:1.95},
  {fi:'Korkeasaari',sv:'Högholmen',suffix:'Zoo',direction:'east',y:3.83,width:1.5},
]);
export const KAUPPATORI_FINGERPOST_REFERENCE = Object.freeze({
  x:20.8,z:303.7,capture:'2024-08',corroboratingCapture:'2022-09',
  camera2024:{latitude:60.1673215,longitude:24.9523808,bearing:63.33,fov:15},
  camera2022:{latitude:60.1671828,longitude:24.9526494,bearing:347.33,fov:15},
  accuracy:'Words/symbols/arm groups observed; position triangulated approximately, dimensions and mounting heights estimated, not surveyed',
});

export function createKauppatoriFingerpost({canvasFactory=()=>globalThis.document?.createElement('canvas')}={}){
  const root=new THREE.Group();root.name='Kauppatori photographed cycling fingerpost';
  root.position.set(KAUPPATORI_FINGERPOST_REFERENCE.x,0,KAUPPATORI_FINGERPOST_REFERENCE.z);
  const metal=new THREE.MeshStandardMaterial({color:'#9da6a1',metalness:.6,roughness:.58});
  const canvas=canvasFactory(),rowHeight=100,width=1024;
  let c=null,map=null;
  if(canvas){canvas.width=width;canvas.height=2048;c=canvas.getContext('2d');map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;}
  const ink=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#1554a4',roughness:.7,alphaTest:.5});
  const backs=[],faces=[];
  const directions={south:{angle:-Math.PI/2,side:1},north:{angle:-Math.PI/2,side:-1},east:{angle:0,side:1},west:{angle:0,side:-1}};
  function add(g,list){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}list.push(g);}
  function face(w,h,x,y,z,angle,row){
    const g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,1-(row+(1-uv.getY(i)))*rowHeight/2048);
    g.rotateY(angle);g.translate(x,y,z);add(g,faces);
  }
  function bike(ctx,x,y,size){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.strokeStyle='#fff';ctx.lineWidth=.065;
    for(const wx of [-.33,.33]){ctx.beginPath();ctx.arc(wx,.12,.22,0,Math.PI*2);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-.33,.12);ctx.lineTo(-.10,-.19);ctx.lineTo(.08,.12);ctx.lineTo(-.33,.12);ctx.moveTo(-.10,-.19);ctx.lineTo(.23,-.19);ctx.lineTo(.08,.12);ctx.moveTo(.23,-.31);ctx.lineTo(.33,.12);ctx.moveTo(.19,-.31);ctx.lineTo(.35,-.31);ctx.moveTo(-.18,-.26);ctx.lineTo(-.03,-.26);ctx.stroke();ctx.restore();
  }
  function pedestrian(ctx,x,y,size){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.strokeStyle='#fff';ctx.lineWidth=.11;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(0,-.32,.10,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
    ctx.beginPath();ctx.moveTo(0,-.12);ctx.lineTo(-.02,.19);ctx.lineTo(-.17,.48);ctx.moveTo(-.02,.19);ctx.lineTo(.20,.46);ctx.moveTo(-.01,-.04);ctx.lineTo(-.19,.14);ctx.moveTo(0,-.03);ctx.lineTo(.18,.12);ctx.stroke();ctx.restore();
  }
  function panel(row,s,side){
    if(!c)return;const top=row*rowHeight;c.save();c.translate(0,top);c.fillStyle='#12529f';c.fillRect(0,0,width,rowHeight);
    c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(3,3,width-6,rowHeight-6);
    c.beginPath();const ax=side>0?995:29;c.moveTo(ax-side*25,12);c.lineTo(ax,50);c.lineTo(ax-side*25,88);c.lineWidth=7;c.stroke();
    const ix=side>0?68:948;pedestrian(c,ix,31,39);bike(c,ix,77,47);c.lineWidth=2;c.beginPath();c.moveTo(side>0?118:903,3);c.lineTo(side>0?118:903,97);c.stroke();
    c.fillStyle='#fff';c.textBaseline='middle';c.textAlign='left';c.font='600 31px Arial, sans-serif';
    const tx=side>0?140:178,available=side>0?665:700;c.fillText(s.fi,tx,29,available);c.fillText(s.sv,tx,71,available);
    c.font='600 45px Arial, sans-serif';c.textAlign=side>0?'right':'left';c.fillText(s.distance||s.suffix,side>0?950:60,52,125);c.restore();
  }
  const pole=new THREE.CylinderGeometry(.045,.055,4.9,10);pole.translate(0,2.45,0);add(pole,backs);
  KAUPPATORI_CYCLE_DESTINATIONS.forEach((s,i)=>{
    const {angle,side}=directions[s.direction],centre=side*(s.width/2+.025),x=centre*Math.cos(angle),z=-centre*Math.sin(angle);
    const g=new THREE.BoxGeometry(s.width,.225,.045);g.rotateY(angle);g.translate(x,s.y,z);add(g,backs);
    for(let f=0;f<2;f++){const a=angle+f*Math.PI,row=i*2+f;panel(row,s,side*(f?-1:1));face(s.width-.015,.215,x+Math.sin(a)*.024,s.y,z+Math.cos(a)*.024,a,row);}
  });
  // West-facing mandatory cycleway circle and both-direction supplementary plate.
  if(c){
    c.save();c.translate(0,1800);c.fillStyle='#fff';c.beginPath();c.ellipse(512,50,500,49,0,0,Math.PI*2);c.fill();c.fillStyle='#12529f';c.beginPath();c.ellipse(512,50,470,46,0,0,Math.PI*2);c.fill();
    c.save();c.translate(512,51);c.scale(9,1);bike(c,0,0,60);c.restore();c.restore();
    c.save();c.translate(0,1900);c.fillStyle='#12529f';c.fillRect(0,0,1024,100);c.strokeStyle='#fff';c.lineWidth=5;c.strokeRect(6,3,1012,94);c.fillStyle='#fff';
    for(const side of [-1,1]){c.beginPath();const x=512+side*170;c.moveTo(x,37);c.lineTo(x+side*100,37);c.lineTo(x+side*100,18);c.lineTo(x+side*290,50);c.lineTo(x+side*100,82);c.lineTo(x+side*100,63);c.lineTo(x,63);c.closePath();c.fill();}c.restore();
  }
  const disc=new THREE.CylinderGeometry(.36,.36,.03,48);disc.rotateZ(Math.PI/2);disc.translate(-.065,2.92,0);add(disc,backs);
  face(.72,.72,-.082,2.92,0,-Math.PI/2,18);
  const plate=new THREE.BoxGeometry(.025,.36,.36);plate.translate(-.065,2.31,0);add(plate,backs);face(.35,.35,-.081,2.31,0,-Math.PI/2,19);
  // A single post, so it bends or snaps when hit like any light sign (breakable-signs.js); pivot in root space.
  const signs=createBreakableSigns('Kauppatori fingerpost'),post=signs.post({id:'kauppatori-fingerpost',x:KAUPPATORI_FINGERPOST_REFERENCE.x,z:KAUPPATORI_FINGERPOST_REFERENCE.z,pivot:[0,0,0],yaw:Math.PI/2,height:4.9,radius:.055});
  for(const [gs,m]of [[backs,metal],[faces,ink]]){const mesh=new THREE.Mesh(mergeGeometries(gs),m);mesh.castShadow=true;root.add(mesh);signs.attach(mesh,post);gs.forEach(g=>g.dispose());}
  root.add(signs.finish());root.breakable=signs;
  root.worldObjects=signs.bodies;
  root.userData={...KAUPPATORI_FINGERPOST_REFERENCE,armCount:9,collision:'breakable',destinationKind:'walking/cycling, not motor-vehicle overhead directions'};
  return root;
}
