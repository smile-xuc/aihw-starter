import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIO_TOOL, DEFAULT_LIBRARY_ID, EMBED_MODEL, LEGACY_MEMORY_KEY, LEGACY_SUMMARY_KEY, LIBRARIES_KEY, MAX_BIO, RETRIEVE_TOOL,
  activeLibrary, applyBio, applyMemoryPatch, bioReceipt, bioResult, cleanObservation, clearLibrary, cleanStm, createLibrary, datedEntries, emptyDialogue, emptyLtm, finishDialogue, formatUpdaterInput, hybridRetrieval, isEmptyPatch, ltmCount, memoryLabel, mergeVectorHits, normalizeDate, normalizeVector, observerPrompt, parsePatch, rankWithTime, readStore, recordExchange, recordObservation, redactOperations, rememberTurn,
  renameLibrary, renderProfile, renderRecent, replaceActive, resolveTimeRange, retrieveMemory, selectRecent, sessionFacts, shouldConsolidateLibrary, librarySwitchNote, spaceEnvHits, presentRetrieval, switchLibrary, vectorMatches, vectorsForTexts, vectorsFromEmbedding, writeStore,
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
  assert.equal(shouldConsolidateLibrary(true), false);
  assert.equal(shouldConsolidateLibrary(false), true);
  assert.match(librarySwitchNote('家', true), /这一通接下来用这套/);
  assert.match(librarySwitchNote('家', true), /挂断时整理/);
  assert.equal(librarySwitchNote('家', false), '当前记忆库是「家」。');
  const dated = [
    { text: '桌上有杯子', at: 1000 },
    { text: '桌上仍有杯子', at: 1200 },
    { text: '窗外开始下雨', at: 1600 },
  ];
  assert.deepEqual(spaceEnvHits(dated.map((item) => item.text), dated), ['桌上有杯子', '窗外开始下雨']);
  assert.deepEqual(spaceEnvHits(['近处', '正好十分钟'], [{ text: '近处', at: 100 }, { text: '正好十分钟', at: 700 }]), ['近处', '正好十分钟']);
  const presented = presentRetrieval('桌上有杯子\n桌上仍有杯子\n窗外开始下雨', [], dated, null, 'env');
  assert.equal(presented, '桌上有杯子\n窗外开始下雨');
  assert.equal(presentRetrieval('没有找到相关记忆。', [], dated, null, 'dialogue'), '没有找到相关记忆。');
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
  const applied = applyBio(library, ops);
  assert.deepEqual(applied.entries, ['用户喜欢喝绿茶', '用户每周三开会']);
  assert.equal(applied.result.added, 1);
  assert.equal(applied.result.updated, 1);
  assert.equal(applied.result.deleted, 1);
  assert.match(bioResult(applied.entries), /0\. 用户喜欢喝绿茶/);
  assert.match(bioReceipt(applied), /已更新长期事实/);
  const source = ['A', 'B', 'C'];
  const ordered = applyBio({ bio: source }, { update: [{ index: 1, content: 'new B' }], delete: [0, 2, 0], add: ['D'] });
  assert.deepEqual(ordered.entries, ['new B', 'D']);
  assert.equal(ordered.result.deleted, 2);
  assert.deepEqual(source, ['A', 'B', 'C']);
  const partial = applyBio({ bio: ['A'] }, {
    update: [{ index: true, content: 'bad' }, { index: 0.5, content: 'bad' }, { index: -1, content: 'bad' }, { index: 0, content: 'new' }],
    delete: [10],
    add: [false, '', 'new'],
  });
  assert.deepEqual(partial.entries, ['new']);
  assert.equal(partial.result.updated, 1);
  assert.equal(partial.result.skipped, 7);
  const crowded = applyBio({ bio: ['A', 'B'] }, { delete: [0], add: ['C', 'D'] }, { maxEntries: 2, maxEntryChars: 200 });
  assert.deepEqual(crowded.entries, ['B', 'C']);
  assert.equal(crowded.result.added, 1);
  assert.equal(crowded.result.skipped, 1);
  const packed = Array.from({ length: MAX_BIO }, (_, index) => `事实${index}`);
  const overflow = applyBio({ bio: packed }, { add: ['再加一条新的事实'] });
  assert.equal(overflow.entries.length, MAX_BIO);
  assert.equal(overflow.entries[0], '事实0');
  assert.equal(overflow.result.added, 0);
  assert.match(bioReceipt(overflow), /不会被挤掉/);
  const flowers = applyBio({ bio: [] }, { add: [' one\n two ', '🌻🌻🌻🌻'] }, { maxEntries: 8, maxEntryChars: 3 });
  assert.deepEqual(flowers.entries, ['one', '🌻🌻🌻']);
  assert.equal(applyBio({ bio: flowers.entries }, { update: [{ index: 0, content: 'one' }] }).result.changed, false);
  assert.equal(applyBio({ bio: flowers.entries }, null).result.malformed, true);
  const found = retrieveMemory({ ...library, bio: applied.entries }, { query: '绿茶 开会', source: 'dialogue' });
  assert.match(found, /绿茶/);
  assert.match(found, /开会/);
  assert.match(retrieveMemory(library, { query: '杯子', source: 'dialogue' }), /杯子/);
  assert.equal(retrieveMemory(library, { query: '窗外的树', source: 'env' }), '这套记忆库还没有视觉观察。');
  assert.equal(retrieveMemory(library, { query: '没有的词', source: 'dialogue' }), '没有找到相关记忆。');
  assert.throws(() => retrieveMemory(library, { query: '  ', source: 'dialogue' }), /检索词是空的/);
  const saved = writeStore(storage({ [LIBRARIES_KEY]: 'null' }), { activeId: 'default', libraries: [{ ...library, bio: applied.entries }] });
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

test('visual observations stay in the active library and out of dialogue search', () => {
  const sentence = '用户在厨房水槽前冲洗绿色黄瓜。';
  assert.equal(cleanObservation(`好的，${sentence}旁边还有一把刀。`), sentence);
  assert.equal(cleanObservation('你好。'), '');
  assert.equal(cleanObservation(sentence), sentence);
  assert.equal(cleanObservation('用户的钥匙是 sk-abcdefghijklmn。'), '');
  assert.equal(recordObservation({ env: [] }, '用户的钥匙是 sk-abcdefghijklmn。').length, 0);
  assert.match(observerPrompt('screen'), /屏幕截图/);
  assert.doesNotMatch(observerPrompt('camera'), /屏幕截图/);
  let lines = recordObservation({ env: [] }, `好的，${sentence}`, 100);
  lines = recordObservation({ env: lines }, sentence, 200);
  assert.deepEqual(lines, [{ content: sentence, at: 200 }]);
  for (let i = 0; i < 25; i += 1) lines = recordObservation({ env: lines }, `用户看到编号${i}的白色杯子放在桌上。`);
  assert.equal(lines.length, 20);
  assert.match(lines.at(-1).content, /编号24/);
  const library = { bio: ['用户喜欢喝茶'], notes: ['看到杯子'], summary: '', env: [sentence] };
  assert.match(retrieveMemory(library, { query: '厨房', source: 'env' }), /厨房/);
  assert.equal(retrieveMemory(library, { query: '厨房', source: 'dialogue' }), '没有找到相关记忆。');
  assert.equal(retrieveMemory({ bio: [], notes: [], summary: '' }, { query: '厨房', source: 'env' }), '这套记忆库还没有视觉观察。');
  const box = storage();
  let store = writeStore(box, { ...readStore(box).store, visual: true });
  store = replaceActive(store, { ...activeLibrary(store), env: [sentence] });
  store = writeStore(box, store);
  assert.equal(readStore(box).store.visual, true);
  assert.equal(activeLibrary(readStore(box).store).env[0].content, sentence);
  assert.equal(activeLibrary(readStore(box).store).env[0].at, 0);
  store = createLibrary(store, '工作', 'work');
  assert.equal(store.visual, true);
  assert.equal(activeLibrary(store).env.length, 0);
  store = clearLibrary(switchLibrary(store, 'default'), 'default');
  assert.equal(activeLibrary(store).env.length, 0);
  assert.match(memoryLabel(readStore(box).store), /视觉观察 1 条/);
});

test('hangup patch updates the durable profile and upcoming items', () => {
  assert.equal(normalizeDate('2026-11'), '2026-11-30');
  assert.equal(normalizeDate('2026-02-31'), null);
  const raw = '说明\n```json\n{"ltm_patch":{"set":{"name":"海铂"},"add":{"preferences":["喝茶"]}},"stm_patch":{"add":[{"content":"去上海出差（2026年11月18日）","status":"upcoming","event_date":"2026-11-18","expires":"2027-01-01"}]}}\n```';
  const patch = parsePatch(raw);
  assert.equal(isEmptyPatch(patch), false);
  assert.equal(isEmptyPatch({ ltm_patch: { add: {} }, stm_patch: { add: [] } }), true);
  let next = applyMemoryPatch({ ltm: emptyLtm(), stm: [], stmSeq: 0 }, patch, '2026-11-15');
  assert.equal(next.ltm.name, '海铂');
  assert.deepEqual(next.ltm.preferences, ['喝茶']);
  assert.equal(next.stm[0].id, 'stm_1');
  next = applyMemoryPatch({ ltm: next.ltm, stm: next.stm, stmSeq: next.stmSeq }, {
    ltm_patch: { remove: { preferences: ['喝茶'] }, add: { preferences: ['sk-notarealkey12345678'] } },
    stm_patch: { update: [{ id: 'stm_1', fields: { content: '去上海出差（2026年11月19日）', event_date: '2026-11-19' } }] },
  }, '2026-11-15');
  assert.deepEqual(next.ltm.preferences, []);
  assert.equal(next.stm[0].event_date, '2026-11-19');
  assert.match(next.stm[0].content, /11月19日/);
  const expired = applyMemoryPatch({ stm: [], stmSeq: 0 }, {
    stm_patch: { add: [{ content: '昨天的会（2026年11月14日）', status: 'upcoming', event_date: '2026-11-14', expires: '2026-11-14' }] },
  }, '2026-11-15');
  assert.equal(expired.stm.length, 0);
  const input = formatUpdaterInput({ ltm: next.ltm, stm: next.stm, notes: ['用户说喜欢喝茶 → 记住了'], today: '2026-11-15' });
  assert.match(input, /2026-11-15/);
  assert.match(input, /海铂/);
  assert.match(input, /stm_1/);
  assert.match(input, /记住了/);
  const withFacts = formatUpdaterInput({
    ltm: next.ltm,
    stm: next.stm,
    notes: ['用户说喜欢喝茶 → 记住了'],
    facts: ['用户喜欢喝绿茶', 'sk-notarealkey12345678'],
    today: '2026-11-15',
  });
  assert.match(withFacts, /用户喜欢喝绿茶/);
  assert.doesNotMatch(withFacts, /记住了/);
  assert.doesNotMatch(withFacts, /sk-/);
  const many = Array.from({ length: 70 }, (_, index) => `事实${index}`);
  const capped = formatUpdaterInput({ facts: many, notes: ['不要出现'], today: '2026-11-15' });
  assert.match(capped, /事实0/);
  assert.match(capped, /事实63/);
  assert.doesNotMatch(capped, /事实64/);
  assert.doesNotMatch(capped, /不要出现/);
  assert.deepEqual(sessionFacts(['用户喜欢喝茶'], ['用户喜欢喝茶', '用户每周三开会']), ['用户每周三开会']);
  const added = sessionFacts(['旧事实'], ['旧事实', ...many]);
  assert.equal(added.length, 64);
  assert.equal(added[0], '事实0');
  assert.equal(added.at(-1), '事实63');
  const library = { bio: [], notes: [], summary: '', ltm: next.ltm, stm: next.stm };
  assert.match(retrieveMemory(library, { query: '海铂', source: 'dialogue' }), /海铂/);
  assert.match(retrieveMemory(library, { query: '上海', source: 'dialogue' }), /上海/);
  assert.equal(retrieveMemory(library, { query: '上海', source: 'env' }), '这套记忆库还没有视觉观察。');
  const box = storage();
  const saved = writeStore(box, replaceActive(readStore(box).store, { ...activeLibrary(readStore(box).store), ltm: next.ltm, stm: next.stm, stmSeq: next.stmSeq }));
  assert.equal(activeLibrary(readStore(box).store).ltm.name, '海铂');
  assert.match(memoryLabel(saved), /长期资料/);
  assert.match(memoryLabel(saved), /近期事项/);
  const cleared = clearLibrary(saved, 'default');
  assert.equal(ltmCount(activeLibrary(cleared).ltm), 0);
  assert.equal(activeLibrary(cleared).stm.length, 0);
  assert.match(renderProfile(next.ltm), /姓名：海铂/);
  assert.match(renderRecent(next.stm, '2026-11-15'), /即将发生/);
});

test('time range reweights dated dialogue and still keeps outside hits', () => {
  const now = new Date('2026-11-15T08:00:00+08:00');
  const recent = Math.floor(now.getTime() / 1000) - 86400;
  const old = Math.floor(now.getTime() / 1000) - 10 * 86400;
  assert.equal(rememberTurn([], '密钥 sk-notarealkey12345678', recent).length, 0);
  let turns = rememberTurn([], '上周做了项目评审。', old);
  turns = rememberTurn(turns, '昨天在喝水。', recent);
  for (let i = 0; i < 45; i += 1) turns = rememberTurn(turns, `第${i}句补充对话内容。`, recent);
  assert.equal(turns.length, 40);
  const library = { bio: [], notes: [], summary: '', turns: [turns[0], { text: '昨天在喝水。', at: recent }, { text: '上周做了项目评审。', at: old }] };
  const keyword = retrieveMemory(library, { query: '项目 喝水', source: 'dialogue' });
  const ranked = rankWithTime(keyword, [], datedEntries(library, 'dialogue'), [2, 0], now);
  assert.equal(ranked.split('\n')[0], '昨天在喝水。');
  assert.match(ranked, /项目评审/);
  const swapped = resolveTimeRange([1, 14], now);
  assert.ok(swapped.from < swapped.to);
  const box = storage();
  const saved = writeStore(box, replaceActive(readStore(box).store, { ...activeLibrary(readStore(box).store), turns: library.turns }));
  assert.equal(activeLibrary(readStore(box).store).turns.at(-1).text, '上周做了项目评审。');
  assert.match(memoryLabel(saved), /带时间的对话/);
  const cleared = clearLibrary(saved, 'default');
  assert.equal(activeLibrary(cleared).turns.length, 0);
});

test('dialogue is cut into segments and older segments stay searchable', () => {
  const started = 1_700_000_000;
  assert.equal(recordExchange(emptyDialogue(), '密钥 sk-notarealkey12345678', '不要记', started).tail.length, 0);
  let state = emptyDialogue();
  for (let i = 0; i < 4; i += 1) state = recordExchange(state, `第${i}句在讨论日程`, '收到', started + i);
  assert.equal(state.segments.length, 0);
  state = recordExchange(state, '第五句才切开', '收到', started + 4);
  assert.equal(state.segments[0].reason, 'max_turns');
  assert.equal(state.tail.length, 1);
  assert.match(state.segments[0].text, /第0句/);
  assert.doesNotMatch(state.segments[0].text, /第五句/);
  let quiet = recordExchange(emptyDialogue(), '只有一句', '好', started);
  quiet = recordExchange(quiet, '一分钟后还没切开', '好', started + 120);
  assert.equal(quiet.segments.length, 0);
  let paused = recordExchange(emptyDialogue(), '第一句在开会', '好的', started);
  paused = recordExchange(paused, '第二句还在开会', '继续', started + 10);
  paused = recordExchange(paused, '停了一分钟', '嗯', started + 70);
  assert.equal(paused.segments[0].reason, 'silence_gap');
  assert.equal(paused.tail.length, 1);
  let bulky = recordExchange(emptyDialogue(), '长'.repeat(600), '答'.repeat(600), started);
  bulky = recordExchange(bulky, '下一句因为字数切开', '好', started + 1);
  assert.equal(bulky.segments[0].reason, 'max_chars');
  let archived = emptyDialogue();
  for (let i = 0; i < 81; i += 1) archived = finishDialogue(recordExchange(archived, `片段${i}里有独特词`, '收到', started + i));
  assert.equal(archived.segments.length, 80);
  assert.doesNotMatch(archived.segments[0].text, /片段0里/);
  assert.match(archived.segments.at(-1).text, /片段80里/);
  const old = Math.floor(new Date('2026-11-05T08:00:00+08:00').getTime() / 1000);
  const recent = Math.floor(new Date('2026-11-14T08:00:00+08:00').getTime() / 1000);
  let dialogue = finishDialogue(recordExchange(emptyDialogue(), '上周做了海洋馆的讲解', '记下了', old));
  dialogue = finishDialogue(recordExchange(dialogue, '昨天在整理船票', '好', recent));
  const library = { bio: [], notes: [], summary: '', turns: [], dialogue };
  const ranked = rankWithTime(retrieveMemory(library, { query: '海洋馆 船票', source: 'dialogue' }), [], datedEntries(library, 'dialogue'), [2, 0], new Date('2026-11-15T08:00:00+08:00'));
  assert.match(ranked.split('\n')[0], /船票/);
  assert.match(ranked, /海洋馆/);
  const box = storage();
  const saved = writeStore(box, replaceActive(readStore(box).store, { ...activeLibrary(readStore(box).store), dialogue }));
  assert.match(activeLibrary(readStore(box).store).dialogue.segments.at(-1).text, /船票/);
  assert.match(memoryLabel(saved), /对话片段 2 段/);
  const cleared = clearLibrary(saved, 'default');
  assert.equal(activeLibrary(cleared).dialogue.segments.length, 0);
  assert.equal(finishDialogue(dialogue).tail.length, 0);
});

test('cached segment vectors outrank a keyword miss', () => {
  const query = normalizeVector([1, 0, 0]);
  const near = normalizeVector([0.96, 0.28, 0]);
  const far = normalizeVector([0, 1, 0]);
  const texts = ['海洋馆讲解', '整理船票'];
  const separated = vectorsForTexts(texts, new Map([[texts[0], near], [texts[1], far]]), query.length);
  assert.deepEqual(separated.missing, []);
  const wrongSize = vectorsForTexts(['甲', '乙'], new Map([['甲', near]]), 4);
  assert.deepEqual(wrongSize.missing, ['甲', '乙']);
  const hits = vectorMatches(texts, query, texts.map((text) => separated.ready.get(text)));
  const merged = mergeVectorHits([[{ text: '整理船票', similarity: 0.1 }], hits]);
  assert.equal(merged[0].text, '海洋馆讲解');
  const ranked = rankWithTime('没有找到相关记忆。', merged, texts.map((text) => ({ text, at: 1 })), null);
  assert.match(ranked.split('\n')[0], /海洋馆/);
});

test('stale upcoming items leave the prompt and urgent ones stay', () => {
  const today = '2026-11-15';
  const noon = new Date(2026, 10, 15, 12, 0, 0);
  const stamp = Math.floor(noon.getTime() / 1000);
  const kept = cleanStm([
    { id: 'stm_1', content: '已经过了宽限的发布会', status: 'upcoming', event_date: '2026-11-10', created_ts: stamp },
    { id: 'stm_2', content: '昨天的讨论还在宽限里', status: 'upcoming', event_date: '2026-11-14', created_ts: stamp },
    { id: 'stm_3', content: '九十天前的进行事项', status: 'ongoing', created_ts: stamp - 91 * 86400 },
  ], today);
  assert.deepEqual(kept.stm.map((item) => item.id), ['stm_2']);
  const stamped = applyMemoryPatch({ stm: [], stmSeq: 0 }, {
    stm_patch: { add: [{ content: '正在写方案', status: 'ongoing' }] },
  }, today, noon);
  assert.equal(stamped.stm[0].created_ts, stamp);
  const rows = [];
  for (let index = 0; index < 8; index += 1) {
    rows.push({ id: `stm_${index + 1}`, content: '事'.repeat(150), status: 'ongoing', created_ts: stamp - (40 - index) * 86400 });
  }
  rows.push({ id: 'stm_9', content: '明天要交稿', status: 'upcoming', event_date: '2026-11-16', created_ts: stamp });
  const shown = selectRecent(rows, today, noon);
  assert.equal(shown.some((item) => item.id === 'stm_1'), false);
  assert.equal(shown.some((item) => item.content === '明天要交稿'), true);
  assert.match(renderRecent(rows, today, noon), /记于 2026-11-15 12:00/);
  assert.match(renderRecent(rows, today, noon), /即将发生/);
});
