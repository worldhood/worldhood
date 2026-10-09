import * as THREE from 'three';

// Code-native Škoda/Transtech Artic (HSL class 401-) body model.
// Each of the three articulated modules is emitted as one merged geometry per
// material (painted body, glazing, lit-looking interior, and emissive lamps that
// share a batch with the canvas-atlas lettering), so the renderer can instance every module and
// the whole fleet costs a fixed handful of draw calls.  Heights are local to the
// module origin (the renderer lifts modules 0.12 m to rail-head level).

export const ARTIC_PROFILE={
 halfWidth:1.2,skirt:.28,waist:1.0,waistTop:1.07,sill:1.14,windowTop:2.44,bandTop:2.5,yellowTop:2.94,gutter:2.99,fairingTop:3.45,roofTop:3.5,equipmentTop:3.68,
 floor:.4,ceiling:2.55,cabLength:1.6,cabPillar:.24,wireHeight:5.48
};
export const ARTIC_COLOURS={green:'#22603f',yellow:'#d6a63a',black:'#17181b',frame:'#22272b',silver:'#b8bcc0',fairing:'#2c2e32',trim:'#5c6166',rubber:'#1b1c1e',bogie:'#2a2d30',wheel:'#45484b',housing:'#9aa1a7',pantograph:'#3a4044'};
// Rows of the shared lettering atlas: one row per tram, split into regions
// (pixel rectangles within the row). "white" is a plain white patch that the
// unlit lamp pieces sample, so lamps and lettering share one material.
export const SIGN_REGIONS={display:{x:[0,640],y:[4,156]},line:{x:[640,760],y:[8,152]},fleet:{x:[760,920],y:[40,120]},livery:{x:[920,1220],y:[0,160]},white:{x:[1240,1280],y:[0,160]}};
export const SIGN_ATLAS={width:1280,rowHeight:160,rows:8};
export const SIGN_WHITE_UV=[1260/1280,.5];
// Display sizes in metres: front destination display, rear line display, the
// side destination display behind the first door and the line number in the
// first side window. The front display is a little taller than the real
// ~0.35 m unit so the line and destination read from the driving camera.
export const TRAM_DISPLAYS={front:[2.0,.475],rear:[.4,.46],side:[1.3,.31],sideLine:[.3,.36],fleet:[.3,.15],livery:[.54,.288]};

const P=ARTIC_PROFILE;
// A city can repaint the tram (cities/<id>/city.json → liveries.tram), e.g. Tampere's red Artics.
let C=ARTIC_COLOURS;
export function setTramLivery(overrides={}){C={...ARTIC_COLOURS,...overrides};}
const colour=hex=>new THREE.Color(hex);
const tmpA=new THREE.Vector3(),tmpB=new THREE.Vector3(),tmpN=new THREE.Vector3();

class Accumulator{
 // fixedUv: every piece samples this atlas texel unless it is pushed as atlas
 // lettering (geometry(...,true)), which keeps lamps and signs in one batch.
 constructor({uv=false,shade=false,fixedUv=null,rig=false}={}){this.p=[];this.n=[];this.c=[];this.uv=uv||fixedUv?[]:null;this.shade=shade;this.fixedUv=fixedUv;
  // rig: per-vertex person base, joint pivot and [part, rand, face, seated] so the shader can animate passengers (trams.js).
  this.rig=rig?{base:[],joint:[],info:[],cur:null,people:0}:null;}
 push(v,n,c,uv){this.p.push(v.x,v.y,v.z);this.n.push(n.x,n.y,n.z);
  // Interior pieces use unlit materials, so bake a simple key/fill split into
  // their vertex colours to keep seats, figures and panels readable as forms.
  const k=this.shade?.72+.2*Math.max(0,n.y)+.08*Math.abs(n.x)-.1*Math.max(0,-n.y):1;this.c.push(c.r*k,c.g*k,c.b*k);if(this.uv)this.uv.push(...(uv||this.fixedUv||[0,0]));
  if(this.rig){const r=this.rig,c=r.cur;r.base.push(...c.base);r.joint.push(...c.joint);r.info.push(...c.info);}}
 tri(a,b,c,col,hint){tmpA.subVectors(b,a);tmpB.subVectors(c,a);tmpN.crossVectors(tmpA,tmpB);if(tmpN.lengthSq()<1e-12)return;tmpN.normalize();
  if(hint&&tmpN.dot(hint)<0){[b,c]=[c,b];tmpN.negate();}const n=tmpN.clone();for(const v of [a,b,c])this.push(v,n,col);}
 quad(a,b,c,d,col,hint){this.tri(a,b,c,col,hint);this.tri(a,c,d,col,hint);}
 geometry(g,col,matrix,atlasUv=false){if(matrix)g.applyMatrix4(matrix);if(g.index)g=g.toNonIndexed();const pos=g.attributes.position,nor=g.attributes.normal,uv=atlasUv||!this.fixedUv?g.attributes.uv:null,v=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);n.fromBufferAttribute(nor,i);this.push(v,n,col,uv?[uv.getX(i),uv.getY(i)]:null);}g.dispose();}
 build(){if(!this.p.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));if(this.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
  if(this.rig){g.setAttribute('pBase',new THREE.Float32BufferAttribute(this.rig.base,3));g.setAttribute('pJoint',new THREE.Float32BufferAttribute(this.rig.joint,3));g.setAttribute('pInfo',new THREE.Float32BufferAttribute(this.rig.info,4));}
  g.computeBoundingSphere();return g;}
}

function rng(seed){let s=seed>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

export function buildArticModule({length,cab=null,doors=[],roofBoxes=[],pantograph=false,bellows=false,seed=1}){
 const acc={paint:new Accumulator(),glass:new Accumulator(),interior:new Accumulator({shade:true}),passengers:new Accumulator({shade:true,rig:true}),lit:new Accumulator({fixedUv:SIGN_WHITE_UV})};
 const L=length,H=P.halfWidth;
 // dir is the module end that carries a cab: -1 = front (travel direction), +1 = rear cab.
 const dir=cab==='rear'?1:-1,zAt=e=>dir*(L/2-e);
 const col={};for(const [k,v] of Object.entries(C))col[k]=colour(v);
 const box=(a,[x0,x1],[y0,y1],[z0,z1],c)=>{const g=new THREE.BoxGeometry(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0));g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);acc[a].geometry(g,typeof c==='string'?colour(c):c);};
 const boxE=(a,xs,ys,[e0,e1],c)=>box(a,xs,ys,[zAt(e0),zAt(e1)],c);
 const beam=(a,p,q,t,c,tz=t)=>{const d=new THREE.Vector3().subVectors(q,p),g=new THREE.BoxGeometry(t,d.length(),tz);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));g.translate((p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2);acc[a].geometry(g,typeof c==='string'?colour(c):c);};
 const disc=(a,x,y,z,r,c,axis='z',depth=.03)=>{const g=new THREE.CylinderGeometry(r,r,depth,14);if(axis==='z')g.rotateX(Math.PI/2);else g.rotateZ(Math.PI/2);g.translate(x,y,z);acc[a].geometry(g,colour(c));};
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);

 // ---- Cab: lofted, raked wrap-around nose -------------------------------------------------
 // Each level: height, setback of the nose centre from the module end, half width,
 // corner chamfer (x, e) and the colour of the band above that level.
 let cabLevels=null;
 if(cab){
  cabLevels=[
   {y:.22,d:.10,hw:1.1,cx:.30,cz:.40,band:'black'},
   {y:.34,d:.06,hw:1.18,cx:.32,cz:.42,band:'green'},
   {y:.45,d:.00,hw:1.2,cx:.33,cz:.43,band:'rubber'},
   {y:.66,d:.00,hw:1.2,cx:.33,cz:.43,band:'green'},
   {y:1.0,d:.10,hw:1.2,cx:.31,cz:.41,band:'yellow'},
   {y:1.07,d:.12,hw:1.2,cx:.30,cz:.40,band:'black'},
   {y:1.30,d:.17,hw:1.2,cx:.29,cz:.39,band:'glass'},
   {y:2.72,d:.70,hw:1.2,cx:.21,cz:.31,band:'black'},
   {y:2.92,d:.80,hw:1.2,cx:.19,cz:.29,band:'silver'},
   {y:3.10,d:.93,hw:1.19,cx:.18,cz:.27,band:'silver'},
   {y:3.26,d:1.08,hw:1.16,cx:.17,cz:.25,band:'silver'},
   {y:3.40,d:1.24,hw:1.12,cx:.15,cz:.22,band:'silver'},
   {y:P.roofTop,d:1.36,hw:1.08,cx:.14,cz:.2,band:null}
  ];
  // Rounded corners sampled on a quarter ellipse (five points a side) and a
  // slightly convex nose centre, so the silhouette reads as curved glass and
  // skin rather than a chamfered box.
  const CORNER=5,outline=l=>{const pts=[[-l.hw,P.cabLength]];
   for(let i=0;i<=CORNER;i++){const t=i/CORNER*Math.PI/2;pts.push([-l.hw+l.cx*(1-Math.cos(t)),l.d+l.cz*(1-Math.sin(t))+.035*Math.sin(t)]);}
   pts.push([-l.hw*.45+l.cx*.3,l.d+.014],[0,l.d]);
   const mirror=pts.slice(1).reverse().map(([x,e])=>[-x,e]);pts.push(...mirror.slice(1));pts.push([l.hw,P.cabLength]);
   return pts.map(([x,e])=>V(x,l.y,zAt(e)));};
  const rings=cabLevels.map(outline),inside=V(0,1.8,zAt(P.cabLength+2.4));
  // Face normals of every loft quad (winding chosen to face outward), then
  // per-vertex normals averaged across neighbours that are not a crease
  // (> ~50 degrees apart), so the nose shades smoothly while the
  // windscreen-to-roof break and the band edges stay crisp.
  const quadN=[],flip=[];
  for(let i=0;i<rings.length-1;i++){quadN.push([]);flip.push([]);
   for(let k=0;k<rings[i].length-1;k++){const a=rings[i][k],b=rings[i][k+1],c2=rings[i+1][k+1],d=rings[i+1][k];
    const n=new THREE.Vector3().crossVectors(tmpA.subVectors(c2,a),tmpB.subVectors(d,b));if(n.lengthSq()<1e-12)n.set(0,0,-dir);n.normalize();
    const m=V((a.x+b.x+c2.x+d.x)/4,(a.y+b.y+c2.y+d.y)/4,(a.z+b.z+c2.z+d.z)/4),f=n.dot(m.sub(inside))<0;if(f)n.negate();quadN[i].push(n);flip[i].push(f);}}
  const vertexN=(i,k,ref)=>{const n=new THREE.Vector3();for(const qi of [i-1,i])for(const qk of [k-1,k]){const q=quadN[qi]?.[qk];if(q&&q.dot(ref)>.64)n.add(q);}return n.lengthSq()?n.normalize():ref.clone();};
  for(let i=0;i<rings.length-1;i++){const band=cabLevels[i].band,target=band==='glass'?'glass':'paint',c=colour(band==='glass'?'#ffffff':C[band]);
   for(let k=0;k<rings[i].length-1;k++){const ref=quadN[i][k],a=rings[i][k],b=rings[i][k+1],c2=rings[i+1][k+1],d=rings[i+1][k];
    const na=vertexN(i,k,ref),nb=vertexN(i,k+1,ref),nc=vertexN(i+1,k+1,ref),nd=vertexN(i+1,k,ref);
    const tri=(p,q,r,np,nq,nr)=>{if(flip[i][k]){acc[target].push(p,np,c);acc[target].push(r,nr,c);acc[target].push(q,nq,c);}else{acc[target].push(p,np,c);acc[target].push(q,nq,c);acc[target].push(r,nr,c);}};
    tri(a,b,c2,na,nb,nc);tri(a,c2,d,na,nc,nd);}}
  for(const [ring,up] of [[rings[0],-1],[rings.at(-1),1]]){const m=ring.reduce((s,v)=>s.add(v),V(0,0,0)).multiplyScalar(1/ring.length);for(let k=0;k<ring.length;k++)acc.paint.tri(m,ring[k],ring[(k+1)%ring.length],colour(up>0?C.silver:C.black),V(0,up,0));}
  const surface=(y,x=0)=>{for(let i=1;i<cabLevels.length;i++)if(y<=cabLevels[i].y){const a=cabLevels[i-1],b=cabLevels[i],t=(y-a.y)/(b.y-a.y);return a.d+(b.d-a.d)*t;}return cabLevels.at(-1).d;};
  const out=(e,o=.012)=>zAt(e-o);
  // Black A-pillars behind the wrap-around glass and rear frame of the cab side window.
  for(const s of [-1,1]){const lo=cabLevels[6],hi=cabLevels[7];beam('paint',V(s*(lo.hw-.012),lo.y,out(lo.d+lo.cz)),V(s*(hi.hw-.012),hi.y,out(hi.d+hi.cz)),.07,C.black);
   beam('paint',V(s*1.195,1.07,zAt(P.cabLength-.02)),V(s*1.195,2.72,zAt(P.cabLength-.02)),.07,C.black);
   // Yellow pillar that frames the cab (a strong cue in the reference).
   boxE('paint',[s*1.182,s*1.212],[P.waist,P.yellowTop],[P.cabLength,P.cabLength+P.cabPillar],C.yellow);
   // Door-side marker lamp and small mirror housing camera stub.
   boxE('lit',[s*1.2,s*1.222],[.4,.46],[P.cabLength+.06,P.cabLength+.17],'#ff8a2a');
   boxE('paint',[s*1.2,s*1.27],[2.62,2.7],[P.cabLength+.04,P.cabLength+.2],C.yellow);disc('paint',s*1.3,2.66,zAt(P.cabLength+.12),.05,C.yellow,'x',.08);
  }
  // Headlamp clusters in the black band under the windscreen.
  const lampE=surface(1.18)-.01;
  for(const s of [-1,1]){boxE('paint',[s*.3,s*.82],[1.12,1.26],[lampE+.02,lampE-.012],C.housing);
   for(const x of [.42,.56,.70])disc('lit',s*x,1.19,zAt(lampE-.02),x===.70?.026:.036,cab==='front'?'#f3ead2':(x===.70?'#ff3a2a':'#fff1d0'),'z',.02);}
  if(cab==='rear')for(const s of [-1,1])boxE('lit',[s*.5,s*.72],[.76,.86],[.03,.075],'#d6231c');
  // Wipers parked on the lower windscreen.
  for(const s of [-1,1]){const y0=1.36,y1=2.05;beam('paint',V(s*.16,y0,zAt(surface(y0)-.03)),V(s*.75,y1,zAt(surface(y1)-.03)),.025,C.black,.012);}
  // Cab interior: console, raised platform, driver's chair (and driver on the front cab).
  boxE('interior',[-1.05,1.05],[P.floor,.72],[.5,P.cabLength+.25],'#2e3236');
  boxE('interior',[-.98,.98],[.72,1.22],[.42,.86],'#24272b');boxE('interior',[-.7,.7],[1.22,1.3],[.46,.8],'#1b1d20');
  boxE('interior',[-.1,.1],[1.28,1.4],[.62,.7],'#3a3f44');
  boxE('interior',[-.26,.26],[.72,1.02],[1.2,1.62],'#303438');boxE('interior',[-.26,.26],[1.02,1.72],[1.56,1.66],'#2a2d31');
  boxE('interior',[-1.12,1.12],[2.68,2.76],[1.0,P.cabLength+.3],'#aeb3b6');boxE('interior',[-1.12,1.12],[P.ceiling,2.76],[P.cabLength+.26,P.cabLength+.3],'#aeb3b6');
  if(cab==='front'){person(acc.interior,{x:0,y:1.02,z:zAt(1.4),face:dir,seated:true,clothes:'#1d1f22',shirt:'#e9e8e4',skin:'#d9b299',hair:'#4a3a2c',armsForward:.55});}
 }

 // ---- Body sides -------------------------------------------------------------------------
 const e0=cab?P.cabLength:0,body=[Math.min(zAt(e0),zAt(L)),Math.max(zAt(e0),zAt(L))];
 const bodyWin=cab?[Math.min(zAt(e0+P.cabPillar),zAt(L)),Math.max(zAt(e0+P.cabPillar),zAt(L))]:body;
 const doorSpans=doors.map(e=>{const z=zAt(e);return [z-.66,z+.66];});
 const cut=(range,spans)=>{let parts=[range];for(const [a,b] of spans)parts=parts.flatMap(([x,y])=>b<=x||a>=y?[[x,y]]:[[x,Math.min(a,y)],[Math.max(b,x),y]].filter(([p,q])=>q-p>.05));return parts;};
 for(const s of [-1,1]){
  const spans=s>0?doorSpans:[],x0=s*(H-.06),x1=s*H,xo=s*(H+.008);
  for(const [a,b] of cut(body,spans)){box('paint',[x0,x1],[P.skirt,P.waist],[a,b],col.green);box('paint',[x0,xo],[P.waist,P.waistTop],[a,b],col.yellow);}
  for(const [a,b] of cut(bodyWin,spans)){box('paint',[x0,x1],[P.waistTop,P.sill],[a,b],col.black);box('paint',[x0,x1],[P.windowTop,P.bandTop],[a,b],col.black);
   // One pane per side window bay, black pillars and alternating hopper transoms.
   acc.glass.quad(V(s*(H-.03),P.sill,a),V(s*(H-.03),P.sill,b),V(s*(H-.03),P.windowTop,b),V(s*(H-.03),P.windowTop,a),colour('#ffffff'),V(s,0,0));
   const n=Math.max(1,Math.round((b-a)/1.38));for(let k=0;k<=n;k++){const z=a+k*(b-a)/n,w=k===0||k===n?.07:.11;box('paint',[x0,s*(H+.004)],[P.sill,P.windowTop],[Math.max(a,z-w/2),Math.min(b,z+w/2)],col.black);
    if(k<n&&k%2===0)box('paint',[x0,s*(H+.004)],[2.08,2.13],[z,a+(k+1)*(b-a)/n],col.black);}
   // Interior wall lining under the windows.
   box('interior',[s*(H-.075),s*(H-.06)],[P.floor,P.sill],[a,b],'#7d8488');
  }
  const upper=body;box('paint',[x0,x1],[P.bandTop,P.yellowTop],upper,col.yellow);box('paint',[x0,s*(H+.012)],[P.yellowTop,P.gutter],upper,col.trim);
  // Dark roof-side equipment fairings, leaning in towards the silver roof.
  // Two facets so the roof shoulder curves in rather than breaking at one angle.
  const [za,zb]=upper,sx=s*1.155,sy=P.gutter+(P.fairingTop-P.gutter)*.58;
  acc.paint.quad(V(s*H,P.gutter,za),V(s*H,P.gutter,zb),V(sx,sy,zb),V(sx,sy,za),col.fairing,V(s,.4,0));
  acc.paint.quad(V(sx,sy,za),V(sx,sy,zb),V(s*1.08,P.fairingTop,zb),V(s*1.08,P.fairingTop,za),col.fairing,V(s,.7,0));
  for(let y=3.1;y<3.42;y+=.09){const t=(y-P.gutter)/(P.fairingTop-P.gutter),x=H-(H-1.08)*t;box('paint',[s*(x-.02),s*(x+.004)],[y,y+.018],[za+.1,zb-.1],'#3d4045');}
  // Doors: two glazed plug leaves in a black portal, on the kerb (right, +x) side.
  if(s>0)for(const [a,b] of doorSpans){const m=(a+b)/2;box('paint',[x0,x1],[P.skirt,P.bandTop],[a,a+.06],col.black);box('paint',[x0,x1],[P.skirt,P.bandTop],[b-.06,b],col.black);box('paint',[x0,x1],[2.4,P.bandTop],[a,b],col.black);
   for(const [la,lb] of [[a+.06,m-.012],[m+.012,b-.06]]){box('paint',[x0,s*(H+.004)],[P.skirt,.62],[la,lb],col.frame);box('paint',[x0,s*(H+.004)],[2.3,2.4],[la,lb],col.frame);box('paint',[x0,s*(H+.004)],[.62,2.3],[la,la+.06],col.frame);box('paint',[x0,s*(H+.004)],[.62,2.3],[lb-.06,lb],col.frame);
    acc.glass.quad(V(s*(H-.03),.62,la),V(s*(H-.03),.62,lb),V(s*(H-.03),2.3,lb),V(s*(H-.03),2.3,la),colour('#ffffff'),V(s,0,0));}
   box('paint',[x0,s*(H+.006)],[P.skirt,2.4],[m-.012,m+.012],col.rubber);box('lit',[s*H,s*(H+.012)],[1.12,1.2],[m+.08,m+.14],'#35d06b');
  }
 }
 // Roof and underframe.
 box('paint',[-1.08,1.08],[P.fairingTop,P.roofTop],cab?[Math.min(zAt(P.cabLength),zAt(L)),Math.max(zAt(P.cabLength),zAt(L))]:body,col.silver);
 box('paint',[-1.14,1.14],[P.skirt,P.floor-.04],body,col.rubber);
 for(const [a,b] of roofBoxes){boxE('paint',[-.82,.82],[P.roofTop,P.equipmentTop],[a,b],C.fairing);boxE('paint',[-.7,.7],[P.equipmentTop,P.equipmentTop+.012],[a+.1,b-.1],'#4a4e53');}
 // Articulation ends: end plates, and bellows in the gap in front of this module.
 const ends=[];if(cab!=='front')ends.push(-L/2);if(cab!=='rear')ends.push(L/2);
 for(const z of ends){const sg=Math.sign(z);box('paint',[-H,H],[P.skirt,P.roofTop],[z-sg*.05,z],col.black);box('interior',[-1.1,1.1],[P.floor,P.ceiling],[z-sg*.08,z-sg*.06],'#8a9094');box('interior',[-.62,.62],[P.floor,2.15],[z-sg*.085,z-sg*.08],'#3b4045');}
 if(bellows){const z=-L/2-.15;box('paint',[-1.12,1.12],[.42,3.3],[z-.16,z+.16],col.rubber);for(const o of [-.1,0,.1])box('paint',[-1.16,1.16],[.4,3.34],[z+o-.02,z+o+.02],'#2b2c2f');}
 // Bogie, wheels and skirts.
 const bz=zAt(cab?L*.52:L/2);box('paint',[-.82,.82],[.22,.5],[bz-1.1,bz+1.1],col.bogie);
 for(const az of [-.9,.9])for(const x of [-.52,.52])disc('paint',x,.3,bz+az,.3,C.wheel,'x',.12);
 if(pantograph)buildPantograph(acc.paint,zAt);

 // ---- Interior: floor, ceiling, lights, seats, grab poles and passengers ----------------------
 const iz=cab?[Math.min(zAt(P.cabLength+.3),zAt(L-.1)),Math.max(zAt(P.cabLength+.3),zAt(L-.1))]:[-L/2+.1,L/2-.1];
 box('interior',[-1.14,1.14],[P.floor-.04,P.floor],cab?[Math.min(zAt(.9),zAt(L-.05)),Math.max(zAt(.9),zAt(L-.05))]:[-L/2+.05,L/2-.05],'#3c4247');
 box('interior',[-1.14,1.14],[P.ceiling,P.ceiling+.04],iz,'#c3c8cb');
 for(const s of [-1,1]){box('interior',[s*1.13,s*1.14],[P.windowTop,P.ceiling],iz,'#b8bdc0');box('lit',[s*.5,s*.66],[P.ceiling-.012,P.ceiling],[iz[0]+.2,iz[1]-.2],'#fff3dc');
  box('interior',[s*.34,s*.37],[2.28,2.31],[iz[0]+.3,iz[1]-.3],'#e3b21f');}
 const r=rng(seed),clothes=['#27313f','#5b3a2e','#7c8b99','#9e2f32','#d8c6a2','#1f2a36','#3e5f3e','#c46f2a','#4b4b52','#2f4f78'],skins=['#e5bc9f','#c98f6c','#8d5a3b','#f0cdb4','#b07b58'],hairs=['#2b2118','#6b4a2e','#b58a4a','#161616','#9a9a9a','#7a2e1d'];
 const seatZones=s=>cut(iz,s>0?doorSpans.map(([a,b])=>[a-.25,b+.25]):[]);
 for(const s of [-1,1])for(const [a,b] of seatZones(s)){const count=Math.floor((b-a)/.82);
  for(let k=0;k<count;k++){const z=a+.41+k*.82+((b-a)-count*.82)/2,face=k%2?1:-1,xs=s*.68;
   box('interior',[xs-.44,xs+.44],[.44,.62],[z-.12,z+.12],'#5f666c');box('interior',[xs-.45,xs+.45],[.62,.72],[z-.23,z+.23],'#3a506c');
   box('interior',[xs-.45,xs+.45],[.72,1.38],[z-face*.23-.04,z-face*.23+.04],'#34495f');box('interior',[xs-.45,xs+.45],[1.38,1.46],[z-face*.23-.05,z-face*.23+.05],'#8d9397');
   for(const px of [xs-.22,xs+.22])if(r()<.36)person(acc.passengers,{x:px,y:.72,z:z+face*.02,face,seated:true,clothes:clothes[Math.floor(r()*clothes.length)],shirt:clothes[Math.floor(r()*clothes.length)],skin:skins[Math.floor(r()*skins.length)],hair:hairs[Math.floor(r()*hairs.length)]});
  }}
 for(let z=iz[0]+1.2;z<iz[1]-.6;z+=2.3)for(const s of [-1,1])beam('interior',V(s*.36,P.floor,z),V(s*.36,P.ceiling,z),.04,'#e3b21f');
 for(const [a,b] of doorSpans)for(const z of [a+.1,b-.1])beam('interior',V(.9,P.floor,z),V(.9,P.ceiling,z),.04,'#c9cdd0');
 const standing=1+Math.floor(r()*3);for(let k=0;k<standing;k++){const z=iz[0]+.8+r()*(iz[1]-iz[0]-1.6);person(acc.passengers,{x:(r()-.5)*.5,y:P.floor,z,face:r()<.5?1:-1,seated:false,clothes:clothes[Math.floor(r()*clothes.length)],shirt:clothes[Math.floor(r()*clothes.length)],skin:skins[Math.floor(r()*skins.length)],hair:hairs[Math.floor(r()*hairs.length)]});}

 // ---- Lettering: LED displays, line numbers, fleet numbers, HSL marks ------------------------
 // Every sign is a quad in the lamp batch that samples its region of the
 // lettering atlas. Displays sit 12 mm proud of the glass, parallel to the
 // windscreen rake, so the tinted glazing does not dim them.
 if(cab){const surface=y=>{for(let i=1;i<cabLevels.length;i++)if(y<=cabLevels[i].y){const a=cabLevels[i-1],b=cabLevels[i];return a.d+(b.d-a.d)*(y-a.y)/(b.y-a.y);}return 0;};
  const sign=(region,[w,h],matrix)=>{const r=SIGN_REGIONS[region],u0=r.x[0]/SIGN_ATLAS.width,u1=r.x[1]/SIGN_ATLAS.width,v0=1-r.y[1]/SIGN_ATLAS.rowHeight,v1=1-r.y[0]/SIGN_ATLAS.rowHeight,g=new THREE.PlaneGeometry(w,h),uv=g.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setXY(i,u0+(u1-u0)*uv.getX(i),v0+(v1-v0)*uv.getY(i));acc.lit.geometry(g,colour('#ffffff'),matrix,true);};
  const m=(x,y,z,ry,rx=0)=>new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,0,'YXZ')),V(1,1,1));
  const face=cab==='front'?Math.PI:0,rake=Math.atan2(cabLevels[7].d-cabLevels[6].d,cabLevels[7].y-cabLevels[6].y),D=TRAM_DISPLAYS;
  if(cab==='front'){
   sign('display',D.front,m(0,2.45,zAt(surface(2.45)-.012),face,-rake));
   const tilt=Math.atan2(cabLevels[8].d-cabLevels[7].d,cabLevels[8].y-cabLevels[7].y);sign('fleet',D.fleet,m(0,2.82,zAt(surface(2.82)-.008),face,-tilt));
   // Line number in the first side window on both sides; line + destination
   // display in the window behind the first door on the kerb side.
   for(const s of [-1,1]){sign('line',D.sideLine,m(s*(H+.008),2.05,zAt(P.cabLength+.54),s*Math.PI/2));sign('livery',D.livery,m(s*(H+.012),.68,zAt(P.cabLength+.52),s*Math.PI/2));}
   sign('display',D.side,m(H+.008,2.25,zAt((doors[0]||3.1)+1.3),Math.PI/2));
  }else sign('line',D.rear,m(0,2.47,zAt(surface(2.47)-.012),face,-rake));
 }
 return Object.fromEntries(Object.entries(acc).map(([k,a])=>[k,a.build()]));
}

function buildPantograph(acc,zAt){
 const c=colour(C.pantograph),V=(x,y,z)=>new THREE.Vector3(x,y,z),beam=(p,q,t)=>{const d=new THREE.Vector3().subVectors(q,p),g=new THREE.BoxGeometry(t,d.length(),t);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));g.translate((p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2);acc.geometry(g,c);};
 const box=(xs,ys,[e0,e1],cc=c)=>{const g=new THREE.BoxGeometry(xs[1]-xs[0],ys[1]-ys[0],Math.abs(zAt(e1)-zAt(e0)));g.translate((xs[0]+xs[1])/2,(ys[0]+ys[1])/2,(zAt(e0)+zAt(e1))/2);acc.geometry(g,cc);};
 const top=ARTIC_PROFILE.roofTop,head=ARTIC_PROFILE.wireHeight;
 box([-.5,.5],[top,top+.07],[2.9,4.3],colour('#2a2d31'));for(const x of [-.4,.4])for(const e of [3.05,4.15])box([x-.05,x+.05],[top+.08,top+.2],[e-.05,e+.05],colour('#c9c3b6'));
 box([-.55,.55],[top+.2,top+.28],[3.9,4.3]);
 // Single-arm: lower arm leans back to the knee, the twin upper arm reaches forward to the head.
 const base=V(0,top+.28,zAt(4.1)),knee=V(0,4.45,zAt(5.05)),hd=V(0,head-.08,zAt(3.0));beam(base,knee,.09);for(const x of [-.14,.14])beam(knee,V(x*2.4,hd.y,hd.z),.045);beam(V(0,top+.3,zAt(3.95)),V(0,4.2,zAt(4.8)),.03);
 for(const e of [2.88,3.12])box([-.62,.62],[head-.05,head],[e-.03,e+.03]);
 for(const s of [-1,1])beam(V(s*.62,head-.025,zAt(3.0)),V(s*.86,head-.2,zAt(3.0)),.035);
 box([-.36,.36],[head-.12,head-.05],[2.96,3.04]);
}

function person(acc,{x,y,z,face,seated,clothes,shirt,skin,hair,armsForward=0}){
 const b=(xs,ys,zs,c)=>{const g=new THREE.BoxGeometry(xs,ys,zs);return [g,colour(c)];},put=([g,c],px,py,pz)=>{g.translate(px,py,pz);acc.geometry(g,c);};
 const top=seated?y+.7:y+1.42,base=[x,y,z],rand=acc.rig?(++acc.rig.people*.618034)%1:0;
 // Rig parts: 0 body, 1 left arm, 2 right arm, 3 head (pivots: base, shoulders, neck).
 const part=(type,joint)=>{if(acc.rig)acc.rig.cur={base,joint,info:[type,rand,face,seated?1:0]};};
 part(0,base);
 if(seated){put(b(.34,.14,.42,clothes),x,y+.07,z+face*.14);for(const s of [-1,1])put(b(.12,.42,.12,clothes),x+s*.09,y-.18,z+face*.33);put(b(.38,.55,.24,shirt),x,y+.42,z-face*.03);}
 else{for(const s of [-1,1])put(b(.13,.82,.14,clothes),x+s*.09,y+.41,z);put(b(.38,.6,.24,shirt),x,y+1.12,z);}
 part(2,[x+.23,top-.01,z]);put(b(.1,.46,.1,shirt),x+.23,top-.24,z+face*(armsForward?.2:0));
 part(1,[x-.23,top-.01,z]);put(b(.1,.46,.1,shirt),x-.23,top-.24,z+face*(armsForward?.2:0));
 part(0,base);if(armsForward){put(b(.36,.4,.25,clothes),x,top-.27,z-face*.01);}
 part(3,[x,top,z]);put(b(.1,.08,.1,skin),x,top+.03,z);put(b(.19,.23,.21,skin),x,top+.18,z);put(b(.2,.07,.22,hair),x,top+.32,z-face*.01);
}

export function createArticModules(){
 return [
  buildArticModule({length:9.7,cab:'front',doors:[3.1,7.7],roofBoxes:[[5.2,9.4]],pantograph:true,seed:17}),
  buildArticModule({length:7.6,doors:[3.8],roofBoxes:[[2.1,5.5]],bellows:true,seed:29}),
  buildArticModule({length:9.7,cab:'rear',doors:[4.2],roofBoxes:[[2.2,6.8]],bellows:true,seed:43})
 ];
}

// Raide-Jokeri light rail (line 15): Škoda ForCity Smart Artic X54, the same family in five modules
// (34 m, cabs at both ends) in its grey and white HSL livery: white body and upper band, grey skirt,
// light grey roof fairings. Lengths match JOKERI_DIMENSIONS in tram-simulation.js.
export const JOKERI_COLOURS={green:'#646b70',yellow:'#eef0ef',silver:'#d9dddf',fairing:'#c3c8cb',trim:'#9aa0a4'};
export function createJokeriModules(){
 const saved=C;C={...ARTIC_COLOURS,...JOKERI_COLOURS};
 try{return [
  buildArticModule({length:7.9,cab:'front',doors:[2.75,6.35],roofBoxes:[[4.2,7.4]],pantograph:true,seed:51}),
  buildArticModule({length:5.5,doors:[2.75],roofBoxes:[[1.2,4.3]],bellows:true,seed:53}),
  buildArticModule({length:6.3,doors:[3.15],roofBoxes:[[1.4,4.9]],bellows:true,seed:59}),
  buildArticModule({length:5.5,doors:[2.75],roofBoxes:[[1.2,4.3]],bellows:true,seed:61}),
  buildArticModule({length:7.9,cab:'rear',doors:[2.75,6.35],roofBoxes:[[4.2,7.4]],pantograph:true,bellows:true,seed:67})
 ];}finally{C=saved;}
}

// Draw one tram's row of the lettering atlas: amber LED destination display
// (line number large at the left, destination at the right, split over two
// lines when a long name would otherwise shrink too far, as HSL displays do),
// the line-number display, the white front fleet number and the HSL livery
// marks with the yellow side fleet number. Text is drawn twice, once with a
// soft amber halo, so the LEDs keep a slight glow and thicken rather than
// thin out when the texture is minified at 30-60 m.
export const SIGN_FONTS={digit:'"Arial Black", "Helvetica Neue", Arial, sans-serif',text:'"Helvetica Neue", Arial, Helvetica, sans-serif'};
export function destinationLines(ctx,text,width,{max=92,min=64}={}){
 const t=String(text||'').trim(),font=px=>`bold ${px}px ${SIGN_FONTS.text}`,fit=(str,limit)=>{ctx.font=font(max);const w=ctx.measureText(str).width||str.length*max*.55;return Math.min(max,max*width/Math.max(w,1e-6));};
 // A long single word keeps the minimum height and is condensed by fillText's maxWidth, as LED matrices do.
 const single=fit(t,width);if(single>=min||!t.includes(' '))return {lines:[t],px:Math.max(single,min),font};
 // Split at the space closest to the middle, then size both lines to fit.
 const words=t.split(' ');let best=null;for(let k=1;k<words.length;k++){const a=words.slice(0,k).join(' '),b=words.slice(k).join(' ');const d=Math.abs(a.length-b.length);if(!best||d<best.d)best={a,b,d};}
 return {lines:[best.a,best.b],px:Math.min(66,fit(best.a,width),fit(best.b,width)),font};
}
export function drawSignRow(ctx,row,{line,destination,fleet}){
 const {rowHeight:h}=SIGN_ATLAS,y=row*h,R=SIGN_REGIONS,amber='#ffbe46',rect=(r,fill)=>{ctx.fillStyle=fill;ctx.fillRect(r.x[0],y+r.y[0],r.x[1]-r.x[0],r.y[1]-r.y[0]);};
 const glow=(text,x,yy,maxWidth)=>{ctx.fillStyle=amber;ctx.shadowColor='#ff9a1a';ctx.shadowBlur=14;ctx.fillText(text,x,yy,maxWidth);ctx.shadowBlur=0;ctx.fillText(text,x,yy,maxWidth);};
 ctx.save();ctx.clearRect(0,y,SIGN_ATLAS.width,h);ctx.textBaseline='middle';
 rect(R.white,'#ffffff');rect(R.display,'#0a0a0b');rect(R.line,'#0a0a0b');rect(R.fleet,'#0b0b0c');
 // Front/side display: line number right-aligned in a 160 px box, destination after it.
 const dy=y+(R.display.y[0]+R.display.y[1])/2,textX=R.display.x[0]+178,textW=R.display.x[1]-16-textX;
 ctx.textAlign='right';ctx.font=`900 132px ${SIGN_FONTS.digit}`;glow(String(line),R.display.x[0]+160,dy+8,150);
 const dest=destinationLines(ctx,destination,textW);ctx.textAlign='left';
 if(dest.lines.length===1){ctx.font=dest.font(dest.px);glow(dest.lines[0],textX,dy+4,textW);}
 else{ctx.font=dest.font(dest.px);glow(dest.lines[0],textX,dy-dest.px*.52,textW);glow(dest.lines[1],textX,dy+dest.px*.56,textW);}
 // Line-number display (rear window and first side window).
 ctx.textAlign='center';ctx.font=`900 126px ${SIGN_FONTS.digit}`;glow(String(line),(R.line.x[0]+R.line.x[1])/2,y+(R.line.y[0]+R.line.y[1])/2+7,110);
 ctx.fillStyle='#eef0f2';ctx.font=`bold 62px ${SIGN_FONTS.text}`;ctx.fillText(String(fleet),(R.fleet.x[0]+R.fleet.x[1])/2,y+(R.fleet.y[0]+R.fleet.y[1])/2+3,150);
 const lx=R.livery.x[0];ctx.fillStyle='#ecefee';ctx.font=`bold 36px ${SIGN_FONTS.text}`;ctx.textAlign='left';ctx.fillText('HSL',lx+84,y+36);ctx.fillText('HRT',lx+84,y+74);ctx.fillRect(lx+70,y+16,4,76);
 ctx.beginPath();ctx.arc(lx+36,y+54,18,0,Math.PI*2);ctx.lineWidth=6;ctx.strokeStyle='#ecefee';ctx.stroke();for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.fillRect(lx+36+Math.cos(a)*24-3,y+54+Math.sin(a)*24-3,7,7);}
 ctx.fillStyle='#d9ab3c';ctx.font=`bold 56px ${SIGN_FONTS.text}`;ctx.fillText(String(fleet),lx+14,y+128);
 ctx.restore();
}
