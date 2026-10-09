import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
mkdirSync('data/raw',{recursive:true});
for(const [layer,file] of [['Liikennevaylat','traffic-lines'],['Liikennevalot_piste','traffic-lights']]){
 const url=new URL('https://kartta.hel.fi/ws/geoserver/avoindata/wfs');url.search=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`avoindata:${layer}`,outputFormat:'application/json',srsName:'EPSG:4326',bbox:'24.908,60.148,24.996,60.191,EPSG:4326',count:'50000'});
 const path=`data/raw/${file}.json`;execFileSync('curl',['-f','-L','--retry','2','--max-time','120',url.href,'-o',path],{stdio:'inherit'});
 const data=JSON.parse(readFileSync(path));if(!data.features?.length||data.numberMatched>data.features.length)throw Error(`Incomplete ${layer} response`);console.log(`${layer}: ${data.features.length} features`);
}
