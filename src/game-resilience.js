import {createLoadingScreen} from './loading-screen.js';

// Browser noise that never means the game broke: motion-sensor permission refused (tilt steering),
// an optional asset that failed to load, a ResizeObserver hiccup.
// Matched narrowly so real crashes (TypeErrors in the frame loop, WebGL failures) still stop the game.
const SENSOR=/accelerometer|gyroscope|magnetometer|orientation|devicemotion|motion sensor|sensor/i;
const BENIGN=[
 /failed to load resource/i,
 /ResizeObserver loop/i,
];
export function isBenignError(error,message=''){
 const text=`${error?.name||''} ${error?.message||''} ${typeof error==='string'?error:''} ${message||''}`;
 if(BENIGN.some(p=>p.test(text)))return true;
 // NotAllowedError/SecurityError when motion-sensor access is refused (e.g. tilt steering declined).
 return /NotAllowedError|SecurityError|permission/i.test(text)&&SENSOR.test(text);
}

// This lives outside main.js so failures while importing or creating the renderer
// can still show a usable recovery screen. Recovery is always the player's choice.
export function createGameResilience({win=window,doc=document,screen=createLoadingScreen(doc),reload=()=>win.location.reload(),log=console.error}={}){
 const canvas=doc.getElementById('world'),button=doc.getElementById('start-btn');
 const listeners=[],stopListeners=new Set();let stopped=false,kind=null;
 const listen=(target,type,handler,capture=false)=>{target?.addEventListener(type,handler,capture);listeners.push(()=>target?.removeEventListener(type,handler,capture));};
 const fail=(error,source='runtime')=>{
  if(stopped)return false;
  stopped=true;kind=source;
  const detail=String(error?.message||error||'Unknown error');
  win.worldhoodFailure={kind,message:detail};
  doc.body.classList.add('game-failed');
  for(const dialog of doc.querySelectorAll('dialog[open]'))dialog.close();
  for(const stop of stopListeners){try{stop();}catch(e){log('Could not stop a game subsystem:',e);}}
  if(source==='graphics-lost')screen.error('The browser lost its graphics connection. Close other graphics-heavy tabs, then reload to restart.',{title:'Graphics connection lost'});
  else if(/webgl|graphics context/i.test(detail))screen.error('This browser could not start 3D graphics. Enable hardware acceleration or try another browser, then reload.',{title:'3D graphics unavailable'});
  else if(source==='startup')screen.error('The game could not finish loading. Check your connection, then reload to try again.');
  else screen.error('The game stopped unexpectedly. Reload to restart from your chosen city.',{title:'The game stopped'});
  log(`Worldhood ${source} failure:`,error);
  button?.focus();
  return true;
 };
 listen(canvas,'webglcontextlost',event=>{
  event.preventDefault(); // Allow the browser to restore the context, without an automatic reload loop.
  fail(new Error('WebGL context lost'),'graphics-lost');
 });
 listen(canvas,'webglcontextrestored',()=>{
  if(kind==='graphics-lost')screen.error('Graphics is available again. Reload to restart the game.',{title:'Ready to restart'});
 });
 listen(win,'error',event=>{if(event.error&&!isBenignError(event.error,event.message))fail(event.error);}); // Ignore optional image/font resource events.
 listen(win,'unhandledrejection',event=>{if(isBenignError(event.reason))log('Ignored a harmless browser error:',event.reason);else fail(event.reason);});
 // These capture listeners precede gameplay handlers, including the existing
 // start button handler. A failure cannot accidentally start the world again.
 listen(win,'click',event=>{
  if(!stopped||!button?.contains(event.target))return;
  event.preventDefault();event.stopImmediatePropagation();reload();
 },true);
 const blockKeys=event=>{
  if(!stopped||event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.type==='keydown'&&event.code==='Enter'&&!event.repeat){event.preventDefault();reload();}
  // Preserve Tab navigation and the browser's button/link activation; stop only
  // delivery to gameplay listeners. Space on the focused reload button can click.
  event.stopImmediatePropagation();
 };
 listen(win,'keydown',blockKeys,true);listen(win,'keyup',blockKeys,true);
 return {
  fail,
  get stopped(){return stopped;},
  onStop(callback){stopListeners.add(callback);if(stopped)callback();return ()=>stopListeners.delete(callback);},
  dispose(){for(const remove of listeners)remove();stopListeners.clear();},
 };
}

let active;
export function installGameResilience(options){return active??=createGameResilience(options);}
export function gameIsStopped(){return active?.stopped||false;}
export function onGameStop(callback){return installGameResilience().onStop(callback);}
export function reportGameError(error,source='runtime'){return installGameResilience().fail(error,source);}
