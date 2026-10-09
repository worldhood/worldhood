// Pure helpers for collecting current reference photos of one place (a square, a landmark) from
// open sources: Wikimedia Commons, Mapillary and Panoramax. Shared by scripts/reference-photos.mjs
// and the tests; nothing here touches the network.

// Commons DateTimeOriginal comes in many shapes ("2022-06-10 18:01", "Taken on 5 March 2021",
// "25 July 2017", "5.8.2007"). Returns YYYY-MM-DD, YYYY-MM or YYYY, or '' when there is no year.
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function commonsDate(text=''){
 const s=String(text).replace(/<[^>]*>/g,' ');
 let m=/(\d{4})[-:](\d{2})[-:](\d{2})/.exec(s);if(m)return `${m[1]}-${m[2]}-${m[3]}`;
 m=/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(s);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 m=/\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})\b/.exec(s);if(m&&MONTHS.includes(m[2].toLowerCase()))return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase())+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
 m=/\b([A-Za-z]{3})[a-z]*\s+(\d{4})\b/.exec(s);if(m&&MONTHS.includes(m[1].toLowerCase()))return `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase())+1).padStart(2,'0')}`;
 m=/\b(1[89]\d\d|20\d\d)\b/.exec(s);return m?m[1]:'';
}
// Is a (possibly partial) date on or after `since` (YYYY-MM-DD)? Partial dates compare by their prefix.
export const isCurrent=(date,since)=>!!date&&date>=since.slice(0,date.length);

// Mapillary/Panoramax images inside a circle, newest first, thinned to one image per grid cell and
// heading sector so a few hundred photos of the same tram stop don't crowd out the other corners.
export function pickStreetImages(images,{x=0,z=0,radius=120,since='2021-01-01',cell=12,sectors=8,max=160}={}){
 const keep=new Map();
 for(const im of [...images].sort((a,b)=>b.captured.localeCompare(a.captured))){
  if(Math.hypot(im.x-x,im.z-z)>radius||!isCurrent(im.captured,since))continue;
  const sector=Number.isFinite(im.heading)?Math.floor(((im.heading%360)+360)%360/(360/sectors)):sectors;
  const key=`${Math.floor(im.x/cell)},${Math.floor(im.z/cell)},${sector}`;if(!keep.has(key))keep.set(key,im);
 }
 return [...keep.values()].slice(0,max);
}

// "Category name@depth" entries from a place's photoSearch.commons list.
export const commonsCategories=list=>(list||[]).map(c=>{const [name,depth]=String(c).split('@');return {name:name.replace(/^Category:/,''),depth:Number.isFinite(+depth)&&depth!==undefined?+depth:1};});
