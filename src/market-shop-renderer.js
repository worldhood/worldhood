import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createPersonBatch,personLook,advanceGait} from './person-model.js';
import {groundAt} from './terrain.js';
import {vendorSpot,counterSpot,stallFrame,STALL_KINDS,HANDOVER_SECONDS} from './market-shop.js';

// Market vendors behind each counter and the small things the player buys and carries.
// Original low-poly shapes; one stall vendor per canopy, drawn only near the player.
const mat=(color,roughness=.75)=>new THREE.MeshStandardMaterial({color,roughness});
const PAPER=mat('#f3efe4',.85),KRAFT=mat('#b98d5c',.9),SLEEVE=mat('#8f5f3a'),LID=mat('#e9e4d8',.5),SOUP=mat('#e7a55f',.55),GREEN=mat('#4f7c3a'),RIBBON=mat('#c4462f');
const SHARED_MATERIALS=new Set([PAPER,KRAFT,SLEEVE,LID,SOUP,GREEN,RIBBON]);
function part(group,geometry,material,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;}
function berries(group,color,n=11,r=.052,y=.15){const g=new THREE.SphereGeometry(color==='#2f3f7a'?.014:.02,6,5),m=mat(color,.45);
 for(let i=0;i<n;i++){const a=i*2.4,d=Math.sqrt(i/n)*r;part(group,g,m,Math.cos(a)*d,y+(1-i/n)*.025,Math.sin(a)*d);}}
// Models are built with their bottom (or grip point) at the origin.
const MODELS={
 icecream(kind,entry){
  const g=new THREE.Group(),waffle=mat('#c59152'),cream=mat(entry.color||'#fff1d2',.63);
  const cone=part(g,new THREE.ConeGeometry(.065,.18,12),waffle,0,-.005,0);cone.rotation.x=Math.PI;cone.name='Waffle cone';
  part(g,new THREE.TorusGeometry(.059,.0045,4,12),waffle,0,.077,0).rotation.x=Math.PI/2;
  if(entry.flavour==='vanilla'||kind==='soft-serve'){
   const points=Array.from({length:65},(_,i)=>{const t=i/64,a=t*Math.PI*8,r=.056*(1-t)**.7;return new THREE.Vector3(Math.cos(a)*r,.105+t*.18,Math.sin(a)*r);});
   const parts=[new THREE.SphereGeometry(.065,10,6).scale(1,.5,1).translate(0,.095,0),new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,.020,5,false)];
   const frosting=part(g,mergeGeometries(parts),cream);frosting.name='Soft-serve swirl';parts.forEach(geometry=>geometry.dispose());
  }else{const scoop=part(g,new THREE.SphereGeometry(.080,12,8),cream,0,.145,0);scoop.name=`${entry.flavour||'Ice cream'} scoop`;}
  g.userData={flavour:entry.flavour,color:entry.color,gripY:0};return g;
 },
 cup(){const g=new THREE.Group();part(g,new THREE.CylinderGeometry(.04,.03,.11,14),PAPER,0,.055,0);part(g,new THREE.CylinderGeometry(.039,.035,.045,14),SLEEVE,0,.06,0);part(g,new THREE.CylinderGeometry(.043,.041,.012,14),LID,0,.115,0);return g;},
 bag(){const g=new THREE.Group();part(g,new THREE.BoxGeometry(.11,.13,.06),KRAFT,0,.065,0);const top=part(g,new THREE.BoxGeometry(.112,.03,.02),KRAFT,0,.14,0);top.rotation.x=.2;return g;},
 cone(kind){const g=new THREE.Group(),c=part(g,new THREE.ConeGeometry(.065,.17,14,1,true),PAPER,0,.085,0);c.rotation.x=Math.PI;c.material=PAPER.clone();c.material.side=THREE.DoubleSide;berries(g,kind==='blueberries'?'#2f3f7a':'#c8242c');return g;},
 bowl(){const g=new THREE.Group();const b=part(g,new THREE.CylinderGeometry(.075,.05,.07,16,1,true),PAPER,0,.035,0);b.material=PAPER.clone();b.material.side=THREE.DoubleSide;part(g,new THREE.CylinderGeometry(.05,.05,.004,16),PAPER,0,.002,0);part(g,new THREE.CylinderGeometry(.07,.07,.006,16),SOUP,0,.058,0);part(g,new THREE.BoxGeometry(.012,.004,.13),mat('#d9d4c8'),.02,.09,0).rotation.x=.9;return g;},
 tray(){const g=new THREE.Group();part(g,new THREE.BoxGeometry(.17,.025,.11),PAPER,0,.012,0);const fish=new THREE.CapsuleGeometry(.009,.055,3,6),gold=mat('#c98b38',.6);for(let i=0;i<7;i++){const f=part(g,fish,gold,-.06+i*.02,.032,(i%2-.5)*.03);f.rotation.z=Math.PI/2;f.rotation.y=(i%3-1)*.4;}part(g,new THREE.SphereGeometry(.018,8,6),mat('#f2ead2',.4),.055,.03,.03);return g;},
 bouquet(kind){const g=new THREE.Group(),w=part(g,new THREE.ConeGeometry(.07,.3,10,1,true),KRAFT,0,.12,0);w.rotation.x=Math.PI;w.material=KRAFT.clone();w.material.side=THREE.DoubleSide;
  const heads=kind==='sunflowers'?['#f2b51c','#f2b51c','#eba615']:kind==='rose'?['#b51f36']:['#e8433f','#f28fb0','#f6d13b','#e8433f','#ffffff','#d94a8c'];
  heads.forEach((c,i)=>{const a=i*2.3,d=heads.length>1?.035:0;part(g,new THREE.CylinderGeometry(.004,.004,.12,4),GREEN,Math.cos(a)*d,.29,Math.sin(a)*d);part(g,new THREE.SphereGeometry(kind==='sunflowers'?.04:.026,8,6),mat(c,.6),Math.cos(a)*d,.35+(i%2)*.02,Math.sin(a)*d).scale.y=kind==='sunflowers'?.45:1;});
  part(g,new THREE.TorusGeometry(.03,.006,4,12),RIBBON,0,.08,0).rotation.x=Math.PI/2;return g;},
 parcel(){const g=new THREE.Group();part(g,new THREE.BoxGeometry(.16,.09,.1),KRAFT,0,.045,0);part(g,new THREE.BoxGeometry(.162,.092,.012),RIBBON,0,.045,0);part(g,new THREE.BoxGeometry(.012,.092,.102),RIBBON,0,.045,0);return g;},
};
export function heldModel(entry){const make=MODELS[entry.carry]||MODELS.bag,g=make(entry.id,entry);g.name=`Held ${entry.name}`;return g;}

// Per-item geometries, private materials and textures are owned by that model.
// Shared cup/paper materials remain available to another held item or renderer.
export function disposeHeldModel(model){
 if(!model)return;
 const geometries=new Set(),materials=new Set(),textures=new Set();
 model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!SHARED_MATERIALS.has(material))materials.add(material);o.dispose?.();});
 for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
 for(const texture of textures)texture.dispose();for(const geometry of geometries)geometry.dispose();model.removeFromParent();
}

export function createIceCreamSign(stall){
 const group=new THREE.Group(),{nx,nz}=stallFrame(stall);group.name='Pehmis ice cream sign';group.userData={stallId:stall.id,kind:'icecream'};
 group.position.set(stall.x+nx*(stall.d/2+.08),2.10+groundAt(stall.x,stall.z),stall.z+nz*(stall.d/2+.08));group.rotation.y=stall.facing||0;
 part(group,new THREE.BoxGeometry(2.48,.50,.04),mat('#548d82'),0,0,0);
 part(group,new THREE.BoxGeometry(2.38,.40,.05),mat('#fff2d8'),0,0,.012);
 // Local canvas text, with the sculpted cone still identifying the stand in
 // environments without a canvas. There are no image or font requests here.
 const canvas=globalThis.document?.createElement('canvas'),ctx=canvas?.getContext?.('2d');
 if(ctx){canvas.width=640;canvas.height=112;ctx.fillStyle='#254b40';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 46px sans-serif';ctx.fillText('PEHMIS · ICE CREAM',320,56);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  part(group,new THREE.PlaneGeometry(2.20,.385),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),0,0,.044);
 }
 const cone=heldModel(STALL_KINDS.icecream.items[0]);cone.scale.setScalar(1.75);cone.position.set(-1.54,-.10,.04);group.add(cone);return group;
}

function droppedModel(item){
 const root=new THREE.Group();root.name='Dropped ice cream';
 const cone=heldModel(item);cone.scale.setScalar(1.35);root.add(cone);
 const spill=part(root,new THREE.SphereGeometry(.095,12,6),mat(item.color||'#fff1d2',.68));spill.name='Spilled ice cream';spill.scale.set(1.8,.10,1.25);spill.visible=false;
 return {root,cone,spill};
}

export function createMarketShopRenderer(scene,stalls=[]){
 const group=new THREE.Group();group.name='Market vendors and purchases';scene.add(group);
 const vendors=stalls.map((s,i)=>{const v=vendorSpot(s);return {id:`vendor-${s.id}`,stall:s.id,talkable:true,vendor:{stallId:s.id,kind:s.kind,stall:s},x:v.x,z:v.z,heading:v.heading,home:v.heading,pose:'chat',speed:0,walking:false,
  ...personLook(9100+i*31,{accessory:null,phoneWalk:false,bagType:null,coat:0,skirt:false,outer:i%2?'puffer':'jacket',hairStyle:i%3?'beanie':'short'})};});
 const batch=createPersonBatch(Math.max(1,vendors.length),{name:'Market stall vendors',frustumCulled:true});group.add(batch.group);
 for(const stall of stalls)if(stall.kind==='icecream')group.add(createIceCreamSign(stall));
 let held=null,heldId='',dropped=null,dropId=null,dropAppearance='',time=0,disposed=false;const flying=new THREE.Vector3(),from=new THREE.Vector3();
 function setHeld(entry){if(heldId===(entry?.id||''))return;disposeHeldModel(held);held=entry?heldModel(entry):null;heldId=entry?.id||'';if(held)group.add(held);}
 function setDropped(record){
  if(!record||!record.item||record.id==null||![record.x,record.z,record.age,record.life].every(Number.isFinite)||record.age<0||record.life<=0||record.age>=record.life){disposeHeldModel(dropped?.root);dropped=null;dropId=null;dropAppearance='';return;}
  const appearance=`${record.item.id}:${record.item.carry}:${record.item.flavour||''}:${record.item.color||''}`;
  if(!dropped||dropId!==record.id||dropAppearance!==appearance){disposeHeldModel(dropped?.root);dropped=droppedModel(record.item);dropId=record.id;dropAppearance=appearance;group.add(dropped.root);}
  const t=Math.min(1,record.age/.5),heading=Number.isFinite(record.heading)?record.heading:0;
  // Match the carried grip at release, including a raised eating hand. The
  // encounter supplies a height above local ground, not a world-space Y.
  const startHeight=Number.isFinite(record.startY)?Math.max(.07,record.startY-.075):1.12;
  dropped.root.position.set(record.x,.025+groundAt(record.x,record.z),record.z);dropped.root.rotation.y=heading;
  dropped.root.scale.setScalar(Math.min(1,Math.max(0,(record.life-record.age)/.7)));
  dropped.cone.position.set(.11*t,.07+(startHeight-.07)*(1-t)**2,0);dropped.cone.rotation.set(0,t*.5,-Math.PI/2*t);
  dropped.spill.visible=t===1;dropped.spill.position.set(.26,.006,0);
 }
 return {group,vendors,
  update(dt,{viewer=null,shop=null,hand=null,visible=true,dropped:dropRecord=null}={}){
   if(disposed)return;
   time+=dt;group.visible=visible;
   setDropped(dropRecord);
   const snap=shop?.hand,open=shop?.open;
   // Vendors turn to the customer at their stall and reach out to hand things over.
   for(const v of vendors){
    const serving=(open&&open.id===v.stall)||(snap&&snap.stall===v.stall&&snap.state==='handover');
    if(!v.conversation){
     const target=serving&&viewer?Math.atan2(v.x-viewer.x,v.z-viewer.z):v.home,d=Math.atan2(Math.sin(target-v.heading),Math.cos(target-v.heading));
     v.heading+=d*Math.min(1,dt*6);v.pose=snap&&snap.stall===v.stall&&snap.state==='handover'?'browse':'chat';
    }
    advanceGait(v,v,dt);
   }
   batch.begin(viewer);for(const v of vendors)batch.draw(v,v,v,time);batch.end();
   // The bought item: from the vendor's counter into the player's hand, then carried.
   setHeld(snap?.item||null);
   if(!held)return;
   held.visible=!!hand;if(!hand)return;
   const portion=shop.portion();held.scale.setScalar(1.35*(.6+.4*portion)); // a little larger than life, so it reads at camera distance
   if(snap.state==='handover'){
    const c=counterSpot(snap.stallRef),t=Math.min(1,snap.age/HANDOVER_SECONDS),s=t*t*(3-2*t);
    from.set(c.x,c.y+groundAt(c.x,c.z),c.z);flying.set(hand.x,hand.y-.04,hand.z);
    held.position.lerpVectors(from,flying,s);held.position.y+=Math.sin(s*Math.PI)*.18;held.rotation.set(0,hand.heading,0);
    return;
   }
   held.position.set(hand.x,hand.y-.05,hand.z);held.rotation.set(0,hand.heading,0);
  },
  reset(){setHeld(null);setDropped(null);},
  dispose(){if(disposed)return;disposed=true;setHeld(null);setDropped(null);disposeHeldModel(group);},
 };
}
