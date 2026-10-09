// Local metres: X east, Z south. Municipal footprint IDs are the placement
// authority; photography is an appearance reference, NOT a texture source.
export const HARBOUR_REFERENCE = {
  capture: '2024-08',
  limitations: 'Flattened terrain. Railings, poles, ferry berth and apron props are photo-guided approximations, not surveyed object transforms.',
};
export const CYCLE_SURFACES = [41192,42153,45853,45855];
export const PLATFORM_SURFACES = [41194,41195,45847,45848];
export const PLATFORM_RAILS = [
  {id:41195,points:[[226.65,969.4],[226.40,962],[225.55,951],[224.8,943]]},
  {id:41194,points:[[240.5,969.5],[239.85,957.3],[235.3,941]]},
  {id:45847,points:[[16.56,535.6],[18.39,567.3]]},
  {id:45848,points:[[25.89,535.3],[27.77,567.3]]},
];
export const HARBOUR_RAIL = [[251.4,969],[249.65,953.97],[245.81,939.91],[241.19,927.32],[236.58,916.81],[228,903],[218.3,887.32],[189.7,848.9],[178,833.7],[145,789.3],[110,742.2],[80.04,701.51],[69.5,685.28],[59.78,665.9]];
// A static Silja-class silhouette, not a live vessel position. Published
// dimensions: https://www.tallink.com/on-board/fleet/silja-symphony
export const FERRY = {x:365,z:870,yaw:.64,length:203,width:31.5};
export const surfaceId = p => Number(p.id.split('.').pop());
export const inHarbour = p => ['Laivasillankatu','Eteläranta','Olympiaranta'].includes(p.name) && p.bbox[1]<1150 && p.bbox[3]>460;
