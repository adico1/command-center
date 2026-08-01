const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appPath = path.join(__dirname, '..', 'app.js');
const appCode = fs.readFileSync(appPath, 'utf8');
const vm = require('node:vm');

function runTests() {
  const context = {
    console,
    crypto: { randomUUID: () => 'mock-id' },
    localStorage: {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, value) { this.store[key] = String(value); },
      clear() { this.store = {}; },
    },
    window: {},
    document: {},
    module: { exports: {} },
    exports: {},
    URLSearchParams,
  };

  context.window = context;
  context.window.location = { search: '' };
  context.document = { getElementById: () => null };
  context.window.addEventListener = () => { };
  context.window.matchMedia = () => ({ matches: false });
  context.window.QRCode = { toCanvas: (_canvas, _text, _options, cb) => cb(null) };
  context.window.deferredPrompt = null;

  vm.runInNewContext(appCode, context);
  const app = context.module.exports;

  const state = app.loadState();
  assert.ok(state.commands.length >= 1, 'default commands should exist');

  const nextState = { ...state, commands: [...state.commands, { id: 'x', target: 'desk-pc', text: 'report', token: 't', status: 'queued', note: 'test' }] };
  app.saveState(nextState);
  const saved = app.loadState();
  assert.ok(saved.commands.length >= 2, 'state should persist updates');
  assert.equal(app.getDeviceIdFromUrl(), 'phone-asker');
  console.log('tests passed');
}

runTests();
