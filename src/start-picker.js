// Starting-point picker on the welcome card: ‹ Olympia Terminal › cycles through the same
// starts as the city map. Buttons, ←/→ before the game starts, and a horizontal swipe on touch.
// The pure helpers below are what tests/start-picker.test.mjs checks; the DOM part stays thin.

// Wraps in both directions: step -1 from the first start goes to the last.
export function cycleIndex(length,index,step){
 if(!(length>0))return -1;
 const i=Number.isInteger(index)&&index>=0&&index<length?index:0;
 return ((i+step)%length+length)%length;
}

// The start `step` places away from `current` (matched by identity, then by name).
export function cycleStart(starts,current,step){
 if(!starts?.length)return null;
 let index=starts.indexOf(current);
 if(index<0&&current)index=starts.findIndex(s=>(s.id||s.name)===(current.id||current.name));
 return starts[cycleIndex(starts.length,index,step)];
}

export const PICKER_KEYS=Object.freeze({ArrowLeft:-1,ArrowRight:1});

// ←/→ choose a start only while the welcome card is up. Once the game has started (or a
// dialog/arrest screen owns the keyboard) they return 0 and stay steering keys.
export function pickerStep(code,{ready=false,started=false,blocked=false}={}){
 if(!ready||started||blocked)return 0;
 return PICKER_KEYS[code]||0;
}

// A deliberate horizontal swipe: left shows the next start, right the previous one.
export function swipeStep(dx,dy,{min=40,ms=0,maxMs=700}={}){
 if(ms>maxMs||Math.abs(dx)<min||Math.abs(dx)<Math.abs(dy)*1.5)return 0;
 return dx<0?1:-1;
}

export const startPosition=(index,length)=>`${index+1} / ${length}`;

export function createStartPicker({doc=document,starts,current,onChange}){
 const el=id=>doc.getElementById(id);
 const root=el('intro'),title=el('boot-title'),count=el('start-count'),status=el('start-status');
 const prev=el('start-prev'),next=el('start-next');
 let selected=current;
 const many=starts.length>1;
 prev.hidden=next.hidden=count.hidden=!many;root.classList.toggle('has-picker',many);
 function render(direction=0){
  const index=Math.max(0,starts.indexOf(selected));
  title.textContent=selected.name;count.textContent=startPosition(index,starts.length);
  if(direction){title.classList.remove('slide-next','slide-prev');void title.offsetWidth;title.classList.add(direction>0?'slide-next':'slide-prev');}
  return index;
 }
 function step(direction){
  if(!many||!direction)return;
  selected=cycleStart(starts,selected,direction);
  const index=render(direction);
  status.textContent=`${selected.name}, starting point ${index+1} of ${starts.length}`;
  onChange(selected);
 }
 prev.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));
 let touch=null;
 root.addEventListener('touchstart',e=>{touch=e.touches.length===1&&!e.target.closest('a,summary,.boot-controls')?{x:e.touches[0].clientX,y:e.touches[0].clientY,t:e.timeStamp}:null;},{passive:true});
 root.addEventListener('touchend',e=>{
  if(!touch)return;const t=e.changedTouches[0];
  const s=swipeStep(t.clientX-touch.x,t.clientY-touch.y,{ms:e.timeStamp-touch.t});touch=null;
  if(s&&!root.classList.contains('gone'))step(s);
 },{passive:true});
 render();
 return {
  step,
  get selected(){return selected;},
  // A start that could not load: show the one still in place.
  set(start){selected=start;render();},
  // While a picked place loads: the button says so and a progress line runs under the picker.
  busy(on){
   root.classList.toggle('switching',on);title.setAttribute('aria-busy',String(on));
   const label=el('start-label');if(label){label.dataset.idle??=label.textContent;label.textContent=on?`Loading ${selected.name}…`:label.dataset.idle;}
   if(on)status.textContent=`Loading ${selected.name}`;
  },
 };
}
