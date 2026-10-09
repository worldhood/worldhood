import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
const origin=[25497346.46417427,6673025.255281374];
const size=600,resolution=2048;const tiles=[];
mkdirSync('public/data/aerial',{recursive:true});
for(let z=-4;z<4;z++)for(let x=-4;x<4;x++)tiles.push({x:x*size,z:z*size,size,file:`aerial/${x},${z}.jpg`});
tiles.sort((a,b)=>Math.hypot(a.x+300,a.z+300-70)-Math.hypot(b.x+300,b.z+300-70));
for(const [i,t] of tiles.entries()){
 const target=`public/data/${t.file}`;if(!existsSync(target)){
 const url=new URL('https://kartta.hel.fi/ws/geoserver/avoindata/wms');
 url.search=new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:'avoindata:Ortoilmakuva_2025_5cm',styles:'',srs:'EPSG:3879',bbox:[origin[0]+t.x,origin[1]-t.z-size,origin[0]+t.x+size,origin[1]-t.z].join(','),width:String(resolution),height:String(resolution),format:'image/jpeg'});
 execFileSync('curl',['-f','-L','--retry','2','--max-time','120','-sS',url.href,'-o',target],{stdio:'inherit'});
 const magic=readFileSync(target).subarray(0,2);if(magic[0]!==255||magic[1]!==216)throw Error(`${target} is not a JPEG image`);
 }
 console.log(`${i+1}/${tiles.length} ${t.file}`);
}
writeFileSync('public/data/aerial-index.json',JSON.stringify({source:'City of Helsinki, 2025 orthophotography (5 cm source), resampled to 29.3 cm/px for the game',sourceLayer:'avoindata:Ortoilmakuva_2025_5cm',pixelSize:size/resolution,year:2025,tiles}));
const provenance=JSON.parse(readFileSync('public/data/provenance.json'));
provenance.aerial={year:2025,sourceLayer:'avoindata:Ortoilmakuva_2025_5cm',source:'https://kartta.hel.fi/ws/geoserver/avoindata/wms',gameResolutionMetres:size/resolution,license:'CC BY 4.0',tiles:tiles.length};
provenance.limitations.push('Aerial view shows the city at the 2025 image capture date, including photographed parked vehicles, shadows, construction and people. These are image pixels, not simulated traffic or objects. Building roof displacement in orthophotography can differ from ground-level collision footprints.');
writeFileSync('public/data/provenance.json',JSON.stringify(provenance,null,2));
