// Reading the HSL GTFS feed (data/raw/hsl-gtfs.zip, https://www.hsl.fi/en/hsl/open-data, CC BY 4.0) into the
// game's local metres. Download: curl -L -o data/raw/hsl-gtfs.zip https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import proj4 from 'proj4';
export const GTFS='data/raw/hsl-gtfs.zip';
export function csv(line){const out=[];let s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(s);s='';}else if(c!=='\r')s+=c;}return [...out,s];}
export function rows(file,visit){const text=execFileSync('unzip',['-p',GTFS,file],{maxBuffer:400*1024*1024,encoding:'utf8'}),lines=text.split('\n'),keys=csv(lines[0].replace(/^﻿/,''));for(let i=1;i<lines.length;i++)if(lines[i]){const v=csv(lines[i]);visit(Object.fromEntries(keys.map((k,j)=>[k,v[j]])));}}
// stop_times.txt is close to a gigabyte: stream it and keep only rows of the wanted trips.
export async function stopTimes(trips,visit){const reader=spawn('unzip',['-p',GTFS,'stop_times.txt']);let keys;
 for await(const line of createInterface({input:reader.stdout,crlfDelay:Infinity})){if(!keys){keys=csv(line.replace(/^﻿/,''));continue;}if(!trips.has(line.slice(0,line.indexOf(','))))continue;const v=csv(line);visit(Object.fromEntries(keys.map((k,i)=>[k,v[i]])));}}
const projection=proj4('EPSG:4326','+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs'),origin=projection.forward([24.9522,60.1701]);
export const toLocal=(lon,lat)=>{const p=projection.forward([+lon,+lat]);return [+(p[0]-origin[0]).toFixed(2),+(origin[1]-p[1]).toFixed(2)];};
// Service on one weekday of the feed (YYYYMMDD).
export function activeServices(date){const day=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6)}T12:00Z`).getUTCDay()],active=new Set();
 rows('calendar.txt',r=>{if(r.start_date<=date&&r.end_date>=date&&r[day]==='1')active.add(r.service_id);});
 rows('calendar_dates.txt',r=>{if(r.date===date){if(r.exception_type==='1')active.add(r.service_id);else active.delete(r.service_id);}});
 return active;}
export function feedDate(){let v='';rows('feed_info.txt',r=>v=r.feed_version);return v.slice(0,10);}
