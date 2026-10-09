import {crossingPolygons} from './crossing-markings.js';
import {createSofiankatuSigns,SOFIANKATU_SIGN_POSTS} from './sofiankatu-signs.js';
import {SpatialIndex,segmentDistance} from './geo.js';
import {authoredOlympiaMarkings} from './road-safety.js';

export function routeCrossingPosts(city,edges){
 const roads=new SpatialIndex(city.roads.filter(p=>p.kind!=='Koroke')),pavement=new SpatialIndex(city.pavement),safe=new SpatialIndex([...city.pavement,...city.roads.filter(p=>p.kind==='Koroke')]),buildings=new SpatialIndex(city.buildings);
 const world={roads,pavement},crossings=crossingPolygons(edges,world,{excluded:authoredOlympiaMarkings});
 const painted=crossings.polygons.map(p=>p[0][0]),posts=[],missing=[];
 const names=new Set(['Laivasillankatu','Eteläranta','Pohjoisesplanadi','Mariankatu','Aleksanterinkatu','Unioninkatu','Kaivokatu','Mannerheimintie','Nordenskiöldinkatu']);
 const route=new SpatialIndex(city.roads.filter(r=>names.has(r.name)));
 const clear=(x,z)=>[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]].every(([a,b])=>safe.at(x+a,z+b)&&!roads.at(x+a,z+b)&&!buildings.at(x+a,z+b));
 for(const [id,chain]of crossings.chains.entries()){
  if(!chain.points.some((b,i)=>{if(!i)return false;const a=chain.points[i-1],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let j=0;j<=n;j++)if(route.at(a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n))return true;return false;}))continue;
  if(!painted.some(([x,z])=>chain.points.some((b,i)=>i&&segmentDistance(x,z,chain.points[i-1],b)<2)))continue;
  for(const end of [0,1]){const tip=end?chain.points.at(-1):chain.points[0],other=end?chain.points.at(-2):chain.points[1],l=Math.hypot(tip[0]-other[0],tip[1]-other[1]),dx=(tip[0]-other[0])/l,dz=(tip[1]-other[1])/l;
   if([...posts,...SOFIANKATU_SIGN_POSTS].some(p=>Math.hypot(p.x-tip[0],p.z-tip[1])<5)||authoredOlympiaMarkings(...tip))continue;
   let anchor=null;
   for(const along of [0,.6,1.2,2,3,4,6]){for(const side of [1.7,-1.7,2.3,-2.3,.8,-.8]){const x=tip[0]+dx*along-dz*side,z=tip[1]+dz*along+dx*side;if(clear(x,z)){anchor={x,z,y:0,id:`crossing-${id}-${end}`,normal:[dz,-dx]};break;}}if(anchor)break;}
   if(anchor){posts.push(anchor,{...anchor,id:anchor.id+'-reverse',normal:anchor.normal.map(v=>-v)});}else missing.push({id,end,tip});
  }
 }
 return {posts,missing};
}
export function createRouteCrossingSigns(city,edges){
 const {posts,missing}=routeCrossingPosts(city,edges),group=createSofiankatuSigns(city,{island:false,posts});
 group.name='Road-safe signs paired with rendered zebra crossings';group.userData.missing=missing;group.userData.accuracy='Crossing-linked placement constrained to pavement; exact pole positions outside photographed locations unverified.';return group;
}
