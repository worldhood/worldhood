import * as THREE from 'three';
import {WATERFRONT_FRONTAGES} from './kauppatori-buildings.js';
export {THREE};

// National flag proportions: Finnish Ministry of the Interior,
// https://intermin.fi/en/flag-and-arms/about-the-flag (11:18, cross3,
// hoist5/fly10, upper/lower4). Roof placement is photo-guided, not surveyed.
export const CITY_HALL_FLAG={width:3.6,height:2.2,mastBase:18.45,mastTop:31.65,clothTop:31.20};
// August 2024 north/east-looking photography: two flying flags followed by
// three empty masts. Cloth and mast dimensions are photo estimates.
export const CITY_HALL_STREET_FLAGS=['Finland','Ukraine',null,null,null];
export function isFinnishCross(u,v){return (u>=5/18&&u<8/18)||(v>=4/11&&v<7/11);}
export function createCityHallFlag(){
 const group=new THREE.Group();group.name='City Hall Finnish flag';
 const {s,d}=WATERFRONT_FRONTAGES[216],angle=.052;
 group.position.set(Math.cos(angle)*s+Math.sin(angle)*(d-.8),0,-Math.sin(angle)*s+Math.cos(angle)*(d-.8));
 group.rotation.y=angle-.25;
 const c=CITY_HALL_FLAG,metal=new THREE.MeshStandardMaterial({color:'#d7d9d4',roughness:.52,metalness:.3});
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.047,.085,c.mastTop-c.mastBase,10),metal);
 pole.position.y=(c.mastTop+c.mastBase)/2;group.add(pole);
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.085,10,6),metal);cap.position.y=c.mastTop;group.add(cap);
 const positions=[],colours=[],uvs=[],white=new THREE.Color('#f5f5ef'),blue=new THREE.Color('#002f6c');
 const columns=36,rows=22;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const colour=isFinnishCross((col+.5)/columns,(row+.5)/rows)?blue:white;
  for(const [du,dv] of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]){
   const u=(col+du)/columns,v=(row+dv)/rows;
   positions.push(u*c.width,c.clothTop-v*c.height,0);uvs.push(u,v);colours.push(colour.r,colour.g,colour.b);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.computeVertexNormals();
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(c.width/2,c.clothTop-c.height/2,0),3);
 const cloth=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.92,metalness:0}));
 cloth.name='Animated blue-cross cloth';group.add(cloth);
 const street=new THREE.Group();street.name='Five forecourt flagpoles — Finnish and Ukrainian flags';
 // Same façade registration as the previously modelled bare poles, with the
 // roof group's wind rotation undone so the row stays parallel to the façade.
 street.rotation.y=.25;street.position.set(-Math.sin(.25)*7.2,0,Math.cos(.25)*7.2);group.add(street);
 const animated=[{geometry,uvs,width:c.width,height:c.height,top:c.clothTop,phase:0}];
 const streetCloths=[];
 for(let i=0;i<5;i++){
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.045,.085,18.8,10),metal);mast.position.set(-11+i*5.5,9.4,0);street.add(mast);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.085,10,6),metal);finial.position.set(mast.position.x,18.8,0);street.add(finial);
  const country=CITY_HALL_STREET_FLAGS[i];if(!country)continue;
  const g=geometry.clone(),colors=g.attributes.color,uv=uvs.slice();
  const ukBlue=new THREE.Color('#0057b7'),yellow=new THREE.Color('#ffd700');
  if(country==='Ukraine')for(let j=0;j<colors.count;j++){
   // Each six-vertex cell has a uniform colour, keeping the horizontal seam sharp.
   const cell=Math.floor(j/6),row=Math.floor(cell/columns),color=row<rows/2?ukBlue:yellow;
   colors.setXYZ(j,color.r,color.g,color.b);
  }
  const flag=new THREE.Mesh(g,cloth.material);flag.name=country+' forecourt flag';flag.position.x=mast.position.x;
  flag.rotation.y=-.25;street.add(flag);streetCloths.push(flag);
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3(1.65,17.3,0),3);
  animated.push({geometry:g,uvs:uv,width:3.3,height:country==='Finland'?3.3*11/18:2.2,top:18.4,phase:i*.7});
 }
 group.userData={buildingRatu:216,flag:'Finland national flag',streetFlags:[...CITY_HALL_STREET_FLAGS],mastCount:6,animated:true,placement:'Photo-guided rooftop and five forecourt masts; Finnish and Ukrainian display from user Aug 2024 reference, not a live flagging claim'};
 let lastUpdate=-Infinity;
 function update(time,car){
  group.visible=!car||Math.hypot(car.x-group.position.x,car.z-group.position.z)<650;
  if(!group.visible||!Number.isFinite(time)||(time>=lastUpdate&&time-lastUpdate<1/30))return;
  lastUpdate=time;
  for(const a of animated){const p=a.geometry.attributes.position,t=time+a.phase;
  for(let i=0;i<p.count;i++){
   const u=a.uvs[i*2],v=a.uvs[i*2+1],envelope=u*u;
   p.setXYZ(i,u*a.width,a.top-v*a.height-.13*u+.05*envelope*Math.sin(u*8-t*2.5),
    envelope*(.22*Math.sin(u*10-t*3.1+v*.6)+.08*Math.sin(u*19-t*4.2-v)));
  }
  p.needsUpdate=true;a.geometry.computeVertexNormals();}
 }
 update(0);
 return {group,cloth,streetCloths,update};
}
