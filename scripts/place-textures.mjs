// npm run place:textures -- <city> <place> [--only=name,...]
// Photo textures for a place's walls: each panel in cities/<city>/<place>-reference.json → photoPanels
// names a downloaded reference photo (npm run photos:fetch), the four corners of a wall area in that
// photo (top-left, top-right, bottom-right, bottom-left, in photo pixels) and the same area's size on
// the building in metres (u along the wall, y up). The photo is perspective-corrected (rectified) to
// that rectangle at `ppm` pixels per metre, people and street furniture in front are covered with
// `patches` copied from elsewhere on the same wall, and the result is written as a JPEG next to the
// place's data (public/cities/<city>/places/<place>/<name>.jpg) for src/photo-panels.js.
// The textures are derivatives of the photos: they keep the photo's licence (see the sources file).
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {homography} from '../src/photo-panels-data.js';

const args=process.argv.slice(2),[city,place]=args.filter(a=>!a.startsWith('--')),only=(args.find(a=>a.startsWith('--only='))||'').slice(7).split(',').filter(Boolean);
if(!city||!place)throw Error('Usage: npm run place:textures -- <city> <place>');
const ref=JSON.parse(fs.readFileSync(path.join('cities',city,`${place}-reference.json`)));
const reg=JSON.parse(fs.readFileSync('public/cities/index.json')).cities.find(c=>c.id===city);
const out=path.join('public',reg.dataRoot,'places',place);fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.PW_CHANNEL||'chrome',headless:true});const page=await browser.newPage();
// Ground textures: a patch of paving near the camera, rectified to a tile and made seamless.
const panels=[...(ref.photoPanels||[]),...(ref.groundTextures||[]).map(g=>({...g,u:[0,g.size[0]],y:[0,g.size[1]],ppm:g.ppm||Math.round(512/g.size[0]),ground:true}))];
for(const p of panels){
 if(only.length&&!only.includes(p.name)||p.copyOf)continue;
 const ppm=p.ppm||32,W=Math.min(2048,Math.round((p.u[1]-p.u[0])*ppm)),H=Math.min(2048,Math.round((p.y[1]-p.y[0])*ppm));
 // Output pixel (0,0) is the top-left corner of the wall area; map output → photo.
 const Hm=homography([[0,0],[W,0],[W,H],[0,H]],p.corners);
 const src='data:image/jpeg;base64,'+fs.readFileSync(path.join('data/raw/photos',city,place,p.photo)).toString('base64');
 const toPx=([u,y])=>[(u-p.u[0])*W/(p.u[1]-p.u[0]),(p.y[1]-y)*H/(p.y[1]-p.y[0])];
 const patches=(p.patches||[]).map(q=>{const [x0,y1]=toPx([q.from[0],q.from[1]]),[x1,y0]=toPx([q.from[0]+q.from[2],q.from[1]+q.from[3]]),[tx,ty1]=toPx(q.to);return {sx:x0,sy:y0,w:x1-x0,h:y1-y0,dx:tx,dy:ty1-(y1-y0),flip:!!q.flip};});
 const data=await page.evaluate(async({src,W,H,Hm,patches,quality,seamless})=>{
  const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
  const s=g.getImageData(0,0,im.width,im.height).data,o=new ImageData(W,H),d=o.data,sw=im.width,sh=im.height;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const X=x+.5,Y=y+.5,w=Hm[6]*X+Hm[7]*Y+Hm[8],u=(Hm[0]*X+Hm[1]*Y+Hm[2])/w-.5,v=(Hm[3]*X+Hm[4]*Y+Hm[5])/w-.5;
   const x0=Math.max(0,Math.min(sw-2,Math.floor(u))),y0=Math.max(0,Math.min(sh-2,Math.floor(v))),fx=Math.max(0,Math.min(1,u-x0)),fy=Math.max(0,Math.min(1,v-y0)),k=(y*W+x)*4;
   for(let ch=0;ch<3;ch++){const a=s[(y0*sw+x0)*4+ch],b=s[(y0*sw+x0+1)*4+ch],e=s[((y0+1)*sw+x0)*4+ch],f=s[((y0+1)*sw+x0+1)*4+ch];d[k+ch]=(a*(1-fx)+b*fx)*(1-fy)+(e*(1-fx)+f*fx)*fy;}d[k+3]=255;}
  const r=document.createElement('canvas');r.width=W;r.height=H;const rg=r.getContext('2d');rg.putImageData(o,0,0);
  const copy=document.createElement('canvas');copy.width=W;copy.height=H;copy.getContext('2d').drawImage(r,0,0);
  for(const q of patches){rg.save();if(q.flip){rg.translate(q.dx+q.w,q.dy);rg.scale(-1,1);rg.drawImage(copy,q.sx,q.sy,q.w,q.h,0,0,q.w,q.h);}else rg.drawImage(copy,q.sx,q.sy,q.w,q.h,q.dx,q.dy,q.w,q.h);rg.restore();}
  // Seamless tiling: blend in a copy shifted by half a tile wherever the original nears its edges.
  if(seamless){const a=rg.getImageData(0,0,W,H),b=new Uint8ClampedArray(a.data);
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){const ex=Math.min(x,W-1-x)/(W/2),ey=Math.min(y,H-1-y)/(H/2),w=Math.min(1,Math.min(ex,ey)*2.2),sx=(x+W/2|0)%W,sy=(y+H/2|0)%H,k=(y*W+x)*4,k2=(sy*W+sx)*4;
    for(let c=0;c<3;c++)a.data[k+c]=b[k+c]*w+b[k2+c]*(1-w);}
   rg.putImageData(a,0,0);}
  return r.toDataURL('image/jpeg',quality).split(',')[1];
 },{src,W,H,Hm,patches,quality:p.quality||.84,seamless:!!p.ground});
 const file=path.join(out,`${p.name}.jpg`);fs.writeFileSync(file,Buffer.from(data,'base64'));console.log(`${file} ${W}×${H} (${Math.round(fs.statSync(file).size/1024)} kB)`);
}
await browser.close();
