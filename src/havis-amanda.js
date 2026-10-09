import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';

export const HAVIS_AMANDA_REFERENCE={
 source:'https://www.hamhelsinki.fi/en/the-story-of-havis-amanda/',
 figurePhoto:'https://www.hamhelsinki.fi/wp-content/uploads/2025/11/Havis_Amanda_paluu-3-1440x960.jpg',
 fountainPhoto:'https://www.hamhelsinki.fi/wp-content/uploads/2026/03/Havis-Amanda-2024-2.jpg',
 condition:'Post-2023–24 conservation: dark waxed bronze, summer fountain operating',
 accuracy:'Original photo-guided geometry, not a scan; small anatomy, ornament and dimensions approximated',
 basinRadius:4.8,figureHeight:2.15,seaLions:4,fish:4,
};

// Elliptical sections along an organic centreline. Unlike a chain of cylinders,
// the radius and the centre both interpolate continuously through knees/elbows.
function organic(sections,segments=42,sides=16){
 const curve=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(...s.slice(0,3))));
 const radii=new THREE.CatmullRomCurve3(sections.map(s=>new THREE.Vector3(s[3],s[4]??s[3],0)));
 const vertices=[],indices=[];
 for(let i=0;i<=segments;i++){
  const t=i/segments,p=curve.getPoint(t),r=radii.getPoint(t),tangent=curve.getTangent(t);
  // Keep elliptical width across the body (X), not an arbitrary Frenet axis
  // that swaps torso width and depth on nearly vertical curves.
  let n=new THREE.Vector3(1,0,0).addScaledVector(tangent,-tangent.x);
  if(n.lengthSq()<.005)n=new THREE.Vector3(0,0,1).addScaledVector(tangent,-tangent.z);
  n.normalize();const b=new THREE.Vector3().crossVectors(tangent,n).normalize();
  for(let j=0;j<=sides;j++){
   const a=j/sides*Math.PI*2,q=p.clone().addScaledVector(n,Math.cos(a)*Math.max(.002,r.x)).addScaledVector(b,Math.sin(a)*Math.max(.002,r.y));
   vertices.push(...q.toArray());
  }
 }
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
 const start=vertices.length/3;vertices.push(...curve.getPoint(0).toArray(),...curve.getPoint(1).toArray());
 for(let j=0;j<sides;j++){indices.push(start,j+1,j);const end=segments*(sides+1);indices.push(start+1,end+j,end+j+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createHavisAmanda({x=-39.066,z=281.183}={}){
 const group=new THREE.Group();group.name='Havis Amanda — restored bronze fountain';group.position.set(x,0,z);
 const b=architectureBuilder(),bronze=new THREE.MeshStandardMaterial({color:'#61584a',metalness:.42,roughness:.48}),dark=new THREE.MeshStandardMaterial({color:'#272c27',metalness:.45,roughness:.5});
 const granite=new THREE.MeshStandardMaterial({color:'#9c9991',roughness:.94});
 const joint=new THREE.MeshStandardMaterial({color:'#757770',roughness:1});
 const sculpt=(g,mat=bronze)=>b.add(g,mat);
 const ellipsoid=(sx,sy,sz,px,py,pz,mat=bronze,rot=0)=>{const g=new THREE.SphereGeometry(1,20,14);g.scale(sx,sy,sz);g.rotateZ(rot);b.add(g,mat,px,py,pz);};
 const lathe=(profile,mat=bronze)=>sculpt(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),80),mat);
 // Restored broad stone pool: real inner wall, coping and shallow water, not a
 // stone disk covering the water. Joint lines divide the coping into blocks.
 b.cylinder(4.83,4.95,.17,joint,0,.155,0,96);
 lathe([[4.36,.16],[4.36,.57],[4.4,.64],[4.74,.64],[4.8,.59],[4.8,.23]],granite);
 for(let i=0;i<32;i++){
  const a=i*Math.PI/16;const g=new THREE.BoxGeometry(.012,.01,.42);g.rotateY(a);g.translate(Math.sin(a)*4.57,.644,Math.cos(a)*4.57);sculpt(g,joint);
 }
 // Tall moulded bronze plinth and shallow wide upper bowl, visible in HAM's
 // post-conservation side view. Four fish sit above this bowl at her feet.
 lathe([[0,.3],[.95,.3],[1.05,.44],[.94,.61],[.69,.77],[.58,1],[.53,1.85],[.69,2.04],[1.08,2.15],[1.53,2.24],[1.68,2.36],[1.69,2.42],[1.61,2.44],[1.5,2.34],[.65,2.26],[.45,2.27],[.40,2.72],[.52,2.84],[0,2.89]]);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const g=organic([[Math.sin(a)*.8,.42,Math.cos(a)*.8,.14],[Math.sin(a)*.65,.66,Math.cos(a)*.65,.13],[Math.sin(a)*.57,1.02,Math.cos(a)*.57,.04]],16,8);sculpt(g);
 }
 const jets=[];
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+.35;
  const fish=organic([[0,2.40,.32,.04],[0,2.62,.26,.16],[0,2.86,.51,.22],[0,2.92,.76,.17],[0,2.85,.98,.10]],30,14);fish.rotateY(a);sculpt(fish);
  for(const side of [-1,1]){
   const fin=new THREE.SphereGeometry(1,12,8);fin.scale(.23,.045,.25);fin.rotateZ(side*.3);fin.translate(side*.19,2.75,.53);fin.rotateY(a);sculpt(fin);
   const eye=new THREE.SphereGeometry(.023,8,6);eye.translate(side*.12,2.94,.79);eye.rotateY(a);sculpt(eye,dark);
  }
  const mouth=new THREE.SphereGeometry(.066,10,8);mouth.scale(1,.65,.3);mouth.translate(0,2.84,.993);mouth.rotateY(a);sculpt(mouth,dark);
  jets.push({from:[Math.sin(a)*1.01,2.84,Math.cos(a)*1.01],to:[Math.sin(a)*2.9,.38,Math.cos(a)*2.9],rise:.18});
 }
 // A roughly two-metre contrapposto figure. Her left hand touches the neck,
 // the other arm hangs beside the hip; the head turns back toward the raised
 // hand. Hair is swept into short curls, not a spherical featureless head.
 const figure=new THREE.Group();figure.name='Amanda figure — turned head and hand at neck';
 const f=architectureBuilder();
 const fa=g=>f.add(g,bronze);
 const fe=(scale,p,mat=bronze,rot=0)=>{const g=new THREE.SphereGeometry(1,24,18);g.scale(...scale);g.rotateZ(rot);f.add(g,mat,...p);};
 // Coordinates relative to feet; torso shifts over the supporting leg.
 fa(organic([[.03,.84,0,.12,.13],[.045,.99,-.015,.225,.17],[.04,1.13,-.025,.19,.14],[0,1.29,0,.14,.12],[-.01,1.44,.012,.185,.135],[-.035,1.59,.015,.23,.125],[-.04,1.65,.015,.15,.105]],48,24));
 fa(organic([[-.095,.94,-.01,.14],[-.14,.75,.005,.125],[-.145,.48,.025,.079],[-.15,.31,-.015,.077],[-.15,.095,0,.048]],40,20));
 fa(organic([[.18,.94,-.025,.145],[.24,.75,.09,.124],[.27,.53,.16,.075],[.16,.31,.08,.07],[.09,.08,0,.046]],40,20));
 fe([.065,.06,.135],[-.145,.065,.072]);fe([.059,.055,.13],[.09,.053,.066]);
 fa(organic([[-.035,1.58,.01,.09],[-.045,1.72,.02,.071],[-.025,1.8,.022,.074]],22,18));
 // Shoulder, elbow forward/down, then fingers curling up under the jaw.
 fa(organic([[-.205,1.58,.02,.082],[-.28,1.44,.10,.077],[-.32,1.31,.17,.063],[-.21,1.42,.25,.052],[-.13,1.61,.19,.04],[-.10,1.72,.16,.037]],44,18));
 fe([.045,.089,.025],[-.084,1.731,.15],bronze,-.40);
 for(let j=0;j<4;j++)fa(organic([[-.11+j*.016,1.735,.174,.01],[-.075+j*.014,1.785,.155,.008],[-.06+j*.012,1.796,.137,.004]],12,6));
 fa(organic([[.19,1.58,0,.078],[.235,1.42,-.045,.07],[.25,1.23,-.065,.049],[.28,1.06,-.02,.037]],38,18));
 fe([.088,.094,.10],[-.195,1.58,.017]);fe([.082,.094,.098],[.19,1.58,.005]);
 fe([.041,.098,.034],[.273,1.009,0],bronze,-.12);
 // Low sculptural support behind the calves, shaped like rising seaweed.
 for(let i=0;i<5;i++)fa(organic([[.08+(i-2)*.033,.02,-.09,.055],[.05+(i-2)*.025,.30,-.13,.043],[.13+(i-2)*.03,.61,-.095,.028],[.10+(i-2)*.025,.87,-.06,.004]],24,8));
 // Face parts share the same bronze; only deep eye/mouth creases are darker.
 const head=architectureBuilder();
 const he=(s,p,mat=bronze)=>{const g=new THREE.SphereGeometry(1,22,16);g.scale(...s);head.add(g,mat,...p);};
 he([.116,.158,.112],[0,0,0]);he([.077,.05,.062],[0,-.116,.045]);
 he([.025,.052,.047],[0,-.015,.107]);
 for(const side of [-1,1]){he([.038,.013,.023],[side*.049,.023,.1]);he([.024,.006,.012],[side*.049,.02,.119],dark);he([.024,.041,.023],[side*.111,-.017,0]);}
 he([.038,.008,.014],[0,-.071,.106],dark);he([.039,.009,.014],[0,-.079,.109]);
 he([.123,.112,.117],[0,.071,-.02]);
 // Grooved waves of hair, with swept side curls and a small crest.
 for(let i=0;i<11;i++){
  const a=(i/10-.5)*2.4;head.add(organic([[Math.sin(a)*.095,.143,Math.cos(a)*.08,.021],[Math.sin(a)*.125,.076,.03,.023],[Math.sin(a)*.145,-.012,-.025,.022],[Math.sin(a)*.16,-.06,-.014,.01]],18,8),bronze);
 }
 head.add(organic([[-.04,.14,.056,.025],[-.044,.20,.045,.037],[.004,.208,.007,.025],[.041,.151,-.03,.018]],20,10),bronze);
 const hg=head.finish();hg.rotation.y=-.55;hg.rotation.z=.07;hg.position.set(-.047,1.897,.03);hg.updateMatrix();
 for(const m of hg.children){m.geometry.applyMatrix4(hg.matrix);f.add(m.geometry,m.material);}
 const fg=f.finish();fg.scale.setScalar(1.03);figure.add(fg);figure.position.set(0,2.98,0);figure.rotation.y=-Math.PI*.67;group.add(figure);
 // Sea lions sit upright with heads turned inward. Flippers and whiskered
 // muzzles give an animal silhouette distinct from the former seal blobs.
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+.35,lion=architectureBuilder();
  const add=g=>lion.add(g,bronze);
  add(organic([[0,.40,.29,.025],[0,.49,.18,.40,.33],[0,.71,.08,.37,.32],[0,1.0,-.13,.29,.28],[0,1.35,-.30,.21,.23],[0,1.65,-.37,.18],[0,1.79,-.45,.13]],40,22));
  for(const side of [-1,1]){
   const flipper=new THREE.SphereGeometry(1,18,12);flipper.scale(.16,.055,.52);flipper.rotateY(side*.42);flipper.translate(side*.37,.43,-.09);add(flipper);
   const tail=new THREE.SphereGeometry(1,16,10);tail.scale(.15,.045,.28);tail.rotateY(side*.45);tail.translate(side*.13,.41,.66);add(tail);
   const eye=new THREE.SphereGeometry(.023,10,8);eye.translate(side*.118,1.79,-.55);lion.add(eye,dark);
  }
  const muzzle=new THREE.SphereGeometry(1,18,12);muzzle.scale(.13,.105,.19);muzzle.translate(0,1.77,-.59);add(muzzle);
  const nose=new THREE.SphereGeometry(1,12,8);nose.scale(.055,.033,.027);nose.translate(0,1.82,-.762);lion.add(nose,dark);
  const mouth=new THREE.SphereGeometry(1,12,8);mouth.scale(.07,.025,.026);mouth.translate(0,1.726,-.771);lion.add(mouth,dark);
  for(const side of [-1,1])for(let j=0;j<3;j++)lion.add(organic([[side*.07,1.75+j*.018,-.70,.004],[side*.17,1.75+j*.025,-.72,.003],[side*.22,1.72+j*.035,-.68,.001]],8,4),dark);
  const lg=lion.finish();for(const m of lg.children){m.geometry.rotateY(a);m.geometry.translate(Math.sin(a)*3.52,0,Math.cos(a)*3.52);sculpt(m.geometry,m.material.color.equals(dark.color)?dark:bronze);}
  jets.push({from:[Math.sin(a)*2.75,1.726,Math.cos(a)*2.75],to:[Math.sin(a)*.92,.40,Math.cos(a)*.92],rise:1.12});
 }
 group.add(b.finish());
 const waterMaterial=new THREE.MeshStandardMaterial({color:'#62918e',metalness:.24,roughness:.2,transparent:true,opacity:.76});
 const water=new THREE.Mesh(new THREE.CircleGeometry(4.34,96),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=.38;group.add(water);
 const jetMaterial=new THREE.MeshBasicMaterial({color:'#d9eeed',transparent:true,opacity:.48,depthWrite:false});
 const curves=jets.map(({from,to,rise})=>{const p=new THREE.Vector3(...from),q=new THREE.Vector3(...to),m=p.clone().lerp(q,.5);m.y=Math.max(p.y,q.y)+rise;return new THREE.QuadraticBezierCurve3(p,m,q);});
 const jb=architectureBuilder();for(const curve of curves)jb.add(new THREE.TubeGeometry(curve,28,.019,5,false),jetMaterial);
 const jg=jb.finish();jg.traverse(m=>{m.castShadow=false;m.receiveShadow=false;});group.add(jg);
 const dropletCount=384,positions=new Float32Array(dropletCount*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const spray=new THREE.Points(geo,new THREE.PointsMaterial({color:'#e0f2ee',size:.035,transparent:true,opacity:.55,depthWrite:false}));spray.frustumCulled=false;group.add(spray);
 group.userData={...HAVIS_AMANDA_REFERENCE,x,z};let previous=-Infinity;
 const update=(time,car)=>{
  const near=!car||Math.hypot(car.x-x,car.z-z)<240;spray.visible=near;jg.visible=near;
  if(!near||!Number.isFinite(time)||(time>=previous&&time-previous<1/30))return;previous=time;
  for(let i=0;i<dropletCount;i++){
   const t=((i/48+time*.62)%1+1)%1,point=curves[i%curves.length].getPoint(t),s=.012+t*.05;
   point.x+=Math.sin(i*7.17)*s;point.z+=Math.cos(i*9.41)*s;geo.attributes.position.setXYZ(i,...point.toArray());
  }geo.attributes.position.needsUpdate=true;
 };update(0);
 return {group,update};
}
