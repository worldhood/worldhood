import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const base='https://kartta.hel.fi/3d/datasource-data/16fc3fd5-df6d-4f48-bfd5-9aeee430a02f/';
const root=JSON.parse(readFileSync('data/raw/tileset.json')).root;
const tiles=[];
function visit(t){
  const r=t.boundingVolume.region.map((v,i)=>i<4?v*180/Math.PI:v);
  if(r[2]<24.908||r[0]>24.996||r[3]<60.148||r[1]>60.191) return;
  if(t.content && !t.children?.length) tiles.push({uri:t.content.uri,region:r,transform:t.transform});
  t.children?.forEach(visit);
}
visit(root);
tiles.sort((a,b)=>Math.hypot((a.region[0]+a.region[2])/2-24.9522,((a.region[1]+a.region[3])/2-60.1701)*2)-Math.hypot((b.region[0]+b.region[2])/2-24.9522,((b.region[1]+b.region[3])/2-60.1701)*2));
mkdirSync('data/raw/roofs',{recursive:true});
writeFileSync('data/raw/roof-index.json',JSON.stringify({base,tiles}));
console.log(`${tiles.length} official LOD2 tiles in bounding box`);
for (const [i,t] of tiles.entries()){
  const path=`data/raw/roofs/${t.uri.replaceAll('/','_')}`;
  if(!existsSync(path)) execFileSync('curl',['-f','-L','--retry','2','--max-time','60','-sS',base+t.uri,'-o',path],{stdio:'inherit'});
  console.log(`${i+1}/${tiles.length} ${t.uri}`);
  if(process.argv.includes('--sample')) break;
}
