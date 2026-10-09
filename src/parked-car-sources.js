import {Matrix4} from 'three';

// Keep fixed scene props and their collision polygons in sync when a player
// takes one over. The driven car is rendered by PlayerTravel afterwards.
export function createParkedCarSource({id,label='Parked car',actor,obstacle,visual,setHidden=()=>{}}){
 const home={x:actor.x,z:actor.z,heading:actor.heading,edge:actor.edge||{}};
 let claimed=false;
 return {id,label,actor,obstacle,visual,
  claim(){
   if(claimed||actor.playerTaken||obstacle?.disabled)return false;
   claimed=true;actor.playerTaken=true;actor.edge=null;actor.speed=0;
   if(obstacle)obstacle.disabled=true;
   setHidden(true);
   return true;
  },
  release(){
   if(!claimed)return false;
   claimed=false;Object.assign(actor,home,{playerTaken:false,speed:0});
   if(obstacle)obstacle.disabled=false;
   setHidden(false);
   return true;
  },
 };
}

// A static instanced car may span a body, windows, wheels and a taxi sign.
// Capture just those matrices once; changing one car never hides its neighbours.
export function instancedCarVisibility(parts){
 const saved=parts.map(({mesh,index})=>{const matrix=new Matrix4();mesh.getMatrixAt(index,matrix);return {mesh,index,matrix};});
 const hiddenMatrix=new Matrix4().makeScale(0,0,0),meshes=new Set(saved.map(p=>p.mesh));
 return hidden=>{
  for(const p of saved)p.mesh.setMatrixAt(p.index,hidden?hiddenMatrix:p.matrix);
  for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;
 };
}
