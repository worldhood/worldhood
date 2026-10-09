// A map extension's buses and light rail (scripts/build-extension-transit.mjs → <area>/transit.json), joined
// to the running simulations when the area is installed. Installing the area's road graph afterwards
// (mobility.appendRegion) gives them their junction signals and lane relations.
export function installTransit(lines,{trams,tramRenderer,buses}){
 if(lines?.trams?.paths?.length)tramRenderer?.addPaths(trams.addPaths(lines.trams));
 if(lines?.buses?.paths?.length)buses.addPaths(lines.buses);
}
