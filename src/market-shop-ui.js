import './market-shop.css';

// Stall prompt ("E · Buy"), the stall card with its menu and wallet, and the
// "E · Eat" prompt while something is in hand. Buttons work for mouse, touch and keyboard.
export function createMarketShopUI({action,buy,close,focusWorld=()=>{},doc=document}){
 const root=doc.createElement('section');root.id='market-shop';root.hidden=true;root.setAttribute('aria-label','Market stall');
 const prompt=doc.createElement('button');prompt.id='market-prompt';prompt.type='button';
 const card=doc.createElement('div');card.id='market-card';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-modal','false');
 const head=doc.createElement('header'),awning=doc.createElement('div');awning.className='market-awning';awning.setAttribute('aria-hidden','true');
 const titles=doc.createElement('div'),local=doc.createElement('span'),title=doc.createElement('h3');local.className='market-local';title.id='market-card-title';card.setAttribute('aria-labelledby',title.id);
 const shut=doc.createElement('button');shut.type='button';shut.className='market-close';shut.textContent='×';shut.setAttribute('aria-label','Close the stall card');
 titles.append(local,title);head.append(titles,shut);
 const wallet=doc.createElement('p');wallet.className='market-wallet';wallet.setAttribute('aria-live','polite');
 const list=doc.createElement('ul');list.className='market-items';
 const foot=doc.createElement('p');foot.className='market-foot';
 const flash=doc.createElement('span');flash.className='market-flash';flash.setAttribute('aria-hidden','true');
 card.append(awning,head,wallet,list,foot,flash);root.append(card,prompt);
 // Short confirmations ("Strawberries, €5. Mm.") get their own bubble: the general toast is hidden in the clean desktop view.
 const note=doc.createElement('p');note.id='market-note';note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.hidden=true;
 doc.querySelector('#app').append(root,note);let noteTimer=0;
 flash.addEventListener('animationend',()=>flash.classList.remove('go'));
 prompt.addEventListener('click',()=>{action();focusWorld();});
 shut.addEventListener('click',()=>{close();focusWorld();});
 let key='',lastFlash='';
 return {root,note,
  say(text,{seconds=2.8}={}){if(!text)return;note.textContent=text;note.hidden=false;note.classList.remove('in');void note.offsetWidth;note.classList.add('in');clearTimeout(noteTimer);noteTimer=setTimeout(()=>{note.hidden=true;},seconds*1000);},
  update(state,{hidden=false}={}){
   const coarse=doc.body.classList.contains('touch');
   const hand=state?.hand,intent=state?.intent,keyName=coarse?'':'E · ';
   const promptText=!state?'':intent==='buy'?`${keyName}Buy at the ${state.nearby.title.toLowerCase()}`:intent==='use'?`${keyName}${hand.use==='drink'?'Drink':'Eat'} the ${hand.name.toLowerCase()}`:intent==='stow'?`${keyName}Put the ${hand.name.toLowerCase()} away`:'';
   root.hidden=hidden||!state||!(state.open||promptText);
   if(root.hidden)return;
   prompt.hidden=!promptText;if(promptText&&prompt.textContent!==promptText)prompt.textContent=promptText;
   prompt.dataset.kind=intent||'';
   card.hidden=!state.open;if(!state.open)flash.classList.remove('go');
   if(state.open){
    const o=state.open,next=JSON.stringify([o.id,state.money,o.items.map(i=>[i.id,i.ok,i.reason])]);
    card.dataset.canopy=o.canopy;
    if(next!==key){key=next;
     local.textContent=o.local;title.textContent=o.title;wallet.innerHTML='';
     const coin=doc.createElement('span');coin.className='market-coin';coin.setAttribute('aria-hidden','true');coin.textContent='€';
     const amount=doc.createElement('strong');amount.textContent=state.wallet;wallet.append(coin,doc.createTextNode('Wallet '),amount);
     list.replaceChildren();
     o.items.forEach((it,n)=>{const li=doc.createElement('li'),b=doc.createElement('button');b.type='button';b.dataset.item=it.id;
      const why=it.reason==='money'?'Not enough money':it.reason==='hands'?'Hands full':'';
      b.disabled=!it.ok;b.setAttribute('aria-label',`Buy ${it.name}, ${it.label}${why?`. ${why}`:''}`);
      const k=doc.createElement('kbd');k.textContent=String(n+1);k.setAttribute('aria-hidden','true');
      const text=doc.createElement('span');text.className='market-item-text';const name=doc.createElement('strong');name.textContent=it.name;const note=doc.createElement('small');note.textContent=why||it.note;text.append(name,note);
      const price=doc.createElement('span');price.className='market-price';price.textContent=it.label;
      b.append(k,text,price);b.addEventListener('click',()=>{buy(it.id);focusWorld();});li.append(b);list.append(li);});
     foot.textContent=coarse?'Tap an item to buy':'1–'+o.items.length+' to buy · Esc to close';
    }
   }else key='';
   if(state.flash&&state.flash!==lastFlash){flash.textContent=state.flash;flash.classList.remove('go');void flash.offsetWidth;flash.classList.add('go');}
   lastFlash=state.flash;
  },
  dispose(){root.remove();note.remove();clearTimeout(noteTimer);},
 };
}
