import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import {SpatialIndex} from './geo.js';
import {architectureBuilder} from './cathedral.js';
import {stopAdPlacements} from './bind-ads.js';
import {createBreakableSigns} from './breakable-signs.js';

// Shared Helsinki tram-stop kit: green-framed glazed shelter, green panel
// railings with silver handrails, yellow tram flag with line plates, HSL
// departure display, litter bin and (where the municipal platform polygon is
// known) a raised platform with granite kerb and tactile edge strip. Kauppatori
// reuses the same kit so every stop on the route shares one design.
export const STOP_KIT={platformBase:.10,platformTop:.36,kerb:.3,tactile:.6,ramp:2.6,shelter:{width:1.4,length:5.4},railing:{width:.18,length:1.85,pitch:1.9}};

const LASIPALATSI_SOURCE='HSL GTFS 2026-09-16 stops.txt/stop_times.txt (stop ids, platform codes 51/52, weekday lines 1, 2, 4, 10B (line 10 runs as 10B Kolmikulma–Pikku Huopalahti on the snapshot date); 289 departures 07–19 h per platform, mean gap 2.5 min) + Helsinki YLRE pavement polygons in city.pack + September 2025 street-level photography';
const LASIPALATSI_ACCURACY='Measured: platform outlines, track-side kerb lines, stop points, platform codes and line list. Interpreted: shelter, railing, flag, display and bin positions, platform height, tactile strip, departure minutes';

// heading: local +a (across) points away from the track towards the platform
// back edge, local +d (along) points rearward relative to tram travel.
export const LASIPALATSI_STOP_REFERENCES=[
 {id:'1020444',code:'H0101',platformCode:'51',name:'Lasipalatsi',swedish:'Glaspalatset',type:'tram',x:-803.35,z:-40.89,heading:.641,direction:'north',
  lines:['1','2','4','10B'],departures:[['1','Käpylä'],['2','Messukeskus'],['4','Munkkiniemi'],['10B','Pikku Huopalahti']],
  platform:{id:'YLRE_Katu_ja_viherosat_kevytliikenne_alue.57187',trackEdge:[[-820.55,-60.07],[-781.96,-8.48]],width:3.77,along:[0,64.4]},
  source:LASIPALATSI_SOURCE,accuracy:LASIPALATSI_ACCURACY},
 {id:'1020443',code:'H0102',platformCode:'52',name:'Lasipalatsi',swedish:'Glaspalatset',type:'tram',x:-796.82,z:-15.26,heading:.641+Math.PI,direction:'south',
  lines:['1','2','4','10B'],departures:[['1','Eira'],['2','Olympiaterminaali'],['4','Katajanokka'],['10B','Kolmikulma']],
  platform:{id:'YLRE_Katu_ja_viherosat_kevytliikenne_alue.57186',trackEdge:[[-824.54,-56.04],[-786.35,-5.2]],width:4.4,along:[-4,64.4]},
  source:LASIPALATSI_SOURCE,accuracy:LASIPALATSI_ACCURACY},
];
export const LASIPALATSI_STOP_REFERENCE=LASIPALATSI_STOP_REFERENCES[0];

// Measured platform frame: along the track-side kerb from its first vertex,
// across towards the platform interior (same sense as the reference's +a).
export function platformFrame(platform,heading){
 const [A,B]=platform.trackEdge,dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,c=Math.cos(heading),s=Math.sin(heading);
 let nx=uz,nz=-ux;if(nx*c-nz*s<0){nx=-nx;nz=-nz;}
 return {A,L,ux,uz,nx,nz,yaw:Math.atan2(ux,uz),along:(x,z)=>(x-A[0])*ux+(z-A[1])*uz,across:(x,z)=>(x-A[0])*nx+(z-A[1])*nz,point:(along,across)=>[A[0]+ux*along+nx*across,A[1]+uz*along+nz*across]};
}

export function lasipalatsiStopPlacement(city,existing=[],reference=LASIPALATSI_STOP_REFERENCE){
 const p=reference,c=Math.cos(p.heading),s=Math.sin(p.heading),K=STOP_KIT,pavement=new SpatialIndex(city.pavement.filter(p=>!/pyör|Portaat/i.test(p.kind))),blocked=new SpatialIndex([...city.roads,...city.buildings,...city.water,...city.pavement.filter(p=>/pyör/i.test(p.kind)),...existing]);
 const safe=(x,z,w,d)=>{
  const nx=Math.ceil(w/.2),nz=Math.ceil(d/.25);
  for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
   const a=-w/2+w*ix/nx,b=-d/2+d*iz/nz;
   const px=x+c*a+s*b,pz=z-s*a+c*b;if(!pavement.at(px,pz)||blocked.at(px,pz)||Math.hypot(px+807.267,pz+46.595)<.5)return false;
  }return true;
 };
 const frame=p.platform?platformFrame(p.platform,p.heading):null;
 // Shelter target: the GTFS stop point itself, or on a measured platform 7 m
 // behind the halted tram's nose and against the back edge (interpreted).
 const target=frame?{x:p.x+s*7+c*(p.platform.width-K.shelter.width/2-.35-frame.across(p.x,p.z)),z:p.z+c*7-s*(p.platform.width-K.shelter.width/2-.35-frame.across(p.x,p.z))}:{x:p.x,z:p.z};
 let shelter;
 for(let dx=-7;dx<=7;dx+=.25)for(let dz=-7;dz<=7;dz+=.25){const score=dx*dx+dz*dz;if(score>49||shelter&&score>=shelter.score)continue;const x=target.x+dx,z=target.z+dz;if(safe(x,z,K.shelter.width,K.shelter.length))shelter={x,z,score};}
 const railings=[];
 if(shelter&&frame){
  // Runs along the back edge of the measured platform around the shelter,
  // leaving the boarding/pedestrian gaps beside the shelter open.
  const back=p.platform.width-.45,centre=frame.along(shelter.x,shelter.z),[a0,a1]=p.platform.along;
  for(let i=-7;i<=7;i++){if(Math.abs(i)<2)continue;const along=centre+i*K.railing.pitch;if(along<a0+2||along>a1-2)continue;const [x,z]=frame.point(along,back);if(safe(x,z,K.railing.width,K.railing.length))railings.push({x,z});}
 }else if(shelter)for(let i=-6;i<=6;i++){
  if(Math.abs(i)<2)continue; // boarding access / pedestrian gap beside shelter.
  const along=i*K.railing.pitch,x=shelter.x+c*.65+s*along,z=shelter.z-s*.65+c*along;
  if(safe(x,z,K.railing.width,K.railing.length))railings.push({x,z});
 }
 const pole=frame&&safe(p.x,p.z,.16,.16)?{x:p.x,z:p.z}:shelter?{x:shelter.x+c*.05+s*-1.2,z:shelter.z-s*.05+c*-1.2}:null;
 const bin=shelter&&(()=>{const x=shelter.x+c*.35+s*3.35,z=shelter.z-s*.35+c*3.35;return safe(x,z,.5,.5)?{x,z}:null;})();
 const display=shelter&&p.departures&&(()=>{const x=shelter.x+c*.3+s*-3.5,z=shelter.z-s*.3+c*-3.5;return safe(x,z,.3,.3)?{x,z}:null;})();
 return {shelter,railings,pole,bin,display,frame,safe};
}

function canvasTexture(width,height,draw){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return null;draw(ctx);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
// Yellow Helsinki tram-stop flag: tram pictogram, bilingual name, line plates
// and the HSL stop code. Procedural lettering only, no photo pixels.
function flagTexture(p){
 return canvasTexture(512,704,ctx=>{
  ctx.fillStyle='#f3c623';ctx.fillRect(0,0,512,704);ctx.fillStyle='#1d1d1b';
  ctx.beginPath();ctx.roundRect(126,54,260,150,26);ctx.fill();ctx.fillStyle='#f3c623';for(let i=0;i<3;i++)ctx.fillRect(150+i*78,80,60,54);ctx.fillRect(248,20,16,36);ctx.fillRect(200,16,112,10);
  ctx.fillStyle='#1d1d1b';for(const x of [176,336])ctx.fillRect(x,204,30,22);
  ctx.textAlign='center';ctx.font='bold 54px Arial, Helvetica, sans-serif';ctx.fillText(p.name,256,300);ctx.font='40px Arial, Helvetica, sans-serif';ctx.fillText(p.swedish||'',256,352);
  if(p.lines){ctx.fillStyle='#ffffff';ctx.fillRect(28,392,456,118);ctx.fillStyle='#1d1d1b';ctx.font='bold 78px Arial, Helvetica, sans-serif';const w=456/p.lines.length;p.lines.forEach((l,i)=>ctx.fillText(l,28+w*(i+.5),478,w-10));}
  ctx.fillStyle='#1d1d1b';ctx.font='bold 44px Arial, Helvetica, sans-serif';ctx.fillText(p.code||'',256,600);if(p.platformCode){ctx.font='30px Arial, Helvetica, sans-serif';ctx.fillText(`Laituri ${p.platformCode}`,256,652);}
 });
}
// HSL real-time departure display; the minute values are illustrative.
function displayTexture(p){
 return canvasTexture(768,384,ctx=>{
  ctx.fillStyle='#0d1012';ctx.fillRect(0,0,768,384);ctx.fillStyle='#ffb23d';ctx.shadowColor='#ff9a1a';ctx.shadowBlur=5;ctx.textBaseline='middle';
  ctx.font='bold 40px Arial, Helvetica, sans-serif';ctx.textAlign='left';ctx.fillText(`${p.name}  ${p.code||''}`,28,44);ctx.textAlign='right';ctx.fillText('min',740,44);
  p.departures.slice(0,4).forEach(([line,destination],i)=>{const y=118+i*68;ctx.font='bold 54px Arial, Helvetica, sans-serif';ctx.textAlign='left';ctx.fillText(line,28,y);ctx.font='48px Arial, Helvetica, sans-serif';ctx.fillText(destination,130,y,480);ctx.textAlign='right';ctx.fillText(String([2,5,7,11][i]),740,y);});
 });
}
function tactileTexture(){
 const t=canvasTexture(64,64,ctx=>{ctx.fillStyle='#e6e3da';ctx.fillRect(0,0,64,64);ctx.fillStyle='#c3bfb4';for(let i=0;i<6;i++)for(let j=0;j<6;j++){ctx.beginPath();ctx.arc(5+i*10.6,5+j*10.6,3,0,Math.PI*2);ctx.fill();}});
 if(t){t.wrapS=t.wrapT=THREE.RepeatWrapping;}return t;
}

export function createLasipalatsiStop(city,existing=[],reference=LASIPALATSI_STOP_REFERENCE,{signs:sharedSigns=null}={}){
 const placement=lasipalatsiStopPlacement(city,existing,reference),group=new THREE.Group();group.name=`${reference.name} ${reference.code||reference.id} tram stop (shared Helsinki stop kit)`;
 if(!placement.shelter){group.userData={...reference,placed:false,reason:'No full safe platform footprint'};return {group,obstacles:[],...placement};}
 const p=reference,K=STOP_KIT,{x,z}=placement.shelter,c=Math.cos(p.heading),s=Math.sin(p.heading),b=architectureBuilder();
 const mat=(color,roughness=.7)=>new THREE.MeshStandardMaterial({color,roughness}),green=mat('#28594b'),silver=mat('#a4aaa6',.45),wood=mat('#8b8775'),yellow=mat('#e1bb43'),dark=mat('#2a2d2c',.5),concrete=mat('#9d9e98',.85),granite=mat('#b9b7ae',.6),glass=new THREE.MeshStandardMaterial({color:'#a7c5c4',transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide,roughness:.25});
 const point=(a,y,d,origin={x,z})=>[origin.x+c*a+s*d,y,origin.z-s*a+c*d];
 const box=(a,y,d,w,h,l,m,origin)=>b.box(w,h,l,m,...point(a,y,d,origin),p.heading);
 const top=placement.frame?K.platformTop:0,lift=top; // furniture stands on the raised platform when one is modelled
 box(0,lift+2.76,0,1.4,.12,5.4,green);
 for(const a of [-.62,.62])for(const d of [-2.58,0,2.58])box(a,lift+1.45,d,.065,2.5,.065,green);
 // Rear (carriageway-facing) wall, glazed ends and platform-facing boarding opening.
 box(.62,lift+1.5,0,.025,2.25,5.1,glass);for(const d of [-2.58,2.58])box(0,lift+1.5,d,1.24,2.25,.025,glass);
 box(.26,lift+.61,0,.45,.12,3.5,wood);for(const d of [-1.45,1.45])box(.26,lift+.36,d,.075,.4,.1,green);
 // Glazed information case; timetable lettering omitted (no legible reference).
 box(.57,lift+1.62,1.4,.08,.80,.59,silver);box(.515,lift+1.62,1.4,.018,.71,.50,wood);
 for(let i=0;i<8;i++)box(.502,lift+1.91-i*.075,1.4,.012,.012,.39,green);
 for(const r of placement.railings){for(const a of [-.86,.86])box(0,lift+.71,a,.055,1.16,.055,green,r);box(0,lift+1.22,0,.06,.055,1.81,silver,r);box(0,lift+.65,0,.035,.87,1.73,green,r);}
 const signs=[];
 // The flag pole is a light single post: it bends or snaps when hit (breakable-signs.js). Stops built
 // together share one sign set (one batch per material); a standalone stop finishes its own.
 const poleSigns=sharedSigns||(placement.pole?createBreakableSigns(`${p.name} stop pole`):null);
 if(placement.pole){const o=placement.pole,i=poleSigns.post({id:`${p.id}-pole`,x:o.x,z:o.z,y:lift,yaw:p.heading+Math.PI/2,height:3.76,radius:.05});
  const part=(a,y,w,h,l,m)=>{const g=new THREE.BoxGeometry(w,h,l);g.rotateY(p.heading);g.translate(...point(a,y,0,o));poleSigns.add(g,m,i);};
  part(0,lift+1.6,.08,3.2,.08,green);part(0,lift+3.52,.06,.48,.7,yellow);
  const t=flagTexture(p);if(t)for(const side of [1,-1]){const sign=new THREE.Mesh(new THREE.PlaneGeometry(.52,.715),new THREE.MeshBasicMaterial({map:t}));sign.position.set(...point(side*.045,lift+2.75,0,o));sign.rotation.y=p.heading+side*Math.PI/2;signs.push(sign);poleSigns.attach(sign,i);}}
 if(poleSigns&&!sharedSigns){signs.push(poleSigns.finish());group.breakable=poleSigns;}
 if(placement.display){const o=placement.display;box(0,lift+1.5,0,.1,3,.1,dark,o);box(0,lift+2.75,0,.14,.52,1.0,dark,o);
  const t=displayTexture(p);if(t)for(const side of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(.94,.47),new THREE.MeshBasicMaterial({map:t,toneMapped:false}));face.position.set(...point(side*.075,lift+2.75,0,o));face.rotation.y=p.heading+(side>0?Math.PI/2:-Math.PI/2);signs.push(face);}}
 if(placement.bin){const o=placement.bin;b.cylinder(.22,.2,.9,green,...point(0,lift+.45,0,o),16);b.cylinder(.24,.24,.06,dark,...point(0,lift+.93,0,o),16);}
 const obstacles=[],footprint=(origin,w,d,name=`${p.name} tram platform furniture`)=>({name,rings:[[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[origin.x+c*a+s*b,origin.z-s*a+c*b])]});
 obstacles.push(footprint({x,z},K.shelter.width,K.shelter.length),...placement.railings.map(r=>footprint(r,K.railing.width,K.railing.length)));
 // Pole footprint is placement-only (`breakable`): main.js keeps it out of car collision.
 if(placement.pole)obstacles.push({...footprint(placement.pole,.16,.16),breakable:true});if(placement.display)obstacles.push(footprint(placement.display,.3,.3));if(placement.bin)obstacles.push(footprint(placement.bin,.5,.5));
 let platform=null;
 if(placement.frame){
  const f=placement.frame,poly=city.pavement.find(q=>q.id===p.platform.id),[a0,a1]=p.platform.along;
  if(poly){
   const clip=[f.point(a0-.05,-.5),f.point(a1+.05,-.5),f.point(a1+.05,p.platform.width+1.5),f.point(a0-.05,p.platform.width+1.5)];
   const ring=polygonClipping.intersection([poly.rings[0]],[clip])[0]?.[0];
   if(ring&&ring.length>3){
    const shape=new THREE.Shape(ring.map(([qx,qz])=>new THREE.Vector2(qx,-qz)));
    const slab=new THREE.ExtrudeGeometry(shape,{depth:K.platformTop-K.platformBase,bevelEnabled:false});slab.rotateX(-Math.PI/2);slab.translate(0,K.platformBase,0);b.add(slab,concrete);
    // Granite kerb and tactile warning strip along the track-side edge; ramps at both ends.
    const len=a1-a0-.4,mid=(a0+a1)/2,[kx,kz]=f.point(mid,K.kerb/2),[tx,tz]=f.point(mid,K.kerb+K.tactile/2);
    b.box(K.kerb,.012,len,granite,kx,K.platformTop+.006,kz,f.yaw);
    const tactile=tactileTexture();if(tactile){tactile.repeat.set(1,len/K.tactile);const strip=new THREE.Mesh(new THREE.PlaneGeometry(K.tactile,len),new THREE.MeshStandardMaterial({map:tactile,roughness:.9}));strip.geometry.rotateX(-Math.PI/2);strip.geometry.rotateY(f.yaw);strip.position.set(tx,K.platformTop+.014,tz);strip.receiveShadow=true;signs.push(strip);}
    for(const [end,sign] of [[a1,1],[a0,-1]]){const g=new THREE.BoxGeometry(p.platform.width-.1,.05,K.ramp);g.rotateX(Math.atan2(K.platformTop-.12,K.ramp));g.rotateY(f.yaw+(sign>0?0:Math.PI));const [rx,rz]=f.point(end+sign*K.ramp/2,p.platform.width/2);g.translate(rx,(K.platformTop+.12)/2,rz);b.add(g,concrete);}
    // Keep the car off the platform: the whole measured outline blocks, except
    // a bay for the fictional Bind stop panel so that it still fits where
    // bind-ads.js would otherwise place it.
    const rings=[ring.map(q=>[q[0],q[1]])];
    const [ad]=stopAdPlacements(city,[{id:p.id,name:p.name,x:p.x,z:p.z}],[...existing,...obstacles]);
    if(ad){const w=1.55,d=1.2;rings.push([[ad.x-w,ad.z-d],[ad.x+w,ad.z-d],[ad.x+w,ad.z+d],[ad.x-w,ad.z+d]]);}
    obstacles.push({name:`${p.name} ${p.code} tram platform`,rings});
    platform={id:p.platform.id,vertices:ring.length,length:+(a1-a0).toFixed(1),width:p.platform.width,adBay:!!ad};
   }
  }
 }
 group.add(b.finish(),...signs);
 group.userData={...p,placed:true,railings:placement.railings.length,shelter:{x,z},pole:placement.pole,display:!!placement.display,bin:!!placement.bin,platform};
 return {group,obstacles,...placement};
}

// Both Lasipalatsi platforms between Lasipalatsi and Sokos on Mannerheimintie.
export function createLasipalatsiStops(city,existing=[]){
 const group=new THREE.Group();group.name='Lasipalatsi tram stops H0101 / H0102';
 const obstacles=[],stops=[],signs=createBreakableSigns('Lasipalatsi stop poles');
 for(const reference of LASIPALATSI_STOP_REFERENCES){
  const stop=createLasipalatsiStop(city,[...existing,...obstacles],reference,{signs});
  group.add(stop.group);obstacles.push(...stop.obstacles);stops.push(stop);
 }
 group.add(signs.finish());group.breakable=signs;
 group.userData={placed:stops.filter(s=>s.shelter).length,stops:stops.map(s=>s.group.userData)};
 return {group,obstacles,stops};
}
