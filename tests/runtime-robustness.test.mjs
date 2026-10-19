import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameQueue,logOnce,waitForUploads} from '../src/tile-streaming.js';
import {createGameResilience,isBenignError} from '../src/game-resilience.js';
import {districtLabel} from '../src/start-picker.js';
import {welcomeCameraPose,createDriveCameraState,stepDriveCamera,followBody} from '../src/driving-camera.js';

test('a failing upload is skipped and logged once; the rest of the queue still runs',()=>{
 const logged=[],q=createFrameQueue({maxJobs:3,budgetMs:1000,onError:logOnce((...a)=>logged.push(a))}),ran=[];
 const bad=()=>{throw new Error('Texture upload failed');};
 q.push(()=>ran.push(1));q.push(bad);q.push(()=>ran.push(3));q.push(bad);q.push(()=>ran.push(5));
 assert.doesNotThrow(()=>{q.step();q.step();});
 assert.deepEqual(ran,[1,3,5]);assert.equal(q.size,0);assert.equal(q.failures,2);assert.equal(logged.length,1,'same message logged once');
 // A throwing error handler cannot break the frame either.
 const r=createFrameQueue({onError:()=>{throw new Error('logger broke');}});r.push(bad);assert.doesNotThrow(()=>r.step());
});

test('waiting for uploads drains the queue frame by frame and stops if the game stops',async()=>{
 const q=createFrameQueue({maxJobs:1,budgetMs:1000});let frames=0;for(let i=0;i<3;i++)q.push(()=>{});
 await waitForUploads(q,{nextFrame:async()=>{frames++;q.step();}});assert.equal(q.size,0);assert.equal(frames,3);
 q.push(()=>{});
 await assert.rejects(waitForUploads(q,{stopped:()=>true,nextFrame:async()=>{}}),/stopped/);
 await waitForUploads(createFrameQueue(),{nextFrame:()=>assert.fail('no frame needed when empty')});
});

test('benign browser noise is recognised without hiding real crashes',()=>{
 assert.ok(isBenignError(new Error("Permissions policy violation: accelerometer is not allowed in this document.")));
 assert.ok(isBenignError(Object.assign(new Error('Permission denied for the gyroscope sensor'),{name:'NotAllowedError'})));
 assert.ok(isBenignError(Object.assign(new Error('No permission to use DeviceOrientation'),{name:'SecurityError'})));
 assert.ok(isBenignError('Failed to load resource: the server responded with a status of 404'));
 assert.ok(isBenignError(null,'ResizeObserver loop completed with undelivered notifications.'));
 assert.ok(!isBenignError(new TypeError("Cannot read properties of undefined (reading 'x')")));
 assert.ok(!isBenignError(new Error('Error creating WebGL context.')));
 assert.ok(!isBenignError(Object.assign(new Error('Microphone permission denied'),{name:'NotAllowedError'})),'only sensor permissions');
 assert.ok(!isBenignError(undefined));
});

test('the error screen ignores sensor-policy rejections and errors but still stops on real ones',()=>{
 const win=new EventTarget(),body={classList:{add(){}}},doc={getElementById:()=>null,body,querySelectorAll:()=>[]};
 const screen={error(){}},guard=createGameResilience({win,doc,screen,reload:()=>{},log:()=>{}});
 const emit=(type,props)=>{const e=new Event(type);for(const [k,v] of Object.entries(props))Object.defineProperty(e,k,{value:v});win.dispatchEvent(e);};
 emit('unhandledrejection',{reason:Object.assign(new Error('accelerometer blocked by permissions policy'),{name:'NotAllowedError'})});
 emit('error',{error:new Error('x'),message:'Uncaught Error: Permissions-Policy: gyroscope not allowed'});
 assert.equal(guard.stopped,false);
 emit('error',{error:new TypeError('frame is not a function'),message:'Uncaught TypeError: frame is not a function'});
 assert.equal(guard.stopped,true);guard.dispose();
});

test('a start without a district still labels the HUD',()=>{
 assert.equal(districtLabel({name:'Keskustori',district:'Keskusta'},'Tampere'),'KESKUSTA');
 assert.equal(districtLabel({name:'Rotuaari'},'Oulu'),'OULU');
 assert.equal(districtLabel({name:'Rotuaari'}),'ROTUAARI');
 assert.equal(districtLabel(null),'');
});

test('the welcome camera stays above a ridge between it and the start',()=>{
 const flat=()=>5,ridge=(x,z)=>100+50*Math.max(0,1-Math.abs(z-60)/25); // a 50 m ridge just behind a start at 100 m
 const plain=welcomeCameraPose({x:0,z:0},0,96,105,flat);
 assert.deepEqual(plain.position,[0,101,105]);assert.deepEqual(plain.target,[0,5,0]);
 const hill=welcomeCameraPose({x:0,z:0},0,30,105,ridge);
 assert.ok(hill.position[1]>=ridge(0,105)+6,'above the ground under the lens');
 for(let t=.1;t<1;t+=.05){const y=hill.target[1]+(hill.position[1]-hill.target[1])*t;assert.ok(y>ridge(0,105*t),`sight line clears the slope at ${t.toFixed(2)}`);}
});

test('after a knock-down the chase camera follows the body on the ground, not the old ride',()=>{
 const s=createDriveCameraState(),ride={x:0,z:0,heading:0,speed:8,steer:0};
 for(let i=0;i<30;i++)stepDriveCamera(s,ride,1/60);
 const body={x:1.2,z:.4,heading:1.1,speed:0,knockdown:{elapsed:.001,duration:3}};
 stepDriveCamera(s,body,1/60);assert.ok(Math.abs(s.heading-1.1)<1e-9);assert.equal(s.headingVel,0);
 // Stepping the same body keeps the normal spring; the ride is not snapped back to.
 body.heading=1.3;stepDriveCamera(s,body,1/60);assert.ok(s.heading>1.1&&s.heading<1.3);
 const t=followBody(createDriveCameraState(),{x:5,z:6,heading:-2});assert.equal(t.heading,-2);assert.equal(t.lastX,5);
 // An ordinary body swap (getting into a car) is not a knock-down and keeps its smooth lag.
 const u=createDriveCameraState(0);stepDriveCamera(u,{x:0,z:0,heading:0,speed:0},1/60);stepDriveCamera(u,{x:1,z:0,heading:1,speed:0},1/60);assert.ok(u.heading<.5);
});
