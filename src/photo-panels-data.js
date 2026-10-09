// Pure helpers for photo panels: rectified photo textures on building walls (scripts/place-textures.mjs
// makes the textures, src/photo-panels.js puts them on the walls). No THREE, no DOM.

// 3×3 homography (row-major, h33 = 1) mapping four points `from` onto four points `to`.
export function homography(from,to){
 const A=[],b=[];
 for(let i=0;i<4;i++){const [x,y]=from[i],[u,v]=to[i];A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);}
 // Gaussian elimination with partial pivoting.
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];[b[c],b[p]]=[b[p],b[c]];
  for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/A[c][c];for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c];}}
 return [...A.map((row,i)=>b[i]/row[i]),1];
}
export const applyHomography=(h,[x,y])=>{const w=h[6]*x+h[7]*y+h[8];return [(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];};

// Outline of a panel in wall coordinates (u along the wall, y up). 'rect' covers the whole area;
// 'gable' is a rectangle up to `eave` with a triangular pediment rising to the top at u = 0 (or apexU).
// Optional visibleY clips geometry to the unobstructed part of a photo. Keep `y` unchanged:
// it describes the source texture, so clipping must not stretch the surviving photo over the wall.
export function panelOutline(p){
 const [u0,u1]=p.u,[y0,y1]=p.y;
 const e=p.eave??(y0+(y1-y0)*.75),a=p.apexU??(u0+u1)/2;
 let out=p.shape==='gable'?[[u0,y0],[u1,y0],[u1,e],[a,y1],[u0,e]]:[[u0,y0],[u1,y0],[u1,y1],[u0,y1]];
 if(p.visibleY)for(const [edge,sign] of [[p.visibleY[0],1],[p.visibleY[1],-1]]){
  const clipped=[];
  for(let i=0;i<out.length;i++){
   const a=out[i],b=out[(i+1)%out.length],insideA=(a[1]-edge)*sign>=0,insideB=(b[1]-edge)*sign>=0;
   if(insideA)clipped.push(a);
   if(insideA!==insideB){const t=(edge-a[1])/(b[1]-a[1]);clipped.push([a[0]+(b[0]-a[0])*t,edge]);}
  }
  out=clipped;
 }
 return out;
}
// Checks one panel description; returns a list of problems.
export function checkPanel(p){
 const e=[],n=p?.name||'?';
 if(!/^[a-z0-9-]+$/.test(p?.name||''))e.push(`${n}: name in lower-case-with-dashes`);
 if(!p.landmark&&!p.building)e.push(`${n}: landmark type or building id`);
 if(!Array.isArray(p.corners)||p.corners.length!==4||!p.corners.flat().every(Number.isFinite))e.push(`${n}: four photo corners [x,y]`);
 for(const k of ['u','y'])if(!Array.isArray(p[k])||p[k].length!==2||!(p[k][1]>p[k][0]))e.push(`${n}: ${k} = [min, max] metres`);
 if(p.visibleY!=null&&(!Array.isArray(p.visibleY)||p.visibleY.length!==2||!p.visibleY.every(Number.isFinite)||!(p.visibleY[1]>p.visibleY[0])||p.visibleY[0]<p.y?.[0]||p.visibleY[1]>p.y?.[1]))e.push(`${n}: visibleY must be an increasing range inside y`);
 if(!p.photo)e.push(`${n}: photo`);
 return e;
}
