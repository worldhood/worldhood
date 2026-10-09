import * as THREE from 'three';

// Plan layout traced against the city's 2025 orthophoto, municipal stair polygons,
// and the parish's 1995 restoration report pp.12/23. Heights/counts below remain
// reconstruction parameters: the surrounding street terrain is still flattened.
export const CATHEDRAL_SITE={upper:{west:-38,east:34,north:-73,south:5},lowerWest:{west:-64,east:-43,north:-73,south:8,height:5.4},westUpperSteps:17,westStreetSteps:12,frontLanding:1.2};
export function addCathedralSite(b,c,stone){
 const site=CATHEDRAL_SITE,u=site.upper,l=site.lowerWest,h=c.terrace;
 const iron=new THREE.MeshStandardMaterial({color:'#3f4946',roughness:.65,metalness:.5});
 const joints=new THREE.MeshStandardMaterial({color:'#75756f',roughness:1});
 const cobble=new THREE.MeshStandardMaterial({color:'#96958c',roughness:1});
 // Filtered stone courses on the upper and lower terraces (not image scenery).
 cobble.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vCourt;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCourt=position;');shader.fragmentShader='varying vec3 vCourt;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float footprint=max(length(dFdx(vCourt.xz)),length(dFdy(vCourt.xz)));
 float row=floor(vCourt.z/0.28);vec2 cell=abs(fract(vec2(vCourt.x/0.42+mod(row,2.0)*0.5,vCourt.z/0.28))-0.5);
 float seam=smoothstep(0.40,0.49,max(cell.x,cell.y));
 diffuseColor.rgb*=1.0-mix(0.16,seam,1.0-smoothstep(0.05,0.35,footprint))*0.22;
 `);};
 function slab(x0,z0,x1,z1,height,mat=stone){b.box(x1-x0,height,z1-z0,mat,(x0+x1)/2,height/2,(z0+z1)/2);}
 function flight(x,z,width,run,rise,base,count,rotation=0){for(let i=0;i<count;i++){const top=base+rise*(i+1)/count,along=(i+.5)*run/count,xx=x+Math.sin(rotation)*along,zz=z-Math.cos(rotation)*along;b.box(width,top,run/count+.012,stone,xx,top/2,zz,rotation);}}
 function rail(x0,z0,x1,z1,base){const length=Math.hypot(x1-x0,z1-z0),r=Math.atan2(x1-x0,z1-z0);for(const y of [.4,1.05])b.box(.045,.055,length,iron,(x0+x1)/2,base+y,(z0+z1)/2,r);const n=Math.ceil(length/.32);for(let i=0;i<=n;i++)b.box(.035,1.1,.035,iron,x0+(x1-x0)*i/n,base+.55,z0+(z1-z0)*i/n);}
 slab(u.west,u.north,u.east,u.south,h);b.box(u.east-u.west,.08,u.south-u.north,cobble,(u.west+u.east)/2,h+.04,(u.north+u.south)/2);
 // Lower west court and its long flight up to the church terrace.
 slab(l.west,-59,l.east,l.south,l.height);b.box(l.east-l.west,.08,67,cobble,(l.west+l.east)/2,l.height+.04,-25.5);
 flight(l.east,(u.north+u.south)/2,u.south-u.north,5,h-l.height,l.height,site.westUpperSteps,Math.PI/2);
 // Municipal Unioninkatu stair footprint is roughly x -68..-66, z -43..-12
 // in world coordinates. This flight rises east, not north like the main steps.
 flight(-68.3,-30,30,4.3,l.height,0,site.westStreetSteps,Math.PI/2);
 for(const [a,z0,z1] of [[l.west,-59,-45],[l.west,-15,8]]){b.box(.45,l.height+.2,z1-z0,stone,a,(l.height+.2)/2,(z0+z1)/2);rail(a,z0,a,z1,l.height+.2);}
 // Kirkkokatu access ramp: a solid sloping surface, kept out of flat navigation.
 const ramp=new THREE.BufferGeometry(),x0=l.west,x1=l.east,z0=-73,z1=-59,y0=.16,y1=l.height;
 ramp.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z0,x0,y1,z1,x1,y0,z0,x1,y0,z0,x0,y1,z1,x1,y1,z1,x0,0,z0,x0,0,z1,x0,y1,z1,x0,0,z0,x0,y1,z1,x0,y0,z0],3));ramp.computeVertexNormals();b.add(ramp,stone);
 // Southern pavilions sit beside intermediate courts, not a full-height slab.
 slab(-54.2,5,-32,24.5,h/2);slab(34,5,56.2,24.5,h/2);
 const half=Math.floor(c.steps/2),run=(c.stairRun-site.frontLanding)/2;
 flight(1.1,24.5,c.stairWidth,run,h/2,0,half);
 slab(1.1-c.stairWidth/2,24.5-run-site.frontLanding,1.1+c.stairWidth/2,24.5-run,h/2);
 flight(1.1,24.5-run-site.frontLanding,c.stairWidth,run,h/2,h/2,c.steps-half);
 // Short upper links behind the side courts, as seen in the aerial reference.
 flight(-43.1,10,22.2,5,h/2,h/2,22);flight(45.1,10,22.2,5,h/2,h/2,22);
 // The north and east are retaining walls, not mirrored monumental stairs.
 for(const [x0,z0,x1,z1] of [[u.west,u.north,u.east,u.north],[u.east,u.north,u.east,5]]){
  const length=Math.hypot(x1-x0,z1-z0),rotation=Math.atan2(x1-x0,z1-z0);
  b.box(.62,.25,length,stone,(x0+x1)/2,h+.12,(z0+z1)/2,rotation);rail(x0,z0,x1,z1,h+.25);
  for(let y=.7;y<h;y+=.65)b.box(.015,.018,length,joints,(x0+x1)/2+(x0===x1?.015:0),y,(z0+z1)/2+(z0===z1?-.015:0),rotation);
 }
 // Crypt entrance from Kirkkokatu. The opening is a recessed visual portal;
 // its interior and exact stone profile still require a measured survey.
 const dark=new THREE.MeshStandardMaterial({color:'#283435',roughness:.72}),portal=new THREE.Shape();portal.moveTo(-1.6,0);portal.lineTo(1.6,0);portal.lineTo(1.6,2.1);portal.absarc(0,2.1,1.6,0,Math.PI,false);portal.closePath();b.add(new THREE.ShapeGeometry(portal),dark,-1,.12,u.north-.025,Math.PI);
 b.box(3.5,.14,.7,stone,-1,.16,u.north-.3);
 // Four pale globe lamps on the west entrance steps, visible in the 2022 photo.
 const lampPaint=new THREE.MeshStandardMaterial({color:'#b2bcb8',roughness:.6,metalness:.4}),globe=new THREE.MeshStandardMaterial({color:'#dce0da',roughness:.4});
 for(const z of [-43,-19])for(const x of [-41.7,-32]){const base=x<-38?l.height+.7:h;b.box(.6,.3,.6,stone,x,base+.15,z);b.cylinder(.08,.14,2.65,lampPaint,x,base+1.55,z,8);b.box(1.45,.06,.06,lampPaint,x,base+2.45,z);for(const dx of [-.67,0,.67]){b.cylinder(.045,.045,dx===0?.65:.3,lampPaint,x+dx,base+2.6,z,6);b.add(new THREE.SphereGeometry(.18,10,8),globe,x+dx,base+(dx===0?3.12:2.84),z);}}
 return site;
}
