// npm run city:new -- <id> "<place name>" [radiusMetres]
// Creates cities/<id>/city.json from nothing but a place name (OpenStreetMap
// Nominatim). Edit it afterwards if you like, then: npm run city:build -- <id>
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [id,query,radius='1500']=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(id||'')||!query)throw Error('Usage: npm run city:new -- <id> "<place name>" [radiusMetres]');
const file=path.join('cities',id,'city.json');
if(fs.existsSync(file))throw Error(`${file} already exists`);
const url=`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
const [place]=JSON.parse(execFileSync('curl',['-sS','-f','--max-time','60','-A','open-city-drive/0.1 (city setup)',url],{encoding:'utf8'}));
if(!place)throw Error(`Nominatim found nothing for “${query}”`);
const lon=+(+place.lon).toFixed(5),lat=+(+place.lat).toFixed(5);
const city={schemaVersion:1,id,name:place.name||query,country:place.address?.country||'',
 origin:[lon,lat],radiusMetres:+radius,
 maintainers:[],status:'draft',
 note:'Origin and radius define the playable circle. Starts are chosen automatically from well-known named places; add your own in "starts".',
 starts:[],
 source:{geocoder:'Nominatim / OpenStreetMap',displayName:place.display_name}};
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,JSON.stringify(city,null,1));
console.log(`Created ${file}: ${city.name}, ${city.country} (${lat}, ${lon}), radius ${radius} m\nNext: npm run city:build -- ${id}`);
