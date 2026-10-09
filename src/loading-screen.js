export function createLoadingScreen(doc=document){
 const el=id=>doc.getElementById(id),root=el('intro');
 return {
  progress(n,message){
   const value=Math.max(0,Math.min(100,n));el('load-fill').style.width=`${value}%`;el('load-percent').textContent=`${value}%`;el('load-detail').textContent=message;
   root.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(value));
  },
  ready(title='Olympia Terminal'){root.classList.add('ready');root.setAttribute('aria-busy','false');el('boot-title').textContent=title;el('boot-loader').hidden=true;el('boot-launch').hidden=false;el('start-btn').disabled=false;},
  enter(){root.classList.add('gone');root.inert=true;root.setAttribute('aria-hidden','true');doc.body.classList.remove('booting');},
  error(message){root.classList.add('failed');root.setAttribute('aria-busy','false');el('boot-title').textContent='Couldn’t load the game';el('boot-loader').hidden=false;el('load-detail').textContent=message;el('boot-launch').hidden=false;el('start-label').textContent='Reload';el('start-btn').disabled=false;root.querySelector('.boot-enter').hidden=true;},
 };
}
