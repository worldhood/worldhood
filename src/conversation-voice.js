// Browser-provided, installed voices only. Captions remain the authoritative
// dialogue; an unavailable engine or voice never prevents an interaction.
export function createConversationVoice({synthesis=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,enabled=true}={}){
 let active=null,pending=null,serial=0,disposed=false,speaking=false,failed=false;
 const supported=!!synthesis&&typeof synthesis.speak==='function'&&typeof Utterance==='function';
 const voices=()=>{try{return supported?(synthesis.getVoices?.()||[]).filter(v=>v.localService===true):[];}catch{return [];}};
 const selectVoice=seed=>{const list=voices(),english=list.filter(v=>/^en(?:-|_)/i.test(v.lang)||v.lang==='en'),pool=english.length?english:list;return pool.length?pool[Math.abs(seed||0)%pool.length]:null;};
 function stop(){
  serial++;const owned=!!active||!!pending;pending=null;active=null;speaking=false;
  if(owned&&supported)try{synthesis.cancel();}catch{/* Text still works. */}
 }
 function start(request){
  if(disposed||!enabled||request.token!==serial)return false;
  const voice=selectVoice(request.seed);if(!voice)return false;
  let u;try{u=new Utterance(request.text);}catch{failed=true;pending=null;request.onEnd?.('unavailable');return false;}
  pending=null;active=u;u.voice=voice;u.lang=voice.lang||'en';u.rate=.96+(request.seed%3)*.025;u.pitch=.96+(request.seed%4)*.025;u.volume=1;
  const valid=()=>!disposed&&request.token===serial&&active===u;
  const finish=reason=>{if(!valid())return;active=null;speaking=false;failed=reason==='error';request.onEnd?.(reason);};
  u.onstart=()=>{if(valid()){speaking=true;request.onStart?.();}};
  u.onend=()=>finish('end');u.onerror=()=>finish('error');
  try{synthesis.speak(u);return true;}catch{finish('error');return false;}
 }
 function onVoices(){if(pending)start(pending);}
 if(supported)synthesis.addEventListener?.('voiceschanged',onVoices);
 return {
  get enabled(){return enabled;},
  speak(text,{seed=0,onStart,onEnd}={}){
   stop();failed=false;if(disposed||!enabled||!supported||typeof text!=='string'||!text.trim())return false;
   const request={text,seed:Math.abs(seed)||0,onStart,onEnd,token:serial};
   pending=request;return start(request);
  },
  stop,
  setEnabled(value){enabled=!!value;if(!enabled)stop();return enabled;},
  snapshot(){const available=voices().length>0;return {enabled,supported,available,speaking,status:!enabled?'muted':!supported||!available||failed?'text':speaking?'speaking':'ready'};},
  dispose(){if(disposed)return;stop();disposed=true;synthesis?.removeEventListener?.('voiceschanged',onVoices);},
 };
}
