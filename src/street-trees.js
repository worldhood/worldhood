// Pure placement rules for the detailed street-tree set (no EZ-Tree import, so tests can load it).
// Mannerheimintie between Kamppi/Narinkkatori and Kiasma/Postitalo: the municipal register maps the
// boulevard's park limes (PUISTOLEHMUS/LEHMUS) in rows along both pavements and the central
// reservation; the Narinkkatori and Kamppi park maples at the south end share the corridor.
export const MANNERHEIMINTIE_CORRIDOR={x:[-905,-675],z:[-145,125]};
export function mannerheimintieTree(x,z){
 const c=MANNERHEIMINTIE_CORRIDOR;return x>c.x[0]&&x<c.x[1]&&z>c.z[0]&&z<c.z[1];
}
// Template variant per registered species: 0/1 broadleaf (oak silhouettes), 2 birch, 3 pine,
// 4 lime (lean dense crown), 5 lean street broadleaf for the corridor's maples and elms.
export function treeVariant(species='',hash=0,street=false){
 if(/MÄNTY|KUUSI/.test(species))return 3;
 if(/KOIVU/.test(species))return 2;
 if(/LEHMUS/.test(species))return 4;
 return street?5:hash%2;
}
export const STREET_VARIANTS=new Set([4,5]);
// Crown height (m) from the register's trunk-diameter class: mature boulevard limes reach 12–16 m,
// the youngest replacements stay shorter. Harbour trees keep their earlier estimate.
export function treeHeight(size,{harbour=false,variant=0}={}){
 if(harbour)return 13;
 if(STREET_VARIANTS.has(variant)){
  // The youngest classes are still rounded 10–13 m trees in 2025, not saplings.
  if(!size)return 12;
  if(/^0 /.test(size))return 10;
  if(/^10 /.test(size))return 13;
  if(/^20 /.test(size))return 13.5;
  if(/^30 /.test(size))return 15;
  return 16;
 }
 return /50|70|90/.test(size||'')?14:10.5;
}
export function crownWidthRatio(variant){return variant===3?.43:variant===4?.7:variant===5?.78:.68;}
