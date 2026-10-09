import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
mkdirSync('data/raw',{recursive:true});
execFileSync(process.execPath,['scripts/fetch-data.mjs'],{stdio:'inherit'});
const wfs=new URL('https://kartta.hel.fi/ws/geoserver/avoindata/wfs');
wfs.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'avoindata:Merialue_kantakartasta',outputFormat:'application/json',srsName:'EPSG:3879',bbox:'24.908,60.148,24.996,60.191,EPSG:4326'});
execFileSync('curl',['-f','-L','--retry','2','--max-time','180','-sS',wfs.href,'-o','data/raw/water-native.json'],{stdio:'inherit'});
execFileSync('curl',['-f','-L','--retry','2','--max-time','90','-sS','https://kartta.hel.fi/3d/datasource-data/16fc3fd5-df6d-4f48-bfd5-9aeee430a02f/tileset.json','-o','data/raw/tileset.json'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/fetch-roofs.mjs'],{stdio:'inherit'});
