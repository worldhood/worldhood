import * as THREE from 'three';
import {Kit,footprintFrame} from './place-landmarks.js';
import {terrain} from './terrain.js';

// Municipal source data is unchanged; selected blank walls are replaced at render time.
// Detail is original geometry interpreted from
// the permitted exterior references, not scanned or surveyed facade geometry.
export function createMunicipalWaterfront(models){
 const group=new THREE.Group();group.name='Oulu municipal waterfront';
 for(const model of models){
  const node=new THREE.Group();node.name=model.name;node.userData={building:model.building,municipalElevation:true,sourceHeight:model.height};
  const F=footprintFrame(model.ring,[.85,.53]),k=new Kit(),W=F.width,D=F.depth,H=model.height;
  const inverse=F.matrix.clone().invert();
  const local=model.vertices.map(v=>new THREE.Vector3(...v).applyMatrix4(inverse));
  const retained=model.faces.filter(f=>{
   const pts=f.map(i=>local[i]);
   // Open the glazed facade and portico; keep the municipal roof and other elevations.
   if(pts.every(p=>Math.abs(p.z-D/2)<.12))return false;
   if(model.kind==='theatre'&&pts.every(p=>Math.abs(p.x-W/2)<.12))return false;
   return true;
  });
  const positions=retained.flatMap(f=>f.flatMap(i=>model.vertices[i]));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const shell=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:model.kind==='library'?'#bfc3bb':'#d2d0c5',roughness:.85,side:THREE.DoubleSide}));shell.name='Imported municipal LOD1 shell';shell.castShadow=shell.receiveShadow=true;node.add(shell);
  shell.userData.replacedTriangles=model.faces.length-retained.length;
  if(model.kind==='library'){
   // Main glazed facade: 54.27 m in the imported mesh, consistent with the city's 54 m description.
   grid(k,W-.35,H-3.7,0,3.5,D/2+.06,35,9,'#648b97','#cdd0c8');
   k.box(W,.3,.3,0,3.25,D/2+.12,'#aeb4ae');k.box(W,.28,.25,0,H-.28,D/2+.12,'#cdd0c8');
   for(let i=0;i<12;i++){const x=-W/2+.7+i*(W-1.4)/11;k.cyl(.19,.19,3.3,x,0,D/2+.2,'#c1c4b9');}
   grid(k,W-1,3.15,0,.1,D/2-1.5,24,1,'#b6cbd0','#d4d8cf');
   for(const x of [-18,-6,6,18])for(const dx of [-.9,0,.9])k.box(.06,2.8,.12,x+dx,0,D/2-1.4,'#cdd0c8');
   // Visible floor plates behind glass prevent an opaque, featureless curtain wall.
   for(const y of [3.5,7,10.5])k.box(W-.5,.16,7,0,y,D/2-3.6,'#d6d7ce');
   k.box(W-.5,H-3.7,.16,0,3.5,D/2-7,'#d5d2c0');
  }else{
   // SW elevation from the 2026 CC0 view: small-window wing, stair glazing and ribbon windows.
   const side=new Kit(),length=D*.61;
   side.box(length,H-3.5,.07,0,3.4,0,'#b9c6ca');
   for(let row=0;row<3;row++)side.pane(length-.2,.85,.08,0,4.5+row*3.1,.07,'#557785');
   for(let i=0;i<=26;i++)side.box(.06,H-3.5,.08,-length/2+i*length/26,3.4,.12,'#d2d3cb');
   for(let y=3.4;y<H;y+=1.5)side.box(length,.06,.08,0,y,.13,'#d2d3cb');
   const S=F.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-W/2-.08,0,D/2-length/2)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2));node.add(side.build(S,'Photo-guided theatre SW glazing'));
   const annex=new Kit();annex.box(20,H-3.5,.08,0,3.4,0,'#bec7c6');for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=(col-1.5)*4.4,y=4.7+row*3.1;annex.box(2.9,1.05,.08,x,y,0,'#dedfd7');annex.pane(2.6,.8,.08,x,y+.13,.08,'#5d767d');annex.box(.055,.8,.1,x,y+.13,.14,'#d1d6ce');
   }
   const A=F.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-W/2-.08,0,-25)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2));node.add(annex.build(A,'Photo-guided theatre annex windows'));
   const stairs=new Kit();grid(stairs,7.1,H-.3,0,.1,.1,2,4,'#58716d','#c5cbc1');for(let level=0;level<3;level++)for(const side of [-1,1]){
    const g=new THREE.BoxGeometry(3.5,.13,.12);g.rotateZ(side*.52);g.translate(side*1.5,2.4+level*3.4,.2);stairs.put(stairs.solid,g,'#aeb9ac');
   }
   const T=F.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-W/2-.09,0,-11.3)).multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2));node.add(stairs.build(T,'Photo-guided theatre stair glazing'));
   // The municipal shell has no stage-house roof volume. These dimensions are photo estimates.
   const curve=Array.from({length:49},(_,i)=>{const v=-18+i*.75;return [-20+6*(v/18)**2,v+9];});
   const ring=[...curve,[6,27],[6,-9],curve[0]];
   k.walls(ring,H,H+6,'#c7c4b3');
   for(let v=-8;v<27;v+=.7)k.box(.03,5.8,.025,6.03,H,v,'#b8b7aa');
   for(let i=1;i<curve.length;i++){
    const [a,b]=[curve[i-1],curve[i]],du=b[0]-a[0],dv=b[1]-a[1];
    const band=new THREE.BoxGeometry(.065,2,Math.hypot(du,dv)+.02);band.rotateY(Math.atan2(du,dv));band.translate((a[0]+b[0])/2-.06,H+3,(a[1]+b[1])/2);k.put(k.solid,band,'#e1e1d8');
   }
   // SE concrete cantilever and recessed colonnade, CC0 Lenz 2026-01-05 04.
   k.box(W,H-3.5,.2,0,3.5,D/2-.1,'#d2d0c5');
   for(let x=-W/2+1;x<W/2;x+=3)k.box(.025,H-3.5,.025,x,3.5,D/2+.015,'#b9b9af');
   k.box(W,.025,.025,0,9,D/2+.02,'#b9b9af');
   for(let i=0;i<12;i++)k.box(.12,5,.2,W*.23+i*.38,6,D/2+.08,'#90978e');
   grid(k,W-1,3.2,0,.1,D/2-1.4,30,1,'#b4c9c8','#d2d4cb');
   for(let x=-W/2+1;x<W/2;x+=5)k.cyl(.25,.25,3.5,x,0,D/2-.3,'#c5c5b8');
   // NE entrance curtain wall, CC0 Lenz 2026-01-05 05. Original geometry only.
   const entrance=new Kit(),lengthNE=D/2+7.59;
   grid(entrance,lengthNE-.3,H-3.65,0,3.5,.03,20,9,'#b5c8c6','#c4c7b9');
   grid(entrance,lengthNE-.3,3.2,0,.1,-1.3,20,1,'#b8ccca','#d6d8ce');
   entrance.box(lengthNE,.25,.3,0,3.25,0,'#c8c9ba');
   entrance.box(lengthNE,H-3.7,.12,0,3.5,-5,'#c6c2a7');
   entrance.box(lengthNE,.2,4.8,0,3.3,-2.5,'#dbd9c8');
   for(let v=-lengthNE/2+1;v<lengthNE/2;v+=5)entrance.cyl(.22,.22,3.3,v,0,-.3,'#c9cabb');
   const E=F.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(W/2,0,(D/2-7.59)/2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI/2));
   const entry=entrance.build(E,'Photo-guided theatre entrance');clearGlass(entry);node.add(entry);
  }
  const detail=k.build(F.matrix,'Photo-guided waterfront facade');clearGlass(detail);node.add(detail);
  node.position.y=model.sourceBaseElevation-(terrain()?.base||0);group.add(node);
 }
 return group;
}
function clearGlass(group){for(const mesh of group.children)if(mesh.material.metalness>.1){mesh.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.2,metalness:.05,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,emissive:0x718a91,emissiveIntensity:.18});mesh.castShadow=false;}}
function grid(k,w,h,x,y,z,columns,rows,glass,frame){
 k.pane(w,h,.08,x,y,z,glass);
 for(let i=0;i<=columns;i++)k.box(.055,h,.1,x-w/2+i*w/columns,y,z+.07,frame);
 for(let i=0;i<=rows;i++)k.box(w,.055,.1,x,y+i*h/rows,z+.07,frame);
}
