// Clip a triangle against horizontal planes while preserving its winding.
// Dropping a whole triangle at a height cutoff leaves holes in tall wall faces.
export function clipTriangleHeight(vertices, minY, maxY){
 let polygon=vertices.map(v=>v.slice(0,3));
 for(const [height,above] of [[minY,true],[maxY,false]]){
  const result=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length];
   const inside=v=>above?v[1]>=height:v[1]<=height,ia=inside(a),ib=inside(b);
   if(ia)result.push(a);
   if(ia!==ib){const t=(height-a[1])/(b[1]-a[1]);result.push([a[0]+(b[0]-a[0])*t,height,a[2]+(b[2]-a[2])*t]);}
  }
  polygon=result;
 }
 const triangles=[];for(let i=1;i+1<polygon.length;i++)triangles.push([polygon[0],polygon[i],polygon[i+1]]);
 return triangles;
}
