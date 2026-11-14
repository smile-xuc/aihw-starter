// 看说体验的多套记忆库。事实、对话和视觉观察只留在这台浏览器。
// 检索把关键词和 text-embedding-v4 的余弦相似度合在一起。

import { clipSummary, MAX_MEMORY_CHARS, MAX_MEMORY_NOTES } from './session-turn.js';

export const LIBRARIES_KEY = 'aihw.session.libraries';
export const LEGACY_MEMORY_KEY = 'aihw.session.memory';
export const LEGACY_SUMMARY_KEY = 'aihw.session.summary';
export const DEFAULT_LIBRARY_ID = 'default';
export const MAX_LIBRARIES = 8;
export const MAX_BIO = 24;
export const MAX_BIO_CHARS = 160;
export const MAX_NAME_CHARS = 40;
export const EMBED_MODEL = 'text-embedding-v4';
export const MIN_SIMILARITY = 0.4;
export const RETRIEVE_LIMIT = 5;
export const MAX_ENV = 20;
export const MAX_ENV_CHARS = 400;
export const OBSERVE_EVERY_MS = 60000;

// 观察提示词与 Qwen-Live-Harness memory/prompts.ts 的 OBSERVER_PROMPT 一致。
export const OBSERVER_PROMPT = `你是一个记忆系统的视觉观察器。每次收到用户摄像头的一帧画面，输出一句中文陈述，记录当下看到的东西，供以后回忆使用。

规则：
- 主语是「用户」，即画面中最靠近镜头的人。
- 尽可能穷尽画面里看得见的东西：用户身上的每一件（发型、眼镜、上衣、下装、手里拿的），以及环境里每一件可辨认的物品、它的颜色或材质、它放在哪。宁长勿漏。
- 物品的位置要写清楚（在桌上、靠墙、在沙发旁、在键盘右侧），位置是以后回忆时最有用的信息。
- 但不要区分用户的左手和右手，一律写「一只手」「另一只手」——这一点常判断错，而记错比不写更糟。
- 只写看得见的事实。不写气氛、心情、评价，不用「似乎」「可能」「仿佛」。
- 如果画面是第一人称视角、看不到用户本人（只有手或什么都没有），就只写手在做什么和环境，不要推断用户的姿势和穿着。
- 只输出那一句话本身。不要前言、不要解释、不要 markdown、不要给备选说法、不要换行。

示例输出：
用户在紧凑的家用厨房水槽前，一只手将绿色黄瓜冲洗后放上不锈钢台面，另一只手从墙上磁吸刀架取下菜刀，水槽上方有白色置物架。`;

const SCREEN_OBSERVER_NOTE = '\n\n当前输入源是用户的屏幕截图，不是摄像头。只记录屏幕中可见的事实，并说明这是屏幕内容；不要将屏幕中的人物或环境当作用户现实中的人物或环境。';

export function observerPrompt(source) {
  return source === 'screen' ? `${OBSERVER_PROMPT}${SCREEN_OBSERVER_NOTE}` : OBSERVER_PROMPT;
}

export function cleanObservation(text, maxChars = MAX_ENV_CHARS) {
  if (typeof text !== 'string' || !text.trim() || SECRET_RE.test(text)) return '';
  const raw = text.trim().replace(/```[a-zA-Z]*/gu, ' ').replace(/\*{1,3}|_{2,}|^#{1,6}\s*|^[-*+]\s+/gmu, '');
  let first = raw.split('\n').map((line) => line.trim().replace(/\s+/gu, ' ')).find(Boolean) || '';
  first = first.replace(/^(?:好的|嗯+|收到(?:了)?|以下是|这一帧|这张(?:图|画面)?|更准确的?(?:单句)?描述|okay|ok|sure)[\s，,：:。.、]*/u, '').trim();
  if (!first) return '';
  const end = /[。！？!?]/u.exec(first);
  first = end?.index !== undefined ? first.slice(0, end.index + 1) : `${first}。`;
  if ([...first].length > maxChars) {
    let window = [...first].slice(0, Math.max(0, maxChars - 1)).join('');
    const pivot = Math.max(window.lastIndexOf('，'), window.lastIndexOf('、'), window.lastIndexOf(','));
    if (pivot > (window.length * 3) / 4) window = window.slice(0, pivot);
    first = `${window.replace(/[，、,]+$/u, '')}。`;
  }
  if ([...first].length < 6 || SECRET_RE.test(first)) return '';
  return first;
}
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SECRET_RE = /sk-[A-Za-z0-9]{8,}/;

export const BIO_TOOL = {
  type: 'function',
  function: {
    name: 'omnibio',
    description: '记下关于用户本人、以后还会用到的事实，例如姓名、偏好、习惯和尚未发生的安排。每条用第三人称写成完整的一句。不要记录已经结束的一次性事件、临时情绪，或与用户无关的他人信息。记忆里已有的不要重复。先调用，再回答。',
    parameters: {
      type: 'object',
      properties: {
        operations: {
          type: 'object',
          properties: {
            add: { type: 'array', items: { type: 'string' }, description: '要新增的事实。' },
            update: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer', description: '当前长期事实列表里的编号，从 0 开始。' },
                  content: { type: 'string', description: '替换后的完整一句。' },
                },
                required: ['index', 'content'],
              },
            },
            delete: { type: 'array', items: { type: 'integer' }, description: '要删除的编号，从 0 开始。' },
          },
        },
      },
      required: ['operations'],
    },
  },
};

export const RETRIEVE_TOOL = {
  type: 'function',
  function: {
    name: 'omniretrieve',
    description: '在当前记忆库里查找更早的对话、长期事实或视觉观察。会用向量相似度和关键词一起找。当前提示里已经有的内容不要再查。问以前看到的环境时 source 用 env。先调用，再回答。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '2 到 5 个关键词，用空格分开。' },
        source: { type: 'string', enum: ['dialogue', 'env'], description: 'dialogue 是对话和长期事实。env 是打开视觉记忆后记下的画面。' },
      },
      required: ['query', 'source'],
    },
  },
};

function cleanText(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  if (!text || SECRET_RE.test(text)) return '';
  return text;
}

export function cleanName(value) {
  return cleanText(value, MAX_NAME_CHARS);
}

function cleanFact(value) {
  return cleanText(value, MAX_BIO_CHARS);
}

function cleanNote(value) {
  return cleanText(value, MAX_MEMORY_CHARS);
}

export function emptyLibrary(id, name) {
  return { id, name, bio: [], notes: [], summary: '', env: [] };
}

export function emptyStore() {
  return { activeId: DEFAULT_LIBRARY_ID, visual: false, libraries: [emptyLibrary(DEFAULT_LIBRARY_ID, '默认')] };
}

function freshId(store) {
  for (let i = 0; i < 20; i += 1) {
    const id = `m${Math.random().toString(36).slice(2, 8)}`;
    if (ID_RE.test(id) && !store.libraries.some((item) => item.id === id)) return id;
  }
  throw new Error('暂时不能新建记忆库');
}

function asLibrary(raw) {
  if (!raw || typeof raw !== 'object' || !ID_RE.test(raw.id)) return null;
  const name = cleanName(raw.name);
  if (!name) return null;
  const bio = (Array.isArray(raw.bio) ? raw.bio : []).map(cleanFact).filter(Boolean).slice(-MAX_BIO);
  const notes = (Array.isArray(raw.notes) ? raw.notes : []).map(cleanNote).filter(Boolean).slice(-MAX_MEMORY_NOTES);
  const env = (Array.isArray(raw.env) ? raw.env : []).map((line) => cleanObservation(line)).filter(Boolean).slice(-MAX_ENV);
  return { id: raw.id, name, bio, notes, summary: clipSummary(raw.summary), env };
}

export function normalizeStore(raw) {
  const libraries = Array.isArray(raw?.libraries) ? raw.libraries.map(asLibrary).filter(Boolean).slice(0, MAX_LIBRARIES) : [];
  if (!libraries.length) return null;
  const ids = new Set();
  const names = new Set();
  for (const item of libraries) {
    if (ids.has(item.id) || names.has(item.name)) return null;
    ids.add(item.id);
    names.add(item.name);
  }
  const activeId = libraries.some((item) => item.id === raw.activeId) ? raw.activeId : libraries[0].id;
  return { activeId, visual: raw.visual === true, libraries };
}

function legacyNotes(storage) {
  try {
    const raw = JSON.parse(storage.getItem(LEGACY_MEMORY_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function readStore(storage) {
  try {
    const stored = normalizeStore(JSON.parse(storage.getItem(LIBRARIES_KEY) || 'null'));
    if (stored) return { store: stored, migrated: false };
  } catch { /* 损坏时改读旧的一条记忆 */ }
  const store = emptyStore();
  store.libraries[0] = {
    ...store.libraries[0],
    notes: legacyNotes(storage).map(cleanNote).filter(Boolean).slice(-MAX_MEMORY_NOTES),
    summary: clipSummary(storage.getItem(LEGACY_SUMMARY_KEY) || ''),
  };
  return { store, migrated: true };
}

export function writeStore(storage, store) {
  const clean = normalizeStore(store);
  if (!clean) throw new Error('记忆库没有写成');
  storage.setItem(LIBRARIES_KEY, JSON.stringify(clean));
  storage.removeItem(LEGACY_MEMORY_KEY);
  storage.removeItem(LEGACY_SUMMARY_KEY);
  return clean;
}

export function activeLibrary(store) {
  return store.libraries.find((item) => item.id === store.activeId) || store.libraries[0];
}

export function memoryLabel(store) {
  const library = activeLibrary(store);
  const count = store.libraries.length > 1 ? `这台浏览器有 ${store.libraries.length} 个记忆库。` : '';
  const seen = Array.isArray(library.env) ? library.env.length : 0;
  if (!library.bio.length && !library.notes.length && !library.summary && !seen) return `${count}记忆库「${library.name}」还没有记住对话。`;
  const older = library.summary ? '，并保留一段更早的摘要' : '';
  const visual = seen ? `，视觉观察 ${seen} 条` : '';
  return `${count}记忆库「${library.name}」有长期事实 ${library.bio.length} 条，最近 ${library.notes.length} 句对话${older}${visual}。`;
}

export function createLibrary(store, name, id) {
  const title = cleanName(name);
  if (!title) throw new Error('请填写记忆库名称');
  if (store.libraries.length >= MAX_LIBRARIES) throw new Error('这台浏览器最多 8 个记忆库');
  if (store.libraries.some((item) => item.name === title)) throw new Error('已经有同名记忆库');
  const chosen = id || freshId(store);
  if (!ID_RE.test(chosen) || store.libraries.some((item) => item.id === chosen)) throw new Error('记忆库编号无效');
  return { ...store, activeId: chosen, libraries: [...store.libraries, emptyLibrary(chosen, title)] };
}

export function switchLibrary(store, id) {
  if (!store.libraries.some((item) => item.id === id)) throw new Error('没有这个记忆库');
  return { ...store, activeId: id };
}

export function renameLibrary(store, id, name) {
  const title = cleanName(name);
  if (!title) throw new Error('请填写记忆库名称');
  if (!store.libraries.some((item) => item.id === id)) throw new Error('没有这个记忆库');
  if (store.libraries.some((item) => item.id !== id && item.name === title)) throw new Error('已经有同名记忆库');
  return { ...store, libraries: store.libraries.map((item) => (item.id === id ? { ...item, name: title } : item)) };
}

export function clearLibrary(store, id) {
  if (!store.libraries.some((item) => item.id === id)) throw new Error('没有这个记忆库');
  return {
    ...store,
    libraries: store.libraries.map((item) => (item.id === id ? { ...item, bio: [], notes: [], summary: '', env: [] } : item)),
  };
}

export function replaceActive(store, library) {
  const next = asLibrary({ ...library, id: activeLibrary(store).id });
  if (!next) throw new Error('记忆库没有写成');
  return { ...store, libraries: store.libraries.map((item) => (item.id === store.activeId ? { ...item, ...next, id: item.id, name: item.name } : item)) };
}

export function redactOperations(operations, redact) {
  const hide = typeof redact === 'function' ? redact : (value) => value;
  const ops = operations && typeof operations === 'object' ? operations : {};
  return {
    add: (Array.isArray(ops.add) ? ops.add : []).map((item) => hide(item)),
    update: (Array.isArray(ops.update) ? ops.update : []).map((item) => ({ index: item?.index, content: hide(item?.content) })),
    delete: Array.isArray(ops.delete) ? ops.delete : [],
  };
}

export function applyBio(library, operations) {
  const current = library.bio.slice();
  const ops = operations && typeof operations === 'object' ? operations : {};
  const deleted = new Set((Array.isArray(ops.delete) ? ops.delete : []).map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < current.length));
  let next = current.slice();
  for (const item of Array.isArray(ops.update) ? ops.update : []) {
    const index = Number(item?.index);
    const content = cleanFact(item?.content);
    if (!Number.isInteger(index) || index < 0 || index >= next.length || !content || deleted.has(index)) continue;
    next[index] = content;
  }
  next = next.filter((_, index) => !deleted.has(index));
  for (const item of Array.isArray(ops.add) ? ops.add : []) {
    const content = cleanFact(item);
    if (content) next.push(content);
  }
  const seen = new Set();
  const unique = [];
  for (const line of next) {
    if (seen.has(line)) continue;
    seen.add(line);
    unique.push(line);
  }
  return unique.slice(-MAX_BIO);
}

export function bioResult(lines) {
  const facts = (Array.isArray(lines) ? lines : []).filter(Boolean);
  if (!facts.length) return '长期事实是空的。';
  return facts.map((line, index) => `${index}. ${line}`).join('\n');
}

function visibleLines(lines) {
  const list = Array.isArray(lines) ? lines : (lines == null ? [] : [lines]);
  return list.flat().map((line) => String(line || '').replace(/\s+/g, ' ').trim()).filter((line) => line && !SECRET_RE.test(line));
}

export function memoryCorpus(library) {
  return visibleLines([library?.bio, library?.summary, library?.notes]);
}

export function envCorpus(library) {
  return visibleLines(library?.env);
}

export function recordObservation(library, text) {
  const content = cleanObservation(text);
  if (!content) return envCorpus(library);
  return [...envCorpus(library).filter((line) => line !== content), content].slice(-MAX_ENV);
}

export function normalizeVector(values) {
  if (!Array.isArray(values) || !values.length || values.length > 65536) return null;
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;
  let square = 0;
  for (const value of values) square += value * value;
  const norm = Math.sqrt(square);
  if (!Number.isFinite(norm) || norm <= 0) return null;
  return values.map((value) => value / norm);
}

export function vectorsFromEmbedding(body, count) {
  const rows = body?.data;
  if (!Number.isInteger(count) || count < 1 || !Array.isArray(rows) || rows.length !== count) return null;
  const vectors = Array(count);
  for (const item of rows) {
    const index = item?.index;
    const vector = normalizeVector(item?.embedding);
    if (!Number.isInteger(index) || index < 0 || index >= count || vectors[index] || !vector) return null;
    vectors[index] = vector;
  }
  return vectors.every(Boolean) ? vectors : null;
}

export function vectorMatches(corpus, queryVector, docVectors, minSim = MIN_SIMILARITY, limit = RETRIEVE_LIMIT) {
  if (!queryVector || !Array.isArray(corpus) || !Array.isArray(docVectors)) return [];
  return corpus.map((text, index) => {
    const doc = docVectors[index];
    if (!doc || doc.length !== queryVector.length) return null;
    let similarity = 0;
    for (let i = 0; i < queryVector.length; i += 1) similarity += queryVector[i] * doc[i];
    return Number.isFinite(similarity) && similarity >= minSim ? { text, similarity } : null;
  }).filter(Boolean).sort((a, b) => b.similarity - a.similarity || a.text.localeCompare(b.text)).slice(0, limit);
}

export function hybridRetrieval(keywordText, vectorHits) {
  const keyword = keywordText === '没有找到相关记忆。' ? [] : String(keywordText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const vector = (Array.isArray(vectorHits) ? vectorHits : []).map((item) => String(item?.text || '').trim()).filter(Boolean);
  const scores = new Map();
  const add = (lines) => lines.forEach((text, rank) => scores.set(text, (scores.get(text) || 0) + 1 / (61 + rank)));
  add(keyword);
  add(vector);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, RETRIEVE_LIMIT);
  if (!ranked.length) return '没有找到相关记忆。';
  return ranked.map(([text]) => text).join('\n');
}

function queryWords(request) {
  const words = String(request?.query || '').replace(/\s+/g, ' ').trim().slice(0, 200).split(' ').map((word) => word.trim()).filter(Boolean).slice(0, 5);
  if (!words.length) throw new Error('检索词是空的');
  return words;
}

function keywordLines(corpus, words) {
  const found = corpus.map((text) => ({ text, hits: words.filter((word) => text.includes(word)).length }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.text.localeCompare(b.text))
    .slice(0, RETRIEVE_LIMIT);
  if (!found.length) return '没有找到相关记忆。';
  return found.map((item) => item.text).join('\n');
}

export function retrieveMemory(library, request) {
  const source = request?.source;
  if (source !== 'env' && source !== 'dialogue') throw new Error('只能检索对话或视觉观察');
  const words = queryWords(request);
  if (source === 'env' && !envCorpus(library).length) return '这套记忆库还没有视觉观察。';
  return keywordLines(source === 'env' ? envCorpus(library) : memoryCorpus(library), words);
}
