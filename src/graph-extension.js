// Extension graphs keep lines that leave the main graph's ±2350 m box, so
// their seam endpoints coincide with main-graph nodes (same 0.75 m snapping).
export function mergeGraph(base,extra,signalOffset=0){
 const cell=p=>`${Math.floor(p[0])},${Math.floor(p[1])}`,cells=new Map();
 const addCell=(p,i)=>{const k=cell(p);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);};
 base.nodes.forEach(addCell);
 const remap=extra.nodes.map(p=>{
  const x=Math.floor(p[0]),z=Math.floor(p[1]);
  for(let i=x-1;i<=x+1;i++)for(let j=z-1;j<=z+1;j++)for(const n of cells.get(`${i},${j}`)||[])if(Math.hypot(base.nodes[n][0]-p[0],base.nodes[n][1]-p[1])<.75)return n;
  base.nodes.push(p);const n=base.nodes.length-1;addCell(p,n);if(base.outgoing)base.outgoing.push([]);return n;
 });
 for(const e of extra.edges){
  const edge={...e,from:remap[e.from],to:remap[e.to],signal:e.signal>=0?e.signal+signalOffset:-1};
  if(base.outgoing){edge.id=base.edges.length;edge.cumulative=[0];for(let i=1;i<edge.points.length;i++)edge.cumulative.push(edge.cumulative.at(-1)+Math.hypot(edge.points[i][0]-edge.points[i-1][0],edge.points[i][1]-edge.points[i-1][1]));edge.length=edge.cumulative.at(-1);base.outgoing[edge.from].push(edge);}
  base.edges.push(edge);
 }
 return remap;
}

