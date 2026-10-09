import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='https://kartta.hel.fi/3d/datasource-data/e5e7158a-52df-45a1-9be0-1be8f2828abd/';
mkdirSync('data/raw/textured',{recursive:true});
function download(url,path){if(!existsSync(path))execFileSync('curl',['-f','-L','--retry','2','--max-time','90','-sS',url,'-o',path],{stdio:'inherit'});}
download(base+'tileset.json','data/raw/textured-tileset.json');
const tiles=[];const used=new Set();
function visit(t,parent){
 const r=t.boundingVolume?.region?.map((n,i)=>i<4?n*180/Math.PI:n);
 if(r&&(r[2]<24.908||r[0]>24.996||r[3]<60.148||r[1]>60.191))return;
 const uri=t.content?.uri;
 if(uri){const url=new URL(uri,parent).href;
  if(uri.endsWith('.json')){const path='data/raw/textured/'+url.slice(base.length).replaceAll('/','_');download(url,path);visit(JSON.parse(readFileSync(path)).root,url);return;}
  const level=Number(url.slice(base.length).split('/')[0]);
  if(level>=16||!t.children?.length){if(!used.has(url)){used.add(url);tiles.push({url,region:r,file:url.slice(base.length).replaceAll('/','_')});}return;}
 }
 t.children?.forEach(c=>visit(c,parent));
}
visit(JSON.parse(readFileSync('data/raw/textured-tileset.json')).root,base+'tileset.json');
tiles.sort((a,b)=>Math.hypot((a.region[0]+a.region[2])/2-24.9522,((a.region[1]+a.region[3])/2-60.1701)*2)-Math.hypot((b.region[0]+b.region[2])/2-24.9522,((b.region[1]+b.region[3])/2-60.1701)*2));
writeFileSync('data/raw/textured-index.json',JSON.stringify({base,tiles}));
console.log(`${tiles.length} textured LOD2 tiles selected`);
for(const [i,t] of tiles.entries()){download(t.url,'data/raw/textured/'+t.file);if(i%20===0||i===tiles.length-1)console.log(`${i+1}/${tiles.length} tiles downloaded`);}
