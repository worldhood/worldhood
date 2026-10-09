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
export function panelOutline(p){
 const [u0,u1]=p.u,[y0,y1]=p.y;
 if(p.shape==='gable'){const e=p.eave??(y0+(y1-y0)*.75),a=p.apexU??(u0+u1)/2;return [[u0,y0],[u1,y0],[u1,e],[a,y1],[u0,e]];}
 return [[u0,y0],[u1,y0],[u1,y1],[u0,y1]];
}
// Checks one panel description; returns a list of problems.
export function checkPanel(p){
 const e=[],n=p?.name||'?';
 if(!/^[a-z0-9-]+$/.test(p?.name||''))e.push(`${n}: name in lower-case-with-dashes`);
 if(!p.landmark&&!p.building)e.push(`${n}: landmark type or building id`);
 if(!Array.isArray(p.corners)||p.corners.length!==4||!p.corners.flat().every(Number.isFinite))e.push(`${n}: four photo corners [x,y]`);
 for(const k of ['u','y'])if(!Array.isArray(p[k])||p[k].length!==2||!(p[k][1]>p[k][0]))e.push(`${n}: ${k} = [min, max] metres`);
 if(!p.photo)e.push(`${n}: photo`);
 return e;
}
