import * as THREE from 'three';
import {Kit} from './place-landmarks.js';
import {groundAt} from './terrain.js';

// OSM fixes the stair access points. Cross-section and 14 m deck width are photo estimates,
// not a surveyed replacement coastline. Kept level rather than terrain-draped into the tiers.
export function createTorinranta(spec){
 const a=spec.steps[0].points[0],b=spec.steps.at(-1).points[0],dx=b[0]-a[0],dz=b[1]-a[1],run=Math.hypot(dx,dz),axis=[-dx/run,-dz/run],normal=[-axis[1],axis[0]],L=run+16;
 const origin=[(a[0]+b[0])/2,(a[1]+b[1])/2],matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(...[axis[0],0,axis[1]]),new THREE.Vector3(0,1,0),new THREE.Vector3(normal[0],0,normal[1])).setPosition(origin[0],0,origin[1]);
 const k=new Kit(),wood='#a5987e',edge='#c2b59b',metal='#c7ccc4';
 // Lower promenade and timber-clad waterside retaining edge.
 k.box(L,.22,10,0,-1.42,9,wood);k.box(L,1.2,.18,0,-2.4,14,'#858277');
 for(let x=-L/2;x<L/2;x+=.2)k.box(.012,1.2,.025,x,-2.4,14.1,'#686d65');
 for(let z=4.1;z<14;z+=.18)k.box(L,.014,.012,0,-1.19,z,'#817963');
 const stairUs=spec.steps.map(s=>{const p=s.points[0];return (p[0]-origin[0])*axis[0]+(p[1]-origin[1])*axis[1];});
 // Three broad timber seating tiers interrupted by the four mapped stair passages.
 const cuts=[-L/2,...stairUs.flatMap(u=>[u-1.4,u+1.4]),L/2].sort((a,b)=>a-b);
 for(let j=0;j<cuts.length-1;j++){
  const x=(cuts[j]+cuts[j+1])/2;if(stairUs.some(u=>Math.abs(x-u)<1.4))continue;
  const w=cuts[j+1]-cuts[j];for(let tier=0;tier<3;tier++){
   const z=.65+tier*1.3,y=-tier*.4;k.box(w,.4,1.28,x,y-.4,z,wood);k.box(w,.055,1.3,x,y,z,edge);
   for(let v=z-.5;v<z+.6;v+=.18)k.box(w,.012,.012,x,y+.06,v,'#8e816a');
  }
 }
 for(const u of stairUs){for(let i=0;i<8;i++)k.box(2.7,.15,.5,u,-(i+1)*.15,i*.5+.25,'#c2c3b8');
  for(const x of [u-1.38,u+1.38]){for(let i=0;i<3;i++)k.cyl(.035,.035,.95,x,-i*.6,i*2,metal);const g=new THREE.BoxGeometry(.065,.065,4.3);g.rotateX(.29);g.translate(x,.35,2);k.put(k.solid,g,metal);}
 }
 for(let x=-L/2+3;x<L/2;x+=9){if(stairUs.some(u=>Math.abs(x-u)<2))continue;k.cyl(.07,.07,.65,x,-1.2,12.7,metal);k.cyl(.09,.09,.035,x,-.55,12.7,'#e2dfcf');}
 const group=k.build(matrix,'Torinranta stepped timber promenade');group.userData.fixedElevation=true;group.position.y=groundAt(origin[0]-normal[0],origin[1]-normal[1]);group.userData.source=spec.source;
 const point=(u,v)=>[origin[0]+axis[0]*u+normal[0]*v,origin[1]+axis[1]*u+normal[1]*v];
 // Non-drivable stepped pedestrian terrace; collision covers the visible deck and seating.
 const ring=[point(-L/2,0),point(L/2,0),point(L/2,14.2),point(-L/2,14.2),point(-L/2,0)];
 return {group,obstacles:[{id:'oulu-torinranta-terrace',name:'Stepped waterfront terrace',rings:[ring],height:1.2}]};
}
