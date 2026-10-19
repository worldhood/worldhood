// Shared dimensions for the fabric canopy footprint and its gameplay obstacle.
export function marketStallRing(s,clearance=0){
 const w=2.3+clearance,d=1.7+clearance,c=Math.cos(s.yaw),n=Math.sin(s.yaw);
 return [[-w,-d],[w,-d],[w,d],[-w,d],[-w,-d]].map(([x,z])=>[s.x+c*x+n*z,s.z-n*x+c*z]);
}
