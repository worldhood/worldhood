// Synthesised siren, no audio assets. Audible out to SIREN_RANGE: loudness rolls off with
// distance (inverse-distance, eased to silence over the last 100 m) and a low-pass closes on
// far units so they sound muffled across the city. Styles (city.json → police.siren):
// 'wail-yelp' slow wail while the nearest unit is far, fast yelp when close (Finland);
// 'hi-lo' alternating two-tone, quicker up close. `intensity` above 1 (finale surge) makes
// it louder and switches to the close pattern sooner.
export const SIREN_RANGE=500;
export const SURGE_SIREN=1.8;
const FADE=100,ROLLOFF=90,OPEN=2200,MUFFLED=450,CLEAR=40;
export function sirenGain(d){
 if(!(d>=0&&d<SIREN_RANGE))return 0;
 const e=Math.min(1,(SIREN_RANGE-d)/FADE);return (1+d/ROLLOFF)**-1.5*e*e*(3-2*e);
}
// Low-pass cutoff in Hz: open up close, falling exponentially to MUFFLED at the edge of range.
export function sirenCutoff(d){const t=Math.min(1,Math.max(0,(d-CLEAR)/(SIREN_RANGE-CLEAR)));return Math.round(OPEN*(MUFFLED/OPEN)**t);}
export function sirenPitch(style,time,close){
 if(style==='hi-lo')return (time/(close?.8:1.3))%1<.5?920:690;
 const period=close?.32:3.4,c=(time/period)%1,sweep=close?(c<.5?c*2:2-c*2):.5-.5*Math.cos(c*Math.PI*2);
 return (close?720:640)+sweep*(close?640:620);
}
export function sirenMix(units,player,time,intensity=1,style='wail-yelp'){
 let d=Infinity;if(player)for(const u of units)d=Math.min(d,Math.hypot(u.x-player.x,u.z-player.z));
 const gain=sirenGain(d);if(!gain)return {volume:0,frequency:700,cutoff:OPEN,distance:d};
 const close=d<(intensity>1?90:45);
 return {volume:Math.min(.16,.075*gain*intensity),frequency:sirenPitch(style,time,close),cutoff:sirenCutoff(d),distance:d};
}
export function createSiren(){
 let context=null,osc,filter,gain;
 return {
  update(ctx,enabled,units,player,time,intensity=1,style){
   if(!ctx)return;
   if(ctx!==context){
    context=ctx;osc=ctx.createOscillator();filter=ctx.createBiquadFilter();gain=ctx.createGain();
    osc.type='sawtooth';filter.type='lowpass';filter.frequency.value=OPEN;filter.Q.value=.7;gain.gain.value=0;
    osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start();
   }
   const mix=enabled?sirenMix(units,player,time,intensity,style):null,now=ctx.currentTime;
   gain.gain.setTargetAtTime(mix?mix.volume:0,now,.08);
   if(mix){osc.frequency.setTargetAtTime(mix.frequency,now,.012);filter.frequency.setTargetAtTime(mix.cutoff,now,.15);}
  },
 };
}
