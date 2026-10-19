// Per-city police and transit appearance, read from cities/<id>/city.json (copied into
// public/cities/index.json): "police" and "liveries.bus" / "liveries.tram". Every field is
// optional; missing or malformed values fall back to the Finnish defaults Helsinki uses.
// See docs/ADDING_A_CITY.md.
const HEX=/^#[0-9a-f]{6}$/i;
export const isColour=v=>typeof v==='string'&&HEX.test(v);
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,fallback,max=32)=>typeof v==='string'&&v.length<=max?v.trim():fallback;

// Known colour keys only: a typo or a non-hex value never reaches a material.
export function mergeColours(defaults,overrides){
 const out={...defaults};if(isObject(overrides))for(const k of Object.keys(defaults))if(isColour(overrides[k]))out[k]=overrides[k];return out;
}

export const SIREN_STYLES=['wail-yelp','hi-lo'];
// Finnish Poliisi: white car with a navy band and lime accents, blue beacons, navy jacket or
// lime vest with silver reflective bands. `emblem` is the game's own stylised sword badge
// (not an official emblem); `website` the small rear-door address.
export const POLICE_DEFAULTS={label:'POLIISI',website:'www.poliisi.fi',emergency:'112',emblem:true,siren:'wail-yelp',
 car:{body:'#f4f5f2',band:'#1d3a8a',accent:'#d3e34c',lettering:'#f4f5f2',bar:'#2448a6'},
 lights:['#1f5cff','#1f5cff'],
 uniform:{jacket:'#1b2436',trousers:'#1a2232',vest:'#d4e03c',reflective:'#c8ccd0'}};

// A city that sets its own label does not inherit the Finnish website or badge.
export function policeConfig(raw){
 const p=isObject(raw)?raw:{},D=POLICE_DEFAULTS,label=text(p.label,D.label,16)||D.label,national=label===D.label;
 const lights=Array.isArray(p.lights)?p.lights.filter(isColour):isColour(p.lights)?[p.lights]:[];
 return {label,
  website:text(p.website,national?D.website:''),emergency:text(p.emergency,D.emergency,8),
  emblem:typeof p.emblem==='boolean'?p.emblem:national&&D.emblem,
  siren:SIREN_STYLES.includes(p.siren)?p.siren:D.siren,
  car:mergeColours(D.car,p.car),uniform:mergeColours(D.uniform,p.uniform),
  lights:lights.length?[lights[0],lights[1]||lights[0]]:[...D.lights]};
}

// Beacon shades from one colour: dim lens body, flash colour, halo and road glow. The default
// blue keeps its hand-tuned shades.
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const toHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
export function beaconShades(hex){
 if(hex.toLowerCase()===POLICE_DEFAULTS.lights[0])return {lens:'#2a52b8',flash:'#1f5cff',halo:'#3f86ff',pool:'#2a62ff'};
 const c=channels(hex);return {lens:toHex(c.map(v=>v*.6+20)),flash:hex.toLowerCase(),halo:toHex(c.map(v=>v+(255-v)*.22)),pool:hex.toLowerCase()};
}

// Transit: tram lettering beside the first door (operator name lines and an optional ring mark).
export const TRAM_MARKS={operator:['HSL','HRT'],logo:true,marks:'#ecefee',fleet:'#d9ab3c'};
export function tramMarks(raw){
 const t=isObject(raw)?raw:{},own=Array.isArray(t.operator)||typeof t.operator==='string';
 const operator=own?[].concat(t.operator).filter(s=>typeof s==='string').map(s=>s.trim().slice(0,8)).filter(Boolean).slice(0,2):[...TRAM_MARKS.operator];
 return {operator,logo:typeof t.logo==='boolean'?t.logo:!own&&TRAM_MARKS.logo,...mergeColours({marks:TRAM_MARKS.marks,fleet:TRAM_MARKS.fleet},t)};
}

// Everything the boot sequence applies for one city.
export function cityLiveries(city={}){
 return {police:policeConfig(city.police),bus:isObject(city.liveries?.bus)?city.liveries.bus:{},tram:isObject(city.liveries?.tram)?city.liveries.tram:{}};
}
