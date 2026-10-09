import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SpatialIndex,bounds} from './geo.js';

// Deliberate fictional sponsorship layer. These are
// not claims that Bind has bought real advertising inventory in Helsinki.
export const BIND_BILLBOARDS=[
 {name:'Harbour Helsinki billboard',brand:'helsinki',x:112,z:724,y:13,width:24,height:10,yaw:.64,freestanding:true},
 {name:'Forum Bind screen',campaign:true,x:-759.5,z:64.8,y:16,width:18,height:20,yaw:2.2143,freestanding:false,ratu:588},
];
const footprint=(p,w,d)=>{const c=Math.cos(p.yaw),s=Math.sin(p.yaw),ring=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>[p.x+x*c+z*s,p.z-x*s+z*c]);return {name:'Advertising panel',rings:[ring],bbox:bounds([ring])};};

export function stopAdPlacements(data,stops,existing=[]){
 const road=new SpatialIndex(data.roads.filter(r=>!/Koroke/.test(r.kind))),pavement=new SpatialIndex(data.pavement.filter(p=>!/pyörä/i.test(p.kind))),blocked=new SpatialIndex([...data.buildings,...existing]),placements=[];
 // Only route stops in this first sponsorship pass. No standalone screen is
 // installed on a platform without room for it and a pedestrian clearance.
 for(const stop of stops.filter(s=>/Olympiaterminaali|Eteläranta|Kauppatori|Rautatieasema|Lasipalatsi|Ylioppilastalo/.test(s.name))){
  let best;
  for(let dx=-5;dx<=5;dx+=.5)for(let dz=-5;dz<=5;dz+=.5){
   const distance=Math.hypot(dx,dz);if(distance>5||distance<1.6||best&&distance>=best.distance)continue;
   const p={x:stop.x+dx,z:stop.z+dz,yaw:0};
   const clearance=footprint(p,2.5,1.8).rings[0];
   if(clearance.some(([x,z])=>road.at(x,z)||!pavement.at(x,z)||blocked.at(x,z)))continue;
   if(placements.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<4))continue;
   best={...p,distance,stopId:stop.id,stopName:stop.name};
  }
  if(best)placements.push(best);
 }
 return placements;
}
async function adTexture(portrait,campaign=false){
 const canvas=document.createElement('canvas');canvas.width=campaign?1800:portrait?1024:2048;canvas.height=campaign?2000:portrait?1792:1024;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
 const logo=await new THREE.ImageLoader().loadAsync('/branding/bind-logo.svg');
 // Tint the authentic transparent wordmark white; no tagline or invented mark.
 const mark=document.createElement('canvas');mark.width=1740;mark.height=660;
 const ink=mark.getContext('2d');ink.drawImage(logo,0,0,mark.width,mark.height);
 ink.globalCompositeOperation='source-in';ink.fillStyle='#ffffff';ink.fillRect(0,0,mark.width,mark.height);
 const lw=w*(campaign?.82:.92),lh=lw*33/87;ctx.drawImage(mark,(w-lw)/2,campaign?h*.53:(h-lh)/2,lw,lh);
 if(campaign){ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.font='500 165px Arial, sans-serif';ctx.fillText('The AI for',w/2,h*.26);ctx.fillText('Contracts',w/2,h*.36);}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export async function createBindAds(data,stops,existing=[]){
 const group=new THREE.Group();group.name='Fictional Bind demo sponsorship';
 const [wide,tall,campaign]=await Promise.all([adTexture(false),adTexture(true),adTexture(false,true)]);
 const frameMat=new THREE.MeshStandardMaterial({color:'#283533',roughness:.55,metalness:.5});
 // Fictional welcome sign: the city's name in plain type, not the City of Helsinki's logo (a protected mark).
 const helsinki=document.createElement('canvas');helsinki.width=2048;helsinki.height=854;const hc=helsinki.getContext('2d');hc.fillStyle='#000000';hc.fillRect(0,0,2048,854);
 hc.fillStyle='#ffffff';hc.textAlign='center';hc.textBaseline='middle';hc.font='700 360px Arial, sans-serif';hc.fillText('Helsinki',1024,440);
 const ht=new THREE.CanvasTexture(helsinki);ht.colorSpace=THREE.SRGBColorSpace;
 const screenMats=[wide,tall,ht,campaign].map(map=>new THREE.MeshBasicMaterial({map,toneMapped:false}));
 const frames=[],screens=[[],[],[],[]],obstacles=[];
 function box(w,h,d,x,y,z,yaw){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);frames.push(g);}
 function screen(p,portrait,back=false){
  const yaw=p.yaw+(back?Math.PI:0),g=new THREE.PlaneGeometry(p.width,p.height);g.rotateY(yaw);g.translate(p.x+Math.sin(yaw)*.13,p.y,p.z+Math.cos(yaw)*.13);screens[p.brand==='helsinki'?2:p.campaign?3:portrait?1:0].push(g);
 }
 for(const p of BIND_BILLBOARDS){
  box(p.width+.24,p.height+.24,.24,p.x,p.y,p.z,p.yaw);screen(p,false);
  if(p.freestanding)for(const dx of [-p.width*.32,p.width*.32]){
   const x=p.x+dx*Math.cos(p.yaw),z=p.z-dx*Math.sin(p.yaw),height=p.y-p.height/2;
   box(.25,height,.25,x,height/2,z,p.yaw);obstacles.push(footprint({x,z,yaw:p.yaw},.4,.4));
  }
 }
 const placements=stopAdPlacements(data,stops,existing);
 for(const p of placements){
  const panel={...p,y:1.55,width:1.05,height:1.78};box(1.19,1.94,.22,p.x,1.55,p.z,p.yaw);box(.17,.65,.18,p.x,.325,p.z,p.yaw);
  screen(panel,true);screen(panel,true,true);obstacles.push(footprint(p,1.2,.25));
 }
 for(const [gs,mat] of [[frames,frameMat],...screens.map((gs,i)=>[gs,screenMats[i]])])if(gs.length){const m=new THREE.Mesh(mergeGeometries(gs),mat);m.castShadow=mat===frameMat;group.add(m);gs.forEach(g=>g.dispose());}
 group.userData={fictional:true,billboards:BIND_BILLBOARDS.map(p=>p.name),stopPanels:placements.length,placements};
 return {group,obstacles};
}
