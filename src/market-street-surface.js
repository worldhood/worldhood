import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Shared procedural granite setts (nupukivi) for the Kauppatori/Pohjoisranta
// carriageways. Guided by 2024 reference photography at the
// Kauppatori/Pohjoisranta corner; no photo pixels are sampled or shipped.
// Read from that photo: mean sRGB ~(116,108,101) warm grey-brown; elongated
// stones (~1.4:1) in irregular running bond; dark sandy joints; per-stone
// grey / brown / rose / dark variation; rounded, worn tops.
// INTERPRETED (not surveyed): stone size ~0.15 x 0.11 m and the row direction
// (straight rows along the city grid). Local fan/arc patches are NOT modelled:
// their positions are unsurveyed, and a global arc read as waves at distance.
//
// graniteSetts(xz,fp,scale,gloss) returns a colour multiplier with mean ~.955, so
// each caller keeps its own mapped base colour. fp = world metres per pixel along
// x and z, taken by the caller in uniform control flow. Stone ends, then row joints,
// fade to the mean before they reach pixel size, so nothing sparkles in motion.
export const GRANITE_SETTS_GLSL=`
// Sine-free hash (Hoskins): stays well distributed at city-scale stone indices.
float settHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float settEdge(float k,float row){return k+(settHash(vec2(k,row))-.5)*.46;}
vec3 graniteSetts(vec2 xz,vec2 fp,float scale,out float gloss){
 xz/=scale;fp/=scale;
 xz=vec2(xz.x*.998-xz.y*.052,xz.x*.052+xz.y*.998);
 vec2 p=xz;
 const float rowH=.112,len=.152;
 float row=floor(p.y/rowH),fy=fract(p.y/rowH);
 float sx=p.x/len+settHash(vec2(row,3.7))*17.;
 float cx=floor(sx);
 float k=cx-step(sx,settEdge(cx,row))+step(settEdge(cx+1.,row),sx);
 float ex=min(sx-settEdge(k,row),settEdge(k+1.,row)-sx)*len,ey=min(fy,1.-fy)*rowH;
 float h=settHash(vec2(k,row)),h2=settHash(vec2(row,k)+.5);
 // grey, warm brown, rose and dark stones, as in the reference crop
 vec3 tint=(h<.34?vec3(.97,.96,.98):h<.64?vec3(1.07,.98,.90):h<.86?vec3(1.10,.95,.93):vec3(.76,.76,.78))*(.78+h2*.44);
 // Rounded-rectangle distance: worn setts have rounded corners and domed tops.
 float jw=.006+.004*h2,r=.028,e=r-length(max(vec2(r)-vec2(ex,ey),0.));
 float dome=smoothstep(0.,.05,e),fm=max(fp.x,fp.y);
 // Anisotropic filtering: each joint family fades with its own screen
 // frequency, so rows stay legible down the street without shimmering.
 float jy=1.-smoothstep(jw-fp.y*.5,jw+fp.y*.5+.004,ey);
 float xD=1.-smoothstep(.016,.048,fp.x),yD=1.-smoothstep(.02,.05,fp.y);
 // Row level: row joints and per-row tone (the banding seen down a street).
 float rowLevel=mix(1.,mix(1.,.14,jy)*1.18*(.92+.16*settHash(vec2(row,9.1))),yD);
 // Stone level: per-stone colour, rounded tops, end joints. Means normalised to 1.
 float joint=1.-smoothstep(jw-fm*.5,jw+fm*.5+.004,e);
 vec3 stone=mix(tint*mix(.5,1.,dome),vec3(.14),joint)*1.96;
 gloss=dome*xD*yD*(.35+.65*h2);
 return .955*mix(vec3(rowLevel),stone,xD*yD);
}
`;

// Original procedural materials on surveyed polygons, not photo pixels.
export function createMarketStreetSurface(data){
 const group=new THREE.Group();group.name='Pohjoisesplanadi granite carriageway';
 const roads=data.roads.filter(p=>p.name==='Pohjoisesplanadi'&&p.kind==='Ajorata'&&/Nupu|Noppa/.test(p.material));
 const geometries=roads.map(p=>{
  const shape=new THREE.Shape(p.rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const r of p.rings.slice(1))shape.holes.push(new THREE.Path(r.map(([x,z])=>new THREE.Vector2(x,-z))));
  const geometry=new THREE.ShapeGeometry(shape).toNonIndexed();geometry.rotateX(-Math.PI/2);geometry.translate(0,.087,0);return geometry;
 });
 // Base tone tuned so the rendered mean matches the photo's warm grey-brown.
 const material=new THREE.MeshStandardMaterial({color:SETT_BASE,roughness:.9});
 addGraniteSetts(material,'market-street-granite-v2');
 if(geometries.length){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 group.userData={sourceRoadIds:roads.map(p=>p.id),surfaceHeight:.087,reference:'2024 reference photography; municipal road rings; photo-guided sett tone/shape, stone size and row arcs interpreted'};
 return group;
}
export const SETT_BASE='#858483';
// Patch a world-space (mesh at origin) standard material with the sett pattern.
export function addGraniteSetts(material,key,scale=1){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 vStreetStone;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStreetStone=(modelMatrix*vec4(position,1.)).xz;');
  shader.fragmentShader='varying vec2 vStreetStone;\n'+GRANITE_SETTS_GLSL+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 settFp=vec2(length(vec2(dFdx(vStreetStone.x),dFdy(vStreetStone.x))),length(vec2(dFdx(vStreetStone.y),dFdy(vStreetStone.y))));
   float settGloss;
   diffuseColor.rgb*=graniteSetts(vStreetStone,settFp,${scale.toFixed(3)},settGloss);
  `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor*=1.-settGloss*.3;');
 };
 material.customProgramCacheKey=()=>key;
 return material;
}
