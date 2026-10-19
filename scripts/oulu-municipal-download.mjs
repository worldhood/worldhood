// Download the selected official tile and extract only the expected SketchUp file.
import fs from 'node:fs';import {unzipSync} from 'three/addons/libs/fflate.module.js';import {createHash} from 'node:crypto';
const tile='212221',root='data/raw/cities/oulu/municipal-3d',review='data/raw/oulu-review';
fs.mkdirSync(`${root}/sketchup-${tile}`,{recursive:true});fs.mkdirSync(review,{recursive:true});
const artifacts=[{url:'https://api.ouka.fi/3d/index_en.html',file:`${root}/licence-index.html`},{url:`https://api.ouka.fi/3d/Mallit/${tile}.html`,file:`${review}/municipal-${tile}.html`},{url:`https://api.ouka.fi/3d/Mallit/${tile}.skp.zip`,file:`${root}/${tile}.skp.zip`}];
for(const a of artifacts){if(!fs.existsSync(a.file)){const r=await fetch(a.url,{headers:{'User-Agent':'worldhood/0.1 municipal model import'},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${r.status} ${a.url}`);fs.writeFileSync(a.file,Buffer.from(await r.arrayBuffer()));}
 const b=fs.readFileSync(a.file);a.bytes=b.length;a.sha256=createHash('sha256').update(b).digest('hex');}
const extracted=`${root}/sketchup-${tile}/${tile}.skp`;
if(!fs.existsSync(extracted)){const files=unzipSync(new Uint8Array(fs.readFileSync(`${root}/${tile}.skp.zip`)),{filter:f=>f.name===`${tile}.skp`});if(!files[`${tile}.skp`])throw Error('Archive lacks expected SketchUp model');fs.writeFileSync(extracted,files[`${tile}.skp`]);}
fs.writeFileSync(`${root}/download-manifest.json`,JSON.stringify({licence:'CC BY 4.0',author:'City of Oulu',tile,artifacts},null,1));console.log({tile,artifacts:artifacts.map(({file,bytes})=>({file,bytes})),extracted});
