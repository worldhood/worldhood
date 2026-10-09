import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {KANAVAKATU_CENTRUM_SIGN as sign, createRouteDirectionSigns} from '../src/route-direction-signs.js';

test('Kanavakatu observed destination wording is not replaced by invented port or overhead signage', () => {
  assert.deepEqual(sign.lines, ['KESKUSTA', 'CENTRUM']);
  assert.equal(sign.arrow, 'left');
  assert.equal(sign.mounting, 'wall');
  assert.equal(sign.buildingRatu, 1760);
  assert.equal(sign.imageryDate, null, 'do not turn a website date into an imagery date');
  assert.match(sign.estimated, /not surveyed/);
});

test('destination board has outward face, finite bounds and no poles on roads', () => {
  const group = createRouteDirectionSigns({canvasFactory: () => null});
  group.updateMatrixWorld(true);
  assert.equal(group.userData.overheadCount, 0);
  assert.equal(group.children.length, 1);
  const bounds = new THREE.Box3().setFromObject(group);
  assert.ok(bounds.min.y > 3, 'wall board must not add road-level collision obstacles');
  assert.ok(bounds.max.y < 5);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(group.children[0].quaternion);
  assert.ok(normal.x < -0.5 && normal.z > 0.8, 'front faces southwest, away from the brick façade');
  group.traverse(object => {
    if (!object.isMesh) return;
    assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
    object.geometry.dispose(); object.material.dispose();
  });
});
