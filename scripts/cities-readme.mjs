// npm run cities:readme
// Rewrites the cities table in README.md (between the CITIES markers) from
// src/cities.js (built-in Helsinki) and public/cities/index.json (built cities).
// city:build runs this automatically at its end, so a new city shows up in the README. A city's
// "helpWanted": <issue number> in city.json links its open to-do issue from the table.
// A screenshot at docs/media/cities/<id>.jpg (about 320x200, JPEG) shows as the city's thumbnail.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const START='<!-- CITIES:START -->',END='<!-- CITIES:END -->';
const registry=fs.existsSync('public/cities/index.json')?JSON.parse(fs.readFileSync('public/cities/index.json')).cities:[];
const rows=[{id:'helsinki',name:'Helsinki',country:'Finland',status:'playable',maintainers:[],source:'City of Helsinki 3D city model + open data, HSL',radius:2000},
 ...registry.map(c=>({...c,country:(c.country||'').split(' / ').at(-1),source:'OpenStreetMap'}))];
const play=c=>`https://worldhood.org/?city=${c.id}`;
const thumb=c=>fs.existsSync(`docs/media/cities/${c.id}.jpg`)?`<a href="${play(c)}"><img src="docs/media/cities/${c.id}.jpg" width="160" alt="${c.name}"></a>`:'';
const table=['| | City | Play | Status | Data | Maintainers |','| --- | --- | --- | --- | --- | --- |',
 ...rows.map(c=>`| ${thumb(c)} | ${c.name}${c.country?`, ${c.country}`:''} | [\`?city=${c.id}\`](${play(c)}) | ${c.status||'draft'}${Number.isInteger(c.helpWanted)?` · [help wanted → #${c.helpWanted}](https://github.com/worldhood/worldhood/issues/${c.helpWanted})`:''} | ${c.source} | ${c.maintainers?.length?c.maintainers.join(', '):'wanted'} |`)].join('\n');
const readme=fs.readFileSync('README.md','utf8');
if(!readme.includes(START))throw Error('README.md has no CITIES markers');
const next=readme.replace(new RegExp(`${START}[\\s\\S]*?${END}`),`${START}\n${table}\n${END}`);
if(next!==readme){fs.writeFileSync('README.md',next);console.log(`README cities table: ${rows.length} cities`);}

// Keep the map in sync with the table.
execFileSync(process.execPath,['scripts/cities-map.mjs'],{stdio:'inherit'});
