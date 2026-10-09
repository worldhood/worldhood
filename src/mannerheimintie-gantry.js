import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const MANNERHEIMINTIE_GANTRY_REFERENCE=Object.freeze({
  source:'street-level reference photography',capture:'2025-09',
  location:'Mannerheimintie northbound, Sokos west frontage beside Lasipalatsi tram platform',
  cameraCoordinates:null,heading:null,
  destinations:[{fi:'TURKU',sv:'ÅBO',route:'1'},{fi:'HANKO',sv:'HANGÖ',route:'51'}],
  right:{arrow:'straight',symbols:['airport'],routes:['3','E12'],upper:{arrow:'right',symbol:'railway-station'}},
  accuracy:'Text, arrows, panel layout and solid mast-to-façade bar observed; placement, proportions and height photo-estimated, not surveyed',
});
export const MANNERHEIMINTIE_GANTRY_POLE=Object.freeze({x:-807.267,z:-46.595,radius:.21,minY:0,maxY:6.2,type:'gantry-pole'});
export const MANNERHEIMINTIE_GANTRY_PLACEMENT=Object.freeze({x:-807.267,z:-46.595,angle:Math.atan2(.598,.801),span:17.4});

export function createMannerheimintieGantry({canvasFactory=()=>globalThis.document?.createElement('canvas')}={}){
  const g=new THREE.Group();g.name='Mannerheimintie observed Turku Hanko airport gantry';
  const p=MANNERHEIMINTIE_GANTRY_PLACEMENT;g.position.set(p.x,0,p.z);g.rotation.y=p.angle;
  const steel=new THREE.MeshStandardMaterial({color:'#858e89',metalness:.55,roughness:.64});
  const metal=new THREE.MeshStandardMaterial({color:'#b4b9ad',metalness:.45,roughness:.6});
  const structure=[],backs=[],faces=[];
  function add(geo,list){if(geo.index){const original=geo;geo=original.toNonIndexed();original.dispose();}list.push(geo);}
  function box(x,y,z,w,h,d,list=structure){const geom=new THREE.BoxGeometry(w,h,d);geom.translate(x,y,z);add(geom,list);}
  // One left platform mast, plain rectangular crossbar, façade plate at right.
  // There is no invented lattice and no second ground pole by Sokos.
  box(0,3.1,0,.20,6.2,.20);box(p.span/2,6.09,0,p.span,.23,.19);
  box(0,.10,0,.40,.20,.40,backs);box(p.span,6.09,0,.08,.46,.46,backs);
  const canvas=canvasFactory();let map=null;
  if(canvas){
    canvas.width=2048;canvas.height=2048;const c=canvas.getContext('2d');
    const white='#f3f3e8',blue='#2055aa',green='#398065',black='#303a35';
    const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    function border(x,y,w,h,color=white,dashed=false){c.save();c.strokeStyle=color;c.lineWidth=7;if(dashed)c.setLineDash([22,13]);c.strokeRect(x+3.5,y+3.5,w-7,h-7);c.restore();}
    function straight(x,y,w,h){c.fillStyle=white;c.beginPath();[[.40,.90],[.60,.90],[.60,.40],[.89,.40],[.50,.08],[.11,.40],[.40,.40]].forEach(([a,b],i)=>i?c.lineTo(x+a*w,y+b*h):c.moveTo(x+a*w,y+b*h));c.closePath();c.fill();}
    function route(x,y,w,h,word,bg,fg=white,dash=false){rect(x,y,w,h,bg);border(x,y,w,h,fg,dash);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`500 ${h*.78}px Arial, sans-serif`;c.fillText(word,x+w/2,y+h*.54,w*.91);}
    // Tall left sign, exactly two green bilingual destination rows and blue
    // vertical straight-arrow strip. No unsupported destination added.
    rect(0,0,1400,980,green);rect(0,0,310,980,blue);border(0,0,1400,980);
    c.strokeStyle=white;c.lineWidth=7;c.beginPath();c.moveTo(310,0);c.lineTo(310,980);c.moveTo(310,490);c.lineTo(1400,490);c.moveTo(620,0);c.lineTo(620,980);c.stroke();
    straight(52,353,205,280);route(355,142,222,225,'1','#b44542',white,true);route(355,634,222,225,'51','#e9b239',black,true);
    c.fillStyle=white;c.font='500 159px Arial, sans-serif';c.textAlign='left';c.textBaseline='middle';
    for(const [line,y]of [['TURKU',164],['ÅBO',359],['HANKO',654],['HANGÖ',849]])c.fillText(line,667,y,690);
    // Thin right row: straight / plane /3 /E12.
    const yy=1040;rect(0,yy,1800,330,blue);border(0,yy,1800,330);straight(70,yy+35,210,245);
    border(370,yy+15,310,300);c.fillStyle=white;c.beginPath();
    [[.46,.07],[.55,.07],[.58,.41],[.93,.66],[.93,.77],[.57,.62],[.55,.85],[.68,.95],[.68,1],[.50,.94],[.32,1],[.32,.95],[.45,.85],[.43,.62],[.07,.77],[.07,.66],[.42,.41]].forEach(([a,b],i)=>i?c.lineTo(396+a*257,yy+30+b*264):c.moveTo(396+a*257,yy+30+b*264));c.closePath();c.fill();
    route(704,yy+19,283,292,'3','#b44542',white,true);route(1018,yy+19,751,292,'E12',green);
    // White supplement: right-turn arrow and front-view railway pictogram.
    rect(0,1440,940,410,white);border(0,1440,940,410,black);c.strokeStyle=black;c.lineWidth=6;c.beginPath();c.moveTo(494,1440);c.lineTo(494,1850);c.stroke();
    c.fillStyle=black;c.beginPath();[[.12,.82],[.28,.82],[.28,.39],[.66,.39],[.66,.62],[.92,.30],[.66,.08],[.66,.25],[.12,.25]].forEach(([a,b],i)=>i?c.lineTo(30+a*420,1490+b*300):c.moveTo(30+a*420,1490+b*300));c.closePath();c.fill();
    border(529,1470,370,350,black);rect(575,1510,278,201,black);rect(598,1530,232,84,white);
    for(const x of [611,811]){c.fillStyle=white;c.beginPath();c.arc(x,1677,18,0,Math.PI*2);c.fill();}
    c.strokeStyle=black;c.lineWidth=23;c.beginPath();c.moveTo(615,1701);c.lineTo(583,1781);c.moveTo(809,1701);c.lineTo(841,1781);c.stroke();
    map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  }
  const print=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#398065',roughness:.73});
  function panel(x,y,w,h,atlas){
    box(x,y,.14,w+.025,h+.025,.065,backs);
    const geo=new THREE.PlaneGeometry(w,h),uv=geo.attributes.uv,[ax,ay,aw,ah]=atlas;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(ax+uv.getX(i)*aw)/2048,1-(ay+(1-uv.getY(i))*ah)/2048);
    geo.translate(x,y,.174);add(geo,faces);
    for(const dx of [-w*.31,w*.31])box(x+dx,y,0,.045,h*.94,.18);
  }
  panel(4.25,7.16,3.05,2.14,[0,0,1400,980]);
  panel(8.7,6.43,3.3,.61,[0,1040,1800,330]);
  panel(9.30,7.06,1.6,.70,[0,1440,940,410]);
  for(const [geometries,material,name]of [[structure,steel,'Single mast and plain building-anchored bar'],[backs,metal,'Sign backs and anchor plates'],[faces,print,'Observed bilingual destination and route faces']]){
    const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.name=name;mesh.castShadow=true;g.add(mesh);geometries.forEach(geo=>geo.dispose());
  }
  g.userData={...MANNERHEIMINTIE_GANTRY_REFERENCE,poleFootprint:MANNERHEIMINTIE_GANTRY_POLE,collision:'pole only; never whole gantry bounds',clearance:5.97};return g;
}
