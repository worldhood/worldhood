import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// 2024 street-level reference photography, including a readable close-up
// of the same assembly. Words and
// symbols below are observed, never inferred from a map's destination labels.
export const ETELARANTA_GANTRY_REFERENCE=Object.freeze({
  capture:'2024-08',
  location:'Eteläranta, immediately north of the Old Market Hall west central portal',
  cameraCoordinates:null,heading:null,
  left:{arrow:'bent-up-left',upperArrow:'bent-up-right',restriction:'12 m',routes:['1','3','51']},
  right:{arrow:'bent-up-right',symbols:['truck','airplane','tent','cabin','caravan'],routes:['4','7','E75']},
  accuracy:'Visible panel layout, arrows, symbols and numbers observed; dimensions, absolute position and height photo-estimated against municipal geometry, not surveyed',
});
export const ETELARANTA_GANTRY_PLACEMENT=Object.freeze({x:21.4,z:433,angle:.055,clearance:5.65});
// Register only this small ground-level footprint with a circle-obstacle
// collision API. Never use the gantry group's overall box as a road collider.
export const ETELARANTA_GANTRY_POLE=Object.freeze({x:21.4,z:433,radius:.22,minY:0,maxY:8.9,type:'gantry-pole'});

export function createEtelarantaGantry({canvasFactory=()=>globalThis.document?.createElement('canvas')}={}){
  const group=new THREE.Group();group.name='Eteläranta reference-observed cantilever direction gantry';
  const p=ETELARANTA_GANTRY_PLACEMENT;group.position.set(p.x,0,p.z);group.rotation.y=p.angle;
  const steel=new THREE.MeshStandardMaterial({color:'#4c5651',metalness:.65,roughness:.62});
  const aluminium=new THREE.MeshStandardMaterial({color:'#a7ada3',metalness:.5,roughness:.64});
  const steelParts=[],backParts=[],faceParts=[];
  function add(g,list){if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}list.push(g);}
  function beam(a,b,width,depth=width){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
    const g=new THREE.BoxGeometry(width,v.length(),depth);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,steelParts);
  }
  const pole=new THREE.CylinderGeometry(.13,.17,8.9,12);pole.translate(0,4.45,0);add(pole,steelParts);
  const base=new THREE.CylinderGeometry(.22,.22,.18,12);base.translate(0,.09,0);add(base,backParts);
  // Triangular open cantilever, not a solid decorative bar. Far left is free.
  for(const z of [-.16,.16]){
    for(const y of [6.05,6.85])beam([-13.6,y,z],[0,y,z],.075);
    beam([-13.6,6.05,z],[-13.6,6.85,z],.065);
    for(let i=0;i<16;i++){const a=-13.6+i*.85,b=a+.85;beam([a,i%2?6.05:6.85,z],[b,i%2?6.85:6.05,z],.055);}
  }
  for(let x=-13.6;x<.01;x+=1.7)for(const y of [6.05,6.85])beam([x,y,-.16],[x,y,.16],.055);
  const canvas=canvasFactory();let map=null;
  if(canvas){
    canvas.width=2048;canvas.height=2048;const c=canvas.getContext('2d');
    const blue='#2456a8',white='#f4f4e9',black='#303832';
    function field(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
    function border(x,y,w,h,color=white,width=8,dashed=false){c.save();c.strokeStyle=color;c.lineWidth=width;if(dashed)c.setLineDash([22,15]);c.strokeRect(x+width/2,y+width/2,w-width,h-width);c.restore();}
    function arrow(x,y,w,h,left=false){
      c.save();c.translate(x+(left?w:0),y);c.scale(left?-1:1,1);c.fillStyle=white;
      const points=[[.26,.84],[.43,.84],[.43,.53],[.67,.29],[.67,.47],[.86,.13],[.49,.13],[.64,.25],[.26,.57]];
      c.beginPath();points.forEach(([a,b],i)=>i?c.lineTo(a*w,b*h):c.moveTo(a*w,b*h));c.closePath();c.fill();c.restore();
    }
    function truck(x,y,w,h,color){
      c.fillStyle=color;c.fillRect(x+w*.08,y+h*.29,w*.58,h*.36);
      c.beginPath();c.moveTo(x+w*.69,y+h*.4);c.lineTo(x+w*.85,y+h*.4);c.lineTo(x+w*.95,y+h*.55);c.lineTo(x+w*.95,y+h*.69);c.lineTo(x+w*.69,y+h*.69);c.closePath();c.fill();
      for(const xx of [.24,.59,.82]){c.beginPath();c.arc(x+w*xx,y+h*.71,h*.085,0,Math.PI*2);c.fill();}
    }
    function plane(x,y,w,h){
      c.save();c.translate(x,y);c.fillStyle=white;c.beginPath();
      [[.06,.46],[.40,.44],[.25,.12],[.38,.12],[.65,.43],[.87,.44],[.95,.5],[.87,.56],[.65,.57],[.38,.88],[.25,.88],[.40,.56],[.06,.54],[.03,.74],[0,.74],[0,.26],[.03,.26]].forEach(([a,b],i)=>i?c.lineTo(a*w,b*h):c.moveTo(a*w,b*h));c.closePath();c.fill();c.restore();
    }
    function tent(x,y,w,h){
      c.strokeStyle=black;c.lineWidth=w*.085;c.beginPath();c.moveTo(x+w*.24,y+h*.16);c.lineTo(x+w*.82,y+h*.86);c.moveTo(x+w*.75,y+h*.16);c.lineTo(x+w*.15,y+h*.86);c.stroke();
      c.fillStyle=black;c.beginPath();c.moveTo(x+w*.5,y+h*.39);c.lineTo(x+w*.85,y+h*.88);c.lineTo(x+w*.15,y+h*.88);c.closePath();c.fill();c.fillStyle=white;c.beginPath();c.moveTo(x+w*.5,y+h*.60);c.lineTo(x+w*.67,y+h*.88);c.lineTo(x+w*.34,y+h*.88);c.closePath();c.fill();
    }
    function cabin(x,y,w,h){
      c.fillStyle=black;c.beginPath();c.moveTo(x+w*.1,y+h*.4);c.lineTo(x+w*.5,y+h*.15);c.lineTo(x+w*.9,y+h*.4);c.closePath();c.fill();c.fillRect(x+w*.2,y+h*.38,w*.6,h*.47);c.fillStyle=white;c.fillRect(x+w*.54,y+h*.48,w*.16,h*.16);
    }
    function caravan(x,y,w,h){
      c.fillStyle=black;c.fillRect(x+w*.12,y+h*.24,w*.75,h*.5);c.fillRect(x+w*.86,y+h*.68,w*.09,h*.04);
      c.beginPath();c.arc(x+w*.59,y+h*.77,h*.10,0,Math.PI*2);c.fill();c.fillStyle=white;c.fillRect(x+w*.2,y+h*.33,w*.2,h*.14);c.fillRect(x+w*.49,y+h*.33,w*.25,h*.14);
    }
    function route(x,y,w,h,word,bg,fg=white,dashed=false){field(x,y,w,h,bg);border(x,y,w,h,fg,8,dashed);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`500 ${h*.78}px Arial, sans-serif`;c.fillText(word,x+w/2,y+h*.53,w*.89);}
    // Left lower assembly: blue arrow | light restriction field | route stack.
    field(0,0,1800,650,blue);field(500,0,660,650,'#d5d8d1');border(0,0,1800,650);
    arrow(45,75,390,500,true);
    c.fillStyle='#b43e34';c.beginPath();c.arc(830,322,210,0,Math.PI*2);c.fill();c.fillStyle='#ebae3f';c.beginPath();c.arc(830,322,172,0,Math.PI*2);c.fill();
    truck(691,202,275,155,black);c.fillStyle=black;c.font='600 98px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('12 m',830,394);
    for(const dir of [-1,1]){const x=830+dir*140;c.beginPath();c.moveTo(x-dir*20,374);c.lineTo(x,394);c.lineTo(x-dir*20,414);c.lineWidth=8;c.strokeStyle=black;c.stroke();}
    route(1188,35,273,268,'1','#b44540',white,true);route(1490,35,273,268,'3','#b44540',white,true);route(1310,340,338,278,'51','#efb33d',black,true);
    // Right assembly: blue arrow, two blue transport symbols, three pale
    // tourism symbols; route shields4/7/E75 beneath. No destination words.
    const yy=700;field(0,yy,1800,650,blue);border(0,yy,1800,650);arrow(28,yy+75,340,510);
    c.strokeStyle=white;c.lineWidth=8;c.beginPath();c.moveTo(425,yy);c.lineTo(425,yy+650);c.stroke();
    for(let i=0;i<5;i++){const x=445+i*260;field(x,yy+27,246,285,i<2?blue:white);border(x,yy+27,246,285);}
    truck(460,yy+61,220,224,white);plane(722,yy+64,211,213);tent(983,yy+53,210,230);cabin(1243,yy+56,212,225);caravan(1503,yy+61,214,221);
    route(447,yy+344,247,266,'4','#b44540',white,true);route(714,yy+344,247,266,'7','#b44540',white,true);route(995,yy+347,522,263,'E75','#387c59');
    // Separate small right-bend square above the left arrow.
    field(0,1400,500,500,blue);border(0,1400,500,500);arrow(50,1440,400,420);
    map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  }
  const printed=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#2456a8',roughness:.72});
  function panel(x,y,w,h,atlas){
    const backing=new THREE.BoxGeometry(w+.035,h+.035,.07);backing.translate(x,y,.21);add(backing,backParts);
    const face=new THREE.PlaneGeometry(w,h),uv=face.attributes.uv;const [ax,ay,aw,ah]=atlas;
    for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,(ax+u*aw)/2048,1-(ay+(1-v)*ah)/2048);}
    face.translate(x,y,.247);add(face,faceParts);
    for(const dx of [-w*.32,w*.32])beam([x+dx,y-h*.40,-.21],[x+dx,y+h*.40,.15],.04);
  }
  const y=p.clearance+.695+.0175;
  panel(-10.95,y,3.60,1.30,[0,0,1800,650]);
  panel(-6.03,y,3.85,1.39,[0,700,1800,650]);
  panel(-12.25,y+1.14,1,1,[0,1400,500,500]);
  for(const [parts,material]of [[steelParts,steel],[backParts,aluminium],[faceParts,printed]]){
    const mesh=new THREE.Mesh(mergeGeometries(parts),material);mesh.name=material===printed?'Observed arrow, restriction and route-shield faces':material===steel?'Open cantilever steelwork':'Metal sign backs and pole base';mesh.castShadow=true;group.add(mesh);parts.forEach(g=>g.dispose());
  }
  group.userData={...ETELARANTA_GANTRY_REFERENCE,clearance:p.clearance,poleFootprint:ETELARANTA_GANTRY_POLE,collision:'pole only; open roadway beneath cantilever'};
  return group;
}
