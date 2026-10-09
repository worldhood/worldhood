import './people-interaction.css';

export function createPeopleInteractionUI({interact,choose,focusWorld=()=>{},doc=document}){
 const root=doc.createElement('section');root.id='people-interaction';root.hidden=true;root.setAttribute('aria-label','Talk to a passerby');
 const talk=doc.createElement('button');talk.id='people-talk-button';talk.type='button';talk.textContent='G · Say hello';
 const panel=doc.createElement('div');panel.id='people-chat';panel.hidden=true;
 const title=doc.createElement('strong');title.id='people-chat-title';title.textContent='Passerby';panel.setAttribute('aria-labelledby',title.id);
 const response=doc.createElement('p');response.id='people-chat-response';response.setAttribute('role','status');response.setAttribute('aria-live','polite');response.setAttribute('aria-atomic','true');
 const options=doc.createElement('div');options.className='people-chat-options';
 talk.addEventListener('click',()=>{interact();focusWorld();});
 panel.append(title,response,options);root.append(talk,panel);doc.querySelector('#app').append(root);
 let optionsKey='',lastResponse='';
 return {
  root,
  update(state,{hidden=false}={}){
   root.hidden=hidden||!state||!(state.active||state.nearby);
   if(root.hidden)return;
   talk.textContent=doc.body.classList.contains('touch')?'Say hello':'G · Say hello';
   talk.hidden=!!state.active;panel.hidden=!state.active;
   if(state.active){
    title.textContent=state.person?.label||'Passerby';
    if(lastResponse!==state.response){response.textContent=state.response;lastResponse=state.response;}
    const key=state.choices.map(c=>`${c.id}:${c.label}`).join('|');
    if(optionsKey!==key){
     options.replaceChildren();optionsKey=key;
     for(const c of state.choices){const button=doc.createElement('button');button.type='button';button.textContent=c.label;button.dataset.reply=c.id;button.addEventListener('click',()=>{choose(c.id);focusWorld();});options.append(button);}
    }
   }else lastResponse='';
  },
  dispose(){root.remove();},
 };
}
