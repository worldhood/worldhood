import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {placesOf} from '../scripts/place-build.mjs';
import {cityRoot} from '../scripts/traffic-harness.mjs';

test('photo acquisition plans do not require a rendered place model',()=>{
 assert.equal(JSON.parse(fs.readFileSync('cities/oulu/own-reference.json')).referenceOnly,true);
 assert.ok(!placesOf('oulu').includes('own'));
 assert.ok(placesOf('oulu').includes('market'),'authored market now builds as a place');
 assert.ok(placesOf('tampere').includes('keskustori'));
});

test('traffic harness resolves city data paths on this operating system',()=>{
 assert.ok(fs.existsSync(`${cityRoot('helsinki')}/mobility.json`));
 assert.ok(fs.existsSync(`${cityRoot('tampere')}/mobility.json`));
});

test('Oulu retains its multipolygon City Hall and main river geometry',()=>{
 const city=JSON.parse(gunzipSync(fs.readFileSync('public/cities/oulu/city.pack')));
 const hall=city.buildings.find(b=>b.id==='osm-relation-1303262');
 assert.ok(hall?.rings[0].length>3,'City Hall is present as a footprint');
 const river=city.water.find(w=>w.id==='osm-relation-1519226');
 assert.ok(river?.rings[0].length>3,'Oulujoki multipolygon has water geometry');
});
