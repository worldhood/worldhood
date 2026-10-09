// npm run cities:map
// Draws docs/cities-map.svg: country outlines (Natural Earth, public domain) with a
// marker per city, coloured by status. Run by cities:readme, so it stays current.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const RAW='data/raw/naturalearth',FILE=path.join(RAW,'countries-50m.geojson');
const URL='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
fs.mkdirSync(RAW,{recursive:true});
if(!fs.existsSync(FILE))execFileSync('curl',['-sS','-f','-L','--max-time','120','-o',FILE,URL]);
const countries=JSON.parse(fs.readFileSync(FILE)).features;
const registry=fs.existsSync('public/cities/index.json')?JSON.parse(fs.readFileSync('public/cities/index.json')).cities:[];
const cities=[{id:'helsinki',name:'Helsinki',origin:[24.9522,60.1701],status:'playable'},...registry];

// Frame: the cities' bounding box with generous padding, at least a country-sized view.
const lons=cities.map(c=>c.origin[0]),lats=cities.map(c=>c.origin[1]);
let [w,e,s,n]=[Math.min(...lons),Math.max(...lons),Math.min(...lats),Math.max(...lats)];
const padLon=Math.max(12,(e-w)*.35),padLat=Math.max(6,(n-s)*.35);[w,e,s,n]=[w-padLon,e+padLon,Math.max(-80,s-padLat),Math.min(82,n+padLat)];
const midLat=(s+n)/2*Math.PI/180;
// Landscape frame (about 2:1): widen longitude around the centre rather than stretching.
{const needLon=(n-s)*2/Math.cos(midLat),c=(w+e)/2;if(e-w<needLon){w=c-needLon/2;e=c+needLon/2;}}
const W=900,H=Math.round(W*((n-s)/((e-w)*Math.cos(midLat)))),k=W/(e-w);
const xy=([lon,lat])=>[(lon-w)*k,(n-lat)*k/Math.cos(midLat)];
const ringPath=r=>'M'+r.map(p=>xy(p).map(v=>v.toFixed(1)).join(',')).join('L')+'Z';
const inView=r=>r.some(([lon,lat])=>lon>w-20&&lon<e+20&&lat>s-20&&lat<n+20);
const land=countries.map(f=>{const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
 return polys.filter(p=>inView(p[0])).map(p=>p.map(ringPath).join('')).join('');}).filter(Boolean);
const colour={reviewed:'#2e7d4f',playable:'#e0603a','playable-draft':'#e0603a',draft:'#d9a23a'};
const markers=cities.map(c=>{const [x,y]=xy(c.origin),fill=colour[c.status]||colour.draft;
 return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${fill}" stroke="#fff" stroke-width="2.5"/><text x="${(x+14).toFixed(1)}" y="${(y+5).toFixed(1)}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="17" font-weight="600" fill="#1f2a27" stroke="#fff" stroke-width="4" paint-order="stroke">${c.name}</text></g>`;}).join('\n');
const legend=[['reviewed','Reviewed'],['playable','Playable'],['draft','Draft']].map(([k2,label],i)=>`<g transform="translate(${20+i*120},${H-22})"><circle r="6" fill="${colour[k2]}"/><text x="12" y="5" font-family="system-ui,sans-serif" font-size="13" fill="#3a4642">${label}</text></g>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Map of Worldhood cities">
<rect width="${W}" height="${H}" rx="14" fill="#cfe1e4"/>
<g fill="#eef0e8" stroke="#b9c2b8" stroke-width=".8">${land.map(d=>`<path d="${d}"/>`).join('')}</g>
${markers}
${legend}
<text x="${W-14}" y="${H-14}" text-anchor="end" font-family="system-ui,sans-serif" font-size="11" fill="#5d6a66">Map: Natural Earth (public domain)</text>
</svg>`;
fs.writeFileSync('docs/cities-map.svg',svg);
fs.writeFileSync('public/about/cities-map.svg',svg); // the /about page shows the same map
console.log(`docs/cities-map.svg: ${cities.length} cities, ${W}×${H}`);
