import * as THREE from 'three';
import {panelOutline} from './photo-panels-data.js';
import {footprintFrame} from './place-landmarks.js';

// Rectified photo textures (scripts/place-textures.mjs) on the walls they show: each panel is a flat
// polygon in a building's footprint frame (src/place-landmarks.js footprintFrame: X along the front,
// Z out of it), `inset` metres behind the footprint front (negative = in front), just proud of the
// modelled wall so it covers it. One draw call per panel; textures load lazily.
export function createPhotoPanels(panels,{ringOf,urlOf,loader=null}={}){
 const group=new THREE.Group();group.name='Photo façades';const info=[];
 for(const p of panels){
  const ring=ringOf(p);if(!ring)continue;
  const F=footprintFrame(ring,p.facing||null),z=F.depth/2-(p.inset||0)+.05,out=panelOutline(p);
  const shape=new THREE.Shape(out.map(([u,y])=>new THREE.Vector2(u,y))),g=new THREE.ShapeGeometry(shape);
  const pos=g.attributes.position,uv=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){const u=pos.getX(i),y=pos.getY(i);uv[i*2]=(u-p.u[0])/(p.u[1]-p.u[0]);uv[i*2+1]=(y-p.y[0])/(p.y[1]-p.y[0]);pos.setZ(i,z);}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.computeVertexNormals();g.applyMatrix4(F.matrix);g.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color:'#c8c8c8',emissive:'#ffffff',emissiveIntensity:.42,roughness:.92,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  // The photo already carries its daylight: part of it is emitted so a wall in the game's shadow still reads like the photo.
  if(loader){loader.load(urlOf(p),t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;material.map=t;material.emissiveMap=t;material.needsUpdate=true;});}
  const m=new THREE.Mesh(g,material);m.name=`Photo façade ${p.name}`;m.receiveShadow=true;group.add(m);info.push(p.name);
 }
 group.userData={panels:info};return group;
}
