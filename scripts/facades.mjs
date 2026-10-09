// npm run facades:ship -- <city>
// Checks cities/<city>/facades.json, copies it next to the city's runtime data and registers it
// (with the Mapillary credit) in public/cities/index.json. city:build runs this automatically.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateFacades} from '../src/facade-data.js';

export const CREDIT='Façade colours and details described from Mapillary street-level photos (mapillary.com), CC BY-SA 4.0.';
export function shipFacades(id,{registry='public/cities/index.json'}={}){
 const source=path.join('cities',id,'facades.json');if(!fs.existsSync(source))return null;
 const data=JSON.parse(fs.readFileSync(source)),errors=validateFacades(data);
 if(errors.length)throw Error(`${source}:\n  ${errors.slice(0,20).join('\n  ')}`);
 const reg=JSON.parse(fs.readFileSync(registry)),city=reg.cities.find(c=>c.id===id);if(!city)throw Error(`${id} is not built yet: npm run city:build -- ${id}`);
 fs.copyFileSync(source,path.join('public',city.dataRoot,'facades.json'));
 city.facades='facades.json';if(!city.attribution.includes(CREDIT))city.attribution=`${city.attribution} ${CREDIT}`;
 fs.writeFileSync(registry,JSON.stringify(reg,null,1));
 return Object.keys(data.buildings).length;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
 const id=process.argv[2];if(!id)throw Error('Usage: npm run facades:ship -- <city>');
 const n=shipFacades(id);console.log(n==null?`No cities/${id}/facades.json`:`${n} described buildings shipped for ${id}`);
}
