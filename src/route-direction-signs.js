import * as THREE from 'three';
import {objectBehavior} from './world-objects.js';

// This is a real WALL-MOUNTED board, not an invented overhead gantry.
// Transcription and façade side observed in the linked property photograph.
// Location fitted to municipal RATU1760 footprint; dimensions/height estimated.
export const KANAVAKATU_CENTRUM_SIGN = Object.freeze({
  id: 'kanavakatu-1-centrum-wall',
  lines: Object.freeze(['KESKUSTA', 'CENTRUM']),
  arrow: 'left',
  mounting: 'wall',
  buildingRatu: 1760,
  x: 625.59, z: 388.95, y: 3.85,
  angle: -0.592,
  width: 2.5, height: 0.88,
  source: 'https://images.nooflab.tools/locations/1415/main_01.jpg',
  sourcePage: 'https://kaikkitoimitilat.fi/space/328',
  imageryDate: null,
  observed: 'Two uppercase text lines, left-pointing black wedge, white board with black border, mounted on Kanavakatu 1 brick wall by Locanda Scappi.',
  estimated: 'Placement within approximately 2 m along measured municipal façade; width, mounting height and material finish photo-guided, not surveyed.',
});

// Parameter permits geometry tests in Node without introducing a canvas package.
export function createRouteDirectionSigns({canvasFactory = () => globalThis.document?.createElement('canvas')} = {}) {
  const root = new THREE.Group();
  root.name = 'Reference-observed Kanavakatu destination board';
  const data = KANAVAKATU_CENTRUM_SIGN;
  const board = new THREE.Group();
  board.name = data.id;
  board.position.set(data.x, data.y, data.z);
  board.rotation.y = data.angle;
  const metal = new THREE.MeshStandardMaterial({color: '#939995', roughness: 0.5, metalness: 0.5});
  const panel = new THREE.Mesh(new THREE.BoxGeometry(data.width + 0.025, data.height + 0.025, 0.055), metal);
  panel.castShadow = true;
  board.add(panel);
  const canvas = canvasFactory();
  let texture = null;
  if (canvas) {
    canvas.width = 1536; canvas.height = 544;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#efefe8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#202524'; ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    // Photograph shows a solid left wedge rather than a shaft-and-head arrow.
    ctx.fillStyle = '#202524';
    ctx.beginPath(); ctx.moveTo(45, 272); ctx.lineTo(283, 40); ctx.lineTo(283, 504); ctx.closePath(); ctx.fill();
    ctx.font = '500 194px Arial, sans-serif'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(data.lines[0], 355, 167, 1110);
    ctx.fillText(data.lines[1], 355, 385, 1110);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(data.width, data.height),
    new THREE.MeshStandardMaterial({map: texture, color: texture ? '#ffffff' : '#efefe8', roughness: 0.82}));
  face.position.z = 0.03;
  board.add(face);
  // Two small rear stand-offs attach to the wall: no pavement or lane poles.
  for (const x of [-0.9, 0.9]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.58, 0.15), metal);
    bracket.position.set(x, 0, -0.09); board.add(bracket);
  }
  board.userData = {...data};
  root.add(board);
  // Mounted above street level on an already collidable mapped building.
  root.obstacles=[];root.worldObjects=[objectBehavior({id:data.id,buildingRatu:data.buildingRatu,minY:data.y-data.height/2},'decoration')];
  root.userData = {count: 1, overheadCount: 0, status: 'Reference-observed text; photo-guided placement; unknown imagery date'};
  return root;
}
