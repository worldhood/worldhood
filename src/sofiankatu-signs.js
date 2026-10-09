import * as THREE from 'three';
import earcut from 'earcut';
import polygonClipping from 'polygon-clipping';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SpatialIndex,bounds} from './geo.js';
import {createBreakableSigns} from './breakable-signs.js';

// Legacy task name: the municipal side street at this pose is Katariinankatu,
// not Sofiankatu. Positions are constrained to mapped safe surfaces, not surveyed.
export const SOFIANKATU_SIGN_POSTS=Object.freeze([
  {id:'north-pavement',x:74,z:234,y:0.07,crossing:true,keepRight:false},
  {id:'west-refuge-tip',x:85.5,z:245.2,y:0.18,crossing:true,keepRight:true},
]);
export const SOFIANKATU_ISLAND_IDS=Object.freeze([46411,46412,46413].map(id=>`YLRE_Katu_ja_viherosat_ajorata_alue.${id}`));
export const SOFIANKATU_SIGN_NORMAL=Object.freeze([-0.99875,0.04998]);

export function sofiankatuSignSafe(post,city,indices){
  const road=indices?.road||new SpatialIndex(city.roads.filter(p=>p.kind!=='Koroke'));
  const safe=indices?.safe||new SpatialIndex([...city.pavement,...city.roads.filter(p=>p.kind==='Koroke')]);
  const buildings=indices?.buildings||new SpatialIndex(city.buildings||[]);
  return [[0,0],[.16,0],[-.16,0],[0,.16],[0,-.16]].every(([dx,dz])=>
    safe.at(post.x+dx,post.z+dz)&&!road.at(post.x+dx,post.z+dz)&&!buildings.at(post.x+dx,post.z+dz));
}

export function createSofiankatuSigns(city,{island=true,posts=SOFIANKATU_SIGN_POSTS,signs:shared=null}={}){
  const group=new THREE.Group();group.name='Pohjoisesplanadi / Katariinankatu observed crossing signs';
  const materials={metal:new THREE.MeshStandardMaterial({color:'#929b9d',metalness:.65,roughness:.48}),
    blue:new THREE.MeshStandardMaterial({color:'#0955ac',roughness:.58}),white:new THREE.MeshStandardMaterial({color:'#f5f5ef',roughness:.7}),
    black:new THREE.MeshStandardMaterial({color:'#15201e',roughness:.8}),granite:new THREE.MeshStandardMaterial({color:'#928f84',roughness:1}),
    stone:new THREE.MeshStandardMaterial({color:'#aaa599',roughness:1}),joint:new THREE.MeshStandardMaterial({color:'#747367',roughness:1})};
  const batches=new Map(),signs=shared||createBreakableSigns('Crossing sign posts');let postIndex=null;
  // Post geometry is tagged with its post so the pole can bend or snap off (breakable-signs.js); the island stays static.
  function add(g,m,matrix){if(matrix)g.applyMatrix4(matrix);if(g.index){const old=g;g=old.toNonIndexed();old.dispose();}g.deleteAttribute('uv');if(postIndex!==null){signs.tag(g,postIndex);m='sign:'+m;}if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}
  function box(w,h,d,x,y,z,m,matrix){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m,matrix);}
  function shape(points,x,y,z,m,matrix){const s=new THREE.Shape();points.forEach(([a,b],i)=>i?s.lineTo(a,b):s.moveTo(a,b));s.closePath();const g=new THREE.ShapeGeometry(s);g.translate(x,y,z);add(g,m,matrix);}
  function stroke(a,b,r,m,matrix){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p),g=new THREE.CylinderGeometry(r,r,v.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,m,matrix);}
  function disk(radius,x,y,z,m,matrix){const g=new THREE.CircleGeometry(radius,32);g.translate(x,y,z);add(g,m,matrix);}
  const placed=[],omitted=[];
  const indices={road:new SpatialIndex(city.roads.filter(p=>p.kind!=='Koroke')),safe:new SpatialIndex([...city.pavement,...city.roads.filter(p=>p.kind==='Koroke')]),buildings:new SpatialIndex(city.buildings||[])};
  for(const post of posts){
    if(!sofiankatuSignSafe(post,city,indices)){omitted.push(post.id);continue;}
    const normal=post.normal||SOFIANKATU_SIGN_NORMAL;
    const matrix=new THREE.Matrix4().makeRotationY(Math.atan2(...normal));matrix.setPosition(post.x,post.y||0,post.z);
    // Back-to-back plates on one pole (route crossings) share a single breakable post.
    const shared=placed.find(p=>Math.hypot(p.x-post.x,p.z-post.z)<.05);
    postIndex=shared?shared.postIndex:signs.post({id:post.id,x:post.x,z:post.z,y:post.y||0,yaw:Math.atan2(...normal),height:3.35,radius:.04});
    stroke([0,0,0],[0,3.35,0],.031,'metal',matrix);
    box(.69,.69,.045,0,3.02,.035,'metal',matrix);
    box(.667,.667,.006,0,3.02,.060,'white',matrix);
    box(.628,.628,.005,0,3.02,.066,'blue',matrix);
    shape([[-.273,-.244],[.273,-.244],[0,.269]],0,3.02,.07,'white',matrix);
    // Original vector pictogram: zebra treads and a walking silhouette.
    for(let i=-2;i<=2;i++)box(.069,.026,.003,i*.087,2.81,.075,'black',matrix);
    disk(.037,-.008,3.134,.076,'black',matrix);
    stroke([-.008,3.082,.077],[.022,2.966,.077],.022,'black',matrix);
    stroke([.022,2.966,.077],[-.078,2.868,.077],.018,'black',matrix);
    stroke([.022,2.966,.077],[.094,2.877,.077],.018,'black',matrix);
    stroke([.0,3.056,.077],[-.071,3.01,.077],.014,'black',matrix);
    stroke([.0,3.056,.077],[.074,3.025,.077],.014,'black',matrix);
    if(post.keepRight){
      const back=new THREE.CylinderGeometry(.285,.285,.04,40);back.rotateX(Math.PI/2);back.translate(0,2.20,.03);add(back,'metal',matrix);
      disk(.278,0,2.20,.052,'white',matrix);disk(.258,0,2.20,.054,'blue',matrix);
      shape([[-.168,.124],[-.116,.173],[.085,-.028],[.13,.016],[.153,-.154],[-.018,-.132],[.03,-.085]],0,2.20,.057,'white',matrix);
    }
    placed.push({...post,normal:[...normal],postIndex});
  }
  postIndex=null;
  const sourceIslands=city.roads.filter(p=>SOFIANKATU_ISLAND_IDS.includes(p.id));
  if(island)for(const feature of sourceIslands){
    const rings=feature.rings,flat=rings.flat().flat(),holes=[];let cursor=rings[0].length;for(const ring of rings.slice(1)){holes.push(cursor);cursor+=ring.length;}
    const indices=earcut(flat,holes),vertices=[];
    // Earcut XY -> XZ reverses handedness: swap triangle corners for +Y fronts.
    for(let i=0;i<indices.length;i+=3)for(const j of [indices[i],indices[i+2],indices[i+1]])vertices.push(flat[j*2],.18,flat[j*2+1]);
    const top=new THREE.BufferGeometry();top.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));top.computeVertexNormals();add(top,'joint');
    for(const ring of rings)for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const g=new THREE.BoxGeometry(.075,.15,Math.hypot(dx,dz));g.rotateY(Math.atan2(dx,dz));g.translate((a[0]+b[0])/2,.105,(a[1]+b[1])/2);add(g,'granite');
    }
    const [x0,z0,x1,z1]=bounds(rings),size=feature.material==='Betonikivi'?.35:.21;
    for(let x=Math.floor(x0/size)*size;x<x1+size;x+=size)for(let z=Math.floor(z0/size)*size;z<z1+size;z+=size){
      const r=size*.477,clipped=polygonClipping.intersection(rings,[[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r],[x-r,z-r]]]);
      for(const polygon of clipped){
        const f=polygon[0].flat(),ii=earcut(f),v=[];
        for(let i=0;i<ii.length;i+=3)for(const j of [ii[i],ii[i+2],ii[i+1]])v.push(f[j*2],.186,f[j*2+1]);
        if(!v.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,(Math.floor(x*17+z*13)%4===0)?'granite':'stone');
      }
    }
  }
  for(const [key,gs] of batches){const sign=key.startsWith('sign:'),name=sign?key.slice(5):key,geometry=mergeGeometries(gs),mesh=sign?signs.mesh(geometry,materials[name]):new THREE.Mesh(geometry,materials[key]);mesh.name=`Crossing kit ${name}`;mesh.castShadow=key!=='joint';mesh.receiveShadow=true;group.add(mesh);gs.forEach(g=>g.dispose());}
  group.userData={placed,omitted,islandIds:island?sourceIslands.map(p=>p.id):[],referenceDate:'2024-08',aerialDate:'2025',
    accuracy:'Photo-estimated sign positions constrained to municipal surfaces. Municipal refuge and 2025 aerial do not align exactly.',
    temporaryRoadworksIncluded:false,rearBoardText:null};
  // A caller-supplied sign set (roadworks) merges these meshes itself and finishes the set.
  if(!shared){group.add(signs.finish());group.breakable=signs;}
  return group;
}
