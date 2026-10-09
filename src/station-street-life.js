import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json' with {type:'json'};
import {architectureBuilder} from './cathedral.js';
import {SpatialIndex,pointInPolygon,bounds} from './geo.js';
import {createInstancedPeople} from './market-life.js';
import {createBreakableSigns} from './breakable-signs.js';
import {createParkedCarSource,instancedCarVisibility} from './parked-car-sources.js';

const font=new FontLoader().parse(fontData);
export function stationFootprint(x,z,w,d,heading=0){const c=Math.cos(heading),s=Math.sin(heading);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[x+c*a+s*b,z-s*a+c*b]);}
const samples=ring=>[...ring,...ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return [(a[0]+b[0])/2,(a[1]+b[1])/2];})];

// HSL stop anchors and the municipal 2025 orthophoto fix the site. Shelter
// dimensions and taxi occupancy are illustrative, not a surveyed/live queue.
export function stationPlacements(city,tramData,existing=[]){
 const pavement=new SpatialIndex(city.pavement),road=new SpatialIndex(city.roads),blocked=new SpatialIndex([...city.buildings,...city.water,...existing]);
 const obstacles=[],stops=[],taxis=[],signs=[];
 const clear=ring=>samples(ring).every(([x,z])=>!blocked.at(x,z)&&!obstacles.some(o=>pointInPolygon(x,z,o.rings)));
 const obstacle=(name,ring)=>obstacles.push({name,rings:[ring],bbox:bounds([ring])});
 for(const anchor of tramData.stops.filter(s=>s.name==='Päärautatieasema')){
  const platform=pavement.at(anchor.x,anchor.z);if(!platform)continue;
  const heading=(anchor.z>-33?-Math.PI/2:Math.PI/2)+.055;
  const shelters=[];
  // Three linked visual bays with walking gaps; retain the actual 50 m island.
  for(const along of [-12,0,12]){
   const x=anchor.x+Math.sin(heading)*along,z=anchor.z+Math.cos(heading)*along;
   let placed;
   for(const offset of [0,.2,-.2,.4,-.4,.6,-.6]){
    const px=x+Math.cos(heading)*offset,pz=z-Math.sin(heading)*offset,ring=stationFootprint(px,pz,1.35,6,heading);
    if(!clear(ring)||samples(ring).some(([a,b])=>road.at(a,b)||!pointInPolygon(a,b,platform.rings)))continue;
    placed={x:px,z:pz,heading,ring};obstacle('Station tram shelter',ring);break;
   }
   if(placed)shelters.push(placed);
  }
  stops.push({...anchor,heading,platform,shelters});
 }
 // Three north-facing queues seen in the 2025 orthophoto, entirely inside
 // Asema-aukio's taxi apron. Leave the west access loop and south exit open.
 for(const column of [-697,-689,-681])for(let i=0;i<6;i++){
  const z=-96+i*6,x=column+(z+96)*.058,heading=.058,ring=stationFootprint(x,z,2.15,4.9,heading);
  if(!clear(ring)||samples(ring).some(([a,b])=>pavement.at(a,b)||road.at(a,b)?.name!=='Asema-aukio'))continue;
  taxis.push({id:taxis.length,x,z,heading,speed:0,edge:{},ring});obstacle('Parked taxi',ring);
 }
 for(const p of [{x:-674,z:-64},{x:-705,z:-58}]){
  const ring=stationFootprint(p.x,p.z,.24,.24);
  if(clear(ring)&&samples(ring).every(([x,z])=>pavement.at(x,z)&&!road.at(x,z))){signs.push(p);obstacles.push({name:'Taxi rank sign',rings:[ring],bbox:bounds([ring]),breakable:true});} // placement-only: the post is breakable
 }
 return {stops,taxis,signs,obstacles};
}

export function createStationStreetLife(city,tramData,existing=[]){
 const plan=stationPlacements(city,tramData,existing),group=new THREE.Group();group.name='Central station tram platforms and Asema-aukio taxi rank';
 const b=architectureBuilder(),mat=(color,roughness=.75)=>new THREE.MeshStandardMaterial({color,roughness});
 const green=mat('#28554c'),silver=mat('#a5b4b2',.45),wood=mat('#7a6c55'),yellow=mat('#ecc849'),orange=mat('#df6f32'),produceGreen=mat('#5c8b54'),produceRed=mat('#d44732'),white=mat('#ecebe1'),blue=mat('#12558d'),black=mat('#1a2529'),granite=mat('#a9a69e');
 const glass=new THREE.MeshStandardMaterial({color:'#b6d4d8',transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,roughness:.3});
 const taxiSigns=createBreakableSigns('Taxi rank signs');
 const text=(label,x,y,z,size,maxWidth,material,yaw=0,post=null)=>{
  const g=new THREE.ShapeGeometry(font.generateShapes(label,size),3);g.computeBoundingBox();const box=g.boundingBox,w=box.max.x-box.min.x;
  g.translate(-(box.min.x+box.max.x)/2,-box.min.y,0);if(w>maxWidth)g.scale(maxWidth/w,1,1);g.rotateY(yaw);g.translate(x,y,z);if(post===null)b.add(g,material);else taxiSigns.add(g,material,post);
 };
 for(const stop of plan.stops){
  const shape=new THREE.Shape(stop.platform.rings[0].map(([x,z])=>new THREE.Vector2(x,-z))),g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,.155,0);b.add(g,granite);
  for(const s of stop.shelters){
   const c=Math.cos(s.heading),sn=Math.sin(s.heading),point=(a,y,d)=>[s.x+c*a+sn*d,y,s.z-sn*a+c*d];
   const box=(a,y,d,w,h,l,m)=>b.box(w,h,l,m,...point(a,y,d),s.heading);
   box(0,2.78,0,1.35,.14,6,green);
   for(const a of [-.60,.60])for(const d of [-2.85,0,2.85])box(a,1.5,d,.065,2.6,.065,green);
   box(.60,1.5,0,.025,2.2,5.65,glass);for(const d of [-2.85,2.85])box(0,1.5,d,1.18,2.2,.025,glass);
   box(.26,.66,0,.43,.13,3.6,wood);for(const d of [-1.4,1.4])box(.26,.4,d,.07,.44,.09,green);
   box(.57,1.4,1.7,.035,.78,.50,white);for(let k=0;k<6;k++)box(.54,1.63-k*.09,1.7,.01,.014,.38,black);
  }
  // Double-sided bilingual stop name and a small timetable headboard.
  const s=stop.shelters[1]||stop.shelters[0];if(s){
   b.box(.065,3.6,.065,silver,s.x,1.9,s.z);
   b.box(3,.54,.08,yellow,s.x,3.75,s.z);
   for(const side of [-1,1]){const yaw=side===1?0:Math.PI;text('PÄÄRAUTATIEASEMA',s.x,3.76,s.z+side*.046,.20,2.8,black,yaw);text('CENTRALSTATIONEN',s.x,3.54,s.z+side*.046,.14,2.7,black,yaw);}
  }
 }
 // Taxi rank signs are light single posts that bend or snap when hit (breakable-signs.js).
 for(const p of plan.signs){const i=taxiSigns.post({id:`taxi-${p.x}`,x:p.x,z:p.z,height:3.4,radius:.06}),part=(w,h,y,m)=>{const g=new THREE.BoxGeometry(w,h,.075);g.translate(p.x,y,p.z);taxiSigns.add(g,m,i);};
  part(.075,3.2,1.6,silver);part(1.05,.6,3.1,blue);text('TAKSI',p.x,2.94,p.z+.043,.26,.93,white,0,i);}
 group.add(taxiSigns.finish());group.breakable=taxiSigns;
 // Delineate the parked queue without spanning the entrance or pedestrian routes.
 for(const t of plan.taxis){for(const side of [-1,1])b.box(.06,.012,5.3,yellow,t.x+side*1.3,.17,t.z,t.heading);}
 // Roof signs belong to each car's instanced geometry below, so taking a taxi
 // removes its whole visual instead of leaving a floating sign at the rank.

 // Asema-aukio frontage: the photographed snack kiosks sit on the pedestrian
 // apron between Sokos and the station entrance, with the metro vestibule
 // immediately behind the railings. Placement is map-fitted and illustrative.
 const frontBlocked=new SpatialIndex([...city.roads,...city.buildings,...city.water,...existing,...plan.obstacles]);
 const frontObstacle=(name,ring)=>plan.obstacles.push({name,rings:[ring],bbox:bounds([ring])});
 const frontSafe=(x,z,r=.55)=>{
  const p=city.pavement.find(p=>p.bbox[0]<=x&&x<=p.bbox[2]&&p.bbox[1]<=z&&z<=p.bbox[3]&&pointInPolygon(x,z,p.rings));
  if(!p||frontBlocked.at(x,z))return false;
  for(const [dx,dz] of [[-r,-r],[r,-r],[r,r],[-r,r],[0,-r],[r,0],[0,r],[-r,0]])if(frontBlocked.at(x+dx,z+dz))return false;
  return true;
 };
 const frontProps=[],kioskNames=['KAHVI','GRILLI','SNACK','LEIPOMO','MEHU','KIOSKI'];
 const tryFront=(x,z,w,d)=>!frontProps.some(k=>Math.abs(k.x-x)<(k.w+w)/2+.4&&Math.abs(k.z-z)<(k.d+d)/2+.4)&&frontSafe(x,z,Math.max(w,d)/2+.25)&&frontSafe(x-w/2,z-d/2,.1)&&frontSafe(x+w/2,z-d/2,.1)&&frontSafe(x+w/2,z+d/2,.1)&&frontSafe(x-w/2,z+d/2,.1);
 // Search the actual Asema-aukio/Kaivokatu pedestrian polygons rather than
 // hard-coding a point that could land on the traffic lane after a data update.
 for(let i=0;i<kioskNames.length;i++){
  let found;
  for(let z=-88;z<=-49&&!found;z+=1.5)for(let x=-668;x<=-606&&!found;x+=2.2){
   const xx=x+(i%2)*.5,zz=z+Math.floor(i/2)*.2;
   if(tryFront(xx,zz,2.5,1.5)){found={x:xx,z:zz,w:2.5,d:1.5,heading:0,label:kioskNames[i]};break;}
  }
  if(found){frontProps.push(found);const ring=stationFootprint(found.x,found.z,found.w,found.d);frontObstacle('Station food kiosk',ring);}
 }
 for(const k of frontProps){
  b.box(k.w,.95,k.d,wood,k.x,.62,k.z);b.box(k.w+.18,.14,k.d+.16,k.label==='KAHVI'?yellow:orange,k.x,1.76,k.z);
  for(const sx of [-k.w/2+.12,k.w/2-.12])for(const sz of [-k.d/2+.12,k.d/2-.12])b.box(.07,1.72,.07,green,k.x+sx,.86,k.z+sz);
  b.box(k.w-.25,.06,.06,white,k.x,1.22,k.z-k.d/2-.035);
  text(k.label,k.x,1.78,k.z-k.d/2-.05,.18,2.15,black);
  for(let j=0;j<3;j++)b.box(.28,.18,.28,[yellow,produceRed,produceGreen][j],k.x-0.65+j*.65,.99,k.z-k.d/2-.07);
 }
 let metro;
 for(let z=-67;z<=-45&&!metro;z+=1)for(let x=-659;x<=-606&&!metro;x+=1){
  if(tryFront(x,z,3.8,2.2)){metro={x,z,w:3.8,d:2.2};}
 }
 if(metro){
  const ring=stationFootprint(metro.x,metro.z,metro.w,metro.d);frontObstacle('Central station metro entrance',ring);
  b.box(metro.w,.18,metro.d,black,metro.x,.12,metro.z);
  b.box(metro.w,.12,.14,blue,metro.x,2.62,metro.z-metro.d/2-.04);
  text('METRO',metro.x,2.62,metro.z-metro.d/2-.12,.32,2.8,white);
  b.box(2.35,.08,.08,silver,metro.x,1.9,metro.z-metro.d/2-.04);
  for(let i=0;i<5;i++)b.box(2.6,.025,.08,silver,metro.x,.2+i*.16,metro.z-metro.d/2-.03);
 }
 // A busy station frontage: static, instanced pedestrians at kiosk queues and
 // crossings. The crowd is deliberately local and uses mapped pavements only.
 const crowdRecords=[];
 const crowdSafe=(x,z)=>frontSafe(x,z,.34)&&!frontProps.some(k=>Math.abs(x-k.x)<1.7&&Math.abs(z-k.z)<1.2)&&(!metro||Math.abs(x-metro.x)>2.2||Math.abs(z-metro.z)>1.5);
 for(let i=0;i<150&&crowdRecords.length<72;i++){
  const x=-729+(i*17%70)+((i%3)-1)*.24,z=-105+((i*29)%57)*.9/1.0;
  if(crowdSafe(x,z)&&crowdRecords.every(p=>Math.hypot(p.x-x,p.z-z)>.82))crowdRecords.push({x,z,heading:(i%8)*Math.PI/4,pose:i%5===0?'phone':i%3===0?'browse':'chat'});
 }
 const crowd=createInstancedPeople(crowdRecords,{safe:crowdSafe,center:{x:-665,z:-65},name:'Central station frontage crowd'});group.add(crowd.group);
 group.add(b.finish());
 // Low-poly parked taxi fleet: these are static queue vehicles, so avoid
 // spending the full animated vehicle mesh budget on every cab.
 const taxiGroup=new THREE.Group();taxiGroup.name='Parked station taxi queue';
 const taxiBody=new THREE.InstancedMesh(new THREE.BoxGeometry(1.9,.56,4.35),white,plan.taxis.length),taxiRoof=new THREE.InstancedMesh(new THREE.BoxGeometry(1.45,.45,2.25),black,plan.taxis.length),taxiWheel=new THREE.InstancedMesh(new THREE.CylinderGeometry(.31,.31,.16,10).rotateZ(Math.PI/2),black,plan.taxis.length*4);
 const dummy=new THREE.Object3D(),taxiPaint=['#ededE8','#22282d','#a9afb1','#30353b','#e6e4de'];
 const taxiCap=new THREE.InstancedMesh(new THREE.BoxGeometry(1.49,.2,2.29),white,plan.taxis.length);
 const signParts=[];
 const signPart=(geometry,color)=>{
  const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');
  const tint=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));signParts.push(g);
 };
 signPart(new THREE.BoxGeometry(.48,.19,.23).translate(0,1.69,.15),'#ecc849');
 for(const side of [-1,1]){
  const g=new THREE.ShapeGeometry(font.generateShapes('TAKSI',.07),3);g.computeBoundingBox();const box=g.boundingBox,w=box.max.x-box.min.x;
  g.translate(-(box.min.x+box.max.x)/2,-box.min.y,0);if(w>.43)g.scale(.43/w,1,1);g.rotateY(side===1?0:Math.PI);g.translate(0,1.65,.15+side*.123);signPart(g,'#1a2529');
 }
 const taxiSign=new THREE.InstancedMesh(mergeGeometries(signParts),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}),plan.taxis.length);taxiSign.name='Taxi roof signs';signParts.forEach(g=>g.dispose());
 plan.taxis.forEach((t,i)=>{
  // Reset the entire transform: wheel rotation must never leak into the next cab.
  dummy.position.set(t.x,.72,t.z);dummy.rotation.set(0,t.heading,0);dummy.scale.set(1,1,1);dummy.updateMatrix();taxiBody.setMatrixAt(i,dummy.matrix);taxiBody.setColorAt(i,new THREE.Color(taxiPaint[i%taxiPaint.length]));
  dummy.position.y=1.21;dummy.updateMatrix();taxiRoof.setMatrixAt(i,dummy.matrix);
  dummy.position.y=1.49;dummy.updateMatrix();taxiCap.setMatrixAt(i,dummy.matrix);taxiCap.setColorAt(i,new THREE.Color(taxiPaint[i%taxiPaint.length]));
  dummy.position.y=0;dummy.updateMatrix();taxiSign.setMatrixAt(i,dummy.matrix);
  for(let w=0;w<4;w++){
   const sx=w<2?-.91:.91,sz=w%2?-1.35:1.35;
   dummy.position.set(t.x+Math.cos(t.heading)*sx+Math.sin(t.heading)*sz,.44,t.z-Math.sin(t.heading)*sx+Math.cos(t.heading)*sz);
   // The cylinder geometry is already rotated onto its axle.
   dummy.rotation.set(0,t.heading,0);dummy.updateMatrix();taxiWheel.setMatrixAt(i*4+w,dummy.matrix);
  }
 });
 [taxiBody,taxiRoof,taxiWheel,taxiCap,taxiSign].forEach(m=>{m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.receiveShadow=true;taxiGroup.add(m);});group.add(taxiGroup);
 const enterableCars=plan.taxis.map((actor,i)=>createParkedCarSource({id:`station-taxi-${i}`,label:'Taxi',actor,
  obstacle:plan.obstacles.find(o=>o.rings[0]===actor.ring),visual:{type:'taxi',paint:taxiPaint[i%taxiPaint.length]},
  setHidden:instancedCarVisibility([...([taxiBody,taxiRoof,taxiCap,taxiSign].map(mesh=>({mesh,index:i}))),...Array.from({length:4},(_,w)=>({mesh:taxiWheel,index:i*4+w}))])}));
 group.userData={stops:plan.stops.map(s=>({id:s.id,name:s.name,x:s.x,z:s.z,shelters:s.shelters.length})),taxis:plan.taxis.length,signs:plan.signs.length,foodStands:frontProps.length,metroEntrance:!!metro,people:crowdRecords.length,reference:'HSL bundled stop coordinates, municipal 2025 orthophoto; approximate furniture and illustrative taxi occupancy',taxiRank:'Asema-aukio, west entrance between Sokos and Central Station'};
 return {group,obstacles:plan.obstacles,people:crowd.people,reset:crowd.reset,plan,enterableCars,update(player,dt=0){group.visible=!!player&&Math.hypot(player.x+660,player.z+60)<440;if(group.visible)crowd.update(dt,player);}};
}
