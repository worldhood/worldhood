// Synthesised siren, no audio assets. Wail while the nearest unit is far,
// faster yelp when it is close; volume falls off with distance. `intensity`
// above 1 (finale surge) makes it louder and switches to the yelp sooner.
export const SIREN_RANGE=260;
export const SURGE_SIREN=1.8;
export function sirenMix(units,player,time,intensity=1){
 let d=Infinity;if(player)for(const u of units)d=Math.min(d,Math.hypot(u.x-player.x,u.z-player.z));
 if(!(d<SIREN_RANGE))return {volume:0,frequency:700,distance:d};
 const near=1-d/SIREN_RANGE,volume=Math.min(.16,.075*near*near*intensity);
 const yelp=d<(intensity>1?90:45),period=yelp?.32:3.4,c=(time/period)%1;
 const sweep=yelp?(c<.5?c*2:2-c*2):.5-.5*Math.cos(c*Math.PI*2);
 return {volume,frequency:(yelp?720:640)+sweep*(yelp?640:620),distance:d};
}
export function createSiren(){
 let context=null,osc,filter,gain;
 return {
  update(ctx,enabled,units,player,time,intensity=1){
   if(!ctx)return;
   if(ctx!==context){
    context=ctx;osc=ctx.createOscillator();filter=ctx.createBiquadFilter();gain=ctx.createGain();
    osc.type='sawtooth';filter.type='lowpass';filter.frequency.value=2200;filter.Q.value=.7;gain.gain.value=0;
    osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();
   }
   const mix=enabled?sirenMix(units,player,time,intensity):null,now=ctx.currentTime;
   gain.gain.setTargetAtTime(mix?mix.volume:0,now,.08);
   if(mix)osc.frequency.setTargetAtTime(mix.frequency,now,.012);
  },
 };
}
