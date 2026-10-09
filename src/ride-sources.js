// Adapt parked rigid bodies to the city-independent player travel system.
// The source stays at its original slot while the player owns a separate ride.
export function createKnockableRideSources(set,items,{kind='scooter',prefix='parked-ride',lift=0,parts=[]}={}){
 const mode=kind==='scooter'?'scooter':'bike',edge={};
 return set.bodies.map((body,index)=>{
  const item=items[index]||{},id=`${prefix}:${body.id}`,visual={kind,color:item.color||item.accent||(kind==='citybike'?'#f4c01e':'#ffffff'),operator:item.operator,lift,parts};
  const actor={id,travelMode:mode,halfWidth:mode==='bike'?.34:.3,halfLength:mode==='bike'?.9:.62};
  Object.defineProperties(actor,{
   x:{enumerable:true,get:()=>body.x},z:{enumerable:true,get:()=>body.z},heading:{enumerable:true,get:()=>body.yaw},
   speed:{enumerable:true,get:()=>Math.hypot(body.vx||0,body.vz||0)},
   edge:{enumerable:true,get:()=>body.playerTaken?null:edge},playerTaken:{enumerable:true,get:()=>!!body.playerTaken},
  });
  let claimed=false;
  const canClaim=()=>!claimed&&!body.playerTaken&&!body.disabled&&body.resting&&(body.y||0)<.15&&actor.speed<=1.2;
  return {id,mode,label:kind==='citybike'?'City bicycle':mode==='bike'?'Bicycle':'Scooter',actor,obstacle:body,visual,canClaim,
   claim(){if(!canClaim())return false;claimed=true;body.playerTaken=true;body.disabled=true;set.update();return true;},
   release(){if(!claimed)return false;claimed=false;delete body.playerTaken;delete body.disabled;set.resetBody(body);return true;},
  };
 });
}
