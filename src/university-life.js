import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SpatialIndex} from './geo.js';
import {createParkedScooters,createParkedBicycles,createInstancedPeople} from './market-life.js';
import {combineKnockables} from './street-furniture.js';

export const UNIVERSITY_LIFE_REFERENCE=Object.freeze({ capture:'2024-08',
  location:'Yliopistonkatu looking west from Fabianinkatu, north edge by university trees/fence',
  cameraCoordinates:null,heading:null,
  accuracy:'Observed mixed scooters, parked bicycles, dark railing and pedestrians; counts, individual poses and exact transforms illustrative, constrained to mapped pavement, not surveyed',
});
export function universityPlacementValidator(city){
  const walk=new SpatialIndex(city.pavement.filter(p=>p.name==='Yliopistonkatu'&&p.kind==='Jalankulkualue'));
  const blocked=new SpatialIndex([...city.roads,...city.buildings,...city.water,...city.pavement.filter(p=>/pyör|cycle|Portaat/i.test(p.kind))]);
  return (x,z,r=.36)=>{
    if(x< -248||x> -175||z<16||z>38)return false;
    for(const [dx,dz]of [[0,0],[-r,-r],[r,-r],[r,r],[-r,r],[0,r],[0,-r],[-r,0],[r,0]])if(!walk.at(x+dx,z+dz)||blocked.at(x+dx,z+dz))return false;
    return true;
  };
}
export function universityLifePlacements(city){
  const safe=universityPlacementValidator(city),bicycles=[],scooters=[],people=[],rails=[];
  const northEdge=x=>{for(let z=16;z<27;z+=.025)if(safe(x,z,.08))return z;return null;};
  const southEdge=x=>{for(let z=28;z<38;z+=.025)if(safe(x,z,.38))return z;return null;};
  // Bicycles sit beside the northern railing. Full .98m envelope includes
  // wheel ends, bars and slight yaw, not only a centre-point pavement test.
  for(let i=0;i<25;i++){
    const x=-180-i*2.15,edge=northEdge(x);if(edge===null)continue;
    for(let z=edge+1.10;z<edge+1.7;z+=.05)if(safe(x,z,.98)){
      bicycles.push({id:`university-bike-${i}`,x,z,heading:(i%5-2)*.055,color:['#303c3b','#778782','#535f69','#9d4c38','#394f66'][i%5]});break;
    }
  }
  // Shared scooter builder gives teal, coral and green original unbranded
  // frames, as observed; no copied rental-company artwork.
  for(let i=0;i<20;i++){
    const x=-182-i*2.3,edge=northEdge(x);if(edge===null)continue;
    for(let z=edge+4;z>edge+1.8;z-=.05)if(safe(x,z,.65)&&bicycles.every(b=>Math.hypot(b.x-x,b.z-z)>1.45)){
      scooters.push({id:`university-scooter-${i}`,x,z,heading:(i%3-1)*.09,color:['#d76568','#55b6af','#74aa4b','#323d3e'][i%4]});break;
    }
  }
  // Keep the central pedestrian/service corridor and all mapped carriageway
  // completely free. Crowd occupies the two pavements, never the street.
  const crowdSafe=(x,z)=>safe(x,z,.38)&&bicycles.every(b=>Math.hypot(b.x-x,b.z-z)>1.28)&&scooters.every(s=>Math.hypot(s.x-x,s.z-z)>1.0);
  function person(x,z,i){if(!crowdSafe(x,z)||people.some(p=>Math.hypot(p.x-x,p.z-z)<1.04))return false;
    people.push({id:`university-person-${people.length}`,x,z,heading:i%2?Math.PI/2:-Math.PI/2,pose:i%4===0?'phone':i%3===0?'chat':'walk'});return true;}
  for(let i=0;i<34;i++){const x=-177-i*1.94,edge=southEdge(x);if(edge!==null)person(x,edge+.46+(i%3)*.58,i);}
  for(let x=-246;people.length<40&&x<-175;x+=1.15)for(let z=17;z<37&&people.length<40;z+=.6)person(x,z,people.length);
  // Fence follows the mapped north edge; omit short gaps for access rather
  // than drawing a barrier across either pavement or street.
  for(let i=0;i<13;i++){
    if(i===5||i===10)continue;const x=-179-i*4.2,x2=x-3.8,za=northEdge(x),zb=northEdge(x2);if(za===null||zb===null)continue;
    const a={x,z:za+.12},b={x:x2,z:zb+.12};let clear=true;
    for(let t=0;t<=1;t+=.1)if(!safe(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.06))clear=false;
    if(clear)rails.push({a,b,height:1.12});
  }
  return {bicycles,scooters,people,rails,safe,crowdSafe};
}
function createUniversityRailings(rails){
  const pieces=[];
  function beam(a,b,r){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());const flat=g.toNonIndexed();g.dispose();pieces.push(flat);}
  for(const {a,b,height}of rails){
    for(const y of [.30,height])beam([a.x,y,a.z],[b.x,y,b.z],.025);
    const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.21);
    for(let j=0;j<=n;j++){const t=j/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;beam([x,.14,z],[x,height+.03,z],j===0||j===n?.035:.012);}
  }
  const group=new THREE.Group();group.name='University north-edge dark railings';
  if(pieces.length){const mesh=new THREE.Mesh(mergeGeometries(pieces),new THREE.MeshStandardMaterial({color:'#4c5149',metalness:.35,roughness:.8}));mesh.castShadow=true;group.add(mesh);pieces.forEach(g=>g.dispose());}return group;
}
export function createUniversityLife(city){
  const layout=universityLifePlacements(city);
  const crowd=createInstancedPeople(layout.people,{safe:layout.crowdSafe,center:{x:-211,z:26},name:'Yliopistonkatu university street life'});
  // Parked bikes and scooters are knockables (the car sends them flying); the railing stays decorative.
  const bikes=createParkedBicycles(layout.bicycles,'Yliopistonkatu parked bicycles'),scooters=createParkedScooters(layout.scooters,'Yliopistonkatu parked e-scooters');
  crowd.group.add(bikes.group,scooters.group,createUniversityRailings(layout.rails));
  crowd.group.userData={...UNIVERSITY_LIFE_REFERENCE,bicycles:layout.bicycles.length,scooters:layout.scooters.length,people:layout.people.length,drawCalls:crowd.batch.drawCalls+3,collision:'Knockable parked bikes and scooters; decorative railing, no whole-group collider'};
  return {...crowd,bicycles:layout.bicycles,scooters:layout.scooters,rails:layout.rails,knockables:combineKnockables([bikes,scooters])};
}
