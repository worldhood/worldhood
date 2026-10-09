export function createLoadingScreen(doc=document){
 const el=id=>doc.getElementById(id),root=el('intro');
 const failed=()=>root.classList.contains('failed');
 return {
  progress(n,message){
   if(failed())return;
   const value=Math.max(0,Math.min(100,n));el('load-fill').style.width=`${value}%`;el('load-percent').textContent=`${value}%`;el('load-detail').textContent=message;
   root.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(value));
  },
  ready(title='Olympia Terminal'){if(failed())return;root.classList.add('ready');root.setAttribute('aria-busy','false');el('boot-title').textContent=title;el('boot-loader').hidden=true;el('boot-launch').hidden=false;el('start-btn').disabled=false;},
  enter(){if(failed())return;root.classList.add('gone');root.inert=true;root.setAttribute('aria-hidden','true');doc.body.classList.remove('booting');},
  error(message,{title='Couldn’t load the game'}={}){
   root.classList.remove('gone','ready');root.classList.add('failed');root.inert=false;root.removeAttribute('aria-hidden');root.setAttribute('aria-busy','false');
   doc.body.classList.remove('driving');doc.body.classList.add('booting');
   el('boot-title').textContent=title;el('boot-loader').hidden=false;el('load-detail').textContent=message;
   el('load-percent').hidden=true;root.querySelector('[role="progressbar"]').hidden=true;
   el('boot-launch').hidden=false;el('start-label').textContent='Reload';el('start-btn').disabled=false;root.querySelector('.boot-enter').hidden=true;
  },
 };
}
