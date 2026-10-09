import test from 'node:test';
import assert from 'node:assert/strict';
import {MarketShop,STALL_KINDS,WALLET_START,HANDOVER_SECONDS,EAT_SECONDS,CARRY_SECONDS,SHOP_REACH,nearestStall,assignStallKinds,formatEuro,vendorSpot,stallLocal} from '../src/market-shop.js';
import {createBirdLife} from '../src/birds.js';

const stall=(extra={})=>({id:'s1',x:0,z:0,w:5.2,d:4.4,kind:'berries',...extra});
// In front of the default stall (front at +z), facing it (heading 0 looks towards -z).
const walker=(extra={})=>({x:0,z:2.2+1.2,heading:0,speed:0,travelMode:'walk',...extra});
const tick=(shop,player,seconds,step=.1)=>{for(let t=0;t<seconds-1e-9;t+=step)shop.update(step,player);};

test('a stall is in reach only from its front, close by and facing it',()=>{
 const s=stall();
 assert.equal(nearestStall(walker(),[s]),s);
 assert.equal(nearestStall(walker({z:2.2+SHOP_REACH+.1}),[s]),null,'too far from the counter');
 assert.equal(nearestStall(walker({heading:Math.PI}),[s]),null,'back turned to the stall');
 assert.equal(nearestStall(walker({z:-3.4,heading:Math.PI}),[s]),null,'behind the stall is not the front');
 assert.equal(nearestStall(walker({x:4}),[s]),null,'past the end of the counter');
 assert.equal(nearestStall(walker({heading:.9}),[s]),s,'a glance to the side still counts');
 const turned=stall({facing:Math.PI/2});
 assert.equal(nearestStall({x:2.2+1,z:0,heading:Math.PI/2},[turned]),turned,'stalls facing other ways work from their own front');
 assert.equal(nearestStall(walker(),[stall({kind:'unknown'})]),null,'unknown stall kinds sell nothing');
 const near=stall({id:'near',x:.5}),far=stall({id:'far',x:-5.2});
 assert.equal(nearestStall(walker({x:.4}),[far,near]).id,'near');
});

test('every stall kind has 3–5 priced items with a held model and a use',()=>{
 for(const kind of Object.values(STALL_KINDS)){
  assert.ok(kind.items.length>=3&&kind.items.length<=5,kind.id);
  for(const it of kind.items){
   assert.ok(Number.isInteger(it.price)&&it.price>0&&it.price<=WALLET_START,it.id);
   assert.match(it.carry,/^(cup|bag|cone|icecream|bouquet|bowl|tray|parcel)$/);assert.match(it.use,/^(eat|drink|keep)$/);
   assert.ok(it.toast.includes(formatEuro(it.price)),`${it.id} toast names its price`);
  }
 }
 assert.equal(formatEuro(500),'€5');assert.equal(formatEuro(350),'€3.50');
 const kinds=assignStallKinds([{orange:true},{orange:true},{},{},{kind:'flowers'}]).map(s=>s.kind);
 assert.deepEqual(kinds,['soup','cafe','berries','flowers','flowers']);
 const v=vendorSpot(stall());assert.ok(stallLocal(stall(),v).out<-1,'vendor stands behind the counter');
});

test('buying takes money from the wallet, hands the item over and is limited by money and free hands',()=>{
 const shop=new MarketShop({stalls:[stall()]}),p=walker();
 shop.update(.1,p);
 assert.equal(shop.snapshot().nearby.kind,'berries');assert.equal(shop.intent(),'buy');
 assert.equal(shop.buy('strawberries').ok,false,'the card has to be open');
 assert.ok(shop.action(p).opened);assert.equal(shop.snapshot().open.items.length,3);
 const r=shop.buy('strawberries');
 assert.ok(r.ok);assert.equal(r.message,'Strawberries, €5. Mm.');
 assert.equal(shop.money,WALLET_START-500);assert.equal(shop.snapshot().wallet,'€35');
 assert.equal(shop.hand.state,'handover');assert.equal(shop.holdPose(),null,'still in the vendor\'s hands');
 assert.equal(shop.buy('blueberries').ok,false,'hands full');assert.equal(shop.money,WALLET_START-500);
 tick(shop,p,1.2);
 assert.equal(shop.hand.state,'carry');assert.equal(shop.holdPose(),0);
 assert.equal(shop.open,null,'the card closes itself after a moment');
 assert.ok(shop.lure(),'food in hand interests the gulls');
 const broke=new MarketShop({wallet:300,stalls:[stall({kind:'soup'})]});broke.update(.1,p);broke.action(p);
 const soup=broke.buy('salmon-soup');assert.equal(soup.ok,false);assert.match(soup.message,/Not enough/);
 assert.equal(broke.snapshot().open.items.find(i=>i.id==='munkki').ok,true);
 assert.ok(broke.buy('munkki').ok);assert.equal(broke.money,0);
});

test('carried food is eaten with another press or after a while; keepsakes go into the bag',()=>{
 const shop=new MarketShop({stalls:[stall({kind:'cafe'}),stall({id:'s2',x:6,kind:'flowers'})]}),p=walker();
 shop.update(.1,p);shop.action(p);shop.buy('coffee');tick(shop,p,1.2);
 assert.equal(shop.intent(),'use','at the stall with a coffee in hand, E drinks it');
 const r=shop.action(p);assert.ok(r.using);assert.equal(shop.hand.state,'using');
 tick(shop,p,EAT_SECONDS/2);assert.ok(shop.holdPose()>=0&&shop.portion()<1);
 tick(shop,p,EAT_SECONDS/2+.2);assert.equal(shop.hand,null);
 assert.deepEqual(shop.drainMessages(),['Coffee finished. Ready for anything.']);
 // Left alone, food is finished after CARRY_SECONDS.
 shop.action(p);shop.buy('munkki');tick(shop,p,HANDOVER_SECONDS+CARRY_SECONDS+EAT_SECONDS+.5,.25);
 assert.equal(shop.hand,null);assert.equal(shop.drainMessages().length,1);
 // A bouquet stays in hand, then is tucked away; buying something else frees the hand first.
 const f=walker({x:6});shop.update(.1,f);shop.action(f);assert.ok(shop.buy('rose').ok);tick(shop,f,1.2);
 assert.equal(shop.lure(),null,'gulls do not care about flowers');assert.equal(shop.intent(),'buy');
 shop.action(f);assert.ok(shop.buy('sunflowers').ok,'a keepsake does not block buying');assert.deepEqual(shop.bag,['rose']);
 tick(shop,f,1.2);shop.update(.1,walker({x:30}));assert.equal(shop.intent(),'stow');
 assert.equal(shop.action(walker({x:30})).stowed,true);assert.deepEqual(shop.bag,['rose','sunflowers']);
 assert.equal(shop.money,WALLET_START-350-300-400-800);
});

test('the shop only works on foot; riding away finishes food and the card closes when walking off',()=>{
 const shop=new MarketShop({stalls:[stall()]}),p=walker();
 shop.update(.1,{...p,travelMode:'bike'});assert.equal(shop.nearby,null);assert.equal(shop.intent(),null);
 shop.update(.1,p);shop.action(p);assert.ok(shop.open);
 shop.update(.1,walker({z:12}));assert.equal(shop.open,null,'walking away closes the card');
 shop.update(.1,p);shop.action(p);shop.buy('peas');tick(shop,p,1.2);
 shop.update(.1,{...p,travelMode:'bike'});assert.equal(shop.hand,null);assert.equal(shop.drainMessages().length,1);
 shop.update(.1,p);shop.update(.1,p,{enabled:false});assert.equal(shop.intent(),null,'paused or in a menu');
 const empty=new MarketShop();empty.update(.1,p);assert.equal(empty.snapshot().stalls,0);assert.equal(empty.intent(),null,'cities without stalls show nothing');
 shop.reset();assert.equal(shop.money,WALLET_START);assert.equal(shop.hand,null);
});

test('gulls walk up to someone holding food, and only then',()=>{
 const spots=[{x:8,z:0}],plan={flocks:[{kind:'gull',x:0,z:0,radius:16,alt:[3,8],count:8,walkers:8,spots,perches:[],ground:.13,spread:1}]};
 const life=createBirdLife(plan,{seed:3}),food={x:0,z:0};
 for(let i=0;i<60;i++)life.step(1/10,{viewer:food,threats:[{...food,speed:0}],lure:food});
 const close=life.birds.filter(b=>b.state==='ground'&&Math.hypot(b.x,b.z)<4);
 assert.ok(close.length>=3,`gulls gathered: ${close.length}`);
 assert.ok(close.length<=6,'a few, not the whole flock');
 assert.ok(life.birds.every(b=>b.state!=='ground'||Math.hypot(b.x,b.z)>1.2),'they keep just out of reach');
 const calm=createBirdLife({flocks:[{...plan.flocks[0],birds:undefined}]},{seed:3});
 for(let i=0;i<60;i++)calm.step(1/10,{viewer:food,threats:[]});
 assert.equal(calm.birds.filter(b=>b.state==='ground'&&Math.hypot(b.x,b.z)<4).length,0,'no food, no visitors');
});
