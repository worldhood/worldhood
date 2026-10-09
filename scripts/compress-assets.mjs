import {readdirSync,readFileSync,writeFileSync,mkdirSync,renameSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
for(const dir of ['roofs','surfaces']){
 mkdirSync(`data/raw/compiled/${dir}`,{recursive:true});
 for(const name of readdirSync(`public/data/${dir}`).filter(n=>n.endsWith('.bin'))){const p=`public/data/${dir}/${name}`;writeFileSync(`${p}.pack`,gzipSync(readFileSync(p),{level:9}));renameSync(p,`data/raw/compiled/${dir}/${name}`);}
}
if(existsSync('public/data/city.json.gz'))renameSync('public/data/city.json.gz','public/data/city.pack');
if(existsSync('public/data/city.json'))renameSync('public/data/city.json','data/raw/compiled/city.json');
console.log('Compressed runtime map assets.');
