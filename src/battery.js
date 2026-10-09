// Deliberately arcade-sized range for the small playable city, not a claim
// about any real electric vehicle. Only actual travel consumes charge.
export const BATTERY_RANGE_METRES=30000;
export function consumeBattery(charge,metres,speed){
 const load=1+.4*Math.min(1,Math.abs(speed)/(140/3.6))**2;
 return Math.max(0,Math.min(1,charge)-Math.max(0,metres)*load/BATTERY_RANGE_METRES);
}
