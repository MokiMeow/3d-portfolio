import test from 'node:test';
import assert from 'node:assert/strict';
import { think, newMemory, addressRequest, addressed } from '../src/components/pages/home/vision/jarvis/brain.ts';

const apps = [
  { id: 'music', name: 'Music' }, { id: 'nightsky', name: 'Night Sky' }, { id: 'safari', name: 'Safari' }, { id: 'mac', name: 'Mac Virtual Display' },
  { id: 'beatstudio', name: 'Beat Studio' }, { id: 'photos', name: 'Photos' }, { id: 'store', name: 'App Store' },
];
const environments = [{ id: 'room', name: 'My Room' }, { id: 'moon', name: 'The Moon' }, { id: 'night', name: 'Milky Way' }, { id: 'jupiter', name: 'Jupiter' }, { id: 'mondello', name: 'Mondello Beach' }];
const ctx = (over = {}) => ({
  now: new Date(2026, 9, 15, 14, 5), place: { id: 'room', name: 'My Room' }, immersion: 0, open: [], front: null, dark: false, viewOnly: false, focusMode: false,
  apps, environments, timers: [], address: 'sir', neural: false, objects: 0, ...over,
});
const run = (text, over) => think(text, ctx(over), newMemory());
const types = reply => reply.actions.map(action => action.type + (action.app ? ':' + action.app : action.id ? ':' + action.id : ''));

test('opens apps and goes places', () => {
  assert.deepEqual(types(run('Take me to the Moon')), ['environment:moon']);
  assert.deepEqual(types(run('hey jarvis, open night sky please')), ['open:nightsky']);
  assert.deepEqual(types(run('launch beat studio')), ['open:beatstudio']);
  assert.deepEqual(types(run('show me the stars')), ['environment:night']);
  assert.deepEqual(types(run('go to the beach')), ['environment:mondello']);
  assert.deepEqual(types(run('back to my room')), ['environment:room']);
  assert.deepEqual(types(run('open the mac')), ['open:mac']);
});

test('runs several commands in one breath', () => {
  assert.deepEqual(types(run('open music and take me to jupiter')), ['open:music', 'environment:jupiter']);
  assert.deepEqual(types(run('take me to the moon, then drop five glass cubes')), ['environment:moon', 'spawn']);
});

test('builds things in the space', () => {
  const reply = run('drop five glass cubes');
  assert.deepEqual(reply.actions, [{ type: 'spawn', shape: 'cube', count: 5, material: 'glass' }]);
  assert.equal(run('make a gold sphere').actions[0].count, 1);
  assert.equal(run('make a gold sphere').actions[0].material, 'gold');
  assert.equal(run('rain balls').actions[0].count, 24);
  assert.deepEqual(run('set gravity to moon').actions, [{ type: 'gravity', mode: 'moon' }]);
  assert.deepEqual(run('zero g').actions, [{ type: 'gravity', mode: 'zero' }]);
});

test('timers, view and windows', () => {
  assert.deepEqual(run('set a timer for 5 minutes').actions, [{ type: 'timer', seconds: 300, label: '' }]);
  assert.deepEqual(run('remind me in ten seconds to stretch').actions, [{ type: 'timer', seconds: 10, label: 'stretch' }]);
  assert.deepEqual(types(run('hide everything')), ['viewOnly']);
  const open = [{ id: 'music', name: 'Music' }, { id: 'safari', name: 'Safari' }];
  assert.deepEqual(types(run('arrange my windows', { open })), ['arrange']);
  assert.deepEqual(types(run('close safari', { open })), ['close:safari']);
  assert.deepEqual(types(run('close photos', { open })), []);
});

test('answers in character and never misfires on prose', () => {
  assert.match(run('status report', { open: [{ id: 'music', name: 'Music' }] }).say, /All systems nominal, sir\..*Music/);
  assert.equal(run('what time is it').kind, 'answer');
  assert.equal(run('tell me about quantum chromodynamics').kind, 'unknown');
  assert.deepEqual(run('I love rock and roll music').actions, []);
  assert.deepEqual(run('what do you think about the moon landing').actions, []);
});

test('addresses the wearer the way they asked', () => {
  assert.equal(addressRequest("call me ma'am"), "ma'am");
  assert.equal(addressRequest('my name is tony'), 'Tony');
  assert.equal(addressRequest('i am tired'), undefined);
  assert.equal(addressed('{a}. Of course, {a}.', 'boss'), 'Boss. Of course, boss.');
});
