import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
mkdirSync('data/raw', { recursive: true });
const layers = {
  buildings: 'Rakennukset_alue',
  roads: 'YLRE_Katu_ja_viherosat_ajorata_alue',
  pavement: 'YLRE_Katu_ja_viherosat_kevytliikenne_alue',
  parks: 'YLRE_Viherosat_alue',
  trees: 'Puurekisteri_piste',
  water: 'Merialue_kantakartasta',
};
for (const [name, layer] of Object.entries(layers)) {
  const dest = `data/raw/${name}.json`;
  if (existsSync(dest) && !process.argv.includes('--refresh')) continue;
  const url = new URL('https://kartta.hel.fi/ws/geoserver/avoindata/wfs');
  url.search = new URLSearchParams({ service:'WFS', version:'2.0.0', request:'GetFeature', typeNames:`avoindata:${layer}`, outputFormat:'application/json', srsName:'EPSG:4326', bbox:'24.908,60.148,24.996,60.191,EPSG:4326', count:'50000' });
  console.log(`Downloading ${name}…`);
  execFileSync('curl', ['-f','-L','--retry','2','--max-time','180','-sS',url.href,'-o',dest], {stdio:'inherit'});
}
