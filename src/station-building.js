import * as THREE from 'three';
import {architectureBuilder} from './cathedral.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_regular.typeface.json' with {type:'json'};

// Exterior reference: WGA Saarinen 4railwa2.jpg; VR station description.
// Main entrance registered between the RATU 324 piers. Tower registered to
// municipal vertices above 30 m. Ornament sizes are interpreted, not surveyed.
export const STATION_ENTRANCE={x:-593.7,z:-70.35,yaw:.0532};
export const STATION_TOWER={x:-543.72,z:-106.99,clockHeight:39.2};
export function createStationBuildingDetails(){
 const b=architectureBuilder(),m={stone:new THREE.MeshStandardMaterial({color:'#a78b78',roughness:.92}),dark:new THREE.MeshStandardMaterial({color:'#776151',roughness:.94}),bronze:new THREE.MeshStandardMaterial({color:'#968665',metalness:.5,roughness:.48}),glass:new THREE.MeshStandardMaterial({color:'#344a4f',roughness:.27,metalness:.25}),copper:new THREE.MeshStandardMaterial({color:'#587e73',roughness:.52,metalness:.5}),clock:new THREE.MeshStandardMaterial({color:'#e0ded2',roughness:.65})};
 const r=10.35,sy=9.0;
 const opening=new THREE.Shape();opening.moveTo(-r,.7);opening.lineTo(r,.7);opening.lineTo(r,sy);opening.absarc(0,sy,r,0,Math.PI);opening.lineTo(-r,.7);
 b.add(new THREE.ShapeGeometry(opening,48),m.glass,0,0,.32);
 // Concentric recessed granite voussoirs. Thick extruded arch, not a decal.
 for(let j=0;j<4;j++){
  const ri=r+j*.63,ro=ri+.61,shape=new THREE.Shape();shape.absarc(0,sy,ro,0,Math.PI);shape.lineTo(-ri,sy);shape.absarc(0,sy,ri,Math.PI,0,true);shape.closePath();
  b.add(new THREE.ExtrudeGeometry(shape,{depth:.35,bevelEnabled:false,curveSegments:48}),j%2?m.dark:m.stone,0,0,.43+j*.13);
  for(const side of [-1,1])b.box(.61,sy,.4,m.stone,side*(ri+.305),sy/2,.64+j*.13);
 }
 for(const side of [-1,1]){
  b.box(3.5,9.8,1.25,m.stone,side*15,4.9,-.75);
  for(let i=0;i<6;i++)b.box(.055,8.8,.04,m.dark,side*15-1.4+i*.55,4.8,-.10);
  b.box(3.8,.4,1.7,m.copper,side*15,10,-.65);b.box(2.9,.7,1.15,m.copper,side*15,10.5,-.65);
 }
 // Dense bronze grille clipped to the semicircular opening.
 for(let x=-9.9;x<10;x+=.66){const top=sy+Math.sqrt(r*r-x*x);b.box(.065,top-3.6,.10,m.bronze,x,(top+3.6)/2,.47);}
 for(let y=4;y<19;y+=1.15){const half=y<sy?r:Math.sqrt(Math.max(0,r*r-(y-sy)**2));b.box(half*2,.065,.1,m.bronze,0,y,.48);}
 for(const x of [-7.8,-5.2,-2.6,0,2.6,5.2,7.8]){
  b.box(2.28,3.15,.16,m.glass,x,1.75,.5);for(const dx of [-1.15,1.15])b.box(.15,3.4,.25,m.bronze,x+dx,1.8,.57);b.box(.045,3,.05,m.bronze,x,1.75,.60);
 }
 b.box(28,.35,1.3,m.copper,0,3.7,.8);
 const font=new FontLoader().parse(fontData),g=new TextGeometry('RAUTATIEASEMA  JÄRNVÄGSSTATION',{font,size:.50,depth:.04,curveSegments:3,bevelEnabled:false});g.computeBoundingBox();g.translate(-g.boundingBox.max.x/2,0,0);b.add(g,m.bronze,0,4.04,1.47);
 function clock(builder,x,y,z,radius,angle=0){
  const dial=new THREE.CircleGeometry(radius,48);dial.rotateY(angle);builder.add(dial,m.clock,x,y,z);
  const rim=new THREE.TorusGeometry(radius+.045,.075,8,48);rim.rotateY(angle);builder.add(rim,m.bronze,x,y,z);
  for(let i=0;i<12;i++){const a=i*Math.PI/6,g=new THREE.BoxGeometry(.065,radius*.16,.055);g.rotateZ(-a);g.rotateY(angle);builder.add(g,m.dark,x+Math.sin(a)*radius*.82*Math.cos(angle),y+Math.cos(a)*radius*.82,z-Math.sin(a)*radius*.82*Math.sin(angle));}
  for(const [angleZ,length]of [[-.7,radius*.57],[1.0,radius*.76]]){const g=new THREE.BoxGeometry(.095,length,.09);g.translate(0,length/2,0);g.rotateZ(angleZ);g.rotateY(angle);builder.add(g,m.dark,x+Math.sin(angle)*.09,y,z+Math.cos(angle)*.09);}
 }
 b.box(2.15,2.2,.2,m.stone,0,7,.64);clock(b,0,7,.80,.85);
 const main=b.finish();main.position.set(STATION_ENTRANCE.x,0,STATION_ENTRANCE.z);main.rotation.y=STATION_ENTRANCE.yaw;
 const tower=architectureBuilder(),t=STATION_TOWER;
 for(let i=0;i<4;i++){const a=.0532+i*Math.PI/2;clock(tower,t.x+Math.sin(a)*4.16,t.clockHeight,t.z+Math.cos(a)*4.16,2.0,a);}
 const group=new THREE.Group();group.name='Railway station arched portal, bronze grille and four tower clocks';group.add(main,tower.finish());group.userData={ratu:324,clockFaces:5,accuracy:'Measured shell and tower registration; photo-guided architectural detailing'};return group;
}
