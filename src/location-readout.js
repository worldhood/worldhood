import proj4 from 'proj4';
import {ORIGIN} from './geo.js';

// Same ETRS-GK25 projection as scripts/build-data.mjs. Local +X is east,
// local +Z is south. Precision describes the game position, not survey accuracy.
export const GK25='+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
let projection=proj4('EPSG:4326',GK25);
let defaultOrigin=projection.forward(ORIGIN);
// Cities built from OpenStreetMap use their own transverse Mercator centred on the city origin.
export function useProjection(definition,origin){projection=proj4('EPSG:4326',definition);defaultOrigin=projection.forward(origin);}
const degrees=180/Math.PI;
export function worldCoordinates(x,z,origin=defaultOrigin){
 const [longitude,latitude]=projection.inverse([origin[0]+x,origin[1]-z]);
 return {latitude,longitude};
}
export function trueBearing(x,z,dx,dz,origin=defaultOrigin){
 const length=Math.hypot(dx,dz);if(length<1e-8)return null;
 const a=worldCoordinates(x,z,origin),b=worldCoordinates(x+dx/length*100,z+dz/length*100,origin);
 const lat1=a.latitude/degrees,lat2=b.latitude/degrees,delta=(b.longitude-a.longitude)/degrees;
 return (Math.atan2(Math.sin(delta)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(delta))*degrees+360)%360;
}
export function bearingLabel(bearing){
 if(bearing===null)return 'vertical view';
 const n=((bearing%360)+360)%360;
 return `${String(Math.round(n)%360).padStart(3,'0')}° ${['N','NE','E','SE','S','SW','W','NW'][Math.round(n/45)%8]}`;
}
export function describeLocation({car,street,cameraPosition,cameraDirection,fov,origin=defaultOrigin}){
 const [cx,cy,cz]=cameraPosition,[dx,dy,dz]=cameraDirection;
 return {
  street:street||'Unmapped street / off road',
  coordinates:worldCoordinates(car.x,car.z,origin),
  world:{x:car.x,z:car.z},
  carBearing:trueBearing(car.x,car.z,-Math.sin(car.heading),-Math.cos(car.heading),origin),
  camera:{coordinates:worldCoordinates(cx,cz,origin),position:cameraPosition,direction:cameraDirection,
   bearing:trueBearing(cx,cz,dx,dz,origin),pitch:Math.atan2(dy,Math.hypot(dx,dz))*degrees,fov},
  coordinateSystem:'WGS84 from ETRS-GK25 local game coordinates',
  accuracy:'Game-map position; source geometry accuracy is not implied',
 };
}
export function locationLines(location){
 const {coordinates:c,world:w,camera}=location;
 return [location.street,
  `Car: ${c.latitude.toFixed(6)}° N, ${c.longitude.toFixed(6)}° E`,
  `Looking ${bearingLabel(camera.bearing)} · tilt ${camera.pitch.toFixed(1)}° · FOV ${camera.fov.toFixed(0)}°`,
  `Car facing ${bearingLabel(location.carBearing)} · X ${w.x.toFixed(1)} / Z ${w.z.toFixed(1)} m`];
}
export function createLocationReadout(){
 const panel=document.createElement('aside');panel.id='location-readout';panel.setAttribute('aria-label','Game location and camera direction');
 panel.title='Precise in-game position mapped to latitude/longitude. Bearings are clockwise from true north; negative tilt looks down.';
 const lines=Array.from({length:4},()=>{const el=document.createElement('div');panel.append(el);return el;});
 document.body.append(panel);
 return {update(location){locationLines(location).forEach((text,i)=>{if(lines[i].textContent!==text)lines[i].textContent=text;});}};
}

// Save the same readout into the JPEG itself: DOM overlays are not part of WebGL.
export function stampLocation(ctx,width,height,location,capturedAt){
 if(!location)return;
 const lines=[...locationLines(location),capturedAt];
 ctx.save();const fontSize=Math.max(9,Math.min(14,Math.floor(width/48))),lineHeight=fontSize+5;
 ctx.font=`${fontSize}px monospace`;
 const boxWidth=Math.min(width-16,Math.max(...lines.map(line=>ctx.measureText(line).width))+20);
 const boxHeight=lines.length*lineHeight+16,top=Math.max(8,height-boxHeight-12);
 ctx.fillStyle='rgba(19,34,31,.9)';ctx.fillRect(8,top,boxWidth,boxHeight);
 ctx.fillStyle='#ffffff';ctx.textBaseline='top';
 lines.forEach((line,i)=>ctx.fillText(line,18,top+8+i*lineHeight,boxWidth-20));ctx.restore();
}
