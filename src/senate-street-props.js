import * as THREE from 'three';
import {SpatialIndex} from './geo.js';
import {architectureBuilder} from './cathedral.js';
import {createParkedBicycles,createParkedScooters} from './market-life.js';
import {combineKnockables} from './street-furniture.js';

// August 2024 reference: temporary sage-green kiosk row behind Aleksanterinkatu.
// Not a claim that a particular commercial event is permanently installed here.
export function senatePropPlacements(city){
 const square=new SpatialIndex(city.pavement.filter(p=>p.name==='Senaatintori'&&p.kind==='Aukiot'));
 const forbidden=new SpatialIndex([...city.roads,...city.buildings,...city.water,...city.pavement.filter(p=>/pyör|Portaat/i.test(p.kind))]);
 const safe=(x,z,w,d)=>{
  for(let a=-w/2;a<=w/2+.01;a+=Math.min(.3,w))for(let b=-d/2;b<=d/2+.01;b+=Math.min(.3,d))if(!square.at(x+a,z+b)||forbidden.at(x+a,z+b))return false;
  return true;
 };
 const kiosks=[],bicycles=[],scooters=[],cabinets=[];
 for(let i=0;i<12;i++){const x=-22+i*4.3,z=85.4-x*.044;if(safe(x,z,2.7,2.8))kiosks.push({x,z,w:2.7,d:2.8,heading:0});}
 for(let i=0;i<18;i++){const x=-44+i*.78,z=90-x*.044;if(safe(x,z,.6,1.9))bicycles.push({id:`senate-bike-${i}`,x,z,heading:0,color:'#e6c432'});}
 for(let i=0;i<14;i++){const x=-20+i*1.1,z=91.3-x*.044;if(safe(x,z,.9,1.5))scooters.push({id:`senate-scooter-${i}`,x,z,heading:(i%3-1)*.08,color:i%4===0?'#bd554c':'#57a774'});}
 for(let i=0;i<3;i++){const x=28+i*1.4,z=90-x*.044;if(safe(x,z,.85,.65))cabinets.push({x,z,w:.85,d:.65});}
 return {kiosks,bicycles,scooters,cabinets,safe};
}
export function createSenateStreetProps(city){
 const placements=senatePropPlacements(city),{kiosks,bicycles,scooters,cabinets}=placements,group=new THREE.Group(),b=architectureBuilder();
 group.name='Senate Square photo-era kiosks and shared bikes';
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.85});
 const sage=mat('#bac6b7'),roof=mat('#a4b4a4'),trim=mat('#dedfcf'),dark=mat('#33443e'),metal=mat('#666e67'),brown=mat('#71604a');
 for(const k of kiosks){
  b.box(k.w,2.05,k.d,sage,k.x,1.155,k.z);
  b.box(k.w-.35,1.1,.035,dark,k.x,1.42,k.z+k.d/2+.021);
  b.box(k.w+.18,.12,.45,trim,k.x,.87,k.z+k.d/2+.16);
  for(const dx of [-k.w/2+.10,k.w/2-.10])b.box(.12,2.10,.12,trim,k.x+dx,1.18,k.z+k.d/2+.04);
  // Explicit ridge roof avoids cylinder orientation ambiguities.
  const v=new Float32Array([
   -k.w/2,0,-k.d/2,k.w/2,0,-k.d/2,0,.62,-k.d/2,
   -k.w/2,0,k.d/2,0,.62,k.d/2,k.w/2,0,k.d/2,
   -k.w/2,0,-k.d/2,0,.62,-k.d/2,0,.62,k.d/2,-k.w/2,0,-k.d/2,0,.62,k.d/2,-k.w/2,0,k.d/2,
   0,.62,-k.d/2,k.w/2,0,-k.d/2,k.w/2,0,k.d/2,0,.62,-k.d/2,k.w/2,0,k.d/2,0,.62,k.d/2]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();roof.side=THREE.DoubleSide;b.add(g,roof,k.x,2.18,k.z);
  for(let j=0;j<6;j++)b.box(.025,1.95,.02,trim,k.x-k.w/2+(j+.5)*k.w/6,1.15,k.z-k.d/2-.013);
 }
 for(const c of cabinets){b.box(c.w,1.6,c.d,brown,c.x,.93,c.z);b.box(c.w+.06,.06,c.d+.05,metal,c.x,1.76,c.z);b.box(c.w-.16,.8,.018,trim,c.x,1.10,c.z+c.d/2+.012);b.box(.08,.025,.025,dark,c.x+.29,.65,c.z+c.d/2+.026);}
 // Low fixed docks at the front wheels of the yellow bicycle row (solid, one small post each; not a barrier across the walkway).
 for(const p of bicycles){b.box(.15,.60,.2,metal,p.x,.43,p.z-.68);b.box(.26,.14,.26,dark,p.x,.78,p.z-.68);}
 // Alepa citybike identifiers, original text rather than copied logos: a frame plate that flies with each bike.
 const plate=[];
 if(typeof document!=='undefined'&&bicycles.length){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');
  if(ctx){ctx.fillStyle='#e6c432';ctx.fillRect(0,0,256,96);ctx.fillStyle='#d32229';ctx.font='bold 65px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('alepa',128,47);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   plate.push({geometry:new THREE.PlaneGeometry(.38,.18).rotateY(Math.PI/2).translate(.06,.58,.30),material:new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,roughness:.8})});
  }
 }
 // Bikes and scooters are knockables (the car sends them flying); the dock posts are fixed and solid, like the HSL stations.
 const bikeSet=createParkedBicycles(bicycles,'Senate Square shared bikes',plate),scooterSet=createParkedScooters(scooters,'Senate Square e-scooters');
 group.add(b.finish(),bikeSet.group,scooterSet.group);
 const rectRing=(x,z,w,d)=>({name:'Senate Square street prop',rings:[[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]]});
 const obstacles=[...[...kiosks,...cabinets].map(p=>rectRing(p.x,p.z,p.w,p.d)),...bicycles.map(p=>({...rectRing(p.x,p.z-.68,.26,.26),name:'Senate Square bike dock'}))];
 group.userData={kiosks:kiosks.length,bicycles:bicycles.length,scooters:scooters.length,cabinets:cabinets.length,reference:'August 2024 reference photography, 20 Aleksanterinkatu; photo-guided seasonal props, approximate measured placement, not permanent infrastructure'};
 return {group,obstacles,knockables:combineKnockables([bikeSet,scooterSet]),...placements};
}
