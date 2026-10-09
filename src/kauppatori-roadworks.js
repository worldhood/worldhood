import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json' with {type:'json'};
import {SpatialIndex,segmentDistance,bounds} from './geo.js';
import {createKnockables} from './knockables.js';
import {createBreakableSigns} from './breakable-signs.js';
import {createSofiankatuSigns,sofiankatuSignSafe,SOFIANKATU_SIGN_POSTS} from './sofiankatu-signs.js';

// This is the photographed AUGUST 2024 vignette, not today's traffic scheme.
export const KAUPPATORI_ROADWORKS_REFERENCE={capture:'2024-08',currentLayoutClaim:false,exceptionText:null,
 accuracy:'Reference-guided styles; anchors moved to safe mapped surfaces. Not surveyed roadworks positions.'};
export const KAUPPATORI_ROADWORKS_SIGNS=[
 {id:'2024-no-left-turn',x:90.5,z:245.15,type:'no-left',y:.18},
 {id:'2024-temporary-40',x:148,z:254.5,type:'40',y:.07},
];
export const KAUPPATORI_REFUGE_POST={id:'helenankatu-refuge-crossing',x:153.95,z:238.95,y:.18,crossing:true,keepRight:true,normal:[-.99875,.04998]};
const facing=Math.atan2(-.99875,.04998),ROW_OFFSET=2.4,FOOT_WIDTH=.38,FOOT_DEPTH=.62;
function foot(x,z,yaw=facing){return [[-FOOT_WIDTH/2,-FOOT_DEPTH/2],[FOOT_WIDTH/2,-FOOT_DEPTH/2],[FOOT_WIDTH/2,FOOT_DEPTH/2],[-FOOT_WIDTH/2,FOOT_DEPTH/2]].map(([a,b])=>[x+a*Math.cos(yaw)+b*Math.sin(yaw),z-a*Math.sin(yaw)+b*Math.cos(yaw)]);}
function trafficSegments(data){
 const segments=[];
 for(const e of data?.roads?.edges||[])for(let i=1;i<e.points.length;i++){
  const a=e.points[i-1],b=e.points[i];if(Math.max(a[0],b[0])<105||Math.min(a[0],b[0])>207||Math.max(a[1],b[1])<225||Math.min(a[1],b[1])>262)continue;
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!length)continue;const dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length,lane=e.lane||0;
  segments.push({a:[a[0]-dz*lane,a[1]+dx*lane],b:[b[0]-dz*lane,b[1]+dx*lane],dx,dz});
 }
 return segments;
}
export function planKauppatoriRoadworks(city,data,{existingCrossingPosts=[]}={}){
 const road=new SpatialIndex(city.roads.filter(p=>p.kind!=='Koroke')),safe=new SpatialIndex([...city.pavement,...city.roads.filter(p=>p.kind==='Koroke')]),buildings=new SpatialIndex(city.buildings||[]),indices={road,safe,buildings};
 const lanes=trafficSegments(data),pairs=[],omitted=[],signs=[];
 const walkingCrossings=(data?.walks?.edges||[]).filter(e=>e.crossing);
 const noCrossing=(x,z)=>!walkingCrossings.some(e=>e.points.some((b,i)=>i&&segmentDistance(x,z,e.points[i-1],b)<2.3));
 const fits=p=>foot(p.x,p.z,p.yaw).every(([x,z])=>road.at(x,z)&&!buildings.at(x,z))&&lanes.every(s=>segmentDistance(p.x,p.z,s.a,s.b)>1.85)&&noCrossing(p.x,p.z);
 for(let x=115;x<=199;x+=6){
  const lane=lanes.find(s=>s.dx>.95&&s.a[0]<=x&&s.b[0]>=x&&s.a[1]>240);
  if(!lane){omitted.push({x,reason:'no verified eastbound lane'});continue;}
  const z=lane.a[1]+(x-lane.a[0])*(lane.b[1]-lane.a[1])/(lane.b[0]-lane.a[0]);
  const pair=[-1,1].map(side=>({x:x-lane.dz*ROW_OFFSET*side,z:z+lane.dx*ROW_OFFSET*side,yaw:Math.atan2(-lane.dx,-lane.dz),side,center:[x,z]}));
  if(pair.every(fits))pairs.push(pair);else omitted.push({x,reason:'road, crossing or joining NPC path clearance'});
 }
 for(const p of KAUPPATORI_ROADWORKS_SIGNS)if(sofiankatuSignSafe(p,city,indices))signs.push({...p,yaw:facing});else omitted.push({id:p.id,reason:'sign anchor unsafe'});
 const crossing=KAUPPATORI_REFUGE_POST;
 const duplicate=[...existingCrossingPosts,...SOFIANKATU_SIGN_POSTS].some(p=>Math.hypot(p.x-crossing.x,p.z-crossing.z)<4.5);
 const crossingPosts=!duplicate&&sofiankatuSignSafe(crossing,city,indices)?[{...crossing}]:[];
 return {pairs,signs,crossingPosts,omitted,clearLaneWidth:ROW_OFFSET*2-FOOT_WIDTH,existingCrossingReused:duplicate,reference:KAUPPATORI_ROADWORKS_REFERENCE};
}

export function createKauppatoriRoadworks(city,data,options={}){
 const plan=planKauppatoriRoadworks(city,data,options),group=new THREE.Group(),batches=new Map(),obstacles=[];
 group.name='Kauppatori August 2024 roadworks vignette';
 const m={red:new THREE.MeshStandardMaterial({color:'#df4732',roughness:.65}),yellow:new THREE.MeshStandardMaterial({color:'#f3d43e',roughness:.6}),orange:new THREE.MeshStandardMaterial({color:'#efa438',roughness:.68}),
 black:new THREE.MeshStandardMaterial({color:'#15201e',roughness:.8}),metal:new THREE.MeshStandardMaterial({color:'#929b9d',metalness:.65,roughness:.48})};
 // Sign posts bend or snap when hit (breakable-signs.js); every batched geometry here belongs to a post.
 const signs=createBreakableSigns('Kauppatori roadworks sign posts');let postIndex=null;
 function add(g,material,matrix){if(matrix)g.applyMatrix4(matrix);if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}g.deleteAttribute('uv');if(postIndex!==null)signs.tag(g,postIndex);const key=[material.color.getHex(),material.roughness,material.metalness].join(':');if(!batches.has(key))batches.set(key,{material,gs:[]});batches.get(key).gs.push(g);}
 function box(w,h,d,x,y,z,material,matrix){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,material,matrix);}
 function disk(r,x,y,z,material,matrix){const g=new THREE.CircleGeometry(r,40);g.translate(x,y,z);add(g,material,matrix);}
 function shape(points,z,material,matrix){const s=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));const g=new THREE.ShapeGeometry(s);g.translate(0,0,z);add(g,material,matrix);}
 function matrix(p){const q=new THREE.Matrix4().makeRotationY(p.yaw);q.setPosition(p.x,p.y||0,p.z);return q;}
 function pole(p,top){const g=new THREE.CylinderGeometry(.027,.03,top,8);g.translate(0,top/2,0);add(g,m.metal,matrix(p));}
 // Bollards are light, free-standing roadworks furniture: the car knocks them over (see knockables.js)
 // rather than stopping against them. They are built once in local space and instanced.
 const template=new Map(),part=(g,material)=>{if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}g.deleteAttribute('uv');if(!template.has(material))template.set(material,[]);template.get(material).push(g);};
 const lbox=(w,h,d,y,material)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(0,y,0);part(g,material);};
 lbox(FOOT_WIDTH,.09,FOOT_DEPTH,.09,m.black);lbox(.22,1.01,.045,.64,m.red);
 // Narrow red/yellow diagonal barrier boards, not orange traffic cones. Side -1 is the same board turned 180°.
 for(const face of [-1,1])for(const low of [.27,.66]){
  const points=face>0?[[-.108,low],[-.108,low+.19],[.108,low+.37],[.108,low+.18]]:[[-.108,low+.18],[-.108,low+.37],[.108,low+.19],[.108,low]];
  const g=new THREE.ShapeGeometry(new THREE.Shape(points.map(v=>new THREE.Vector2(...v))));if(face<0)g.rotateY(Math.PI);g.translate(0,0,face*.024);part(g,m.yellow);
 }
 lbox(.047,.018,.052,1.09,m.black);
 const bollardItems=plan.pairs.flatMap((pair,i)=>pair.map(p=>({id:`kauppatori-roadwork-${i}-${p.side}`,x:p.x,z:p.z,yaw:p.yaw+(p.side<0?Math.PI:0),footprint:foot(p.x,p.z,p.yaw)})));
 const knockables=createKnockables(bollardItems,[...template].map(([material,gs])=>{const geometry=mergeGeometries(gs);gs.forEach(g=>g.dispose());return {geometry,material};}),{radius:.32});
 group.add(knockables.group);
 const bollardFootprints=bollardItems.map(b=>({id:b.id,rings:[b.footprint],bbox:bounds([b.footprint])}));
 // Sign footprints stay in `obstacles` for placement but are `breakable`: main.js keeps them out of car collision.
 const addObstacle=(id,{x,z})=>{const ring=[[x-.08,z-.08],[x+.08,z-.08],[x+.08,z+.08],[x-.08,z+.08]];obstacles.push({id,rings:[ring],bbox:bounds([ring]),breakable:true});};
 const font=new FontLoader().parse(fontData);
 for(const p of plan.signs){
  postIndex=signs.post({id:p.id,x:p.x,z:p.z,y:p.y||0,yaw:p.yaw,height:3.75,radius:.04});const t=matrix(p);pole(p,3.75);
  if(p.type==='no-left'){
   disk(.42,0,3.24,.035,m.metal,t);disk(.407,0,3.24,.039,m.red,t);disk(.332,0,3.24,.043,m.yellow,t);
   shape([[.07,2.95],[.18,2.95],[.18,3.29],[-.04,3.29],[-.04,3.40],[-.24,3.235],[-.04,3.07],[-.04,3.19],[.07,3.19]],.047,m.black,t);
   const slash=new THREE.BoxGeometry(.078,.79,.009);slash.rotateZ(-Math.PI/4);slash.translate(0,3.24,.055);add(slash,m.red,t);
   box(.64,.92,.045,0,2.23,.035,m.red,t);box(.594,.873,.008,0,2.23,.062,m.yellow,t);
   // Exception wording is unreadable in the supplied photo. Deliberately no
   // guessed times, permissions, names, or fake pseudo-lettering on this plate.
  }else{
   box(.94,.94,.045,0,2.96,.025,m.red,t);box(.886,.886,.006,0,2.96,.052,m.orange,t);
   disk(.341,0,2.96,.059,m.red,t);disk(.275,0,2.96,.064,m.yellow,t);
   const text=new TextGeometry('40',{font,size:.31,depth:.002,curveSegments:5,bevelEnabled:false});text.computeBoundingBox();text.translate(-(text.boundingBox.max.x+text.boundingBox.min.x)/2,2.96-(text.boundingBox.max.y+text.boundingBox.min.y)/2,.069);add(text,m.black,t);
  }
  addObstacle(p.id,p);postIndex=null;
 }
 // Existing manual / route-generated crossing signs are supplied for de-dupe.
 // The third reference's island is otherwise absent from automatic endpoint posts.
 // Its post joins this set, so its plates merge into the same few batches (already tagged).
 const crossing=createSofiankatuSigns(city,{island:false,posts:plan.crossingPosts,signs});
 for(const mesh of crossing.children)add(mesh.geometry.clone(),mesh.material);
 for(const p of plan.crossingPosts)addObstacle(p.id,p);
 for(const {material,gs}of batches.values())group.add(signs.mesh(mergeGeometries(gs),material));
 for(const {gs}of batches.values())gs.forEach(g=>g.dispose());
 group.add(signs.finish());group.breakable=signs;
 group.userData={...plan,bollards:plan.pairs.flat(),exceptionText:null,speedSignIsVisualOnly:true};
 // `obstacles` are breakable sign posts (placement only); bollards are knockable. Placement of crowds/stalls must still avoid the bollards' starting spots.
 return {group,obstacles,placementObstacles:[...obstacles,...bollardFootprints],bollardFootprints,knockables,plan};
}
