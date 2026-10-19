// Extract two licensed municipal shells from the preview's literal mesh data.
// No source JavaScript is executed. SKP stores the reference point; preview coordinates are cm
// in the GK26 grid. Registration is verified against the separately mapped OSM footprints.
import fs from 'node:fs';import path from 'node:path';import proj4 from 'proj4';import {gunzipSync} from 'node:zlib';
const tile='212221',root='data/raw/cities/oulu/municipal-3d';
const html=fs.readFileSync(`data/raw/oulu-review/municipal-${tile}.html`,'utf8'),s=html.slice(html.indexOf('function main_wgl'));
function literalArray(name){
 const m=new RegExp(`\\b${name}\\s*=\\s*\\[`).exec(s);if(!m)throw Error(`Missing ${name}`);const start=m.index+m[0].length-1;let depth=0,quote=null,escape=false,end;
 for(let i=start;i<s.length;i++){const c=s[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='[')depth++;if(c===']'&&!--depth){end=i+1;break;}}
 return JSON.parse(s.slice(start,end).replace(/\/\/[^\r\n]*/g,'').replace(/([{,]\s*)(\w+)\s*:/g,'$1"$2":').replace(/,\s*([}\]])/g,'$1'));
}
const geom=literalArray('geomlist'),instances=literalArray('inslist'),skp=fs.readFileSync(`${root}/sketchup-${tile}/${tile}.skp`);
function attribute(key){const k=Buffer.from(key,'utf16le'),p=skp.indexOf(k);if(p<0||skp[p+k.length]!==6)throw Error(`Missing SKP double ${key}`);return skp.readDoubleLE(p+k.length+1);}
const anchor=[attribute('Longitude'),attribute('Latitude')],gk=proj4('EPSG:4326','+proj=tmerc +lat_0=0 +lon_0=26 +k=1 +x_0=26500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'),origin=gk.forward(anchor);
const registry=JSON.parse(fs.readFileSync('public/cities/index.json')),city=registry.cities.find(c=>c.id==='oulu'),local=proj4('EPSG:4326',city.projection),pack=JSON.parse(gunzipSync(fs.readFileSync('public/cities/oulu/city.pack')));
const specs=[{name:'Oulu Theatre',building:'osm-way-5122974',component:240,kind:'theatre'},{name:'Central Library Saari',building:'osm-way-5122973',component:508,kind:'library'}];
const models=specs.map(spec=>{
 const source=geom[spec.component],instance=instances[spec.component];if(instance.props.length!==1)throw Error('Unexpected instances');
 const m=instance.props[0].matrix,d=m[15],xyz=source.v.map(v=>v.split(',').map(n=>parseInt(n,36)/1e5));
 const transformed=xyz.map(([x,y,z])=>[(m[0]*x+m[4]*y+m[8]*z+m[12])/d*.01,(m[1]*x+m[5]*y+m[9]*z+m[13])/d*.01,(m[2]*x+m[6]*y+m[10]*z+m[14])/d*.01]);
 const base=Math.min(...transformed.map(p=>p[2])),height=Math.max(...transformed.map(p=>p[2]))-base;
 const vertices=transformed.map(([east,north,h])=>{const lonLat=gk.inverse([origin[0]+east,origin[1]+north]),[x,y]=local.forward(lonLat);return [+x.toFixed(4),+(h-base).toFixed(4),+(-y).toFixed(4)];});
 const mapped=pack.buildings.find(b=>b.id===spec.building);if(!mapped)throw Error(spec.building);
 const min=[0,2].map(i=>Math.min(...vertices.map(v=>v[i]))),max=[0,2].map(i=>Math.max(...vertices.map(v=>v[i])));
 const bboxResidual=Math.max(...min.map((n,i)=>Math.abs(n-mapped.bbox[i])),...max.map((n,i)=>Math.abs(n-mapped.bbox[i+2])));
 if(bboxResidual>5)throw Error(`${spec.name}: failed geographic registration (${bboxResidual} m)`);
 // Boundary edges shared by side-wall triangles at the base form the municipal collision ring.
 const edges=new Map();for(const f of source.f){const ids=f.split(',').map(n=>parseInt(n,36));for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3];if(vertices[a][1]>.001||vertices[b][1]>.001)continue;const key=[a,b].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);}}
 const boundary=[...edges].filter(([,n])=>n===1).map(([k])=>k.split(':').map(Number));
 let ring=[];if(boundary.length){const first=boundary.shift();let current=first[1];ring=[first[0],current];while(current!==ring[0]&&boundary.length){const i=boundary.findIndex(e=>e.includes(current));if(i<0)break;const edge=boundary.splice(i,1)[0];current=edge[0]===current?edge[1]:edge[0];ring.push(current);}if(current!==ring[0]||boundary.length)throw Error(`${spec.name}: incomplete base boundary`);}
 if(ring.length<4)throw Error(`${spec.name}: no collision outline`);
 return {...spec,height:+height.toFixed(4),sourceBaseElevation:+base.toFixed(4),bboxResidual:+bboxResidual.toFixed(3),vertices,faces:source.f.map(f=>f.split(',').map(n=>parseInt(n,36))),ring:ring.map(i=>[vertices[i][0],vertices[i][2]]),sourceMappedRing:mapped.rings[0],detail:'Municipal LOD1 shell; glazing and theatre roof volume added from CC0 photos are estimates. Source base elevation is retained; vertical datum is not explicitly established by the legacy download page.'};
});
const out={schemaVersion:1,name:'Oulu municipal waterfront buildings',licence:'CC BY 4.0',attribution:'Municipal shell geometry: City of Oulu, CC BY 4.0, tile 212221 (2017); converted, clipped to two buildings and recoloured by worldhood. Appearance: Estormiz CC0 photographs, 2026.',sourceUrl:`https://api.ouka.fi/3d/Mallit/${tile}.html`,sketchupUrl:`https://api.ouka.fi/3d/Mallit/${tile}.skp.zip`,anchorWgs84:anchor,coordinateSystem:'ETRSGK26 horizontal; preview unit cm; source height retained as an LOD1 measurement, not a surveyed current roof.',models};
fs.writeFileSync('cities/oulu/waterfront-model.json',JSON.stringify(out));
console.log(models.map(({name,height,bboxResidual,vertices,faces,ring})=>({name,height,bboxResidual,vertices:vertices.length,triangles:faces.length,collisionPoints:ring.length})));
