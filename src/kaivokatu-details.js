import * as THREE from 'three';
import earcut from 'earcut';
import polygonClipping from 'polygon-clipping';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json' with {type:'json'};
import {sofiankatuSignSafe} from './sofiankatu-signs.js';
import {bounds} from './geo.js';
import {createBreakableSigns} from './breakable-signs.js';

// September 2025 reference photography + municipal 2025 orthophoto. Positions are
// aerial-traced / safe-map-fitted estimates, not a current traffic regulation.
export const KAIVOKATU_DETAIL_REFERENCE={photography:'2025-09',aerial:'2025',currentLayoutClaim:false};
export const KAIVOKATU_HATCH=[[-481.7,-54.5],[-466.7,-54.8],[-457.7,-45.5],[-473.7,-44.2],[-481.7,-54.5]];
export const KAIVOKATU_ROUNDELS=[{x:-487,z:-46,arrow:'left'},{x:-487,z:-48.7,arrow:'straight'},{x:-487,z:-51.5,arrow:'straight'}];
export const KAIVOKATU_ROAD_FRAME={right:[-.05,-.998749],forward:[-.998749,.05]};
export const KAIVOKATU_DETAIL_POSTS=[
 {id:'kaivokatu-no-u-turn',type:'no-u-turn',x:-667,z:-36,y:.18},
 {id:'sokos-pass-either-side',type:'pass-either-side',x:-690,z:-38.7,y:.18},
 {id:'station-parking-guidance',type:'parking',x:-504,z:-57,y:.07},
];

export function createKaivokatuDetails(city){
 const group=new THREE.Group();group.name='Kaivokatu reference-guided 2025 markings and signs';
 const batches=new Map(),obstacles=[],placed=[],omitted=[];
 const materials={white:new THREE.MeshStandardMaterial({color:'#ebece4',roughness:.85}),yellow:new THREE.MeshStandardMaterial({color:'#eac936',roughness:.8}),
 blue:new THREE.MeshStandardMaterial({color:'#1254a3',roughness:.65}),red:new THREE.MeshStandardMaterial({color:'#d83a29',roughness:.65}),
 black:new THREE.MeshStandardMaterial({color:'#14201e',roughness:.85}),metal:new THREE.MeshStandardMaterial({color:'#939b9a',roughness:.5,metalness:.55}),
 paintWhite:new THREE.MeshStandardMaterial({color:'#e9e8dc',roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),
 paintYellow:new THREE.MeshStandardMaterial({color:'#dfba32',roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2})};
 // Sign posts are light single poles: they bend or snap when hit (breakable-signs.js) instead of acting as walls.
 const signs=createBreakableSigns('Kaivokatu sign posts');let postIndex=null;
 function add(g,key,matrix){if(matrix)g.applyMatrix4(matrix);if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}g.deleteAttribute('uv');if(postIndex!==null){signs.tag(g,postIndex);key='sign:'+key;}if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);}
 const font=new FontLoader().parse(fontData);
 const roads=city.roads.filter(p=>p.kind!=='Koroke'&&p.bbox[2]>-510&&p.bbox[0]<-455&&p.bbox[3]>-60&&p.bbox[1]<-40);
 const roadUnion=roads.length?polygonClipping.union(...roads.map(p=>p.rings)):[];
 const exclusions=[...city.pavement,...city.roads.filter(p=>p.kind==='Koroke')].filter(p=>p.bbox[2]>-510&&p.bbox[0]<-455&&p.bbox[3]>-60&&p.bbox[1]<-40);
 const mask=exclusions.length&&roadUnion.length?polygonClipping.difference(roadUnion,...exclusions.map(p=>p.rings)):roadUnion;
 function paint(rings,key,extraMask){
  if(!mask.length)return;
  let polygons=polygonClipping.intersection([rings],mask);if(extraMask)polygons=polygonClipping.intersection(polygons,[extraMask]);
  for(const rings of polygons){const flat=rings.flat().flat(),holes=[];let n=rings[0].length;for(const r of rings.slice(1)){holes.push(n);n+=r.length;}const indices=earcut(flat,holes),v=[];
   for(let i=0;i<indices.length;i+=3)for(const j of [indices[i],indices[i+2],indices[i+1]])v.push(flat[j*2],.146,flat[j*2+1]);
   if(v.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,key);}
  }
 }
 function strip(a,b,width,key,clip){const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz),nx=-dz/d*width/2,nz=dx/d*width/2;
  paint([[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz],[a[0]+nx,a[1]+nz]]],key,clip);}
 for(let i=1;i<KAIVOKATU_HATCH.length;i++)strip(KAIVOKATU_HATCH[i-1],KAIVOKATU_HATCH[i],.15,'paintYellow');
 for(let x=-501;x<-430;x+=1.55)for(const sign of [-1,1])strip([x,-62],[x+sign*27,-35],.11,'paintYellow',KAIVOKATU_HATCH);
 const {right,forward}=KAIVOKATU_ROAD_FRAME;
 function roadPoints(points,c){return points.map(([x,y])=>[c.x+right[0]*x+forward[0]*y,c.z+right[1]*x+forward[1]*y]);}
 for(const c of KAIVOKATU_ROUNDELS){
  const outer=[],inner=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;outer.push([Math.cos(a)*1.17,Math.sin(a)*1.7]);inner.push([Math.cos(a)*1.04,Math.sin(a)*1.55]);}
  paint([roadPoints(outer,c),roadPoints(inner.reverse(),c)],'paintWhite');
  const shapes=font.generateShapes('30',1.05),g=new THREE.ShapeGeometry(shapes);g.computeBoundingBox();const b=g.boundingBox;g.dispose();
  for(const s of shapes){const shape=s.extractPoints(6),rings=[shape.shape,...shape.holes].map(r=>roadPoints(r.map(p=>[(p.x-(b.min.x+b.max.x)/2)*1.10,(p.y-(b.min.y+b.max.y)/2)*1.85]),c));paint(rings,'paintWhite');}
  const arrow=c.arrow==='left'?[[-.12,-1.3],[.12,-1.3],[.12,.37],[-.75,.37],[-.75,.75],[-1.43,.20],[-.75,-.35],[-.75,.02],[-.12,.02]]:[[-.13,-1.3],[.13,-1.3],[.13,.47],[.5,.47],[0,1.24],[-.5,.47],[-.13,.47]];
  paint([roadPoints(arrow,{x:c.x-10,z:c.z+.5})],'paintWhite');
 }
 function box(w,h,d,x,y,z,key,t){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,key,t);}
 function shape(points,x,y,z,key,t){const g=new THREE.ShapeGeometry(new THREE.Shape(points.map(p=>new THREE.Vector2(...p))));g.translate(x,y,z);add(g,key,t);}
 function disk(r,x,y,z,key,t){const g=new THREE.CircleGeometry(r,40);g.translate(x,y,z);add(g,key,t);}
 function text(label,size,x,y,z,key,t){const g=new THREE.ShapeGeometry(font.generateShapes(label,size));g.translate(x,y,z);add(g,key,t);}
 for(const p of KAIVOKATU_DETAIL_POSTS){
  if(!sofiankatuSignSafe(p,city)){omitted.push(p.id);continue;}
  const t=new THREE.Matrix4().makeRotationY(Math.atan2(.998749,-.05));t.setPosition(p.x,p.y,p.z);
  postIndex=signs.post({id:p.id,x:p.x,z:p.z,y:p.y,yaw:Math.atan2(.998749,-.05),height:p.type==='parking'?5:3.8,radius:.04});
  const pole=new THREE.CylinderGeometry(.032,.035,p.type==='parking'?5:3.8,8);pole.translate(0,p.type==='parking'?2.5:1.9,0);add(pole,'metal',t);
  if(p.type==='no-u-turn'){
   disk(.42,0,2.95,.036,'metal',t);disk(.409,0,2.95,.04,'red',t);disk(.335,0,2.95,.043,'yellow',t);
   // Black inverted-U arrow with downward left leg, then red prohibition slash.
   const pts=[[-.18,-.18]];for(let i=0;i<=20;i++){const a=Math.PI-i*Math.PI/20;pts.push([Math.cos(a)*.18,Math.sin(a)*.18+.10]);}pts.push([.18,-.23],[.10,-.23]);for(let i=0;i<=20;i++){const a=i*Math.PI/20;pts.push([Math.cos(a)*.10,Math.sin(a)*.10+.10]);}pts.push([-.10,-.18]);
   shape(pts,0,2.95,.048,'black',t);
   shape([[-.25,-.13],[-.03,-.13],[-.14,-.3]],0,2.95,.05,'black',t);
   const slash=new THREE.PlaneGeometry(.076,.80);slash.rotateZ(Math.PI/4);slash.translate(0,2.95,.054);add(slash,'red',t);
  }else if(p.type==='pass-either-side'){
   disk(.345,0,2.3,.035,'metal',t);disk(.333,0,2.3,.04,'white',t);disk(.307,0,2.3,.044,'blue',t);
   for(const s of [-1,1])shape([[.033,.16],[.085,.194],[.207,-.055],[.253,-.011],[.253,-.205],[.075,-.17],[.129,-.125]].map(([x,y])=>[s*x*.88,y*.88]),0,2.3,.05,'white',t);
  }else{
   // One shared straight-ahead arrow for all three destinations, as photographed.
   box(1.54,1.02,.045,0,4.47,.035,'metal',t);box(1.50,.98,.005,0,4.47,.062,'white',t);
   shape([[-.62,4.29],[-.57,4.29],[-.57,4.54],[-.49,4.54],[-.595,4.68],[-.70,4.54],[-.62,4.54]],0,0,.07,'black',t);
   for(const [i,label]of ['FORUM','KAMPPI','ELIEL'].entries()){const y=4.8-i*.33;box(.27,.26,.004,-.31,y,.070,'blue',t);text('P',.20,-.375,y-.09,.075,'white',t);text(label,.16,-.10,y-.075,.075,'black',t);if(i<2)box(1.1,.014,.003,.18,y-.164,.075,'metal',t);}
  }
  // Footprint kept for placement of other props only (`breakable`): main.js leaves it out of car collision.
  placed.push({...p});postIndex=null;const ring=[[p.x-.08,p.z-.08],[p.x+.08,p.z-.08],[p.x+.08,p.z+.08],[p.x-.08,p.z+.08]];obstacles.push({id:p.id,rings:[ring],bbox:bounds([ring]),breakable:true});
 }
 for(const [k,gs]of batches){const sign=k.startsWith('sign:'),key=sign?k.slice(5):k,geometry=mergeGeometries(gs),mesh=sign?signs.mesh(geometry,materials[key]):new THREE.Mesh(geometry,materials[key]);mesh.name=`Kaivokatu ${key}`;mesh.castShadow=!key.startsWith('paint');mesh.receiveShadow=true;mesh.renderOrder=key.startsWith('paint')?4:0;group.add(mesh);gs.forEach(g=>g.dispose());}
 group.add(signs.finish());group.breakable=signs;
 group.userData={reference:KAIVOKATU_DETAIL_REFERENCE,placed,omitted,roundels:KAIVOKATU_ROUNDELS,hatch:KAIVOKATU_HATCH,parkingDestinations:['FORUM','KAMPPI','ELIEL'],parkingDirection:'straight',regulatesSimulation:false};
 return {group,obstacles};
}
