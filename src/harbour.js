import {WATER_LEVEL} from './quay.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CYCLE_SURFACES,PLATFORM_SURFACES,PLATFORM_RAILS,HARBOUR_RAIL,FERRY,HARBOUR_REFERENCE,surfaceId,inHarbour} from './harbour-layout.js';
import {pointInPolygon,bounds} from './geo.js';
import polygonClipping from 'polygon-clipping';
import {createHarbourSigns} from './harbour-signs.js';
import {cutLowerYard} from './port-yard.js';
import {createTerminalDetails} from './terminal-details.js';
import {createOlympiaFrontage} from './terminal-frontage.js';
import {createBreakableSigns} from './breakable-signs.js';
import {objectBehavior,solidBox} from './world-objects.js';

// Static geometry is batched by material and 160 m cell. Fine details do not
// become thousands of draw calls, and distant street furniture can be culled.
export function createHarbour(data){
 const group=new THREE.Group();group.name='Photo-guided Olympia to Eteläranta streets';
 const batches=new Map(),obstacles=[],worldObjects=[],counts={platforms:0,cycleways:0,railingBays:0,lamps:0,trailers:0};
 const palette={asphalt:'#424847',footway:'#636965',cycle:'#805953',granite:'#aaa89f',paving:'#97978d',setts:'#777a71',metal:'#8faaa8',dark:'#3d4a4a',white:'#e8e9e2',blue:'#145d9e',glass:'#294b5b',rubber:'#27302f',boat:'#e7a052',rock:'#797d73',brick:'#a58a66',yellow:'#d8b73e'};
 const materials=Object.fromEntries(Object.entries(palette).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:['glass','blue'].includes(k)?.38:.88,metalness:k==='metal'?.55:k==='glass'?.35:0})]));
 materials.rock.flatShading=true;
 materials.rock.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vRock;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRock=position;');
  s.fragmentShader='varying vec3 vRock;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float band=sin(vRock.y*7.+vRock.x*.8+sin(vRock.z*1.3));
   diffuseColor.rgb*=.91+.12*band+.045*sin(vRock.x*16.+vRock.z*11.);
  `);
 };
 materials.brick.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vBrick;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBrick=position;');
  s.fragmentShader='varying vec3 vBrick;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 uv=vec2(vBrick.x*.805-vBrick.z*.594,vBrick.y)/vec2(.26,.085);uv.x+=mod(floor(uv.y),2.)*.5;
   vec2 edge=min(fract(uv),1.-fract(uv));float fp=max(fwidth(uv.x),fwidth(uv.y));
   float seam=1.-smoothstep(.035,.07+fp,min(edge.x,edge.y));
   float n=fract(sin(dot(floor(uv),vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=mix(1.,.86+n*.24-seam*.13,1.-smoothstep(.2,1.,fp));
  `);
 };
 for(const name of ['asphalt','footway','cycle','paving','setts']){
  const mat=materials[name];mat.polygonOffset=true;mat.polygonOffsetFactor=-1;mat.polygonOffsetUnits=-1;
  mat.customProgramCacheKey=()=>`harbour-surface-${name}`;
  mat.onBeforeCompile=s=>{
   s.vertexShader='varying vec3 vStreet;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStreet=position;');
   s.fragmentShader='varying vec3 vStreet;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float fp=max(length(dFdx(vStreet.xz)),length(dFdy(vStreet.xz)));
    float noise=fract(sin(dot(floor(vStreet.xz*28.),vec2(12.9898,78.233)))*43758.5453)-.5;
    diffuseColor.rgb*=.96+.045*sin(vStreet.x*.29+vStreet.z*.13)+noise*.16*(1.-smoothstep(.015,.09,fp));
    ${['paving','setts'].includes(name)?`vec2 cell=abs(fract(vStreet.xz/vec2(${name==='paving'?'.4,.6':'.17,.22'}))-.5);float seam=smoothstep(.43,.49,max(cell.x,cell.y));diffuseColor.rgb*=1.-seam*.22*(1.-smoothstep(.08,.45,fp));`:''}
   `);
  };
 }
 cutLowerYard(materials.asphalt);
 // Tram-stop flag poles are breakable (breakable-signs.js): while postIndex is set, geometry goes to that post.
 const stopSigns=createBreakableSigns('Harbour stop and crossing posts');let postIndex=null;
 function add(g,mat){if(postIndex!==null){stopSigns.add(g,materials[mat],postIndex);return;}if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');g.computeBoundingBox();const c=g.boundingBox.getCenter(new THREE.Vector3());const key=`${mat}:${Math.floor(c.x/160)}:${Math.floor(c.z/160)}`;if(!batches.has(key))batches.set(key,{mat,parts:[]});batches.get(key).parts.push(g);}
 function box(w,h,d,mat,x,y,z,yaw=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);add(g,mat);}
 function beam(a,b,r=.035,mat='metal'){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);if(delta.length()<.001)return;const g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,mat);}
 function polygon(rings,mat,height=.082,depth=0){const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));for(const r of rings.slice(1))shape.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z))));const g=depth?new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1}):new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,height,0);add(g,mat);}
 function barrier(a,b,halfWidth=.09){const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=-dz/l*halfWidth,nz=dx/l*halfWidth;const r=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];obstacles.push({id:`harbour-rail-${obstacles.length}`,rings:[r],bbox:bounds([r])});}
 function railing(points,base=.16,mesh=false){
  for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),n=Math.ceil(l/2.1);
   for(let i=0;i<n;i++){const p=[a[0]+dx*i/n,a[1]+dz*i/n],q=[a[0]+dx*(i+1)/n,a[1]+dz*(i+1)/n];
    box(.085,1.1,.085,'metal',p[0],base+.55,p[1]);for(const h of [.23,.65,1.08])beam([p[0],base+h,p[1]],[q[0],base+h,q[1]],h===1.08?.035:.023);
    if(mesh)for(let k=1;k<8;k++){const t=k/8;beam([p[0]+(q[0]-p[0])*t,base+.24,p[1]+(q[1]-p[1])*t],[p[0]+(q[0]-p[0])*t,base+1.02,p[1]+(q[1]-p[1])*t],.009);}
    else for(const h of [.38,.52,.79,.93])beam([p[0],base+h,p[1]],[q[0],base+h,q[1]],.013);
    counts.railingBays++;
   }box(.085,1.1,.085,'metal',b[0],base+.55,b[1]);barrier(a,b);
  }
 }
 for(const p of [...data.roads,...data.pavement].filter(inHarbour)){
  const id=surfaceId(p),platform=PLATFORM_SURFACES.includes(id),cycle=CYCLE_SURFACES.includes(id);
  const mat=cycle?'cycle':/Noppa|Nupu|Mukul/.test(p.material)?'setts':/Betoni(kivi|laatta)|Graniitti/.test(p.material)?'paving':/Asfaltti/.test(p.material)?(data.roads.includes(p)?'asphalt':'footway'):null;
  if(mat)polygon(p.rings,mat,platform?.09:.082,platform?.11:0);
  if(platform)counts.platforms++;if(cycle)counts.cycleways++;
  // Granite edge follows the entire island footprint, including rounded noses.
  if(platform)for(const r of p.rings)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l>.05)box(.14,.19,l,'granite',(a[0]+b[0])/2,.14,(a[1]+b[1])/2,Math.atan2(b[0]-a[0],b[1]-a[1]));}
 }
 for(const run of PLATFORM_RAILS)railing(run.points,.21);
 railing(HARBOUR_RAIL,.09,true);
 // Exposed bedrock and retaining wall are real municipal features. Only the
 // relief is artistic: we have no terrain-height survey for this section yet.
 for(const id of [461318,131049,461329]){
  const p=data.parks.find(p=>surfaceId(p)===id);if(!p)continue;
  polygon(p.rings,'rock',.04,id===461318?2.7:1.1);
  obstacles.push({id:`harbour-rock-${id}`,rings:p.rings,bbox:p.bbox});
 }
 // Fill the port's apron inside the real shoreline. The public road, cycleway
 // and footway surfaces stay above this layer and keep their mapped boundaries.
 const apron=[[[218.3,887.32],[189.7,848.9],[145,789.3],[110,742.2],[300,742.2],[455,1030],[350,1040],[251.4,969],[249.65,953.97],[241.19,927.32],[218.3,887.32]]];
 for(const rings of polygonClipping.difference(apron,...data.water.map(p=>p.rings)))polygon(rings,'asphalt',.035);
 const frontage=createOlympiaFrontage(data,materials);
 group.add(frontage.group);obstacles.push(...frontage.obstacles);counts.terminalFrontages=frontage.group.userData.placed?1:0;
 // Street furniture anchors are interpreted from the photographed islands.
 // No shelters are invented from GTFS points or placed across boarding edges.
 for(const [x,z,yaw] of [[226.9,946,.08],[238.6,952,.27],[17.3,543,.06],[26.3,543,.06]]){
  postIndex=stopSigns.post({id:`harbour-stop-${x}`,x,z,y:.2,yaw,height:3.45,radius:.06});const post=postIndex;
  beam([x,.2,z],[x,3.6,z],.045);box(.72,.65,.07,'yellow',x,3.32,z,yaw);box(.59,.37,.075,'dark',x,3.24,z,yaw);
  // timetable case and a small open bench on the non-boarding side
  box(.44,.67,.08,'white',x,1.6,z,yaw);postIndex=null;for(let k=0;k<4;k++)box(.11,.055,1.5,'dark',x+.36+k*.12,.65,z+2,yaw);
  for(const dz of [1.4,2.6])box(.08,.5,.08,'metal',x+.53,.38,z+dz);
  // Original text signs, not copied photo pixels. Keep route numbers off
  // the sign until historical imagery and the dated GTFS snapshot agree.
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
   ctx.fillStyle='#f4e5a5';ctx.fillRect(0,0,512,256);ctx.fillStyle='#243a40';ctx.textAlign='center';ctx.font='bold 32px sans-serif';ctx.fillText(z>900?'Olympiaterminaali':'Eteläranta',256,73);
   ctx.font='24px sans-serif';ctx.fillText(z>900?'Olympiaterminalen':'Södra kajen',256,115);ctx.font='bold 35px sans-serif';ctx.fillText('RAITIOVAUNU',256,199);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   const label=new THREE.Mesh(new THREE.PlaneGeometry(.69,.345),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));label.position.set(x+Math.sin(yaw)*.042,3.33,z+Math.cos(yaw)*.042);label.rotation.y=yaw;group.add(label);stopSigns.attach(label,post);
  }
 }
 // Lattice tram supports, transverse suspension and compact dome luminaires.
 const lighting=[[249,956,216,956],[231,914,209,914],[207,872,184,885],[181,837,155,854],[154,800,129,818],[127,764,103,782],[101,729,77,747],[76,694,52,712],[48,640,20,643],[40,587,12,589],[38,520,10,522]];
 for(const [x,z,lx,lz] of lighting){
  for(const side of [-1,1])beam([x+side*.16,0,z],[x+side*.11,8.6,z],.035);
  for(let h=.25;h<8;h+=.7)beam([x-.15,h,z],[x+.15,h+.7,z],.018);
  beam([x,8.4,z],[lx,8.4,lz],.013,'dark');beam([lx,0,lz],[lx,8.6,lz],.048);
  const mx=(x+lx)/2,mz=(z+lz)/2;beam([mx,8.4,mz],[mx,7.5,mz],.02,'dark');
  const shade=new THREE.SphereGeometry(.24,12,6,0,Math.PI*2,0,Math.PI/2);shade.translate(mx,7.36,mz);add(shade,'metal');box(.36,.035,.36,'white',mx,7.36,mz);counts.lamps++;
  obstacles.push(solidBox({id:`harbour-lattice-${x}-${z}`,name:'Harbour lattice support',x,z,width:.39,depth:.07}),solidBox({id:`harbour-wire-post-${lx}-${lz}`,name:'Harbour suspension support',x:lx,z:lz,width:.096,depth:.096}));
  worldObjects.push(objectBehavior({id:`harbour-suspension-${x}-${z}`,minY:7.1},'overhead'));
 }
 // Start crossing matches the mapped raised crossing: not an arbitrary zebra
 // across both rails. Yield triangles are on the approach, away from the island.
 for(let i=0;i<5;i++)box(.47,.012,3.1,'white',222.15+i*.83,.103,966.1,.035);
 for(let i=0;i<4;i++)polygon([[[221.6+i*1.08,976],[222.3+i*1.08,976],[221.95+i*1.08,976.9]]],'white',.104);
 for(const [x,z] of [[220.3,962.6],[227.1,962.5]]){
  postIndex=stopSigns.post({id:`harbour-crossing-${x}`,x,z,height:3.25,radius:.035});
  beam([x,0,z],[x,3.25,z],.035);box(.56,.56,.055,'blue',x,2.94,z);
  // White triangular pedestrian-crossing pictogram (original vector geometry).
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x-.23,2.72,z+.031,x+.23,2.72,z+.031,x,3.17,z+.031],3));g.computeVertexNormals();add(g,'white');postIndex=null;
 }
 // Apron props are illustrative positions on actual land, not container stacks.
 for(const [x,z] of [[242,808],[253,827],[262,843],[241,832],[223,791],[213,778]]){
  const corners=[[-1.3,-6.8],[1.3,-6.8],[1.3,6.8],[-1.3,6.8]].map(([a,b])=>[x+a*Math.cos(.64)+b*Math.sin(.64),z-a*Math.sin(.64)+b*Math.cos(.64)]);
  if(corners.some(([a,b])=>data.water.some(w=>pointInPolygon(a,b,w.rings))||data.buildings.some(p=>pointInPolygon(a,b,p.rings))))continue;
  box(2.5,3.15,13.4,'white',x,2.55,z,.64);box(2.3,.28,13.6,'dark',x,.86,z,.64);
  for(const s of [-1,1])for(const dz of [3.9,5,6]){const lx=s*1.16,lz=dz;const gx=x+lx*Math.cos(.64)+lz*Math.sin(.64),gz=z-lx*Math.sin(.64)+lz*Math.cos(.64);const wheel=new THREE.CylinderGeometry(.47,.47,.23,10);wheel.rotateZ(Math.PI/2);wheel.rotateY(.64);wheel.translate(gx,.51,gz);add(wheel,'rubber');}
  obstacles.push({id:`trailer-${counts.trailers}`,rings:[corners],bbox:bounds([corners])});counts.trailers++;
 }
 // Distinctive high apron floodlight tower seen beyond the public railing.
 for(const [x,z] of [[252,864],[219,747]]){
  for(const a of [-1,1])for(const b of [-1,1])beam([x+a*.55,0,z+b*.55],[x+a*.4,28,z+b*.4],.055);
  for(let y=0;y<28;y+=2){beam([x-.5,y,z-.5],[x+.5,y+2,z-.5],.035);beam([x+.5,y,z+.5],[x+.5,y+2,z-.5],.035);}
  box(4,.12,3,'metal',x,27.8,z);for(const a of [-1,0,1])for(const b of [-1,1])box(.65,.5,.25,'white',x+a*1.3,28.3,z+b*1.25);
 }
 // The ferry has a shaped hull, deck setbacks, bridge, lifeboats, funnel and
 // repeated cabin windows. All geometry; no photo pixels are shipped.
 const ship=new THREE.Matrix4().makeRotationY(FERRY.yaw);ship.setPosition(FERRY.x,WATER_LEVEL-.4,FERRY.z); // hull sits in the lowered harbour water, not on top of it
 function shipAdd(g,mat){g.applyMatrix4(ship);add(g,mat);}
 function sb(w,h,d,mat,x,y,z){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);shipAdd(g,mat);}
 const outline=[[-13,-101.5],[13,-101.5],[15.75,-86],[15.75,65],[13,83],[7,96],[0,101.5],[-7,96],[-13,83],[-15.75,65],[-15.75,-86]];
 const hullShape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z)));
 const hull=new THREE.ExtrudeGeometry(hullShape,{depth:13,bevelEnabled:true,bevelSegments:2,bevelSize:.6,bevelThickness:.5,steps:1});hull.rotateX(-Math.PI/2);shipAdd(hull,'white');
 sb(30.5,2,177,'blue',0,1.2,-7);
 sb(30.1,16,164,'white',0,21,-13);sb(28,4,151,'white',0,31,-17);
 for(const y of [13.8,17.1,20.4])sb(30.3,1.5,164,'blue',0,y,-13);
 for(const side of [-1,1])for(let row=0;row<6;row++)for(let j=0;j<51;j++){
  const y=12.4+row*3.3,z=-90+j*3.02;
  // Flush window faces need no unseen backs or four microscopic side walls.
  const pane=new THREE.PlaneGeometry(1.38,.86);pane.rotateY(side*Math.PI/2);pane.translate(side*(row===5?14.06:15.21),y,z);shipAdd(pane,'glass');
 }
 // Aft open sun decks, glazed bridge wings and the twin promenade roof bands.
 for(const y of [15,19,23,27])sb(29,.17,11,'white',0,y,-95);
 sb(32.8,3.3,8,'glass',0,31.2,62);sb(33.2,.25,8.7,'white',0,33,62);
 sb(33.2,.45,8.7,'white',0,29.65,62);
 for(let x=-15.8;x<16;x+=2.1)sb(.16,2.9,.18,'white',x,31.2,66.08);
 for(const side of [-1,1])for(const z of [59,61,63,65])sb(.16,2.9,.14,'white',side*16.47,31.2,z);
 for(const x of [-6,6]){const dome=new THREE.SphereGeometry(1.05,12,8);dome.translate(x,35.1,49);shipAdd(dome,'white');sb(.65,.8,.65,'white',x,33.8,49);}
 for(const x of [-8,8])sb(7,.35,120,'glass',x,33.15,-15);
 for(const side of [-1,1])for(const z of [-46,-30,-14,2,18]){
  const boat=new THREE.CapsuleGeometry(1.15,6,3,8);boat.rotateX(Math.PI/2);boat.scale(.86,.65,1);boat.translate(side*15.7,11,z);shipAdd(boat,'boat');
  sb(.23,2.1,.25,'white',side*16.4,12.2,z-3.5);sb(.23,2.1,.25,'white',side*16.4,12.2,z+3.5);
 }
 // Tall sloping funnel rather than a rectangular chimney: distinctive in
 // 2023 terminal photography. Seal drawing remains stylised.
 const funnelShape=new THREE.Shape([new THREE.Vector2(-65,33),new THREE.Vector2(-62,45),new THREE.Vector2(-57,45),new THREE.Vector2(-37,33)]);
 const funnel=new THREE.ExtrudeGeometry(funnelShape,{depth:9,bevelEnabled:false});funnel.rotateY(-Math.PI/2);funnel.translate(4.5,0,0);shipAdd(funnel,'white');
 const funnelCap=new THREE.Shape([new THREE.Vector2(-62,45),new THREE.Vector2(-57,45),new THREE.Vector2(-37,33),new THREE.Vector2(-40,33),new THREE.Vector2(-58,43.7),new THREE.Vector2(-62.3,43.7)]);
 const cap=new THREE.ExtrudeGeometry(funnelCap,{depth:9.15,bevelEnabled:false});cap.rotateY(-Math.PI/2);cap.translate(4.575,0,0);shipAdd(cap,'blue');
 for(const z of [-61,-59,-57])sb(5,2,1.05,'dark',0,46,z);
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,1024,256);c.fillStyle='#1c5894';c.font='bold 120px Arial';c.textAlign='center';c.fillText('SILJA LINE',512,170);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  for(const side of [-1,1]){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(23,5.75),new THREE.MeshStandardMaterial({map:texture}));mesh.rotation.y=side*Math.PI/2;mesh.position.set(side*15.25,8.3,33);mesh.updateMatrix();mesh.applyMatrix4(ship);group.add(mesh);}
 }
 for(const z of [-75,43]){const mast=new THREE.CylinderGeometry(.16,.26,8,8);mast.translate(0,37,z);shipAdd(mast,'metal');sb(6,.12,.16,'white',0,39,z);}
 // Cap rails are physical, but omit sub-pixel railing wires from the far ship.
 for(const side of [-1,1])for(let z=-90;z<50;z+=3){sb(.055,1,.055,'white',side*14,33.7,z);}
 for(const side of [-1,1])sb(.07,.07,141,'white',side*14,34.2,-20);
 for(const {mat,parts} of batches.values()){
  const geometry=mergeGeometries(parts);const mesh=new THREE.Mesh(geometry,materials[mat]);mesh.castShadow=!['asphalt','footway','cycle','setts','paving'].includes(mat);mesh.receiveShadow=true;group.add(mesh);parts.forEach(g=>g.dispose());
 }
 group.add(stopSigns.finish());group.breakable=stopSigns;
 const signs=createHarbourSigns();group.add(signs);
 obstacles.push(...signs.obstacles);
 const terminalDetails=createTerminalDetails(data);group.add(terminalDetails.group);obstacles.push(...terminalDetails.obstacles);
 group.worldObjects=worldObjects;
 group.userData={...counts,frontage:frontage.group.userData,terminalDetails:terminalDetails.group.userData,overheadSigns:signs.userData,ferry:{...FERRY},reference:HARBOUR_REFERENCE,batches:group.children.length};
 return {group,obstacles,knockables:terminalDetails.knockables,enterableCars:terminalDetails.enterableCars}; // knockables: docked terminal city bikes
}
