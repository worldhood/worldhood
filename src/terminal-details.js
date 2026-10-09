import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import polygonClipping from 'polygon-clipping';
import {SpatialIndex,pointInPolygon,bounds} from './geo.js';
import {YARD_RING,YARD_DEPTH,yardWest,inLowerYard} from './port-yard.js';
import {createTrafficRenderer} from './traffic-renderer.js';
import {createLooseMicromobility} from './parked-micromobility.js';
import {createBreakableSigns} from './breakable-signs.js';
import {createParkedCarSource} from './parked-car-sources.js';

export const TERMINAL_SIGN_TEXT=['SILJA LINE','OLYMPIATERMINAALI / OLYMPIATERMINALEN','OLYMPIAPARKKI'];
export const TERMINAL_POSTS=[
 {x:216.5,z:1011.9,yaw:-.32,kind:'destination'},
 {x:210.2,z:1026.5,yaw:-.32,kind:'keep-right'},
 {x:234.9,z:1025.1,yaw:-.32,kind:'yield'},
 {x:261,z:998,yaw:.96,kind:'yield'},
 {x:251,z:1004,yaw:.96,kind:'keep-right'},
 {x:269,z:977.5,yaw:-.93,kind:'crossing'},
 {x:259,z:993,yaw:2.21,kind:'crossing'},
];
export function createTerminalDetails(city){
 const group=new THREE.Group();group.name='Photo-guided terminal roundabout and lower freight yard';
 const roads=new SpatialIndex(city.roads.filter(p=>p.kind!=='Koroke'&&p.kind!=='Pysäköintialue')),pavement=new SpatialIndex(city.pavement),buildings=new SpatialIndex(city.buildings);
 const mats=Object.fromEntries(Object.entries({white:'#e4e6df',yellow:'#efd52b',blue:'#1d4483',red:'#c43f33',metal:'#9fa6a0',dark:'#303838',rubber:'#202626',glass:'#263f4b',stone:'#8d8274',soil:'#514c39',leaf:'#52733b',leaf2:'#6c8646',asphalt:'#545b58',green:'#2b8751'}).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:k==='glass'?.3:.85,metalness:k==='metal'?.45:0})]));
 mats.stone.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vSett;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSett=position;');
  s.fragmentShader='varying vec3 vSett;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 q=vSett.xz/vec2(.19,.25);q.x+=mod(floor(q.y),2.)*.5;
   vec2 edge=min(fract(q),1.-fract(q));float fp=max(fwidth(q.x),fwidth(q.y));
   float mortar=1.-smoothstep(.015,.07+fp,min(edge.x,edge.y));
   float variation=fract(sin(dot(floor(q),vec2(12.9898,78.233)))*43758.5453);
   diffuseColor.rgb*=mix(1.,.82+variation*.34-mortar*.28,1.-smoothstep(.4,1.6,fp));`);
 };
 const batches=new Map(),obstacles=[],labels=new Map(),placements={signs:[],bikes:[],freight:[],parked:[],parkingBays:[],apronLights:[]};
 // Single-post traffic signs bend or snap when hit (breakable-signs.js): while postIndex is set, geometry goes to that post.
 const postSigns=createBreakableSigns('Terminal sign posts');let postIndex=null;
 function add(g,mat,matrix){if(matrix)g.applyMatrix4(matrix);if(postIndex!==null){postSigns.add(g,mats[mat],postIndex);return;}if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(g);}
 function box(w,h,d,mat,x,y,z,yaw=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);add(g,mat);}
 function beam(a,b,r,mat='metal'){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(g,mat);}
 function poly(rings,mat,y){const shape=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));for(const r of rings.slice(1))shape.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z))));const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,mat);}
 function face(points,mat,matrix){const s=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));add(new THREE.ShapeGeometry(s),mat,matrix);}
 function labelMaterial(text,bg='#f4f3e8',fg='#253531'){
  const key=text+bg+fg;let mat=labels.get(key);
  if(!mat){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,1024,256);c.fillStyle=fg;c.font='bold 94px Arial';c.textAlign='center';c.textBaseline='middle';const lines=text.split('\n');lines.forEach((l,i)=>c.fillText(l,512,128+(i-(lines.length-1)/2)*105,960));const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;mat=new THREE.MeshStandardMaterial({map:t,roughness:.7});labels.set(key,mat);}
  return mat;
 }
 function label(text,w,h,x,y,z,yaw,bg,fg){
  if(typeof document==='undefined')return;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),labelMaterial(text,bg,fg));mesh.position.set(x,y,z);mesh.rotation.y=yaw;group.add(mesh);
 }
 const footprint=(x,z,w,d,yaw)=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[x+a*Math.cos(yaw)+b*Math.sin(yaw),z-a*Math.sin(yaw)+b*Math.cos(yaw)]);
 function obstacle(id,ring){obstacles.push({id,rings:[ring],bbox:bounds([ring])});}
 function clear(ring,{offRoad=true}={}){return [...ring,...ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return[(a[0]+b[0])/2,(a[1]+b[1])/2];})].every(([x,z])=>!buildings.at(x,z)&&!city.water.some(w=>pointInPolygon(x,z,w.rings))&&(!offRoad||!roads.at(x,z)));}
 // Roundabout garden: clip an inset circle against ALL mapped carriageways,
 // including the tram cut-through. Never plant shrubs over a rail lane.
 const disk=(r,n=80)=>Array.from({length:n+1},(_,i)=>[236.25+Math.cos(i/n*Math.PI*2)*r,992.97+Math.sin(i/n*Math.PI*2)*r]);
 const nearby=city.roads.filter(p=>p.bbox[0]<251&&p.bbox[2]>221&&p.bbox[1]<1008&&p.bbox[3]>977);
 const island=polygonClipping.difference([disk(12.7)],...nearby.map(p=>p.rings));
 const planting=polygonClipping.difference([disk(8.8)],...nearby.map(p=>p.rings));
 for(const rings of island){poly(rings,'stone',.17);for(const ring of rings)for(let i=1;i<ring.length;i++)beam([ring[i-1][0],.15,ring[i-1][1]],[ring[i][0],.15,ring[i][1]],.09,'stone');}
 const foliage=new THREE.IcosahedronGeometry(.29,0),fp=foliage.attributes.position,top=[];
 // The buried lower halves are never visible; keep the irregular upper crown.
 for(let i=0;i<fp.count;i+=3)if(fp.getY(i)+fp.getY(i+1)+fp.getY(i+2)>=0)for(let k=0;k<3;k++)top.push(fp.getX(i+k),fp.getY(i+k),fp.getZ(i+k));
 const crown=new THREE.BufferGeometry();crown.setAttribute('position',new THREE.Float32BufferAttribute(top,3));crown.computeVertexNormals();foliage.dispose();
 let shrubs=0;for(const rings of planting){poly(rings,'soil',.19);obstacle('terminal-garden',rings[0]);for(let x=227.5;x<245;x+=.48)for(let z=984.2;z<1002;z+=.48){const px=x+Math.sin(x*19+z*7)*.14,pz=z+Math.sin(z*13-x)*.14;if(pointInPolygon(px,pz,rings)&&clear(footprint(px,pz,.55,.55,0))){const g=crown.clone();g.scale(1,.32+(Math.sin(x*13+z)*.09),1);g.rotateY(x*7+z);g.translate(px,.25,pz);add(g,shrubs++%3?'leaf':'leaf2');}}}crown.dispose();
 // Forecourt crossing, clipped to the mapped terminal access carriageway.
 // Axis runs from the roundabout footway toward the terminal, not across rails.
 const access=city.roads.filter(p=>p.bbox[0]<277&&p.bbox[2]>255&&p.bbox[1]<997&&p.bbox[3]>976&&p.kind!=='Koroke');
 let crossingStripes=0;
 for(let t=-7;t<=7;t+=.92){const x=265+t*.594,z=986-t*.804,ring=footprint(x,z,.48,4.4,-.934);
  for(const road of access)for(const rings of polygonClipping.intersection([ring],road.rings)){poly(rings,'white',.108);crossingStripes++;}
 }
 // The reference's central lattice catenary mast and square concrete plinth.
 box(1.45,.65,1.45,'stone',235.8,.43,991);
 for(const dx of [-.19,.19])for(const dz of [-.19,.19])beam([235.8+dx,.7,991+dz],[235.8+dx*.65,10.6,991+dz*.65],.035);
 for(let y=.8;y<10;y+=.75)for(const side of [-1,1])beam([235.8-.18,y,991+side*.18],[235.8+.18,y+.75,991+side*.18],.02);
 // Readable observed white arrow boards; symbols use original vector geometry.
 for(const p of TERMINAL_POSTS){if(!clear(footprint(p.x,p.z,p.kind==='destination'?3.7:.35,p.kind==='destination'?.8:.35,p.yaw)))continue;
  // The framed destination board on three posts stays a solid obstacle; single posts are breakable.
  if(p.kind!=='destination')postIndex=postSigns.post({id:`terminal-${p.kind}-${p.x}`,x:p.x,z:p.z,yaw:p.yaw,height:4.25,radius:.05});
  beam([p.x,0,p.z],[p.x,4.25,p.z],.045);const matrix=(y,dz=0)=>{const m=new THREE.Matrix4().makeRotationY(p.yaw);m.setPosition(p.x+Math.sin(p.yaw)*dz,y,p.z+Math.cos(p.yaw)*dz);return m;};
  if(p.kind==='keep-right'){const g=new THREE.CircleGeometry(.43,40);add(g,'blue',matrix(2.0));face([[-.22,.15],[-.14,.23],[.10,-.02],[.17,.04],[.21,-.24],[-.06,-.20],[.01,-.12]],'white',matrix(2,.015));}
  else if(p.kind==='crossing'){
   face([[-.32,-.32],[.32,-.32],[.32,.32],[-.32,.32]],'blue',matrix(2.7));
   face([[-.26,-.24],[.26,-.24],[0,.26]],'white',matrix(2.7,.012));
   for(const x of [-.14,-.05,.04,.13]){const m=matrix(2.53,.018);m.setPosition(p.x+x*Math.cos(p.yaw)+Math.sin(p.yaw)*.018,2.53,p.z-x*Math.sin(p.yaw)+Math.cos(p.yaw)*.018);face([[-.025,-.017],[.025,-.017],[.025,.017],[-.025,.017]],'dark',m);}
   add(new THREE.CircleGeometry(.038,12),'dark',matrix(2.78,.021));
   face([[-.025,.065],[.028,.065],[.015,-.015],[.105,-.105],[.071,-.132],[-.012,-.054],[-.08,-.13],[-.115,-.104],[-.032,-.006]],'dark',matrix(2.68,.023));
  }else{
   face([[-.48,.34],[.48,.34],[0,-.48]],'red',matrix(3.8));face([[-.35,.26],[.35,.26],[0,-.34]],'yellow',matrix(3.8,.012));
   add(new THREE.CircleGeometry(.35,40),'blue',matrix(3));
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,g=new THREE.TorusGeometry(.21,.025,4,16,1.4);g.rotateZ(a);add(g,'white',matrix(3,.012));const t=new THREE.Matrix4().makeRotationZ(a);t.premultiply(matrix(3,.014));face([[.04,.21],[.16,.29],[.16,.14]],'white',t);}
   if(p.kind==='destination')for(const [i,text]of ['SILJA LINE','OLYMPIATERMINAALI\nOLYMPIATERMINALEN','P  OLYMPIAPARKKI'].entries()){
    const y=2.35-i*.5,m=matrix(y,.10);face([[-1.5,-.23],[1.35,-.23],[1.65,0],[1.35,.23],[-1.5,.23]],'white',m);
    label(text,2.55,.40,p.x-.12*Math.cos(p.yaw)+Math.sin(p.yaw)*.13,y,p.z+.12*Math.sin(p.yaw)+Math.cos(p.yaw)*.13,p.yaw);
    face([[1.20,-.19],[1.49,0],[1.20,.19]],'dark',matrix(y,.145));
   }
   if(p.kind==='destination')for(const side of [-1,1]){const x=p.x+side*1.32*Math.cos(p.yaw),z=p.z-side*1.32*Math.sin(p.yaw);beam([x,0,z],[x,2.6,z],.037);}
  }
  const ring=footprint(p.x,p.z,.15,.15,0);placements.signs.push(p);if(postIndex===null)obstacle('terminal-sign',ring);else obstacles.push({id:'terminal-sign',rings:[ring],bbox:bounds([ring]),breakable:true});postIndex=null;
 }
 // Dock row on the eastern terminal approach, separated from the cycle track.
 for(let i=0;i<12;i++){
  const x=238.2+i*.82,z=1028.5-i*.64,yaw=.67,ring=footprint(x,z,.7,2.0,yaw);if(!clear(ring))continue;
  const pt=(a,y,b)=>[x+a*Math.cos(yaw)+b*Math.sin(yaw),y,z-a*Math.sin(yaw)+b*Math.cos(yaw)];
  beam(pt(0,.1,-.8),pt(0,.8,-.8),.055);box(.27,.28,.28,'metal',...pt(0,.73,-.8));
  // The bike itself is a knockable HSL city bike (below); only the dock post is fixed and solid.
  placements.bikes.push({id:`terminal-bike-${i}`,x,z,yaw});obstacle('terminal-dock',footprint(...pt(0,0,-.8).filter((_,k)=>k!==1),.3,.3,yaw));
 }
 // Docked city bikes fly when hit (parked-micromobility.js), the "alepa" rear plate riding along with each one.
 const plate=typeof document==='undefined'?[]:[{geometry:new THREE.PlaneGeometry(.45,.21).rotateY(Math.PI/2).translate(.075,.59,.55),material:labelMaterial('alepa','#efd52b','#b82726')}];
 const bikes=placements.bikes.length?createLooseMicromobility(placements.bikes,{kind:'citybike',name:'Terminal city bikes',lift:.03,parts:plate}):null;if(bikes)group.add(bikes.group);
 // Below-street freight apron and retaining wall; source surfaces are cut by
 // the matching port-yard shader, so these are not half-buried containers.
 for(const rings of polygonClipping.difference([YARD_RING],...city.water.map(w=>w.rings)))poly(rings,'asphalt',-YARD_DEPTH);
 for(let i=0;i<YARD_RING.length;i++){const a=YARD_RING[i],b=YARD_RING[(i+1)%YARD_RING.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);box(.2,YARD_DEPTH,length,'stone',(a[0]+b[0])/2,-YARD_DEPTH/2,(a[1]+b[1])/2,Math.atan2(b[0]-a[0],b[1]-a[1]));}
 for(let i=0;i<16;i++){
  const z=735+i*9.9,x=yardWest(z)+10+(i%3===0?10:0),yaw=.636,ring=footprint(x,z,2.55,8.2,yaw);
  if(!clear(ring)||ring.some(([a,b])=>!inLowerYard(a,b)||pavement.at(a,b)))continue;
  const base=-YARD_DEPTH,brand=i%5===0?'SILJA LINE':i%3===0?'DSV':'LKW\nWALTER',mat=brand==='SILJA LINE'?'white':'blue';
  box(2.55,2.75,8.2,mat,x,base+1.6,z,yaw);
  for(let k=-3.8;k<4;k+=.38)for(const side of [-1,1])box(.045,2.65,.045,mat,x+side*1.29*Math.cos(yaw)+k*Math.sin(yaw),base+1.6,z-side*1.29*Math.sin(yaw)+k*Math.cos(yaw),yaw);
  label(brand,5.8,1.3,x-1.302*Math.cos(yaw),base+1.75,z+1.302*Math.sin(yaw),yaw-Math.PI/2,mat==='white'?'#e4e6df':'#1d4483',mat==='white'?'#244b7c':'#eee08d');
  box(2.35,.22,8.1,'dark',x,base+.22,z,yaw);placements.freight.push({x,z,yaw,brand,base,ring});obstacle('port-container',ring);
 }
 // Parked cars: west kerb + port parking rows; full footprints must avoid
 // buildings, water and paths. The photographed west-side parking strip is
 // included in the municipal carriageway polygon, not in the park behind it.
 // Keep the complete car envelope in that outer kerb strip, clear of the
 // through lanes; rejecting all road polygons placed cars inside the rock.
 const parked=[];
 const parks=new SpatialIndex(city.parks);
 // West kerb belongs to southbound traffic: noses face the terminal, toward
 // the northbound player in the reference. A half-turn preserves footprints.
 for(let z=710;z<912;z+=7){const roadX=110+(z-742)*.738;for(const offset of [-19,-18.75,-18.5,-18.25,-18]){const x=roadX+offset,ring=footprint(x,z,1.85,4.6,.636);if(!clear(ring,{offRoad:false})||ring.some(([a,b])=>!roads.at(a,b)||pavement.at(a,b)||parks.at(a,b)))continue;parked.push({x,z,heading:.636+Math.PI,kind:'west-kerb',ring});obstacle('west-parked',ring);break;}}
 // North apron: the reference view looks across an active car-marshalling
 // area, not an empty lawn. Rows follow the quay with 6.9 m driving aisles.
 // Exact occupancy is illustrative; land/water and public paths are measured.
 const yardPoint=(along,seaward)=>[68+along*.594+seaward*.804,597+along*.804-seaward*.594];
 const apronRing=[yardPoint(-10,-38),yardPoint(138,-38),yardPoint(138,78),yardPoint(-10,78)];
 const exclusions=[...city.water,...city.buildings,...city.pavement,...city.roads.filter(p=>p.kind!=='Pysäköintialue')].filter(p=>p.bbox[0]<220&&p.bbox[2]>45&&p.bbox[1]<740&&p.bbox[3]>540);
 const apron=polygonClipping.difference([apronRing],...[...exclusions.map(p=>p.rings),[YARD_RING]]);
 for(const rings of apron)poly(rings,'asphalt',.039);
 const bayYaw=-Math.atan2(.804,.594);
 const inApron=ring=>ring.every(([x,z])=>apron.some(rings=>pointInPolygon(x,z,rings)));
 for(let row=-3;row<6;row++)for(let i=0;i<46;i++){
  const [x,z]=yardPoint(i*2.9,6+row*12.5),bay=footprint(x,z,2.7,5.6,bayYaw);
  if(!inApron(bay)||!clear(bay))continue;
  placements.parkingBays.push({x,z,yaw:bayYaw,ring:bay});
  for(let j=0;j<3;j++){const a=bay[j],b=bay[j+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=-dz/l*.045,nz=dx/l*.045;poly([[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]]],'white',.057);}
  // Empty spaces preserve the parking pattern and break up repeated models.
  if((i+row*3)%5===0)continue;
  const heading=bayYaw+((i+row)%3===0?Math.PI:0),ring=footprint(x,z,1.85,4.6,heading);
  parked.push({x,z,heading,kind:'port-apron',ring});obstacle('port-parked',ring);
 }
 // Simple double-headed yard lights give the open apron human scale without
 // loading more textures or adding per-prop draw calls.
 for(const along of [8,62,122]){
  const [x,z]=yardPoint(along,25),ring=footprint(x,z,.7,.7,0);if(!inApron(ring)||!clear(ring))continue;
  beam([x,0,z],[x,10,z],.065);beam([x-1.4,9.7,z],[x+1.4,9.7,z],.055);
  for(const side of [-1,1])box(.8,.18,.4,'white',x+side*1.2,9.67,z);
  placements.apronLights.push({x,z});obstacle('port-light',ring);
 }
 placements.parked=parked;
 // Three body families plus varied paint keep the dense parked fleet under
 // the harbour geometry budget without reducing its vehicle count.
 const fleetTypes=['hatchback','estate','van'],fleetActors=parked.map((p,id)=>({...p,id,speed:0,edge:{},parked:true}));
 const fleet=createTrafficRenderer(fleetActors,{types:fleetTypes});let fleetViewer={x:170,z:800};fleet.update(0,fleetViewer);group.add(fleet.group);
 const enterableCars=fleetActors.map((actor,i)=>{
  const vehicle=fleet.vehicleOf(actor),obstacle=obstacles.find(o=>o.rings[0]===actor.ring);
  return createParkedCarSource({id:`terminal-parked-${i}`,label:vehicle.type==='van'?'Parked van':'Parked car',actor,obstacle,
   visual:{type:vehicle.type||fleetTypes[i%fleetTypes.length],paint:`#${vehicle.paint.getHexString()}`},setHidden:()=>fleet.update(0,fleetViewer)});
 });
 group.add(postSigns.finish());group.breakable=postSigns;
 for(const [mat,parts]of batches){const m=new THREE.Mesh(mergeGeometries(parts),mats[mat]);m.castShadow=!['asphalt','soil'].includes(mat);m.receiveShadow=true;group.add(m);parts.forEach(g=>g.dispose());}
 group.userData={...placements,shrubs,crossingStripes,lowerYardDepth:YARD_DEPTH,signText:TERMINAL_SIGN_TEXT,accuracy:'Photo-guided (Aug 2024 / Apr 2023); metre-scale estimated props constrained to municipal ground, not exact surveyed placements.'};
 // Distance levels for the parked fleet (traffic-renderer.js); non-enumerable so state snapshots stay serialisable.
 Object.defineProperty(group.userData,'fleetLod',{value:viewer=>{fleetViewer=viewer;fleet.update(0,viewer);},enumerable:false});
 return {group,obstacles,knockables:bikes,enterableCars};
}
