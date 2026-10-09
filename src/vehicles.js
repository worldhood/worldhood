export {createDetailedVehicle as createVehicle,VEHICLE_TYPES} from './vehicle-models.js';
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
// Body pitch (nose up positive, car faces -z) and roll from the change in
// speed and the steering input, eased with a frame-rate independent lag.
export function bodyPoseTargets(speed,previousSpeed,steer,dt,braking=false){
 const accel=dt>0?(speed-previousSpeed)/dt:0;
 const pitch=clamp(accel*.009,-.055,.035)+(braking&&Math.abs(speed)>1?-.012:0);
 const roll=clamp(-steer*speed*.0032,-.045,.045);
 return {pitch,roll};
}
export function animateVehicle(model,speed,steer,dt,braking=false){
 for(const w of model.userData.wheels){if(w.front)w.pivot.rotation.y=steer*.48;w.spin.rotation.x-=speed*dt/w.radius;}
 if(model.userData.tail)model.userData.tail.emissiveIntensity=braking?1.6:.35;
 const u=model.userData,body=u.body;
 if(!body)return;
 if(dt>0){
  const target=bodyPoseTargets(speed,u.lastSpeed??speed,steer,dt,braking);
  // Dive/squat settle in ~0.25 s; roll follows the steering a little faster.
  const a=1-Math.exp(-dt*7),b=1-Math.exp(-dt*9);
  u.pitch=(u.pitch||0)+(target.pitch-(u.pitch||0))*a;u.roll=(u.roll||0)+(target.roll-(u.roll||0))*b;
 }
 u.lastSpeed=speed;
 body.rotation.x=u.pitch||0;body.rotation.z=u.roll||0;
 // Keep the sills near the wheel arches: pitch about the axle line, not the ground.
 body.position.y=-Math.abs(u.pitch||0)*.1;
}
