// 看说体验的多套记忆库。事实和对话只留在这台浏览器。
// 检索按关键词匹配当前这一套，不调用向量模型，也没有视觉观察。

import { clipSummary, MAX_MEMORY_CHARS, MAX_MEMORY_NOTES } from './session-turn.js';

export const LIBRARIES_KEY = 'aihw.session.libraries';
export const LEGACY_MEMORY_KEY = 'aihw.session.memory';
export const LEGACY_SUMMARY_KEY = 'aihw.session.summary';
export const DEFAULT_LIBRARY_ID = 'default';
export const MAX_LIBRARIES = 8;
export const MAX_BIO = 24;
export const MAX_BIO_CHARS = 160;
export const MAX_NAME_CHARS = 40;
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
    description: '在当前记忆库里查找更早的对话或长期事实。当前提示里已经有的内容不要再查。这台浏览器没有视觉观察，source 不要用 env。先调用，再回答。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '2 到 5 个关键词，用空格分开。' },
        source: { type: 'string', enum: ['dialogue', 'env'], description: 'dialogue 是对话和长期事实。env 是视觉观察，这台浏览器没有。' },
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
  return { id, name, bio: [], notes: [], summary: '' };
}

export function emptyStore() {
  return { activeId: DEFAULT_LIBRARY_ID, libraries: [emptyLibrary(DEFAULT_LIBRARY_ID, '默认')] };
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
  return { id: raw.id, name, bio, notes, summary: clipSummary(raw.summary) };
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
  return { activeId, libraries };
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
  if (!library.bio.length && !library.notes.length && !library.summary) return `${count}记忆库「${library.name}」还没有记住对话。`;
  const older = library.summary ? '，并保留一段更早的摘要' : '';
  return `${count}记忆库「${library.name}」有长期事实 ${library.bio.length} 条，最近 ${library.notes.length} 句对话${older}。`;
}

export function createLibrary(store, name, id) {
  const title = cleanName(name);
  if (!title) throw new Error('请填写记忆库名称');
  if (store.libraries.length >= MAX_LIBRARIES) throw new Error('这台浏览器最多 8 个记忆库');
  if (store.libraries.some((item) => item.name === title)) throw new Error('已经有同名记忆库');
  const chosen = id || freshId(store);
  if (!ID_RE.test(chosen) || store.libraries.some((item) => item.id === chosen)) throw new Error('记忆库编号无效');
  return { activeId: chosen, libraries: [...store.libraries, emptyLibrary(chosen, title)] };
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
    libraries: store.libraries.map((item) => (item.id === id ? { ...item, bio: [], notes: [], summary: '' } : item)),
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

export function retrieveMemory(library, request) {
  const source = request?.source;
  if (source === 'env') return '这台浏览器没有视觉观察记录。';
  if (source !== 'dialogue') throw new Error('只能检索对话或视觉观察');
  const words = String(request?.query || '').replace(/\s+/g, ' ').trim().slice(0, 200).split(' ').map((word) => word.trim()).filter(Boolean).slice(0, 5);
  if (!words.length) throw new Error('检索词是空的');
  const corpus = [...library.bio, library.summary, ...library.notes].map((line) => String(line || '').replace(/\s+/g, ' ').trim()).filter((line) => line && !SECRET_RE.test(line));
  const found = corpus.map((text) => ({ text, hits: words.filter((word) => text.includes(word)).length }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5);
  if (!found.length) return '没有找到相关记忆。';
  return found.map((item) => item.text).join('\n');
}
