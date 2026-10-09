// KTX2/Basis → JPEG for municipal 3D Tiles 1.1 atlases. Uses the Basis
// transcoder shipped with three.js, a minimal PNG
// writer, and macOS `sips` for JPEG encoding. No downloaded code runs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

let basis=null;
async function transcoder(root){
 if(basis)return basis;
 const dir=path.join(root,'node_modules/three/examples/jsm/libs/basis');
 const context={console,WebAssembly,TextDecoder,performance,setTimeout,clearTimeout};context.globalThis=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(dir,'basis_transcoder.js'),'utf8')+';this.BASIS=BASIS;',context);
 basis=await context.BASIS({wasmBinary:fs.readFileSync(path.join(dir,'basis_transcoder.wasm'))});basis.initializeBasis();
 return basis;
}
const CRC=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let x=0xffffffff;for(const b of buf)x=CRC[(x^b)&255]^(x>>>8);return (x^0xffffffff)>>>0;};
function png(rgba,w,h){
 const raw=Buffer.alloc((w*3+1)*h);
 for(let y=0;y<h;y++){const row=y*(w*3+1);for(let x=0;x<w;x++){const s=(y*w+x)*4,d=row+1+x*3;raw[d]=rgba[s];raw[d+1]=rgba[s+1];raw[d+2]=rgba[s+2];}}
 const chunk=(type,data)=>{const len=Buffer.alloc(4),sum=Buffer.alloc(4),body=Buffer.concat([Buffer.from(type),data]);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(body));return Buffer.concat([len,body,sum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
// Drop APP1 (Exif/XMP) and APP13 (Photoshop) blocks the encoder adds; keep pixels only.
export function stripJpegMetadata(bytes){
 if(bytes[0]!==0xff||bytes[1]!==0xd8)return bytes;
 const out=[bytes.subarray(0,2)];let i=2;
 while(i+4<=bytes.length&&bytes[i]===0xff){
  const marker=bytes[i+1];if(marker===0xda){out.push(bytes.subarray(i));return Buffer.concat(out);}
  const length=bytes.readUInt16BE(i+2);if(marker!==0xe1&&marker!==0xed)out.push(bytes.subarray(i,i+2+length));i+=2+length;
 }
 return bytes;
}
export async function ktx2ToJpeg(bytes,destination,quality=88,root=process.cwd()){
 const B=await transcoder(root),file=new B.KTX2File(new Uint8Array(bytes));
 try{
  if(!file.isValid()||!file.startTranscoding())throw Error('Invalid KTX2 atlas');
  const w=file.getWidth(),h=file.getHeight(),RGBA32=13,out=new Uint8Array(file.getImageTranscodedSizeInBytes(0,0,0,RGBA32));
  if(!file.transcodeImage(out,0,0,0,RGBA32,0,-1,-1))throw Error('KTX2 transcode failed');
  const temporary=path.join(os.tmpdir(),`hdv2-${process.pid}-${path.basename(destination)}.png`);
  fs.writeFileSync(temporary,png(out,w,h));
  try{execFileSync('sips',['-s','format','jpeg','-s','formatOptions',String(quality),temporary,'--out',destination],{stdio:'ignore'});fs.writeFileSync(destination,stripJpegMetadata(fs.readFileSync(destination)));}finally{fs.rmSync(temporary,{force:true});}
  return {width:w,height:h};
 }finally{file.close();file.delete();}
}
