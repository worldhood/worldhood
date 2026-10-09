import * as THREE from 'three';
import {createLasipalatsiStop} from './lasipalatsi-stop.js';
import {createBreakableSigns} from './breakable-signs.js';

// Stop anchors come from the bundled HSL snapshot. The photo establishes the
// green shelters and railings, not centimetre-accurate furniture coordinates.
export const KAUPPATORI_STOP_REFERENCES=[
 {id:'1030423',x:-29.08,z:297.46,heading:Math.PI/2},
 {id:'1030424',x:-27.42,z:305.26,heading:-Math.PI/2},
 // North–south branch on the right when approaching from Eteläranta.
 {id:'1030425',x:.74,z:277.42,heading:0},
].map(p=>({...p,name:'Kauppatori',swedish:'Salutorget',type:'tram',
 source:'Bundled HSL stops + Eteläranta photography, August 2024',
 accuracy:'Photo-guided furniture fitted to measured pedestrian platforms; restored fountain retained without construction fencing'}));

export function createKauppatoriTramStops(city,existing=[]){
 const group=new THREE.Group();group.name='Havis Amanda / Kauppatori tram stops and eastern branch';
 const obstacles=[],stops=[],signs=createBreakableSigns('Kauppatori stop poles');
 for(const reference of KAUPPATORI_STOP_REFERENCES){
  const stop=createLasipalatsiStop(city,[...existing,...obstacles],reference,{signs});
  group.add(stop.group);obstacles.push(...stop.obstacles);stops.push(stop);
 }
 group.add(signs.finish());group.breakable=signs;
 group.userData={placed:stops.filter(s=>s.shelter).length,stops:stops.map(s=>s.group.userData)};
 return {group,obstacles,stops};
}
