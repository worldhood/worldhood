import test from 'node:test';
import assert from 'node:assert/strict';
import proj4 from 'proj4';
import {GK25,worldCoordinates,trueBearing,bearingLabel,describeLocation,locationLines} from '../src/location-readout.js';
import {ORIGIN} from '../src/geo.js';

test('location inverts the actual municipal world projection',()=>{
 const origin=proj4('EPSG:4326',GK25,ORIGIN);
 for(const expected of [[24.954,60.161],[24.945,60.169],ORIGIN]){
  const point=proj4('EPSG:4326',GK25,expected),actual=worldCoordinates(point[0]-origin[0],origin[1]-point[1],origin);
  assert.ok(Math.abs(actual.longitude-expected[0])<1e-8);assert.ok(Math.abs(actual.latitude-expected[1])<1e-8);
 }
});
test('bearings respect east-positive / south-positive world and wrap north',()=>{
 for(const [dx,dz,expected] of [[0,-1,0],[1,0,90],[0,1,180],[-1,0,270]]){
  const actual=trueBearing(0,0,dx,dz),delta=((actual-expected+540)%360)-180;assert.ok(Math.abs(delta)<.1);
 }
 assert.equal(bearingLabel(359.9),'000° N');assert.equal(bearingLabel(90),'090° E');assert.equal(trueBearing(0,0,0,0),null);
});
test('view direction is independent of car heading and records reproducible pose',()=>{
 const location=describeLocation({car:{x:18.6,z:452,heading:0},street:'Eteläranta',cameraPosition:[18.6,8,462],cameraDirection:[1,-.25,0],fov:58});
 assert.ok(Math.abs(location.camera.bearing-90)<.1);assert.ok(location.carBearing<.1||location.carBearing>359.9);
 assert.ok(location.camera.pitch<0);assert.equal(location.camera.position[2],462);
 assert.equal(locationLines(location)[0],'Eteläranta');assert.match(locationLines(location)[2],/Looking 090° E/);
 assert.match(locationLines(location)[1],/\d+\.\d{6}° N/);
});
