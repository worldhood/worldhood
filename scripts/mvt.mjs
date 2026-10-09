// Minimal Mapbox Vector Tile reader for point layers (Mapillary coverage tiles list every
// image with its position, heading and date; the Graph API bbox search returns only a sample).
function reader(buf){
 let pos=0;
 const varint=()=>{let r=0,s=0,b;do{b=buf[pos++];r+=(b&127)*2**s;s+=7;}while(b&128);return r;};
 return {get pos(){return pos;},end:()=>pos>=buf.length,varint,
  field(){const k=varint();return [k>>3,k&7];},
  bytes(){const n=varint(),b=buf.subarray(pos,pos+n);pos+=n;return b;},
  skip(type){if(type===0)varint();else if(type===1)pos+=8;else if(type===2)pos+=varint();else if(type===5)pos+=4;else throw Error('bad wire type '+type);},
  double(){const v=buf.readDoubleLE(pos);pos+=8;return v;},float(){const v=buf.readFloatLE(pos);pos+=4;return v;}};
}
const zigzag=n=>(n>>>1)^-(n&1);
function value(buf){const r=reader(buf);let v=null;while(!r.end()){const [f,t]=r.field();
 if(f===1)v=new TextDecoder().decode(r.bytes());else if(f===2)v=r.float();else if(f===3)v=r.double();else if(f===4||f===5)v=r.varint();else if(f===6)v=zigzag(r.varint());else if(f===7)v=!!r.varint();else r.skip(t);}return v;}
// Points of one layer as {lon,lat,...properties}.
export function readPoints(buf,layerName,z,x,y){
 const out=[],top=reader(Buffer.from(buf));
 while(!top.end()){const [f,t]=top.field();if(f!==3){top.skip(t);continue;}
  const l=reader(top.bytes());let name='',extent=4096;const keys=[],values=[],features=[];
  while(!l.end()){const [g,u]=l.field();if(g===1)name=new TextDecoder().decode(l.bytes());else if(g===2)features.push(l.bytes());else if(g===3)keys.push(new TextDecoder().decode(l.bytes()));else if(g===4)values.push(value(l.bytes()));else if(g===5)extent=l.varint();else l.skip(u);}
  if(name!==layerName)continue;
  for(const fb of features){const r=reader(fb);const props={};let geom=null,type=0;
   while(!r.end()){const [g,u]=r.field();if(g===2){const tb=reader(r.bytes());while(!tb.end()){const k=tb.varint(),v=tb.varint();props[keys[k]]=values[v];}}else if(g===3)type=r.varint();else if(g===4)geom=r.bytes();else r.skip(u);}
   if(type!==1||!geom)continue;const gr=reader(geom),cmd=gr.varint();if((cmd&7)!==1)continue;
   const px=zigzag(gr.varint()),py=zigzag(gr.varint()),n=2**z;
   const lon=(x+px/extent)/n*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+py/extent)/n)))*180/Math.PI;
   out.push({lon,lat,...props});}
 }
 return out;
}
export const tileOf=(lon,lat,z)=>{const n=2**z,r=lat*Math.PI/180;return [Math.floor((lon+180)/360*n),Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)];};
