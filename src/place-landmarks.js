import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Hero landmarks of a photo-matched place, built in code on their mapped footprints
// (docs/BUILDING_LANDMARKS.md, approach B). Measured: footprint (OpenStreetMap), heights (the
// city's 3D building parts). Interpreted from current photos and written in the place's reference
// file: storey and bay rhythm, window shapes, columns, pediments, towers and every colour.
// Types: 'old-church' (cruciform timber church with a crossing dome), 'bell-tower' (staged timber
// tower with clock and spire), 'city-hall' (two-storey palace with central pavilion and clock
// turret), 'theatre' (columned hall front over a one-storey entrance wing, stage house behind).
// Each landmark is one vertex-coloured mesh plus one glass mesh: two draw calls.

const C=hex=>new THREE.Color(hex);
// ---------- Footprint frame: local X along the front, Z out of the front, Y up ----------
export function footprintFrame(ring,facing=null){
 // Dominant wall direction (edge angles folded to 0–90°, weighted by length).
 let sx=0,sy=0;for(let i=1;i<ring.length;i++){const dx=ring[i][0]-ring[i-1][0],dz=ring[i][1]-ring[i-1][1],l=Math.hypot(dx,dz),a=Math.atan2(dz,dx)*4;sx+=Math.cos(a)*l;sy+=Math.sin(a)*l;}
 const th=Math.atan2(sy,sx)/4,axes=[[Math.cos(th),Math.sin(th)],[-Math.sin(th),Math.cos(th)],[-Math.cos(th),-Math.sin(th)],[Math.sin(th),-Math.cos(th)]];
 const n=facing?axes.reduce((b,a)=>a[0]*facing[0]+a[1]*facing[1]>b[0]*facing[0]+b[1]*facing[1]?a:b):axes[1];
 const ax=[n[1],-n[0]]; // X = Y × Z keeps the frame right-handed
 const pts=ring.map(p=>[p[0]*ax[0]+p[1]*ax[1],p[0]*n[0]+p[1]*n[1]]);
 const a0=Math.min(...pts.map(p=>p[0])),a1=Math.max(...pts.map(p=>p[0])),f0=Math.min(...pts.map(p=>p[1])),f1=Math.max(...pts.map(p=>p[1]));
 const ac=(a0+a1)/2,fc=(f0+f1)/2,ox=ac*ax[0]+fc*n[0],oz=ac*ax[1]+fc*n[1];
 const matrix=new THREE.Matrix4().makeBasis(new THREE.Vector3(ax[0],0,ax[1]),new THREE.Vector3(0,1,0),new THREE.Vector3(n[0],0,n[1])).setPosition(ox,0,oz);
 return {matrix,width:a1-a0,depth:f1-f0,local:pts.map(([a,f])=>[a-ac,f-fc]),axis:ax,normal:n,origin:[ox,oz]};
}

class Kit{
 constructor(){this.solid=[];this.glass=[];}
 put(list,g,hex){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);if(!g.attributes.normal)g.computeVertexNormals();
  const c=C(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3)a.set([c.r,c.g,c.b],i);g.setAttribute('color',new THREE.BufferAttribute(a,3));list.push(g);return g;}
 box(w,h,d,x,y,z,hex){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y+h/2,z);return this.put(this.solid,g,hex);}
 pane(w,h,d,x,y,z,hex){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y+h/2,z);return this.put(this.glass,g,hex);}
 cyl(r0,r1,h,x,y,z,hex,seg=12){const g=new THREE.CylinderGeometry(r1,r0,h,seg);g.translate(x,y+h/2,z);return this.put(this.solid,g,hex);}
 // Round-headed opening on a wall facing +Z (or rotated by yaw about the opening's own centre).
 arch(w,h,x,y,z,hex,{glass=false,yaw=0,depth=.08}={}){const r=w/2,s=new THREE.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.lineTo(-r,0);
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:6});g.rotateY(yaw);g.translate(x,y,z);return this.put(glass?this.glass:this.solid,g,hex);}
 // Prism with a triangular cross-section (gable roof) running along local X or Z.
 gable(len,width,y0,rise,x,z,alongZ,roofHex,endHex){
  const s=new THREE.Shape([new THREE.Vector2(-width/2,0),new THREE.Vector2(width/2,0),new THREE.Vector2(0,rise)]);const g=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});
  g.translate(0,0,-len/2);if(!alongZ)g.rotateY(Math.PI/2);g.translate(x,y0,z);
  // Roof slopes dark, triangular end caps (the gable tympana) in the wall colour.
  const ng=g.index?g.toNonIndexed():g;ng.computeVertexNormals();const p=ng.attributes.position,n=ng.attributes.normal,c=new Float32Array(p.count*3),r=C(roofHex),e=C(endHex);
  for(let i=0;i<p.count;i++){const end=Math.abs(n.getY(i))<.05&&Math.abs(alongZ?n.getZ(i):n.getX(i))>.9,col=end?e:r;c.set([col.r,col.g,col.b],i*3);}
  ng.setAttribute('color',new THREE.BufferAttribute(c,3));for(const k of Object.keys(ng.attributes))if(!['position','normal','color'].includes(k))ng.deleteAttribute(k);this.solid.push(ng);return ng;}
 lathe(points,x,y,z,hex,seg=16){const g=new THREE.LatheGeometry(points.map(([r,h])=>new THREE.Vector2(r,h)),seg);g.translate(x,y,z);return this.put(this.solid,g,hex);}
 // Footprint walls extruded from local polygon coordinates.
 walls(local,y0,y1,hex){const s=new THREE.Shape(local.map(([a,f])=>new THREE.Vector2(a,-f)));const g=new THREE.ExtrudeGeometry(s,{depth:y1-y0,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return this.put(this.solid,g,hex);}
 build(matrix,name){
  const out=new THREE.Group();out.name=name;let triangles=0;
  for(const [list,mat] of [[this.solid,SOLID],[this.glass,GLASS]]){if(!list.length)continue;const g=mergeGeometries(list);list.forEach(x=>x.dispose());g.applyMatrix4(matrix);g.computeBoundingSphere();
   const m=new THREE.Mesh(g,mat);m.castShadow=mat===SOLID;m.receiveShadow=true;out.add(m);triangles+=g.attributes.position.count/3;}
  out.userData={triangles,drawCalls:out.children.length};return out;}
}
const SOLID=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0});
const GLASS=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.15,metalness:.35});

// Long walls of a local footprint as [{a,b,len,mid,normal}] (normal points outwards).
const inside=([x,z],r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,zi]=r[i],[xj,zj]=r[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
function edges(local){const out=[];
 for(let i=1;i<local.length;i++){const a=local[i-1],b=local[i],dx=b[0]-a[0],df=b[1]-a[1],len=Math.hypot(dx,df);if(len<.5)continue;
  const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let n=[df/len,-dx/len];if(inside([mid[0]+n[0]*.3,mid[1]+n[1]*.3],local))n=[-n[0],-n[1]];
  out.push({a,b,len,mid,dir:[dx/len,df/len],normal:n});}
 return out;}
// Place geometry built facing +Z onto a wall: rotate so +Z is the wall's outward normal.
function onWall(e,t,off=0){const yaw=Math.atan2(e.normal[0],e.normal[1]);return {x:e.a[0]+(e.b[0]-e.a[0])*t+e.normal[0]*off,z:e.a[1]+(e.b[1]-e.a[1])*t+e.normal[1]*off,yaw};}

// ---------- Old Church: cruciform timber church ----------
function oldChurch(L,spec){
 const k=new Kit(),F=footprintFrame(L.ring,null),loc=F.local,ea=spec.eaves,ri=spec.ridge,top=spec.domeTop;
 const halfU=Math.max(...loc.map(p=>Math.abs(p[0]))),halfV=Math.max(...loc.map(p=>Math.abs(p[1])));
 const armV=2*Math.max(...loc.filter(p=>Math.abs(p[0])>halfU*.75).map(p=>Math.abs(p[1]))),armU=2*Math.max(...loc.filter(p=>Math.abs(p[1])>halfV*.75).map(p=>Math.abs(p[0])));
 k.walls(loc,0,1,spec.plinth);k.walls(loc,1,ea,spec.wall);
 // Horizontal weatherboard shadow lines on the four arm ends and the long sides.
 for(const e of edges(loc)){if(e.len<2)continue;const yaw=Math.atan2(e.normal[0],e.normal[1]);
  // Arm ends covered by a photo gable (photo panels) keep only the plain wall behind the photo.
  if(spec.photoGables&&(Math.abs(e.mid[0])>halfU-.8||Math.abs(e.mid[1])>halfV-.8))continue;
  for(let y=1.3;y<ea-.3;y+=.42){const g=new THREE.BoxGeometry(e.len-.4,.035,.03);g.rotateY(yaw+Math.PI/2*0);const m=onWall(e,.5,.02);g.rotateY(0);const gg=new THREE.BoxGeometry(e.len-.4,.035,.03);gg.rotateY(yaw);gg.translate(m.x,y,m.z);k.put(k.solid,gg,'#c99f3d');g.dispose();}
  // Corner pilasters and cornice.
  for(const t of [0,1]){const m=onWall(e,t,.06);const g=new THREE.BoxGeometry(.75,ea-1,.14);g.rotateY(m.yaw);g.translate(m.x-e.dir[0]*(t?.38:-.38),1+(ea-1)/2,m.z-e.dir[1]*(t?.38:-.38));k.put(k.solid,g,spec.trim);}
  const m=onWall(e,.5,.18);const c=new THREE.BoxGeometry(e.len+.4,.45,.4);c.rotateY(m.yaw);c.translate(m.x,ea-.35,m.z);k.put(k.solid,c,spec.trim);
  const sb=new THREE.BoxGeometry(e.len,.22,.18);sb.rotateY(m.yaw);sb.translate(m.x,1.05,m.z-.0);k.put(k.solid,sb,spec.trim);
  // Tall round-headed windows (or the door on the arm ends) with white surrounds.
  const n=e.len>11?2:e.len>5?1:0;
  for(let i=0;i<n;i++){const t=(i+1)/(n+1),w=onWall(e,t,.03),isEnd=e.len<armV*1.05&&e.len>armV*.75&&n===1;
   if(isEnd&&e.len>8){k.arch(1.9,3.2,0,1,0,spec.door,{yaw:w.yaw}).translate(w.x,0,w.z);k.arch(2.5,3.6,0,.95,-.03,spec.trim,{yaw:w.yaw,depth:.06}).translate(w.x,0,w.z);
    for(let s=0;s<4;s++){const st=new THREE.BoxGeometry(2.6,.18,.35);st.rotateY(w.yaw);st.translate(w.x+e.normal[0]*(.25+s*.33),.09+(3-s)*.18*0+(.75-s*.18),w.z+e.normal[1]*(.25+s*.33));k.put(k.solid,st,'#4b4d4f');}continue;}
   k.arch(1.5,3.3,0,2.3,0,'#4a5a62',{yaw:w.yaw,glass:true}).translate(w.x,0,w.z);k.arch(1.95,3.65,0,2.15,-.03,spec.trim,{yaw:w.yaw,depth:.06}).translate(w.x,0,w.z);}
 }
 // Gable roofs over both arms; white raking cornices on each pediment.
 k.gable(armU+.6,armV+.7,ea,ri-ea,0,0,false,spec.roof,spec.wall);k.gable(armV*0+2*halfV+.6,armU+.7,ea,ri-ea,0,0,true,spec.roof,spec.wall);
 for(const [len,w,alongZ] of [[2*halfU,armV,false],[2*halfV,armU,true]])for(const s of [-1,1]){const rise=ri-ea,half=w/2+.35,slope=Math.atan2(rise,half),l=Math.hypot(rise,half);
  for(const side of [-1,1]){const g=new THREE.BoxGeometry(l,.3,.35);g.rotateZ(side*slope);g.translate(side*-half/2,ea+rise/2,0);if(!alongZ)g.rotateY(Math.PI/2);g.translate(alongZ?0:s*(len/2+.32),0,alongZ?s*(len/2+.32):0);k.put(k.solid,g,spec.trim);}
  const base=new THREE.BoxGeometry(w+.5,.3,.4);if(!alongZ)base.rotateY(Math.PI/2);base.translate(alongZ?0:s*(len/2+.3),ea+.05,alongZ?s*(len/2+.3):0);k.put(k.solid,base,spec.trim);}
 // Crossing: low octagonal drum, pale ribbed dome, small yellow lantern, black cross.
 const R=Math.min(armU,armV)*.36;k.cyl(R*1.05,R*1.05,1.3,0,ri-.6,0,spec.trim,8);
 k.lathe([[R,0],[R*.98,.5],[R*.85,1.4],[R*.6,2.2],[R*.25,2.7],[0,2.8]],0,ri+.7,0,spec.dome,16);
 const lt=ri+.7+2.7;k.cyl(.75,.75,1.1,0,lt,0,spec.wall,8);k.cyl(.85,.1,.9,0,lt+1.1,0,spec.dome,8);k.box(.12,Math.max(.6,top-(lt+2)),.12,0,lt+2,0,'#1d1f21');k.box(.7,.1,.1,0,top-.45,0,'#1d1f21');
 return k.build(F.matrix,'Old Church');
}
// ---------- Bell tower: staged timber tower with clock and spire ----------
function bellTower(L,spec){
 const k=new Kit(),F=footprintFrame(L.ring,null),s=Math.min(F.width,F.depth)*.92,H=spec.height;
 const stages=[[0,H*.34,s],[H*.34,H*.53,s*.84],[H*.53,H*.655,s*.7]];
 stages.forEach(([y0,y1,w],i)=>{k.box(w,y1-y0,w,0,y0,0,spec.wall);
  for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])k.box(.7,y1-y0,.7,x*(w/2-.3),y0,z*(w/2-.3),spec.trim);
  k.box(w+.7,.5,w+.7,0,y1-.5,0,spec.trim);if(i<2)k.box(w+.3,.25,w+.3,0,y0,0,spec.trim);
  for(let r=0;r<4;r++){const yaw=r*Math.PI/2,ox=Math.sin(yaw)*(w/2+.02),oz=Math.cos(yaw)*(w/2+.02);
   if(i===0&&r===0){k.arch(1.8,3.4,0,0,0,'#5b5a55',{yaw}).translate(ox,0,oz);k.arch(2.3,3.8,0,0,-.02,spec.trim,{yaw,depth:.05}).translate(ox,0,oz);}
   if(i===0){k.arch(1.1,2.2,0,y1-4.6,0,'#4a5a62',{yaw,glass:true}).translate(ox,0,oz);k.arch(1.45,2.45,0,y1-4.75,-.02,spec.trim,{yaw,depth:.05}).translate(ox,0,oz);}
   if(i===1){k.arch(1.6,3.6,0,y0+1.4,0,'#3f4345',{yaw}).translate(ox,0,oz);k.arch(2.1,3.9,0,y0+1.25,-.02,spec.trim,{yaw,depth:.05}).translate(ox,0,oz);for(let l=0;l<5;l++){const g=new THREE.BoxGeometry(1.4,.07,.12);g.rotateY(yaw);g.translate(ox,y0+1.8+l*.55,oz);k.put(k.solid,g,'#7a7a74');}}
   if(i===2){const cg=new THREE.CircleGeometry(1.15,20);cg.rotateY(yaw);cg.translate(ox*1.01+Math.sin(yaw)*.02,(y0+y1)/2,oz*1.01+Math.cos(yaw)*.02);k.put(k.solid,cg,spec.clock);
    const ring=new THREE.TorusGeometry(1.15,.09,4,20);ring.rotateY(yaw);ring.translate(ox+Math.sin(yaw)*.03,(y0+y1)/2,oz+Math.cos(yaw)*.03);k.put(k.solid,ring,'#2a2b2c');
    for(const [len,a] of [[.75,.6],[1,2.1]]){const h=new THREE.BoxGeometry(.08,len,.03);h.translate(0,len/2,0);h.rotateZ(a);h.rotateY(yaw);h.translate(ox+Math.sin(yaw)*.06,(y0+y1)/2,oz+Math.cos(yaw)*.06);k.put(k.solid,h,'#1b1c1d');}}}
 });
 const sy=H*.655,sr=s*.42;k.cyl(sr*1.05,sr*.98,.9,0,sy,0,spec.spire,8);k.cyl(sr,.08,H*.3,0,sy+.9,0,spec.spire,8);
 k.box(.08,H-(sy+.9+H*.3),.08,0,sy+.9+H*.3,0,'#a88a3a');k.put(k.solid,new THREE.SphereGeometry(.32,10,8).translate(0,H-1.4,0),'#c8a24a');k.box(.05,.5,.9,0,H-.7,0,'#a88a3a');
 return k.build(F.matrix,'Bell tower');
}
// ---------- City Hall: two-storey palace, central pavilion, clock turret ----------
function cityHall(L,spec){
 const k=new Kit(),F=footprintFrame(L.ring,spec.facing),loc=F.local,ea=spec.eaves,g0=6.6;
 k.walls(loc,0,g0,spec.rustic);k.walls(loc,g0,ea-1.2,spec.wall);k.walls(loc,ea-1.2,ea-.4,spec.frieze);k.walls(loc,ea-.4,ea+.4,spec.roof);
 const front=F.depth/2,W=F.width;
 for(const e of edges(loc)){if(e.len<3)continue;const m=onWall(e,.5,.12),isFront=e.normal[1]>.9&&e.mid[1]>front-1.5,photo=isFront&&spec.photoFront;
  if(!photo)for(const [y,h,d] of [[g0-.1,.4,.35],[ea-.5,.55,.6],[.0,.6,.2]]){const g=new THREE.BoxGeometry(e.len+.3,h,d);g.rotateY(m.yaw);g.translate(m.x,y,m.z);k.put(k.solid,g,spec.trim);}
  if(isFront&&!photo)for(let y=.9;y<g0-.4;y+=.55){const g=new THREE.BoxGeometry(e.len,.06,.06);g.rotateY(m.yaw);g.translate(m.x,y,m.z);k.put(k.solid,g,'#b7b0a0');}
  // Window bays: paired round-headed windows on both floors (the pavilion gets its own front).
  const bays=photo?0:Math.floor(e.len/4.6);for(let i=0;i<bays;i++){const t=(i+.5)/bays,ax=e.a[0]+(e.b[0]-e.a[0])*t;if(isFront&&Math.abs(ax)<W*.19)continue;
   for(const pair of [-.55,.55]){const p=onWall(e,t,.03),px=p.x+e.dir[0]*pair,pz=p.z+e.dir[1]*pair;
    k.arch(.85,2.5,0,1.9,0,'#56646b',{yaw:p.yaw,glass:true}).translate(px,0,pz);k.arch(1.0,2.6,0,1.85,-.02,spec.frame,{yaw:p.yaw,depth:.05}).translate(px,0,pz);
    k.arch(.85,2.9,0,g0+1.5,0,'#56646b',{yaw:p.yaw,glass:true}).translate(px,0,pz);k.arch(1.0,3.0,0,g0+1.45,-.02,spec.frame,{yaw:p.yaw,depth:.05}).translate(px,0,pz);}
   const p=onWall(e,t,.08);const hood=new THREE.BoxGeometry(2.6,.25,.25);hood.rotateY(p.yaw);hood.translate(p.x,g0+4.6,p.z);k.put(k.solid,hood,spec.ornament);
   // Pilasters between the bays on the upper floor.
   if(i<bays)for(const edge of i===0?[-.5,.5]:[.5]){const q=onWall(e,t+edge/bays,.06);const pl=new THREE.BoxGeometry(.55,ea-1.3-g0,.14);pl.rotateY(q.yaw);pl.translate(q.x,g0+(ea-1.3-g0)/2+.1,q.z);k.put(k.solid,pl,spec.trim);}}
 }
 // Central pavilion on the front: projects 1.2 m, rises to `centre`.
 const pw=spec.pavilionWidth||W*.36,pr=spec.photoFront?.3:1.2,pz=front+pr/2,C2=spec.centre,pf=spec.photoFront?front-pr/2-.06:front;k.box(pw,C2,pr,0,0,pf,spec.wall);if(!spec.photoFront){k.box(pw,g0,pr+.05,0,0,front,spec.rustic);k.box(pw+.4,.7,1.6,0,ea-.6,front,spec.trim);k.box(pw,1,1.3,0,ea-1.2,front,spec.frieze);}
 k.box(pw+.3,.6,1.6,0,C2-.6,front,spec.trim);k.box(pw*.92,C2-ea,1.0,0,ea,spec.photoFront?front-.56:front,spec.wall);
 if(!spec.photoFront){for(let i=0;i<5;i++){const x=(i-2)*pw/5.4;k.arch(1.5,4.4,x,g0+1.1,pz+.01,'#56646b',{glass:true});k.arch(1.75,4.55,x,g0+1.05,pz,spec.frame,{depth:.04});k.box(.5,5.4,.25,x+pw/10.8,g0+.6,pz,spec.trim);k.box(.6,.25,.3,x,g0+5.7,pz,spec.ornament);}}
 if(!spec.photoFront){k.box(pw*.62,.25,1.6,0,g0+.5,pz+.6,spec.trim);for(let i=0;i<22;i++)k.cyl(.07,.07,.75,-pw*.3+i*pw*.6/21,g0+.75,pz+1.3,spec.trim,6);k.box(pw*.62,.12,.25,0,g0+1.5,pz+1.3,spec.trim);}
 if(!spec.photoFront){for(let i=0;i<3;i++){const x=(i-1)*3.1;k.arch(2.2,3.9,x,0,pz+1.4,'#4b3426',{});k.arch(2.6,4.2,x,0,pz+1.36,spec.trim,{depth:.04});}}
 if(!spec.photoFront){for(const x of [-4.6,-1.55,1.55,4.6])k.cyl(.32,.3,g0,x,0,pz+1.25,spec.trim,10);k.box(pw*.66,.6,2,0,g0-.1,pz+.4,spec.trim);}
 if(!spec.photoFront){for(let s=0;s<3;s++)k.box(pw*.6,.17,.45,0,s*.17,pz+2.1+(2-s)*.45,'#9a9690');}
 if(!spec.photoFront){for(let i=0;i<9;i++)k.box(.7,.5,.08,(i-4)*pw/9.5,ea+.6,pz+.55,i%2?spec.ornament:spec.frieze);}
 k.box(pw*.85,1.5,8,0,C2,front-3.5,spec.roof);
 // Clock turret with dark dome and flagpole.
 const tz=front-1.2,ty=C2+.8;k.box(3.4,3.2,3.4,0,ty,tz,spec.trim);k.box(3.8,.35,3.8,0,ty+3.2,tz,spec.trim);
 const cg=new THREE.CircleGeometry(.85,20);cg.translate(0,ty+1.7,tz+1.72);k.put(k.solid,cg,'#f4f2ea');const ring=new THREE.TorusGeometry(.85,.07,4,20);ring.translate(0,ty+1.7,tz+1.74);k.put(k.solid,ring,'#2a2b2c');
 k.lathe([[1.75,0],[1.6,.6],[1.1,1.3],[.4,1.9],[.08,2.3]],0,ty+3.55,tz,spec.roof,8);k.cyl(.06,.04,6.5,0,ty+5.8,tz,'#e8e8e4',6);k.put(k.solid,new THREE.SphereGeometry(.18,8,6).translate(0,ty+5.9,tz),'#c8a24a');
 return k.build(F.matrix,'City Hall');
}
// ---------- Theatre: columned hall front, entrance wing, stage house ----------
function theatre(L,spec){
 const k=new Kit(),F=footprintFrame(L.ring,spec.facing),loc=F.local,W=F.width,D=F.depth,front=D/2,wing=spec.wing;
 k.walls(loc,0,wing,spec.wall);k.walls(loc,wing,wing+.5,spec.trim);
 // Hall block behind the entrance wing, stage house behind that.
 const hw=spec.hallWidth||Math.min(W*.58,34),hf=front-6.5,hd=Math.min(24,D*.42),hall=spec.hall,eave=spec.hallEave||hall-3.6;
 k.box(hw,eave,hd,0,0,hf-hd/2,spec.wall);k.box(hw+.8,.8,hd+.8,0,eave-.8,hf-hd/2,spec.trim);
 k.gable(hd,hw+.6,eave,hall-eave,0,hf-hd/2,true,spec.roof,spec.wall);
 const sw=hw*.78,sd=Math.min(18,D-hd-8),sz=hf-hd-sd/2+2;k.box(sw,spec.stage-3.5,sd,0,0,sz,spec.wall);k.box(sw+.6,.6,sd+.6,0,spec.stage-4.1,sz,spec.trim);
 k.gable(sd,sw+.4,spec.stage-3.5,3.5,0,sz,false,spec.copper,spec.wall);k.box(sw*.4,1.6,4,0,spec.stage-1.2,sz,spec.copper);
 // Pediment cornice on the hall front.
 const rise=hall-eave,half=hw/2+.3,sl=Math.atan2(rise,half),len=Math.hypot(rise,half);
 for(const side of [-1,1]){const g=new THREE.BoxGeometry(len,.45,.6);g.rotateZ(side*sl);g.translate(-side*half/2,eave+rise/2,hf+.1);k.put(k.solid,g,spec.trim);}
 // Six columns in front of tall windows, plain end bays with relief masks.
 const cy0=wing+.5,cy1=eave-1.6,bay=hw*.62/5;
 k.box(hw*.66,cy1-cy0,.3,0,cy0,hf-.2,spec.wall);k.box(hw*.7,1.3,1.6,0,cy1,hf+.2,spec.trim);
 if(!spec.photoFront){for(let i=0;i<6;i++){const x=(i-2.5)*bay;k.cyl(.55,.48,cy1-cy0,x,cy0,hf+.9,spec.column,14);k.box(1.3,.3,1.3,x,cy1-.3,hf+.9,spec.column);k.box(1.2,.3,1.2,x,cy0,hf+.9,spec.column);}}
 if(!spec.photoFront){for(let i=0;i<5;i++){const x=(i-2)*bay;k.pane(bay*.62,cy1-cy0-2.2,.06,x,cy0+.8,hf+.02,'#3b4a52');for(let r=1;r<6;r++)k.box(bay*.62,.06,.05,x,cy0+.8+r*(cy1-cy0-2.2)/6,hf+.07,spec.trim);for(const c of [-1,0,1])k.box(.06,cy1-cy0-2.2,.05,x+c*bay*.2,cy0+.8,hf+.07,spec.trim);}}
 if(!spec.photoFront){for(const s of [-1,1]){const x=s*(hw/2-hw*.09);k.box(hw*.14,.8,.25,x,cy1-2.4,hf+.05,spec.trim);k.box(1.6,2,.3,x,cy1-1.9+.3,hf+.1,'#d9cfb7');k.pane(.6,cy1-cy0-6,.05,x,cy0+2.5,hf+.02,'#3b4a52');}}
 // Entrance wing front: stone piers, five wooden double doors, gilded name band, side colonnades.
 const ef=front+.02,ew=hw*.9;if(!spec.photoFront){k.box(ew,.9,.25,0,wing-1.8,ef,'#b8a27a');k.box(ew*.8,.35,.08,0,wing-1.55,ef+.13,'#c4a24c');
 for(let i=0;i<6;i++){const x=(i-2.5)*ew/5.6;k.box(1.2,wing-1.8,.5,x,0,ef,spec.stone);}
 for(let i=0;i<5;i++){const x=(i-2)*ew/5.6;k.box(2,3.1,.12,x,0,ef-.02,spec.door);k.box(.06,3.1,.13,x,0,ef,'#3d2a1a');}
 for(const s of [-1,1]){const cx=s*(hw/2+(W-hw)/4);for(let i=0;i<4;i++)k.cyl(.28,.26,wing-1.4,cx+(i-1.5)*2.2,0,ef+.4,spec.column,10);k.box((W-hw)/2-1,.9,1.2,cx,wing-1.4,ef+.1,spec.trim);}
 for(let s=0;s<4;s++)k.box(ew*.55,.17,.45,0,s*.17,ef+.3+(3-s)*.45,'#9a9690');}
 return k.build(F.matrix,'Theatre');
}
const BUILDERS={'old-church':oldChurch,'bell-tower':bellTower,'city-hall':cityHall,'theatre':theatre};
export function createPlaceLandmarks(list,{heights={}}={}){
 const group=new THREE.Group();group.name='Place landmarks';const info={};
 for(const l of list){const b=BUILDERS[l.type];if(!b||!l.ring)continue;const m=b(l,l);m.userData.building=l.building;group.add(m);info[l.type]=m.userData;}
 group.userData=info;return {group,obstacles:[]};
}
