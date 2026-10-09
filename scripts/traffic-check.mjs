// npm run traffic:check -- <city> [--seconds 240] [--seeds 2] [--spot name] [--json]
// Runs the headless flow harness around each watched spot and lists where vehicles get stuck.
import {FLOW_SPOTS,createScenario,runFlow,summarize,loadCity} from './traffic-harness.mjs';
const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const id=args.find(a=>!a.startsWith('--')&&!/^\d+$/.test(a))||'helsinki',seconds=+flag('seconds',240),seeds=+flag('seeds',2),only=flag('spot',null),json=args.includes('--json');
const c=loadCity(id);
// A new city has no curated spots: watch its named start points instead.
const spots=(FLOW_SPOTS[id]||c.city.landmarks.slice(0,4).map(l=>({name:l.name,x:l.x,z:l.z,heading:l.heading||0}))).filter(s=>!only||s.name.toLowerCase().includes(only.toLowerCase()));
const reports=[],started=Date.now();
for(const spot of spots)for(let seed=1;seed<=seeds;seed++){
 const r=runFlow(createScenario(id,spot,{seed}),{seconds});reports.push(r);
 if(!json)console.log(`${spot.name} seed ${seed}: ${r.episodes.length} stuck, ${r.queued.length} queued at stops, ${r.recycled.length} recycled after stalling, ${r.cycles.length} deadlocks, ${r.overlaps.length} overlaps, trams blocked ${(r.tramBlockedShare*100).toFixed(1)}% (${r.vehicleMinutes} vehicle-min)`);
 if(!json)for(const e of r.episodes)console.log(`   ${e.kind} ${e.id} at ${e.x},${e.z} ${e.street||'(unnamed)'} t=${e.at}s: ${e.cause}${e.blocker?' '+e.blocker:''}`);
 if(!json)for(const cy of r.cycles)console.log(`   deadlock: ${cy.join(' → ')}`);
 if(!json)for(const o of r.overlaps.slice(0,8))console.log(`   overlap ${o.kind} ${o.pair} at ${o.x},${o.z} ${o.street}`);
}
const total=summarize(reports);
if(json)console.log(JSON.stringify({city:id,total,reports},null,1));
else console.log(`\n${id}: ${total.stuck} stuck in ${total.vehicleMinutes} vehicle-minutes (${total.stuckPer100VehicleMinutes} per 100), ${total.recycledAfterStall} recycled after stalling, ${total.deadlocks} deadlocks, ${total.overlaps} overlaps (+${total.tightPassing} tight oncoming passes, ${total.squeezes} gridlock squeezes), ${total.queuedAtStops} queued at stops · ${((Date.now()-started)/1000).toFixed(1)} s\n`,total.causes,total.overlapKinds);
process.exitCode=total.deadlocks||total.stuckPer100VehicleMinutes>2?1:0;
