// Anticipate bends in the mapped polyline, including the outgoing junction.
// Physics still uses the original road path and swept clearance tests.
const angleBetween=(a,b)=>Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)));
const heading=(a,b)=>Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]));
export function cornerSpeedLimit(edge,s,cruise,nextEdges=[]){
 let limit=cruise;
 const consider=(angle,distance)=>{
  if(angle<.22||distance< -5)return;
  const turnSpeed=Math.max(3,8-angle*2.2);
  const brakingDistance=Math.max(0,distance-2);
  limit=Math.min(limit,Math.sqrt(turnSpeed*turnSpeed+7*brakingDistance));
 };
 for(let i=1;i<edge.points.length-1;i++){
  const d=edge.cumulative[i]-s;
  if(d>cruise*cruise/7+5)break;
  consider(angleBetween(heading(edge.points[i-1],edge.points[i]),heading(edge.points[i],edge.points[i+1])),d);
 }
 const endHeading=heading(edge.points.at(-2),edge.points.at(-1));
 for(const next of nextEdges)if(next?.points.length>1)consider(angleBetween(endHeading,heading(next.points[0],next.points[1])),edge.length-s);
 return limit;
}
