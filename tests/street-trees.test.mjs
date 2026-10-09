import test from 'node:test';
import assert from 'node:assert/strict';
import {MANNERHEIMINTIE_CORRIDOR,mannerheimintieTree,treeVariant,treeHeight,crownWidthRatio,STREET_VARIANTS} from '../src/street-trees.js';
import {TREE_LOD,detailedTreeLevel} from '../src/tile-lod.js';

test('Mannerheimintie corridor covers the Lasipalatsi stops, Narinkkatori and the Kiasma end, not Esplanadi',()=>{
 assert.ok(mannerheimintieTree(-797,-15),'Lasipalatsi stops');
 assert.ok(mannerheimintieTree(-823,40),'Narinkkatori maples');
 assert.ok(mannerheimintieTree(-830,-121),'Postitalo/Kiasma rows');
 assert.ok(!mannerheimintieTree(-400,300),'Esplanadi stays on its own rule');
 assert.ok(!mannerheimintieTree(-797,200)&&!mannerheimintieTree(-600,0));
 const c=MANNERHEIMINTIE_CORRIDOR;assert.ok(c.x[0]<c.x[1]&&c.z[0]<c.z[1]);
});

test('registered species pick the lime template on the boulevard and lean broadleaf for its maples',()=>{
 assert.equal(treeVariant('PUISTOLEHMUS',7,true),4);assert.equal(treeVariant('LEHMUS',7,false),4,'limes are limes everywhere');
 assert.equal(treeVariant('ISOLEHTILEHMUS',0,true),4);
 assert.equal(treeVariant('METSÄVAAHTERA',3,true),5,'corridor maples use the lean street template');
 assert.equal(treeVariant('METSÄVAAHTERA',3,false),1,'elsewhere maples keep the oak proxies');
 assert.equal(treeVariant('RAUDUSKOIVU',0,true),2);assert.equal(treeVariant('METSÄMÄNTY',0,true),3);
 assert.ok(STREET_VARIANTS.has(4)&&STREET_VARIANTS.has(5)&&!STREET_VARIANTS.has(0));
});

test('street trees are mature 12–16 m crowns by trunk class, young replacements shorter, harbour unchanged',()=>{
 assert.equal(treeHeight('10 - 20 cm',{variant:4}),13);assert.equal(treeHeight('30 - 50 cm',{variant:5}),15);
 assert.equal(treeHeight('50 - 70 cm',{variant:4}),16);assert.equal(treeHeight('70 cm -',{variant:4}),16);
 assert.equal(treeHeight('0 - 10 cm',{variant:4}),10);assert.equal(treeHeight(null,{variant:4}),12);
 assert.equal(treeHeight('50 - 70 cm',{harbour:true,variant:4}),13);
 assert.equal(treeHeight('50 - 70 cm',{variant:0}),14);assert.equal(treeHeight('10 - 20 cm',{variant:0}),10.5);
 assert.ok(crownWidthRatio(4)<crownWidthRatio(5),'limes are narrower than maples');assert.equal(crownWidthRatio(3),.43);
});

test('canopy shadows cast across the whole near band: a shorter band left a shadow edge travelling with the car',()=>{
 // Casting used to stop at 70 m while canopies stayed visible to 150 m, so every tree row ahead was
 // shadowless until the car got close: a dark patch that moved with the player. 150 m costs no
 // measurable FPS (57 driving at DPR 2 on the harbour approach).
 assert.equal(TREE_LOD.detailShadow,TREE_LOD.detailNear);
 assert.equal(detailedTreeLevel(null,TREE_LOD.detailShadow-1),'near');
});
