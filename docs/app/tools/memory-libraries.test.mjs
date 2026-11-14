import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIO_TOOL, DEFAULT_LIBRARY_ID, EMBED_MODEL, LEGACY_MEMORY_KEY, LEGACY_SUMMARY_KEY, LIBRARIES_KEY, RETRIEVE_TOOL,
  activeLibrary, applyBio, bioResult, clearLibrary, createLibrary, hybridRetrieval, memoryLabel, normalizeVector, readStore, redactOperations,
  renameLibrary, replaceActive, retrieveMemory, switchLibrary, vectorMatches, vectorsFromEmbedding, writeStore,
} from '../js/live/memory-libraries.js';

function storage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: (key) => { delete data[key]; },
    data,
  };
}

test('legacy notes become the default library once', () => {
  const box = storage({
    [LEGACY_MEMORY_KEY]: JSON.stringify(['看到杯子 → 这是杯子']),
    [LEGACY_SUMMARY_KEY]: '上次说到杯子',
  });
  const loaded = readStore(box);
  assert.equal(loaded.migrated, true);
  assert.equal(activeLibrary(loaded.store).notes[0], '看到杯子 → 这是杯子');
  assert.equal(activeLibrary(loaded.store).summary, '上次说到杯子');
  const saved = writeStore(box, loaded.store);
  assert.equal(saved.activeId, DEFAULT_LIBRARY_ID);
  assert.equal(box.getItem(LEGACY_MEMORY_KEY), null);
  assert.equal(readStore(box).migrated, false);
});

test('libraries can be created, switched, renamed and cleared without touching the others', () => {
  let store = createLibrary(readStore(storage()).store, '工作', 'work');
  store = replaceActive(store, { ...activeLibrary(store), bio: ['用户在做演示'] });
  store = switchLibrary(store, DEFAULT_LIBRARY_ID);
  assert.equal(activeLibrary(store).bio.length, 0);
  store = renameLibrary(store, 'work', '办公');
  assert.equal(store.libraries.find((item) => item.id === 'work').name, '办公');
  store = clearLibrary(store, 'work');
  assert.equal(store.libraries.find((item) => item.id === 'work').bio.length, 0);
  assert.throws(() => createLibrary(store, '办公'), /同名/);
  assert.throws(() => createLibrary(store, '   '), /名称/);
  assert.throws(() => switchLibrary(store, 'missing'), /没有这个记忆库/);
  let full = store;
  for (let i = 0; i < 6; i += 1) full = createLibrary(full, `库${i}`, `lib${i}`);
  assert.throws(() => createLibrary(full, '再来一个', 'extra'), /最多 8/);
  assert.match(memoryLabel(store), /默认/);
  assert.match(memoryLabel(switchLibrary(store, 'work')), /办公/);
});

test('bio edits keep numbered facts and retrieval stays on this library', () => {
  assert.equal(BIO_TOOL.function.name, 'omnibio');
  assert.equal(RETRIEVE_TOOL.function.name, 'omniretrieve');
  const library = {
    id: 'default',
    name: '默认',
    bio: ['用户喜欢喝茶', '用户住在杭州'],
    notes: ['看到杯子 → 这是杯子'],
    summary: '上次说到杯子',
  };
  const ops = redactOperations({
    add: ['用户每周三开会', 'sk-notarealkey12345678'],
    update: [{ index: 0, content: '用户喜欢喝绿茶' }],
    delete: [1],
  }, (value) => String(value || '').replace(/sk-[A-Za-z0-9]+/g, ''));
  const bio = applyBio(library, ops);
  assert.deepEqual(bio, ['用户喜欢喝绿茶', '用户每周三开会']);
  assert.match(bioResult(bio), /0\. 用户喜欢喝绿茶/);
  const found = retrieveMemory({ ...library, bio }, { query: '绿茶 开会', source: 'dialogue' });
  assert.match(found, /绿茶/);
  assert.match(found, /开会/);
  assert.match(retrieveMemory(library, { query: '杯子', source: 'dialogue' }), /杯子/);
  assert.equal(retrieveMemory(library, { query: '窗外的树', source: 'env' }), '这台浏览器没有视觉观察记录。');
  assert.equal(retrieveMemory(library, { query: '没有的词', source: 'dialogue' }), '没有找到相关记忆。');
  assert.throws(() => retrieveMemory(library, { query: '  ', source: 'dialogue' }), /检索词是空的/);
  const saved = writeStore(storage({ [LIBRARIES_KEY]: 'null' }), { activeId: 'default', libraries: [{ ...library, bio }] });
  assert.equal(activeLibrary(saved).bio[0], '用户喜欢喝绿茶');
});

test('vector retrieval ranks by cosine and merges with keyword hits', () => {
  assert.equal(EMBED_MODEL, 'text-embedding-v4');
  const unit = normalizeVector([3, 4]);
  assert.equal(unit.length, 2);
  assert.ok(Math.abs(unit[0] - 0.6) < 1e-12);
  assert.equal(normalizeVector([0, 0]), null);
  assert.equal(normalizeVector([Number.NaN]), null);
  const body = { data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] };
  const parsed = vectorsFromEmbedding(body, 2);
  assert.deepEqual(parsed[0], [1, 0]);
  assert.equal(vectorsFromEmbedding({ data: [{ index: 0, embedding: [1] }] }, 2), null);
  const corpus = ['用户喜欢喝茶', '看到杯子'];
  const hits = vectorMatches(corpus, [1, 0], [[0, 1], [1, 0]]);
  assert.deepEqual(hits.map((item) => item.text), ['看到杯子']);
  const merged = hybridRetrieval('没有找到相关记忆。', hits);
  assert.equal(merged, '看到杯子');
  const both = hybridRetrieval('用户喜欢喝茶\n看到杯子', hits);
  assert.equal(both.split('\n')[0], '看到杯子');
});
