import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createArticModules,createJokeriModules,drawSignRow,SIGN_ATLAS,SIGN_REGIONS} from './tram-model.js';
import {routePoint} from './mobility.js';
import {TRAM_DIMENSIONS,JOKERI_DIMENSIONS} from './tram-simulation.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {registerEnvMaterial} from './environment.js';
import {groundAt,groundPose,hasTerrain} from './terrain.js';
import {drapeGeometry} from './terrain-mesh.js';
// Hilly cities: line segments split every 4 m and lifted onto the ground (rail heads, contact wire).
function drapeLines(list,step=4){if(!hasTerrain())return list;const out=[];
 for(let i=0;i<list.length;i+=6){const [ax,ay,az,bx,by,bz]=list.slice(i,i+6),n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/step));
  for(let k=0;k<n;k++)for(const t of [k/n,(k+1)/n]){const x=ax+(bx-ax)*t,z=az+(bz-az)*t;out.push(x,ay+(by-ay)*t+groundAt(x,z),z);}}
 return out;}

export function createTramRenderer(scene,sim){
 const seen=new Set(),rails=new THREE.Group();rails.name='HSL route-based tram rails and contact wires';scene.add(rails);
 // Rails for a set of paths; lines added later (a map extension's light rail) get their own batch.
 function addRails(paths){const railParts=[],grooves=[],wires=[],railLines=[];
 for(const path of paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],key=[a.map(v=>Math.round(v*2)).join(','),b.map(v=>Math.round(v*2)).join(',')].sort().join('|');if(seen.has(key))continue;seen.add(key);
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.2)continue;const heading=Math.atan2(dx,dz),nx=-dz/length,nz=dx/length;
  for(const sign of [-1,1])for(const [target,width,y] of [[grooves,.14,.106],[railParts,.045,.11]]){const g=new THREE.PlaneGeometry(width,length+.02);g.rotateX(-Math.PI/2);g.rotateY(heading);g.translate((a[0]+b[0])/2+nx*.5*sign,y,(a[1]+b[1])/2+nz*.5*sign);target.push(g);}
  for(const sign of [-1,1])railLines.push(a[0]+nx*.5*sign,.135,a[1]+nz*.5*sign,b[0]+nx*.5*sign,.135,b[1]+nz*.5*sign);
  wires.push(a[0],5.6,a[1],b[0],5.6,b[1]);
 }
 // Asphalt overlays use a negative polygon offset. Rails need a stronger
 // decal bias; otherwise the road wins the depth test farther from the camera
 // and appears to erase the already-loaded rails as the car moves.
 for(const [parts,color] of [[grooves,'#3b4240'],[railParts,'#a3aaa7']])if(parts.length){const mesh=new THREE.Mesh(drapeGeometry(mergeGeometries(parts)),new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.3,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));mesh.receiveShadow=true;mesh.renderOrder=2;rails.add(mesh);parts.forEach(g=>g.dispose());}
 // Keep distant rail heads at least one screen pixel wide. The physical
 // 45 mm strips alone become sub-pixel and vanish in the low driving camera.
 const railGeometry=new LineSegmentsGeometry();railGeometry.setPositions(drapeLines(railLines));
 const railMaterial=new LineMaterial({color:'#a8b0aa',linewidth:1.2,worldUnits:false,alphaToCoverage:true,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6});
 const continuousRails=new LineSegments2(railGeometry,railMaterial);continuousRails.name='Continuous full-route rail heads';continuousRails.renderOrder=3;rails.add(continuousRails);
 const wireGeometry=new THREE.BufferGeometry();wireGeometry.setAttribute('position',new THREE.Float32BufferAttribute(drapeLines(wires),3));rails.add(new THREE.LineSegments(wireGeometry,new THREE.LineBasicMaterial({color:'#485251',transparent:true,opacity:.3,depthWrite:false})));}
 addRails(sim.paths);
 // Artic fleet: every module kind is instanced once per material, so the whole
 // three-module fleet (with see-through glazing and interiors) costs 12 draw
 // calls: the lamps and the lettering (front/side/rear displays, numbers)
 // share one unlit batch per module, lamps sampling a white atlas texel.
 // Capacity follows the simulation fleet cap (hotspot feeders grow the
 // fleet) and the lettering atlas gets one row per instance, so rows are never
 // re-drawn per frame when more than eight trams are in play.
 const capacity=Math.max(SIGN_ATLAS.rows,sim.capacity||0,sim.trams.length),ROWS=capacity;
 // Glossy clearcoated livery and tinted glazing that reflects the shared sky
 // environment while staying see-through to the lit interior.
 const materials={
  paint:registerEnvMaterial(new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.4,metalness:.1,clearcoat:.55,clearcoatRoughness:.22}),.75),
  interior:new THREE.MeshBasicMaterial({vertexColors:true}),
  glass:registerEnvMaterial(new THREE.MeshPhysicalMaterial({color:'#15262c',roughness:.05,metalness:.55,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}),1.4)
 };
 // Passengers: same unlit look as the interior, animated in the vertex shader from
 // per-tram hit time/side (tram-simulation.js) using the rig from tram-model.js.
 // Most react (arms up / point at the window / turn and half-stand); a few just sway.
 materials.passengers=new THREE.MeshBasicMaterial({vertexColors:true});
 materials.passengers.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
attribute vec3 pBase;attribute vec3 pJoint;attribute vec4 pInfo;attribute float hitAge;attribute float hitSide;`).replace('#include <begin_vertex>',`#include <begin_vertex>
if(hitAge>=0.0&&hitAge<10.0){
 float r=pInfo.y,type=pInfo.x,face=pInfo.z,seated=pInfo.w,on=smoothstep(.1,.55,hitAge)*(1.0-smoothstep(7.0,10.0,hitAge));
 if(r>.14){
  if(type==1.0||type==2.0){vec3 p=transformed-pJoint;
   if(r<.52){float a=-face*(2.5*on+.22*on*sin(hitAge*9.0+r*20.0)),c=cos(a),s=sin(a);p=vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}
   else if(r<.84&&((type==2.0&&hitSide>0.0)||(type==1.0&&hitSide<0.0))){float a=hitSide*(1.45*on+.12*on*sin(hitAge*7.0)),c=cos(a),s=sin(a);p=vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
   transformed=pJoint+p;}
  if(type==3.0){vec3 p=transformed-pJoint;float a=.9*hitSide*face*on,c=cos(a),s=sin(a);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);transformed=pJoint+p;}
  transformed.y+=seated*step(.45,r)*.14*on;
  transformed.x+=.08*hitSide*on*max(0.0,transformed.y-pBase.y)/1.4;
 }
 transformed.z+=.16*exp(-2.2*hitAge)*sin(hitAge*10.0)*(.5+r)*max(0.0,transformed.y-pBase.y+.3);
 transformed.x=clamp(transformed.x,-1.08,1.08); // a pointing hand presses on the glass, never through the body
}`);};
 let atlas=null,ctx=null;
 if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=SIGN_ATLAS.width;canvas.height=SIGN_ATLAS.rowHeight*ROWS;ctx=canvas.getContext('2d');
  // Lamps sample the white patch, so it must be white before any row is drawn.
  ctx.fillStyle='#ffffff';ctx.fillRect(SIGN_REGIONS.white.x[0],0,SIGN_REGIONS.white.x[1]-SIGN_REGIONS.white.x[0],canvas.height);
  atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=8;}
 // Unlit lamps and LED displays: tone mapping off so the amber stays bright in dusk and daylight.
 materials.lit=new THREE.MeshBasicMaterial({vertexColors:true,map:atlas,alphaTest:.5,toneMapped:false});
 // Each instance picks its tram's row of the shared lettering atlas.
 materials.lit.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float signRow;').replace('#include <uv_vertex>',`#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv.y=(vMapUv.y+${ROWS-1}.0-signRow)/${ROWS}.0;\n#endif`);};
 // One instanced fleet per vehicle type: the Artic, and the Raide-Jokeri once its line is loaded.
 function createFleet(modules,dims,name){const fleet=new THREE.Group();fleet.name=name;scene.add(fleet);
 const kinds=modules.map((parts,j)=>Object.entries(parts).filter(([,g])=>g).map(([name,geometry])=>{
  if(name==='lit')geometry.setAttribute('signRow',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  if(name==='passengers')for(const a of ['hitAge','hitSide'])geometry.setAttribute(a,new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(-1),1));
  const mesh=new THREE.InstancedMesh(geometry,materials[name],capacity);mesh.name=`Artic module ${j} ${name}`;mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=name==='paint';mesh.receiveShadow=name==='paint';mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);fleet.add(mesh);return mesh;}));
 return {group:fleet,kinds,dims};}
 const artic=createFleet(createArticModules(),TRAM_DIMENSIONS,'HSL Artic tram fleet'),fleets={artic};
 const rows=[],matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0),euler=new THREE.Euler(0,0,0,'YXZ'),slope={y:0,pitch:0,roll:0};
 function sign(i){const t=sim.trams[i],row=i%ROWS,key=t&&`${t.id}|${t.path.line}|${t.path.destination}|${t.path.shapeId}`;if(!t||rows[row]===key)return;rows[row]=key;
  // Fleet numbers are illustrative Artic numbers (401-); lines/destinations are HSL data.
  if(ctx){drawSignRow(ctx,row,{line:t.path.line,destination:t.path.destination,fleet:t.path.vehicle==='jokeri'?601+((t.id*7+3)%29):401+((t.id*17+11)%80)});atlas.needsUpdate=true;}}
 return {group:artic.group,kinds:artic.kinds,fleets,
  addPaths(paths){addRails(paths);if(!fleets.jokeri&&paths.some(p=>p.vehicle==='jokeri'))fleets.jokeri=createFleet(createJokeriModules(),JOKERI_DIMENSIONS,'Raide-Jokeri light rail fleet');},
  update(player){const counts={};for(const k in fleets)counts[k]=0;
  sim.trams.forEach((t,i)=>{const type=fleets[t.path.vehicle]?t.path.vehicle:'artic',{kinds,dims}=fleets[type],n=counts[type];if(n>=capacity||Math.hypot(t.x-player.x,t.z-player.z)>=470)return;sign(i);
   kinds.forEach((meshes,j)=>{const p=routePoint(t.path,t.s+dims.centres[j],0);groundPose(p.x,p.z,p.heading,4,1.2,slope);matrix.compose(position.set(p.x,.12+slope.y,p.z),slope.y||slope.pitch?quaternion.setFromEuler(euler.set(slope.pitch,p.heading,slope.roll)):quaternion.setFromAxisAngle(up,p.heading),scale);
    for(const mesh of meshes){mesh.setMatrixAt(n,matrix);const {signRow:row,hitAge}=mesh.geometry.attributes;if(row)row.setX(n,i%ROWS);if(hitAge){hitAge.setX(n,t.hitAt===undefined?-1:sim.time-t.hitAt);mesh.geometry.attributes.hitSide.setX(n,t.hitSide||1);}}});counts[type]++;});
  for(const [type,{kinds,group}] of Object.entries(fleets)){const n=counts[type];if(type!=='artic')group.visible=n>0;for(const meshes of kinds)for(const mesh of meshes){mesh.count=n;mesh.instanceMatrix.needsUpdate=true;const {signRow:row,hitAge,hitSide}=mesh.geometry.attributes;if(row)row.needsUpdate=true;if(hitAge){hitAge.needsUpdate=true;hitSide.needsUpdate=true;}}}
 }};
}
