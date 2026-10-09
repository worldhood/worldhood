// Add actual vertex bounds to existing surface indices without rebuilding or
// changing any geometry. Data builders emit the same metadata for future tiles.
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {surfaceRecord} from '../src/surface-streaming.js';

export function indexSurfaceBounds(indexFile,root){
 const entries=JSON.parse(fs.readFileSync(indexFile));
 const result=entries.map(entry=>{
  const packed=fs.readFileSync(path.join(root,entry.file+'.pack'));
  const bytes=packed[0]===31&&packed[1]===139?gunzipSync(packed):packed;
  const values=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
  return {...entry,...surfaceRecord(entry.file,values)};
 });
 fs.writeFileSync(indexFile,JSON.stringify(result));return result.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const roots=['public/data'];
 if(fs.existsSync('public/cities/index.json'))for(const city of JSON.parse(fs.readFileSync('public/cities/index.json')).cities||[])roots.push('public'+city.dataRoot);
 for(const root of roots){
  const files=[path.join(root,'surface-index.json')],catalog=path.join(root,'extensions/index.json');
  if(fs.existsSync(catalog))for(const e of JSON.parse(fs.readFileSync(catalog)).extensions||[])files.push(path.join(root,e.dir,'surface-index.json'));
  for(const file of files)if(fs.existsSync(file))console.log(`${file}: ${indexSurfaceBounds(file,root)} tiles`);
 }
}
