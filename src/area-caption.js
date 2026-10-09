// Minimap caption: the area the player is in. Nearest named place (start points carry a district),
// falling back to the city. A district named after the city reads "<CITY> CENTRE".
// Helsinki's own start points are squares, so the snapshot gets district names here (game frame, metres).
export const HELSINKI_AREAS=[
 {district:'Helsinki',x:-100,z:150},{district:'Katajanokka',x:560,z:120},{district:'Kamppi',x:-1155,z:199},
 {district:'Hakaniemi',x:0,z:-1013},{district:'Ruoholahti',x:-2184,z:627},
 {district:'Seurasaari',x:-3811,z:-1386},{district:'Hanasaari',x:-6340,z:168},
];
export function areaName(places,x,z,city,{reach=1500}={}){
 let best=null,d=reach;for(const p of places){const q=Math.hypot(p.x-x,p.z-z);if(q<d&&p.district){d=q;best=p;}}
 const name=best?.district||city;
 return (name.toLowerCase()===city.toLowerCase()?`${city} centre`:name).toUpperCase();
}
// Cheap to call every frame: recomputes at most every `interval` ms.
export function areaCaption(places,city,interval=500){
 let last=-Infinity,text=`${city} centre`.toUpperCase();
 return (x,z,now)=>{if(now-last>=interval){last=now;text=areaName(places,x,z,city);}return text;};
}
