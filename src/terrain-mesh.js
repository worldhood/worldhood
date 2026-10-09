import * as THREE from 'three';
import {groundAt,waterAt,hasTerrain,terrain,footprintBase} from './terrain.js';

// Geometry that follows the ground (src/terrain.js). Flat cities skip all of this.

// Splits triangles (and line segments) until no edge is longer than maxEdge metres across the ground, so
// draped vertices can follow the terrain between them. All attributes are interpolated; material groups kept.
// With `height` (x,z → metres) a triangle is only split while the ground under it bends away from a plane by
// more than `tolerance` (or an edge is longer than 6×maxEdge): flat streets keep their few big triangles.
export function subdivideGeometry(source,maxEdge=4,{height=null,tolerance=.03}={}){
 const g=source.index?source.toNonIndexed():source,names=Object.keys(g.attributes),pos=g.attributes.position;
 const sizes=names.map(n=>g.attributes[n].itemSize),stride=sizes.reduce((a,b)=>a+b,0),line=!!source.userData?.lines;
 const read=i=>{const v=new Float32Array(stride);let o=0;names.forEach((n,k)=>{const a=g.attributes[n];for(let c=0;c<sizes[k];c++)v[o++]=a.getComponent(i,c);});return v;};
 const mid=(a,b)=>{const v=new Float32Array(stride);for(let i=0;i<stride;i++)v[i]=(a[i]+b[i])/2;return v;};
 const len=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),max2=maxEdge*maxEdge;
 const out=[],groups=[],ranges=g.groups.length?g.groups:[{start:0,count:pos.count,materialIndex:0}];
 for(const r of ranges){const start=out.length;
  if(line){for(let i=r.start;i+1<r.start+r.count;i+=2){const a=read(i),b=read(i+1),n=Math.max(1,Math.ceil(len(a,b)/maxEdge));
   for(let k=0;k<n;k++){const p=new Float32Array(stride),q=new Float32Array(stride);for(let c=0;c<stride;c++){p[c]=a[c]+(b[c]-a[c])*k/n;q[c]=a[c]+(b[c]-a[c])*(k+1)/n;}out.push(p,q);}}}
  else for(let i=r.start;i+2<r.start+r.count;i+=3){const stack=[[read(i),read(i+1),read(i+2)]];
   while(stack.length){const t=stack.pop(),e=[0,1,2].map(k=>{const a=t[k],b=t[(k+1)%3];return (a[0]-b[0])**2+(a[2]-b[2])**2;}),k=e.indexOf(Math.max(...e));
    if(e[k]<=max2||height&&e[k]<=36*max2&&flatUnder(t,height,tolerance)){out.push(...t);continue;}
    const a=t[k],b=t[(k+1)%3],c=t[(k+2)%3],m=mid(a,b);stack.push([a,m,c],[m,b,c]);}}
  groups.push({start,count:out.length-start,materialIndex:r.materialIndex??0});
 }
 const result=new THREE.BufferGeometry();let o=0;
 names.forEach((n,k)=>{const s=sizes[k],a=new Float32Array(out.length*s);for(let i=0;i<out.length;i++)for(let c=0;c<s;c++)a[i*s+c]=out[i][o+c];o+=s;result.setAttribute(n,new THREE.BufferAttribute(a,s,g.attributes[n].normalized));});
 if(g.groups.length)for(const x of groups)result.addGroup(x.start,x.count,x.materialIndex);
 if(g!==source)g.dispose();
 return result;
}

// Drapes a geometry (world-space positions) over the ground. `mark` keeps the added height in a
// `terrainY` attribute, so shaders that read layer heights from position.y can subtract it again.
export function drapeGeometry(geometry,{maxEdge=4,lift=0,water=false,mark=false,lines=false}={}){
 if(!hasTerrain())return geometry;
 if(lines)geometry.userData.lines=true;
 const surface=(x,z)=>{if(water){const w=waterAt(x,z);if(w!==null)return w;}return groundAt(x,z);};
 const g=maxEdge?subdivideGeometry(geometry,maxEdge,{height:lines?null:surface}):geometry,p=g.attributes.position,added=mark?new Float32Array(p.count):null;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=surface(x,z)+lift;p.setY(i,p.getY(i)+h);if(added)added[i]=h;}
 if(added)g.setAttribute('terrainY',new THREE.BufferAttribute(added,1));
 p.needsUpdate=true;if(g.attributes.normal&&!lines)g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();
 return g;
}

// True when the ground under a triangle is a plane through its corners (edge midpoints and centre checked).
function flatUnder(t,h,tol){
 const [a,b,c]=t,ha=h(a[0],a[2]),hb=h(b[0],b[2]),hc=h(c[0],c[2]),off=(x,z,e)=>Math.abs(h(x,z)-e)>tol;
 return !(off((a[0]+b[0])/2,(a[2]+b[2])/2,(ha+hb)/2)||off((b[0]+c[0])/2,(b[2]+c[2])/2,(hb+hc)/2)||off((c[0]+a[0])/2,(c[2]+a[2])/2,(hc+ha)/2)||off((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3,(ha+hb+hc)/3));
}
const identity=m=>{const e=m.elements;return Math.abs(e[12])<1e-6&&Math.abs(e[13])<1e-6&&Math.abs(e[14])<1e-6&&Math.abs(e[0]-1)<1e-6&&Math.abs(e[5]-1)<1e-6&&Math.abs(e[10]-1)<1e-6;};
const box=new THREE.Box3(),v=new THREE.Vector3(),m4=new THREE.Matrix4();
// Lowest ground under an object's footprint (its world bounding box sampled every 3 m).
export function groundUnder(object){
 box.setFromObject(object);if(box.isEmpty())return groundAt(object.position.x,object.position.z);
 return footprintBase([[[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]]],3);
}
// Puts a built scene on the ground: world-space meshes are subdivided and draped, instanced meshes get
// each instance lifted, and positioned objects move as a whole (by the lowest ground under them when
// marked `userData.building`/`rigid`, else by the ground at their origin). Call once after building.
export function settleObject(root,{maxEdge=4,skip=null}={}){
 if(!hasTerrain()||!root)return root;
 root.updateMatrixWorld(true);const done=new WeakSet();
 const rigid=o=>{const h=o.userData.building||o.userData.rigid?groundUnder(o):groundAt(v.setFromMatrixPosition(o.matrixWorld).x,v.z);o.position.y+=h;o.updateMatrixWorld(true);};
 const visit=o=>{
  if(skip?.(o))return;
  if(o!==root&&(o.userData.building||o.userData.rigid)){rigid(o);return;}
  if(o.isInstancedMesh){if(!identity(o.matrixWorld)){rigid(o);return;}
   for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);const e=m4.elements;e[13]+=groundAt(e[12],e[14]);o.setMatrixAt(i,m4);}
   o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere?.();o.computeBoundingBox?.();return;}
  if((o.isMesh||o.isLine||o.isPoints)&&o.geometry){
   if(!identity(o.matrixWorld)){rigid(o);return;}
   if(done.has(o.geometry))return;const old=o.geometry,lines=!!o.isLineSegments,g=drapeGeometry(old,{maxEdge:o.isPoints?0:maxEdge,lines});
   if(g!==old){old.dispose();o.geometry=g;}done.add(g);return;}
  if(o!==root&&!identity(o.matrixWorld)){rigid(o);return;}
  for(const c of [...o.children])visit(c);
 };
 visit(root);return root;
}

// The bare ground: chunked grids following the terrain half a metre below street level (as the flat
// ground plane was), with a coarse skirt out to the horizon. Normals give the hills their shading.
export function createTerrainGround(material,{cell=10,chunk=32,size=11000,depth=-.5}={}){
 const f=terrain(),group=new THREE.Group();group.name='Terrain ground';if(!f)return group;
 const E=Math.floor(f.extent/cell)*cell,n=Math.round(2*E/cell);
 const grid=(xs,zs)=>{const pos=[],nor=[],idx=[],w=xs.length;
  for(const z of zs)for(const x of xs){pos.push(x,groundAt(x,z)+depth,z);const dx=groundAt(x+1,z)-groundAt(x-1,z),dz=groundAt(x,z+1)-groundAt(x,z-1),l=Math.hypot(dx,2,dz);nor.push(-dx/l,2/l,-dz/l);}
  for(let j=0;j+1<zs.length;j++)for(let i=0;i+1<w;i++){const a=j*w+i,b=a+1,c=a+w,d=c+1;idx.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setIndex(idx);g.computeBoundingSphere();g.computeBoundingBox();return g;};
 const range=(a,b,step)=>{const out=[];for(let x=a;x<b-1e-6;x+=step)out.push(x);out.push(b);return out;};
 for(let cz=0;cz<n;cz+=chunk)for(let cx=0;cx<n;cx+=chunk){
  const xs=range(-E+cx*cell,-E+Math.min(n,cx+chunk)*cell,cell),zs=range(-E+cz*cell,-E+Math.min(n,cz+chunk)*cell,cell);
  const m=new THREE.Mesh(grid(xs,zs),material);m.receiveShadow=true;m.name='Terrain chunk';group.add(m);}
 // Skirt: four coarse strips around the fine square, clamped to the edge heights.
 const H=size/2,coarse=125,side=range(-H,-E,coarse),far=range(E,H,coarse),mid=range(-E,E,coarse);
 for(const [xs,zs] of [[[...side,...mid.slice(1),...far.slice(1)],side],[[...side,...mid.slice(1),...far.slice(1)],far],[side,mid],[far,mid]]){const m=new THREE.Mesh(grid(xs,zs),material);m.receiveShadow=true;m.name='Terrain skirt';group.add(m);}
 group.userData={cell,chunks:group.children.length};
 return group;
}

// Open water from the elevation model's `lake` layer: cells spread `spread` cells onto the shore (the
// ground hides what lies above the level, which draws the shoreline) and merged into row runs per level.
export function createLakeGeometry({spread=3,below=.05}={}){
 const f=terrain();if(!f?.lake)return null;
 const n=f.size,c=f.cell,lake=f.lake.slice();
 for(let pass=0;pass<spread;pass++){const next=lake.slice();
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;if(!Number.isNaN(lake[k]))continue;
   for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=n||jj>=n)continue;const v=lake[jj*n+ii];if(!Number.isNaN(v)){next[k]=v;break;}}}
  lake.set(next);}
 const pos=[];
 for(let j=0;j<n;j++){let i=0;while(i<n){const v=lake[j*n+i];if(Number.isNaN(v)){i++;continue;}let e=i+1;while(e<n&&Math.abs(lake[j*n+e]-v)<.005)e++;
  const x0=(i-.5)*c-f.extent,x1=(e-.5)*c-f.extent,z0=(j-.5)*c-f.extent,z1=(j+.5)*c-f.extent,y=v-below;
  pos.push(x0,y,z0,x0,y,z1,x1,y,z0,x1,y,z0,x0,y,z1,x1,y,z1);i=e;}}
 if(!pos.length)return null;
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
