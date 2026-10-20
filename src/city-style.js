// Per-city engine switches, set once at boot from the selected city (main.js). Engine changes made for
// Copenhagen (both eras) are gated on copenhagenStyle(), so Helsinki and the other cities keep their look.
let current={id:'',era:null};
export function setCityStyle(city){current={id:String(city?.id||''),era:city?.era??null};return current;}
export const copenhagenStyle=()=>current.id.startsWith('copenhagen');
export const cityEra=()=>current.era;
