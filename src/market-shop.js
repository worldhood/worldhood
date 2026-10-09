// Buying a little something at a market stall, on foot. Pure game logic, shared by
// every city: stalls come from the city's own data ({x,z,w,d,facing?,kind?}); a city
// without market stalls simply never shows the prompt. Prices are in euro cents.
// The menu is ordinary market-square fare, not any particular vendor's list.

export const WALLET_START=4000;
export const SHOP_REACH=2.5; // metres from the stall front
export const HANDOVER_SECONDS=.9;
export const EAT_SECONDS=2.6;
export const CARRY_SECONDS=45; // food is finished, keepsakes tucked away, after this long in hand

const item=(id,name,price,carry,use,toast,done,note='',extra={})=>Object.freeze({id,name,price,carry,use,toast,done,note,...extra});
// carry: the held model (cup, bag, cone, icecream, bouquet, bowl, tray, parcel); use: eat, drink or keep.
export const STALL_KINDS=Object.freeze({
 soup:Object.freeze({id:'soup',name:'Soup & muikku tent',local:'Lohikeitto · muikut',canopy:'orange',items:Object.freeze([
  item('salmon-soup','Salmon soup',1400,'bowl','eat','Salmon soup, €14. Creamy and hot.','Every last spoonful. Lovely.','Lohikeitto with dill and rye bread'),
  item('vendace','Fried vendace',1300,'tray','eat','Fried vendace, €13. Crispy little fish.','Muikut gone, garlic mayo and all.','Muikut with garlic mayonnaise'),
  item('coffee','Coffee',350,'cup','drink','Coffee, €3.50. Just what you needed.','Coffee finished. Ready for anything.','Filter coffee, a refill-sized cup'),
  item('munkki','Munkki doughnut',300,'bag','eat','Munkki, €3. Still warm.','Sugar on your fingers. Worth it.','Cardamom doughnut rolled in sugar'),
 ])}),
 cafe:Object.freeze({id:'cafe',name:'Market café',local:'Kahvila',canopy:'orange',items:Object.freeze([
  item('coffee','Coffee',350,'cup','drink','Coffee, €3.50. Just what you needed.','Coffee finished. Ready for anything.','Filter coffee, a refill-sized cup'),
  item('munkki','Munkki doughnut',300,'bag','eat','Munkki, €3. Still warm.','Sugar on your fingers. Worth it.','Cardamom doughnut rolled in sugar'),
  item('korvapuusti','Cinnamon bun',400,'bag','eat','Korvapuusti, €4. Smells of cardamom.','Cinnamon bun, gone in four bites.','Korvapuusti, the slapped-ear bun'),
  item('meat-pie','Meat pie',450,'bag','eat','Lihapiirakka, €4.50. A proper snack.','That hit the spot.','Lihapiirakka, fried and filling'),
 ])}),
 berries:Object.freeze({id:'berries',name:'Berries & peas',local:'Marjat · herneet',canopy:'canvas',items:Object.freeze([
  item('strawberries','Strawberries',500,'cone','eat','Strawberries, €5. Mm.','The last strawberry was the best one.','Finnish strawberries, a paper cone'),
  item('blueberries','Blueberries',600,'cone','eat','Blueberries, €6. Blue fingers incoming.','Blueberries gone. Blue smile.','Wild blueberries from the forest'),
  item('peas','Peas in the pod',400,'bag','eat','Peas in the pod, €4. Pop, pop.','Every pod popped.','Sweet fresh peas, eaten raw'),
 ])}),
 flowers:Object.freeze({id:'flowers',name:'Flower stall',local:'Kukat',canopy:'canvas',items:Object.freeze([
  item('tulips','Bunch of tulips',1200,'bouquet','keep','Tulips, €12. Someone will be happy.','Flowers tucked safely under your arm.','Mixed colours, wrapped in paper'),
  item('sunflowers','Sunflowers',800,'bouquet','keep','Sunflowers, €8. Instant summer.','Flowers tucked safely under your arm.','Three tall stems'),
  item('rose','A single rose',400,'bouquet','keep','A single rose, €4. Smooth.','Rose tucked safely under your arm.','Wrapped with a ribbon'),
 ])}),
 souvenir:Object.freeze({id:'souvenir',name:'Craft & souvenir stall',local:'Käsityöt',canopy:'canvas',items:Object.freeze([
  item('reindeer','Wooden reindeer',900,'parcel','keep','Wooden reindeer, €9. Wrapped in paper.','Reindeer packed in your bag.','Carved and hand-painted'),
  item('wool-socks','Wool socks',1800,'parcel','keep','Wool socks, €18. Winter sorted.','Socks packed in your bag.','Hand-knitted, very warm'),
  item('butter-knife','Birch butter knife',1200,'parcel','keep','Birch butter knife, €12. Smells of wood.','Knife packed in your bag.','Turned from Finnish birch'),
 ])}),
 icecream:Object.freeze({id:'icecream',name:'Ice cream stand',local:'Pehmis · jäätelö',canopy:'icecream',items:Object.freeze([
  item('soft-serve','Pehmis soft serve',450,'icecream','eat','Vanilla pehmis, €4.50. The gulls look interested.','Pehmis finished, right down to the cone.','Vanilla soft serve in a waffle cone',{encounter:'gulls',flavour:'vanilla',color:'#fff1d2'}),
  item('berry-cone','Berry ice cream',500,'icecream','eat','Berry ice cream, €5. Keep an eye on your cone.','The last berry-flavoured bite.','A berry scoop in a waffle cone',{encounter:'gulls',flavour:'berry',color:'#dc87a5'}),
  item('chocolate-cone','Chocolate ice cream',500,'icecream','eat','Chocolate ice cream, €5. A cone to take along.','Chocolate ice cream finished.','A chocolate scoop in a waffle cone',{encounter:'gulls',flavour:'chocolate',color:'#825038'}),
 ])}),
});
export const formatEuro=cents=>`€${cents%100===0?cents/100:(cents/100).toFixed(2)}`;
export const edible=it=>it?.use==='eat'||it?.use==='drink';

// The encounter changes the existing action, without introducing another button.
export function marketActionPrompt(state,{coarse=false,encounter=null}={}){
 const hand=state?.hand,key=coarse?'':'E · ',chase=encounter?.phase==='chase'&&hand?.encounter==='gulls'&&(hand.state==='carry'||hand.state==='using');
 const intent=chase?'drop':state?.intent;
 const text=!state?'':chase?`${key}Drop the ice cream`:intent==='buy'?`${key}Buy at the ${state.nearby.title.toLowerCase()}`:intent==='use'?`${key}${hand.use==='drink'?'Drink':'Eat'} the ${hand.name.toLowerCase()}`:intent==='stow'?`${key}Put the ${hand.name.toLowerCase()} away`:'';
 return {intent,text,cue:chase?(coarse?'Tap Run, then hold Go to move':'Hold Shift to run away'):''};
}

const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
// The stall's front faces along `facing` (radians; 0 = +z, the Kauppatori layout).
export function stallFrame(stall){const a=stall.facing||0;return {nx:Math.sin(a),nz:Math.cos(a)};}
export function stallLocal(stall,point){
 const {nx,nz}=stallFrame(stall),dx=point.x-stall.x,dz=point.z-stall.z;
 return {across:dx*nz-dz*nx,out:dx*nx+dz*nz-stall.d/2};
}
// The vendor stands behind the counter, facing the customers.
export function vendorSpot(stall){const {nx,nz}=stallFrame(stall),back=stall.d/2-1.45;return {x:stall.x+nx*back,z:stall.z+nz*back,heading:Math.atan2(-nx,-nz)};}
export function counterSpot(stall){const {nx,nz}=stallFrame(stall),o=stall.d/2-.6;return {x:stall.x+nx*o,y:1.18,z:stall.z+nz*o};}

// Nearest stall whose front the player is standing at (within reach, roughly facing it).
export function nearestStall(player,stalls,{reach=SHOP_REACH,facing=.26}={}){
 if(!finite(player))return null;
 let best=null,score=Infinity;
 for(const stall of stalls||[]){
  if(!finite(stall)||!STALL_KINDS[stall.kind])continue;
  const {across,out}=stallLocal(stall,player);
  if(out<-.05||out>reach||Math.abs(across)>stall.w/2+.25)continue;
  const {nx,nz}=stallFrame(stall),fx=-Math.sin(player.heading||0),fz=-Math.cos(player.heading||0);
  if(fx*-nx+fz*-nz<facing)continue;
  const s=out+Math.abs(across)*.2;if(s<score){score=s;best=stall;}
 }
 return best;
}

// Default stall kinds for a market laid out without them: the orange canopies serve
// food and coffee, the plain canvas ones berries, flowers and crafts.
export function assignStallKinds(stalls){
 const food=['soup','cafe'],produce=['berries','flowers','berries','souvenir'];let f=0,p=0;
 return stalls.map(s=>s.kind?s:{...s,kind:s.orange?food[f++%food.length]:produce[p++%produce.length]});
}
export function stallTitle(stall){return STALL_KINDS[stall?.kind]?.name||'Market stall';}

export class MarketShop{
 constructor({wallet=WALLET_START,stalls=[]}={}){this.startMoney=wallet;this.reset(stalls);}
 reset(stalls=this.stalls||[]){
  this.stalls=(stalls||[]).map((s,i)=>({...s,id:s.id??`stall-${i}`})).filter(s=>finite(s)&&STALL_KINDS[s.kind]);
  this.money=this.startMoney;this.hand=null;this.bag=[];this.open=null;this.nearby=null;this.enabled=false;this.messages=[];this.player=null;this.spent=0;this.flash=null;this.closeIn=0;
 }
 get stall(){return this.open;}
 menu(stall=this.open){return STALL_KINDS[stall?.kind]?.items||[];}
 update(dt,player,{enabled=true}={}){
  dt=Math.max(0,Number.isFinite(dt)?dt:0);this.player=finite(player)?{x:player.x,z:player.z,heading:player.heading||0,travelMode:player.travelMode}:null;
  this.enabled=!!enabled&&player?.travelMode==='walk'&&!!this.stalls.length;
  if(this.flash&&(this.flash.left-=dt)<=0)this.flash=null;
  if(this.closeIn>0&&(this.closeIn-=dt)<=0)this.close();
  const h=this.hand;
  if(h){
   h.age+=dt;
   if(h.state==='handover'&&h.age>=HANDOVER_SECONDS){h.state='carry';h.carried=0;}
   else if(h.state==='carry'){h.carried+=dt;if(h.carried>=CARRY_SECONDS)this.use({auto:true});}
   else if(h.state==='using'){h.progress=Math.min(1,h.progress+dt/EAT_SECONDS);if(h.progress>=1)this.finish();}
  }
  // Getting back on a bike or into a car: hands go to the handlebars, so the item is put away.
  if(player&&player.travelMode&&player.travelMode!=='walk'){if(this.hand){if(edible(this.hand.item))this.finish();else this.stow();}this.close();this.nearby=null;return;}
  if(!this.enabled){this.close();this.nearby=null;return;}
  if(this.open){const {across,out}=stallLocal(this.open,player);if(out>SHOP_REACH+1.5||Math.abs(across)>this.open.w/2+2)this.close();}
  this.nearby=this.open?null:nearestStall(player,this.stalls);
 }
 // One key / button: open the nearby stall, close an open card, otherwise use what is in hand.
 action(player=this.player,{enabled=this.enabled}={}){
  if(this.open){this.close();return {ok:true,closed:true};}
  // Food in hand comes first (you cannot buy more with your hands full anyway).
  if(this.hand&&edible(this.hand.item)&&this.hand.state!=='handover')return this.use();
  if(enabled&&nearestStall(player,this.stalls))return this.openAt(player);
  if(this.hand)return this.use();
  return {ok:false,message:this.stalls.length?'Walk up to a market stall to buy something.':''};
 }
 openAt(player=this.player){
  const stall=nearestStall(player,this.stalls);
  if(!stall)return {ok:false,message:'Walk up to the front of a stall.'};
  this.open=stall;this.nearby=null;this.closeIn=0;return {ok:true,opened:true,stall};
 }
 // A conversation names a particular seller, so never substitute an adjacent
 // stall. Talking already establishes whom the player is addressing; a small
 // camera turn need not cancel the handoff, but front/reach and mode still apply.
 openStall(id,player=this.player){
  if(!this.enabled||player?.travelMode!=='walk')return {ok:false,message:'Walk up to the seller to see the menu.'};
  const candidate=this.stalls.find(s=>s.id===id),stall=candidate&&nearestStall(player,[candidate],{facing:-1});
  if(!stall)return {ok:false,message:'Walk a little closer to the front of that stall.'};
  this.open=stall;this.nearby=null;this.closeIn=0;return {ok:true,opened:true,stall};
 }
 close(){const was=!!this.open;this.open=null;this.closeIn=0;return was;}
 canBuy(entry){
  if(!this.open||!entry)return {ok:false,reason:'closed'};
  if(entry.price>this.money)return {ok:false,reason:'money',message:`Not enough left for the ${entry.name.toLowerCase()} (${formatEuro(this.money)} in your wallet).`};
  if(this.hand&&(this.hand.state==='handover'||this.hand.state==='using'||edible(this.hand.item)))return {ok:false,reason:'hands',message:`Hands full. Finish your ${this.hand.item.name.toLowerCase()} first.`};
  return {ok:true};
 }
 buy(id){
  const entry=this.menu().find(i=>i.id===id);
  if(!entry)return {ok:false,message:'That is not on this stall.'};
  const check=this.canBuy(entry);if(!check.ok)return {ok:false,message:check.message||''};
  if(this.hand)this.stow(); // a keepsake goes into the bag to free a hand
  this.money-=entry.price;this.spent+=entry.price;
  this.hand={item:entry,stall:this.open.id,stallRef:this.open,state:'handover',age:0,carried:0,progress:0};
  this.flash={text:`−${formatEuro(entry.price)}`,left:1.4};
  const message=entry.toast;this.closeIn=1.1; // the card stays a moment to show the change, then gets out of the way
  return {ok:true,item:entry,message,money:this.money};
 }
 use({auto=false}={}){
  const h=this.hand;if(!h)return {ok:false,message:''};
  if(h.state==='handover')return {ok:false,message:''};
  if(h.state==='using')return {ok:true};
  if(edible(h.item)){h.state='using';h.progress=0;return {ok:true,using:true,message:auto?'':`${h.item.use==='drink'?'Sip':'Mmm'}…`};}
  this.stow();const message=h.item.done;if(auto)this.messages.push(message);return {ok:true,stowed:true,message};
 }
 finish(){const h=this.hand;if(!h)return;this.hand=null;this.messages.push(h.item.done);}
 // A dropped item is neither eaten nor refunded. The optional identity guard
 // prevents a delayed gull event from removing a subsequently purchased item.
 drop({hand=this.hand,message=''}={}){
  if(!hand||hand!==this.hand)return {ok:false};
  this.hand=null;return {ok:true,dropped:true,hand,item:hand.item,message};
 }
 stow(){const h=this.hand;if(!h)return;this.hand=null;if(!edible(h.item))this.bag.push(h.item.id);}
 // What the single action key would do now: 'close', 'use', 'buy', 'stow' or null.
 intent(){
  if(this.open)return 'close';
  const h=this.hand,ready=h&&h.state==='carry';
  if(ready&&edible(h.item))return 'use';
  if(this.enabled&&this.nearby)return 'buy';
  if(ready)return 'stow';
  return null;
 }
 drainMessages(){const m=this.messages;this.messages=[];return m;}
 // Arm pose for the person model: 0 = held in front, 1 = at the mouth. null = empty hand.
 holdPose(){
  const h=this.hand;if(!h||h.state==='handover'&&h.age<HANDOVER_SECONDS*.75)return null;
  if(h.state!=='using')return 0;
  const p=h.progress,bites=3;return Math.max(0,Math.sin(Math.min(1,p*1.08)*Math.PI*bites))**.6;
 }
 // Remaining portion (1 → 0) while eating, for the held model.
 portion(){const h=this.hand;return !h?0:h.state==='using'?1-h.progress*.9:1;}
 // Food in hand attracts gulls (birds.js lure).
 lure(){return this.hand&&edible(this.hand.item)&&this.player?{x:this.player.x,z:this.player.z}:null;}
 snapshot(){
  const s=this.open,n=this.nearby;
  return {enabled:this.enabled,intent:this.intent(),money:this.money,wallet:formatEuro(this.money),spent:this.spent,bag:[...this.bag],stalls:this.stalls.length,
   open:s?{id:s.id,kind:s.kind,title:stallTitle(s),local:STALL_KINDS[s.kind].local,canopy:STALL_KINDS[s.kind].canopy,items:this.menu(s).map(i=>({id:i.id,name:i.name,note:i.note,price:i.price,label:formatEuro(i.price),...this.canBuy(i)}))}:null,
   nearby:n?{id:n.id,kind:n.kind,title:stallTitle(n)}:null,
   hand:this.hand?{id:this.hand.item.id,name:this.hand.item.name,carry:this.hand.item.carry,use:this.hand.item.use,encounter:this.hand.item.encounter||null,state:this.hand.state,progress:this.hand.progress,stall:this.hand.stall}:null,
   flash:this.flash?.text||''};
 }
}
