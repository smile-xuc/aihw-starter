// 看说体验的多套记忆库。事实、对话和视觉观察只留在这台浏览器。
// 检索把关键词和 text-embedding-v4 的余弦相似度合在一起。

import { clipSummary, MAX_MEMORY_CHARS, MAX_MEMORY_NOTES } from './session-turn.js';

export const LIBRARIES_KEY = 'aihw.session.libraries';
export const LEGACY_MEMORY_KEY = 'aihw.session.memory';
export const LEGACY_SUMMARY_KEY = 'aihw.session.summary';
export const DEFAULT_LIBRARY_ID = 'default';
export const MAX_LIBRARIES = 8;
export const MAX_BIO = 128;
export const MAX_BIO_CHARS = 200;
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

// 整理提示词与 Qwen-Live-Harness memory/prompts.ts 的 UPDATER_PROMPT 一致。
export const UPDATER_PROMPT = `You are a memory management system. After a video call ends, your job is to update the user's Long-Term Memory (LTM) and Short-Term Memory (STM) from the Working Memory of that call.

## Definitions

### LTM (long-term memory) = who the user is over time
Holds the user's relatively stable personal profile. The test: can the information complete the sentence "over the long run, this user is ..."?

LTM has a fixed set of fields:
- name: the user's name (single value, null if unknown)
- occupation_or_role: long-term occupation or role (list)
- preferences: stable preferences (list)
- routines: long-term repeated habits (list)
- interests: long-term interests (list)
- long_term_goals: goals that span sessions (list)
- relationships: important personal relationships (list)
- appearance: stable physical characteristics (list, e.g. hairstyle, build, glasses, dress style)

### STM (short-term memory) = what has been going on with the user lately

**items**: events and states. Holds what happened recently, is happening now, or is about to happen. The test: can the information complete "lately / currently / soon ..."?

Each item has:
- content: a description of the event, with its time in ONE trailing parenthesis and nowhere else. Same shape for both kinds — an ongoing item states when it is expected to end, an upcoming one when it happens:
 - "赶公司的一个项目（预计2026年8月28日星期五结束）"
 - "去上海出差参加人工智能学术会议（2026年8月31日至9月6日）"
 - "正在装修新房子" ← no parenthesis when no date is known
 **Absolute dates only, in any language.** Never a relative expression — not "tomorrow" / "this week" / "next month", and not "明天" / "这周" / "下周" / "下个月" — and not even alongside the resolved date: write "（2026年8月31日至9月6日）", never "下周（2026年8月31日至9月6日）". Resolve every relative expression against the current date and keep only the result. Do not nest parentheses.
- status: "ongoing" (in progress) or "upcoming" (about to happen)
- event_date: WHEN IT HAPPENS (YYYY-MM-DD). For something spanning several days, the day it STARTS. Only for "upcoming" items; use null when the day is genuinely unknown ("thinking of moving at some point") and for "ongoing" ones.
- expires: WHEN IT CAN BE FORGOTTEN (YYYY-MM-DD). For a one-off event, the day of the event itself; for something spanning several days, the day it ends; null for a long-running ongoing state whose end cannot be determined.

event_date and expires answer different questions and are often different days. "Going to Shanghai next week" starting Monday and ending Sunday is event_date=Monday, expires=Sunday — the first says when to treat it as imminent, the second when it stops being worth mentioning. For a one-off they are the same day, and that is fine.

## Classification rules

For each piece of information in Working Memory, decide:
A. a stable attribute of the user → LTM
B. a recent, current or near-future event or temporary state **that has some duration** (days or more) → STM
C. **discard outright** in these cases:
 - a one-off historical detail ("bought milk today", "just finished eating")
 - momentary behaviour ("watching a film", "waiting for a delivery", "just had a shower") — over within hours, and meaningless to the next conversation
 - events or states about **other people** ("a colleague got promoted", "a friend bought a flat", "the neighbour had a second child") — unless it establishes a new relationship of the user's own ("the user has a new colleague called X")
 - a past hobby or habit the user has **explicitly given up** — do not add it to LTM ("used to like X, doesn't any more" → no interests/routines entry)

Key distinctions:
- "goes running every morning" → LTM.routines (a long-term habit)
- "has a meeting at 8pm every evening this week" → STM (a temporary arrangement with a time range)
- "fancies hotpot tonight" → STM (a near-term plan)
- "has always loved hotpot" → LTM.preferences (a stable preference)
- "bought milk at the supermarket today" → discard (one-off, no lasting meaning)
- "watching a film" / "waiting for a delivery" / "just had a shower" → discard (momentary; over within minutes to hours, meaningless next time)
- "the user's colleague got promoted" / "the user's friend bought a house" → discard (about someone else, not about the user)
- "used to play basketball, doesn't any more" → do not add to interests (an explicitly abandoned hobby is not recorded)
- "the user wears black-framed glasses and has short hair" → LTM.appearance (stable physical characteristics)
- "recently had their hair cut short (it was long before)" → an STM item (a change in appearance) + LTM.appearance remove the old + add the new
- "wore a red dress today" → discard (a single outfit carries no lasting meaning)

## Relation to existing memory

- new information **conflicts** with existing LTM (a changed job, say) → replace it with remove + add
- new information is **semantically the same** as existing LTM (just reworded) → do not add it again
- new information shows an existing STM event is **finished / resolved / no longer valid** → **remove** that STM item (not update)
- new information is an **attribute update** to an existing STM item (a date pushed back, a detail refined, but the event still stands) → update. When a date moves, put \`content\` in the same update and rewrite the parenthesis in it: the date appears both in the fields and in the text, and changing only the field leaves the text stating the old one
- pets belong in relationships ("has a cat called xx")
- never put the same information in both LTM and STM; if it is "recently learning X" and X is also a long-term interest, prefer STM (because "recently" describes a current state)
- appearance records only characteristics that are **stable across sessions** (hairstyle, build, glasses, tattoos, dress style), never a single outfit
- a **change** of appearance (a new hairstyle, say) needs LTM.appearance remove the old + add the new

## Output format

Output exactly the following JSON and nothing else:

\`\`\`json
{
 "ltm_patch": {
 "set": {"name": "..."},
 "add": {"preferences": [...], "routines": [...], ...},
 "remove": {"preferences": [...], ...}
 },
 "stm_patch": {
 "add": [{"content": "...(absolute date)", "status": "ongoing/upcoming", "event_date": "YYYY-MM-DD or null", "expires": "YYYY-MM-DD or null"}],
 "update": [{"id": "stm_xxx", "fields": {"content": "...", "status": "...", "event_date": "...", "expires": "..."}}],
 "remove": ["stm_xxx"]
 }
}
\`\`\`

Rules:
- set: use it only when the name field changes
- omit any field in add/remove that has not changed
- do not output empty arrays for parts that need no change
- one-off events are discarded outright and appear in no patch
- **write every entry in the language the user speaks, not in the language of these instructions** — these memories are read back to the user later
- **times in STM content must be absolute dates**: work them out from the "current date" field. With a current date of 2026-08-10, "tomorrow" → "11 August", "this Friday" → "15 August", "next month" → "September"
- **date rules**: a one-off event has event_date = expires = the day itself (an interview on 11 August → both 2026-08-11); something spanning days has event_date = the first day and expires = the last; an ongoing state has event_date = null and expires = its expected end, or null when that cannot be determined
`;

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
    description: '记下关于用户本人、以后还会用到的事实，例如姓名、偏好、习惯和尚未发生的安排。每条用第三人称写成完整的一句。用 update 或 delete 按当前列表编号修改或删除。不要记录已经结束的一次性事件、临时情绪，或与用户无关的他人信息。记忆里已有的不要重复。名单最多 128 条，满了就不要再加，也不要删掉更早的事实来腾位置。先调用，再回答。',
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
    description: '在当前记忆库里查找更早的对话、长期事实或视觉观察。会用向量相似度和关键词一起找。当前提示里已经有的内容不要再查。问以前看到的环境时 source 用 env。用户提到昨天、上周这类时间时再填 time_range，时间不要写进 query。时间只调整排序，不会丢掉窗口外的结果。先调用，再回答。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '2 到 5 个关键词，用空格分开。时间不要写在这里。' },
        source: { type: 'string', enum: ['dialogue', 'env'], description: 'dialogue 是对话和长期事实。env 是打开视觉记忆后记下的画面。' },
        time_range: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: '可选。用户提到时间才填，格式是 [更早的天数, 更近的天数]。昨天用 [2, 0]，上周用 [14, 1]。',
        },
      },
      required: ['query', 'source'],
    },
  },
};

function cleanText(value, limit) {
  const collapsed = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!collapsed || SECRET_RE.test(collapsed)) return '';
  const text = [...collapsed].slice(0, limit).join('').trim();
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
  return { id, name, bio: [], notes: [], summary: '', env: [], turns: [], dialogue: emptyDialogue(), ltm: emptyLtm(), stm: [], stmSeq: 0 };
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
  const env = envItems({ env: raw.env });
  const turns = cleanTurns(raw.turns);
  const ltm = cleanLtm(raw.ltm);
  const timed = cleanStm(raw.stm, localDate(), Number(raw.stmSeq) || 0);
  return { id: raw.id, name, bio, notes, summary: clipSummary(raw.summary), env, turns, dialogue: cleanDialogue(raw.dialogue), ltm, stm: timed.stm, stmSeq: timed.stmSeq };
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
  const facts = ltmCount(library.ltm);
  const soon = cleanStm(library.stm, localDate()).stm.length;
  const archived = cleanTurns(library.turns).length;
  const pieces = cleanDialogue(library.dialogue).segments.length;
  if (!library.bio.length && !library.notes.length && !library.summary && !seen && !facts && !soon && !archived && !pieces) return `${count}记忆库「${library.name}」还没有记住对话。`;
  const older = library.summary ? '，并保留一段更早的摘要' : '';
  const visual = seen ? `，视觉观察 ${seen} 条` : '';
  const stable = facts ? `，长期资料 ${facts} 条` : '';
  const coming = soon ? `，近期事项 ${soon} 条` : '';
  const history = archived ? `，带时间的对话 ${archived} 条` : '';
  const grouped = pieces ? `，对话片段 ${pieces} 段` : '';
  return `${count}记忆库「${library.name}」有长期事实 ${library.bio.length} 条，最近 ${library.notes.length} 句对话${older}${visual}${stable}${coming}${history}${grouped}。`;
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
    libraries: store.libraries.map((item) => (item.id === id ? { ...item, bio: [], notes: [], summary: '', env: [], turns: [], dialogue: emptyDialogue(), ltm: emptyLtm(), stm: [], stmSeq: 0 } : item)),
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

export function applyBio(library, operations, limits = {}) {
  const maxEntries = Number.isInteger(limits.maxEntries) ? limits.maxEntries : MAX_BIO;
  const maxChars = Number.isInteger(limits.maxEntryChars) ? limits.maxEntryChars : MAX_BIO_CHARS;
  const working = Array.isArray(library?.bio) ? library.bio.slice() : [];
  const result = {
    added: 0, updated: 0, deleted: 0, skipped: 0, nAfter: working.length, malformed: false, changed: false, succeeded: false,
  };
  if (!operations || typeof operations !== 'object' || Array.isArray(operations)) {
    result.malformed = true;
    return { entries: working, result };
  }
  const { update: updates, delete: deletes, add: adds } = operations;
  if (![updates, deletes, adds].some((value) => Array.isArray(value) && value.length)) {
    return { entries: working, result };
  }
  const validIndex = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < working.length;
  const entry = (value) => (typeof value === 'string' ? cleanText(value, maxChars) : '');
  const skip = () => { result.skipped += 1; };
  let next = working.slice();
  if (Array.isArray(updates)) {
    for (const item of updates) {
      if (!item || typeof item !== 'object' || !validIndex(item.index)) { skip(); continue; }
      const content = entry(item.content);
      if (!content || next[item.index] === content) { skip(); continue; }
      next[item.index] = content;
      result.updated += 1;
    }
  }
  if (Array.isArray(deletes)) {
    const doomed = new Set();
    for (const value of deletes) {
      if (!validIndex(value)) { skip(); continue; }
      doomed.add(value);
    }
    next = next.filter((_, index) => !doomed.has(index));
    result.deleted = doomed.size;
  }
  if (Array.isArray(adds)) {
    for (const value of adds) {
      const content = entry(value);
      if (!content || next.includes(content)) { skip(); continue; }
      if (next.length >= maxEntries) { skip(); continue; }
      next.push(content);
      result.added += 1;
    }
  }
  result.nAfter = next.length;
  result.changed = result.added + result.updated + result.deleted > 0;
  result.succeeded = result.changed;
  return { entries: next, result };
}

export function bioReceipt(applied) {
  const entries = Array.isArray(applied?.entries) ? applied.entries : [];
  const result = applied?.result && typeof applied.result === 'object' ? applied.result : {};
  const list = bioResult(entries);
  const crowded = entries.length >= MAX_BIO && result.skipped > 0;
  const room = crowded ? `这套记忆库最多 ${MAX_BIO} 条，多出来的没有写上，已有的不会被挤掉。` : '';
  if (!result.succeeded) return room ? `长期事实没有变化。${room}\n${list}` : '长期事实没有变化。';
  return `已更新长期事实。新增 ${result.added}，修改 ${result.updated}，删除 ${result.deleted}。${room}\n${list}`;
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

export function memoryCorpus(library, today = localDate()) {
  return visibleLines([library?.bio, library?.summary, library?.notes, profileLines(library?.ltm), stmLines(library?.stm, today)]);
}

export function envItems(library) {
  const items = [];
  const seen = new Set();
  for (const raw of Array.isArray(library?.env) ? library.env : []) {
    const content = cleanObservation(typeof raw === 'string' ? raw : raw?.content);
    if (!content || seen.has(content)) continue;
    const at = raw && typeof raw === 'object' && Number.isFinite(raw.at) && raw.at > 0 ? Math.floor(raw.at) : 0;
    seen.add(content);
    items.push({ content, at });
  }
  return items.slice(-MAX_ENV);
}

export function envCorpus(library) {
  return envItems(library).map((item) => item.content);
}

export function recordObservation(library, text, at = 0) {
  const content = cleanObservation(text);
  const items = envItems(library).filter((item) => item.content !== content);
  if (!content) return items;
  const stamp = Number.isFinite(at) && at > 0 ? Math.floor(at) : 0;
  return [...items, { content, at: stamp }].slice(-MAX_ENV);
}

export const MAX_TURNS = 40;
export const TIME_RANGE_BOOST = 2;
export const TIME_EDGE_DAYS = 2;

export function cleanTurns(raw) {
  const turns = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const text = cleanNote(typeof item === 'string' ? item : item?.text);
    if (!text) continue;
    const at = item && typeof item === 'object' && Number.isFinite(item.at) && item.at > 0 ? Math.floor(item.at) : 0;
    turns.push({ text, at });
  }
  return turns.slice(-MAX_TURNS);
}

export function rememberTurn(turns, text, at) {
  const line = cleanNote(text);
  const kept = cleanTurns(turns);
  if (!line) return kept;
  const stamp = Number.isFinite(at) && at > 0 ? Math.floor(at) : 0;
  return [...kept, { text: line, at: stamp }].slice(-MAX_TURNS);
}

export function dialogueLines(library, today = localDate()) {
  const lines = memoryCorpus(library, today);
  for (const turn of cleanTurns(library?.turns)) {
    if (!lines.includes(turn.text)) lines.push(turn.text);
  }
  return lines;
}

export function datedEntries(library, source, today = localDate()) {
  if (source === 'env') return envItems(library).map((item) => ({ text: item.content, at: item.at }));
  const dated = new Map();
  for (const text of memoryCorpus(library, today)) dated.set(text, 0);
  for (const turn of cleanTurns(library?.turns)) dated.set(turn.text, turn.at || dated.get(turn.text) || 0);
  for (const item of dialogueEntries(library)) dated.set(item.text, item.at || dated.get(item.text) || 0);
  return [...dated.entries()].map(([text, at]) => ({ text, at }));
}

export const SEGMENT_MAX_TURNS = 4;
export const SEGMENT_GAP_TURNS = 2;
export const SEGMENT_MAX_CHARS = 1000;
export const SEGMENT_SILENCE_SEC = 60;
export const MAX_SEGMENTS = 80;
export const MAX_UTTERANCE_CHARS = 800;

export function emptyDialogue() {
  return { nextIdx: 0, tail: [], segments: [] };
}

function clipUtterance(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || SECRET_RE.test(text)) return '';
  const chars = [...text];
  return chars.length > MAX_UTTERANCE_CHARS ? chars.slice(0, MAX_UTTERANCE_CHARS).join('') : text;
}

function utteranceChars(turns) {
  return turns.reduce((total, turn) => total + [...turn.user].length + [...turn.assistant].length, 0);
}

function segmentText(turns) {
  const text = turns.flatMap((turn) => [
    turn.user ? `User：${turn.user}` : '',
    turn.assistant ? `Assistant：${turn.assistant}` : '',
  ]).filter(Boolean).join(' ');
  const chars = [...text];
  return chars.length > 600 ? chars.slice(0, 600).join('') : text;
}

function cutReason(tail, incoming) {
  if (!tail.length) return '';
  if (tail.length >= SEGMENT_MAX_TURNS) return 'max_turns';
  if (utteranceChars(tail) >= SEGMENT_MAX_CHARS) return 'max_chars';
  const previous = tail[tail.length - 1];
  if (SEGMENT_SILENCE_SEC > 0 && tail.length >= SEGMENT_GAP_TURNS && incoming.userAt - (previous.assistantAt || previous.userAt) >= SEGMENT_SILENCE_SEC) return 'silence_gap';
  return '';
}

function keepSegments(segments, turns, reason) {
  const text = segmentText(turns);
  if (!text) return segments;
  const start = turns[0].userAt || 0;
  const last = turns[turns.length - 1];
  return [...segments, { start, end: last.assistantAt || last.userAt || start, reason, text }].slice(-MAX_SEGMENTS);
}

export function cleanDialogue(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const tail = [];
  for (const item of Array.isArray(source.tail) ? source.tail : []) {
    const user = clipUtterance(item?.user);
    if (!user) continue;
    const assistant = clipUtterance(item?.assistant);
    const userAt = Number.isFinite(item?.userAt) && item.userAt > 0 ? Math.floor(item.userAt) : 0;
    tail.push({ user, assistant, userAt, assistantAt: Number.isFinite(item?.assistantAt) && item.assistantAt > 0 ? Math.floor(item.assistantAt) : userAt });
  }
  const segments = [];
  for (const item of Array.isArray(source.segments) ? source.segments : []) {
    const text = String(item?.text || '').replace(/\s+/g, ' ').trim();
    if (!text || SECRET_RE.test(text)) continue;
    const chars = [...text];
    const start = Number.isFinite(item?.start) && item.start > 0 ? Math.floor(item.start) : 0;
    const end = Number.isFinite(item?.end) && item.end > 0 ? Math.floor(item.end) : start;
    const reason = ['max_turns', 'max_chars', 'silence_gap', 'session_end'].includes(item?.reason) ? item.reason : 'session_end';
    segments.push({ start, end, reason, text: chars.length > 600 ? chars.slice(0, 600).join('') : text });
  }
  const nextIdx = Number.isInteger(source.nextIdx) && source.nextIdx > 0 ? source.nextIdx : tail.length;
  return { nextIdx, tail: tail.slice(-SEGMENT_MAX_TURNS), segments: segments.slice(-MAX_SEGMENTS) };
}

export function recordExchange(dialogue, user, assistant, at) {
  const state = cleanDialogue(dialogue);
  const heard = clipUtterance(user);
  if (!heard) return state;
  const userAt = Number.isFinite(at) && at > 0 ? Math.floor(at) : Math.floor(Date.now() / 1000);
  const turn = { user: heard, assistant: clipUtterance(assistant), userAt, assistantAt: userAt };
  const reason = cutReason(state.tail, turn);
  return {
    nextIdx: state.nextIdx + 1,
    tail: reason ? [turn] : [...state.tail, turn],
    segments: reason ? keepSegments(state.segments, state.tail, reason) : state.segments,
  };
}

export function finishDialogue(dialogue) {
  const state = cleanDialogue(dialogue);
  if (!state.tail.length) return state;
  return { ...state, tail: [], segments: keepSegments(state.segments, state.tail, 'session_end') };
}

export function dialogueEntries(library) {
  const dialogue = cleanDialogue(library?.dialogue);
  const entries = dialogue.segments.map((item) => ({ text: item.text, at: item.start || 0 }));
  if (dialogue.tail.length) entries.push({ text: segmentText(dialogue.tail), at: dialogue.tail[0].userAt || 0 });
  return entries.filter((item) => item.text);
}

export function vectorsForTexts(texts, stored, dimension = 0) {
  const ready = new Map();
  const missing = [];
  const seen = new Set();
  const saved = stored instanceof Map ? stored : new Map();
  for (const text of Array.isArray(texts) ? texts : []) {
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const vector = normalizeVector(saved.get(text));
    if (vector && (!dimension || vector.length === dimension)) ready.set(text, vector);
    else missing.push(text);
  }
  return { ready, missing };
}

export function mergeVectorHits(groups, limit = RETRIEVE_LIMIT) {
  const best = new Map();
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const hit of Array.isArray(group) ? group : []) {
      const text = String(hit?.text || '').trim();
      const similarity = Number(hit?.similarity);
      if (!text || !Number.isFinite(similarity)) continue;
      const previous = best.get(text);
      if (previous === undefined || similarity > previous) best.set(text, similarity);
    }
  }
  return [...best.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([text, similarity]) => ({ text, similarity }));
}

export function resolveTimeRange(timeRange, now = new Date()) {
  if (!Array.isArray(timeRange) || timeRange.length !== 2 || timeRange.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;
  const older = Math.max(timeRange[0], timeRange[1]);
  const newer = Math.min(timeRange[0], timeRange[1]);
  const origin = Math.floor(now.getTime() / 1000);
  return { from: origin - older * 86400, to: origin - newer * 86400 };
}

export function timeWeight(at, window) {
  if (!window) return 1;
  const stamp = Number(at) || 0;
  if (stamp >= window.from && stamp <= window.to) return TIME_RANGE_BOOST;
  const edge = TIME_EDGE_DAYS * 86400;
  if (edge > 0 && stamp >= window.from - edge && stamp <= window.to + edge) return 1 + (TIME_RANGE_BOOST - 1) / 2;
  return 1;
}

export function rankWithTime(keywordText, vectorHits, dated, timeRange, now = new Date()) {
  const untouched = keywordText === '没有找到相关记忆。' || keywordText === '这套记忆库还没有视觉观察。';
  const keyword = untouched ? [] : String(keywordText || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const vector = (Array.isArray(vectorHits) ? vectorHits : []).map((item) => String(item?.text || '').trim()).filter(Boolean);
  const scores = new Map();
  const add = (lines) => lines.forEach((text, rank) => scores.set(text, (scores.get(text) || 0) + 1 / (61 + rank)));
  add(keyword);
  add(vector);
  const window = resolveTimeRange(timeRange, now);
  const when = new Map((Array.isArray(dated) ? dated : []).map((item) => [item.text, item.at]));
  const ranked = [...scores.entries()]
    .map(([text, score]) => [text, score * timeWeight(when.get(text) || 0, window)])
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, RETRIEVE_LIMIT);
  if (!ranked.length) return keywordText === '这套记忆库还没有视觉观察。' ? keywordText : '没有找到相关记忆。';
  return ranked.map(([text]) => text).join('\n');
}

export const LTM_FIELDS = ['name', 'occupation_or_role', 'preferences', 'routines', 'interests', 'long_term_goals', 'relationships', 'appearance'];
export const MAX_LTM_ITEMS = 8;
export const MAX_LTM_CHARS = 80;
export const MAX_STM = 40;
export const MAX_STM_CHARS = 160;
export const STM_GRACE_DAYS = 2;
export const STM_MAX_AGE_DAYS = 90;
export const STM_UPCOMING_WEIGHT = 1.5;
export const STM_ONGOING_WEIGHT = 1;
export const STM_RECENCY_LAMBDA = 0.05;
export const STM_URGENT_BOOST = 1.5;
export const STM_URGENT_DAYS = 3;
export const STM_PROMPT_ITEMS = 20;
export const STM_PROMPT_CHARS = 1200;
const LTM_LABELS = {
  name: '姓名',
  occupation_or_role: '长期角色',
  preferences: '偏好',
  routines: '习惯',
  interests: '兴趣',
  long_term_goals: '长期目标',
  relationships: '关系',
  appearance: '外形',
};

export function emptyLtm() {
  return {
    name: '',
    occupation_or_role: [],
    preferences: [],
    routines: [],
    interests: [],
    long_term_goals: [],
    relationships: [],
    appearance: [],
  };
}

function clipMemoryText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || SECRET_RE.test(text)) return '';
  const chars = [...text];
  return chars.length > max ? chars.slice(0, max).join('') : text;
}

export function localDate(date = new Date()) {
  const part = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`;
}

function parseDay(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(day || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function shiftDate(day, delta) {
  const parsed = parseDay(day);
  if (!parsed) return '';
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + delta);
  return localDate(date);
}

function dayStamp(day) {
  const parsed = parseDay(day);
  if (!parsed) return 0;
  return Math.floor(new Date(parsed.year, parsed.month - 1, parsed.day, 12).getTime() / 1000);
}

function localStamp(epoch) {
  const date = new Date(epoch * 1000);
  const part = (value) => String(value).padStart(2, '0');
  return `${localDate(date)} ${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/u.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 1) return null;
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = match[3] === undefined ? maxDay : Number(match[3]);
  return day >= 1 && day <= maxDay ? `${match[1]}-${match[2]}-${String(day).padStart(2, '0')}` : null;
}

export function cleanLtm(raw) {
  const ltm = emptyLtm();
  if (!raw || typeof raw !== 'object') return ltm;
  ltm.name = clipMemoryText(raw.name, 40);
  for (const field of LTM_FIELDS) {
    if (field === 'name') continue;
    const unique = [];
    for (const item of Array.isArray(raw[field]) ? raw[field] : []) {
      const text = clipMemoryText(item, MAX_LTM_CHARS);
      if (text && !unique.includes(text)) unique.push(text);
    }
    ltm[field] = unique.slice(-MAX_LTM_ITEMS);
  }
  return ltm;
}

function stmNumber(id) {
  const match = /^stm_(\d+)$/u.exec(String(id || ''));
  return match ? Number(match[1]) : 0;
}

export function cleanStm(raw, today = '', seq = 0) {
  const items = [];
  const seen = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue;
    const content = clipMemoryText(item.content, MAX_STM_CHARS);
    const status = item.status === 'upcoming' || item.status === 'ongoing' ? item.status : '';
    const number = stmNumber(item.id);
    if (!content || !status || !number || seen.has(number)) continue;
    const event_date = normalizeDate(item.event_date);
    const expires = normalizeDate(item.expires);
    const created_ts = Number.isFinite(item.created_ts) && item.created_ts > 0 ? Math.floor(item.created_ts) : 0;
    if (expires && today && expires < today) continue;
    if (!expires && status === 'upcoming' && event_date && today && event_date < shiftDate(today, -STM_GRACE_DAYS)) continue;
    if (created_ts && today && created_ts < dayStamp(today) - STM_MAX_AGE_DAYS * 86400) continue;
    seen.add(number);
    items.push({ id: `stm_${number}`, content, status, event_date, expires, created_ts });
  }
  const stm = items.slice(-MAX_STM);
  const stmSeq = stm.reduce((max, item) => Math.max(max, stmNumber(item.id)), Number.isInteger(seq) && seq > 0 ? seq : 0);
  return { stm, stmSeq };
}

export function ltmCount(ltm) {
  const clean = cleanLtm(ltm);
  return (clean.name ? 1 : 0) + LTM_FIELDS.filter((field) => field !== 'name').reduce((sum, field) => sum + clean[field].length, 0);
}

export function renderProfile(ltm) {
  const clean = cleanLtm(ltm);
  return LTM_FIELDS.flatMap((field) => {
    if (field === 'name') return clean.name ? [`- 姓名：${clean.name}`] : [];
    return clean[field].length ? [`- ${LTM_LABELS[field]}：${clean[field].join('、')}`] : [];
  }).join('\n');
}

export function scoreStm(item, today, now = new Date()) {
  const created = item?.created_ts > 0 ? item.created_ts : Math.floor(now.getTime() / 1000);
  const days = Math.max(0, (now.getTime() / 1000 - created) / 86400);
  let score = (item?.status === 'upcoming' ? STM_UPCOMING_WEIGHT : STM_ONGOING_WEIGHT) * Math.exp(-STM_RECENCY_LAMBDA * days);
  if (item?.status === 'upcoming' && item.event_date && today) {
    const ahead = Math.round((dayStamp(item.event_date) - dayStamp(today)) / 86400);
    if (ahead >= 0 && ahead <= STM_URGENT_DAYS) score *= STM_URGENT_BOOST;
  }
  return score;
}

export function selectRecent(stm, today = localDate(), now = new Date()) {
  const ranked = cleanStm(stm, today).stm
    .map((item) => ({ item, score: scoreStm(item, today, now) }))
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
  const selected = [];
  let used = 0;
  for (const { item } of ranked) {
    if (selected.length >= STM_PROMPT_ITEMS) break;
    const cost = [...item.content].length;
    if (selected.length && used + cost > STM_PROMPT_CHARS) continue;
    used += cost;
    selected.push(item);
  }
  return selected.sort((left, right) => Number(left.status !== 'ongoing') - Number(right.status !== 'ongoing') || (left.created_ts - right.created_ts) || left.id.localeCompare(right.id));
}

export function renderRecent(stm, today = localDate(), now = new Date()) {
  return selectRecent(stm, today, now).map((item) => {
    const when = item.created_ts ? `[记于 ${localStamp(item.created_ts)}] ` : '';
    return `- [${item.status === 'upcoming' ? '即将发生' : '进行中'}] ${when}${item.content}`;
  }).join('\n');
}

export function profileLines(ltm) {
  const clean = cleanLtm(ltm);
  const lines = clean.name ? [`姓名：${clean.name}`] : [];
  for (const field of LTM_FIELDS) {
    if (field === 'name') continue;
    for (const item of clean[field]) lines.push(`${LTM_LABELS[field]}：${item}`);
  }
  return lines;
}

export function stmLines(stm, today = localDate()) {
  return cleanStm(stm, today).stm.map((item) => item.content);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parsePatch(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const raw = text.trim();
  const fenced = /```(?:json)?\s*(\{[\s\S]*\})\s*```/u.exec(raw)?.[1];
  const slice = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : '';
  for (const candidate of [raw, fenced, slice]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch { /* 再试下一种模型输出 */ }
  }
  return null;
}

export function isEmptyPatch(patch) {
  if (!isRecord(patch)) return true;
  const filled = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value));
  const ltm = patch.ltm_patch;
  if (isRecord(ltm)) {
    for (const key of ['set', 'add', 'remove']) {
      if (isRecord(ltm[key]) && Object.values(ltm[key]).some(filled)) return false;
    }
  }
  const stm = patch.stm_patch;
  return !(isRecord(stm) && ['add', 'update', 'remove'].some((key) => Array.isArray(stm[key]) && stm[key].length > 0));
}

export function formatUpdaterInput({ ltm, stm, notes, today }) {
  const clean = cleanLtm(ltm);
  const profile = { name: clean.name || null };
  for (const field of LTM_FIELDS) {
    if (field !== 'name') profile[field] = clean[field];
  }
  const hasLtm = Object.values(profile).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  const items = cleanStm(stm, today).stm.map((item) => ({
    id: item.id,
    content: item.content,
    status: item.status,
    ...(item.event_date ? { event_date: item.event_date } : {}),
    ...(item.expires ? { expires: item.expires } : {}),
  }));
  const entries = (Array.isArray(notes) ? notes : []).map((line) => String(line || '').trim()).filter((line) => line && !SECRET_RE.test(line)).slice(-MAX_MEMORY_NOTES);
  return [
    `## 当前日期\n${today}`,
    hasLtm ? `## 当前 LTM（长期记忆）\n\`\`\`json\n${JSON.stringify(profile, null, 2)}\n\`\`\`` : '## 当前 LTM（长期记忆）\n（空，用户是全新用户）',
    items.length ? `## 当前 STM（短期记忆）\n\`\`\`json\n${JSON.stringify(items, null, 2)}\n\`\`\`` : '## 当前 STM（短期记忆）\n（空）',
    entries.length ? `## 本次通话结束时的 Working Memory\n${entries.map((entry) => `- ${entry}`).join('\n')}` : '## 本次通话结束时的 Working Memory\n（空）',
    '请根据以上信息输出 LTM/STM patch（JSON格式）。',
  ].join('\n\n');
}

function patchEntries(raw) {
  const input = typeof raw === 'string' ? [raw] : (Array.isArray(raw) ? raw : []);
  return input.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

export function applyMemoryPatch(library, patch, today, now = new Date()) {
  const createdAt = Math.floor(now.getTime() / 1000);
  const ltm = cleanLtm(library?.ltm);
  let { stm, stmSeq } = cleanStm(library?.stm, today, Number(library?.stmSeq) || 0);
  const report = { ltmSet: 0, ltmAdded: 0, ltmRemoved: 0, stmAdded: 0, stmUpdated: 0, stmRemoved: 0, rejected: 0 };
  const reject = () => { report.rejected += 1; };
  const ltmPatch = isRecord(patch?.ltm_patch) ? patch.ltm_patch : null;
  if (patch?.ltm_patch && !ltmPatch) reject();
  if (ltmPatch) {
    const set = isRecord(ltmPatch.set) ? ltmPatch.set : {};
    if (Object.hasOwn(set, 'name')) {
      const name = clipMemoryText(set.name, 40);
      if (name) { ltm.name = name; report.ltmSet += 1; }
      else reject();
    }
    for (const field of Object.keys(set)) if (field !== 'name') reject();
    for (const [field, raw] of Object.entries(isRecord(ltmPatch.remove) ? ltmPatch.remove : {})) {
      if (!LTM_FIELDS.includes(field)) { reject(); continue; }
      for (const content of patchEntries(raw)) {
        const text = clipMemoryText(content, field === 'name' ? 40 : MAX_LTM_CHARS);
        if (!text) { reject(); continue; }
        if (field === 'name') {
          if (ltm.name === text) { ltm.name = ''; report.ltmRemoved += 1; }
          continue;
        }
        const before = ltm[field].length;
        ltm[field] = ltm[field].filter((item) => item !== text);
        if (ltm[field].length < before) report.ltmRemoved += before - ltm[field].length;
      }
    }
    for (const [field, raw] of Object.entries(isRecord(ltmPatch.add) ? ltmPatch.add : {})) {
      if (!LTM_FIELDS.includes(field) || field === 'name') { reject(); continue; }
      for (const content of patchEntries(raw)) {
        const text = clipMemoryText(content, MAX_LTM_CHARS);
        if (!text) { reject(); continue; }
        ltm[field] = [...ltm[field].filter((item) => item !== text), text].slice(-MAX_LTM_ITEMS);
        report.ltmAdded += 1;
      }
    }
  }
  const stmPatch = isRecord(patch?.stm_patch) ? patch.stm_patch : null;
  if (patch?.stm_patch && !stmPatch) reject();
  if (stmPatch) {
    for (const value of Array.isArray(stmPatch.remove) ? stmPatch.remove : []) {
      const id = stmNumber(value) ? `stm_${stmNumber(value)}` : '';
      const before = stm.length;
      if (!id) { reject(); continue; }
      stm = stm.filter((item) => item.id !== id);
      if (stm.length < before) report.stmRemoved += 1;
      else reject();
    }
    for (const item of Array.isArray(stmPatch.update) ? stmPatch.update : []) {
      if (!isRecord(item) || !isRecord(item.fields)) { reject(); continue; }
      const id = stmNumber(item.id) ? `stm_${stmNumber(item.id)}` : '';
      const index = stm.findIndex((row) => row.id === id);
      if (!id || index < 0) { reject(); continue; }
      const next = { ...stm[index] };
      let changed = false;
      if (typeof item.fields.content === 'string' && clipMemoryText(item.fields.content, MAX_STM_CHARS)) {
        next.content = clipMemoryText(item.fields.content, MAX_STM_CHARS);
        changed = true;
      }
      if (item.fields.status === 'ongoing' || item.fields.status === 'upcoming') { next.status = item.fields.status; changed = true; }
      else if (item.fields.status !== undefined) reject();
      if (Object.hasOwn(item.fields, 'event_date')) { next.event_date = normalizeDate(item.fields.event_date); changed = true; }
      if (Object.hasOwn(item.fields, 'expires')) { next.expires = normalizeDate(item.fields.expires); changed = true; }
      if (!changed) { reject(); continue; }
      stm[index] = next;
      report.stmUpdated += 1;
    }
    for (const item of Array.isArray(stmPatch.add) ? stmPatch.add : []) {
      if (!isRecord(item)) { reject(); continue; }
      const content = clipMemoryText(item.content, MAX_STM_CHARS);
      const status = item.status === 'upcoming' ? 'upcoming' : (item.status === 'ongoing' || item.status == null ? 'ongoing' : '');
      if (!content || !status) { reject(); continue; }
      const event_date = normalizeDate(item.event_date);
      const expires = normalizeDate(item.expires);
      if (expires && today && expires < today) { reject(); continue; }
      const existing = stm.find((row) => row.content === content);
      if (existing) {
        existing.status = status;
        existing.event_date = event_date;
        existing.expires = expires;
        report.stmUpdated += 1;
        continue;
      }
      stmSeq += 1;
      stm.push({ id: `stm_${stmSeq}`, content, status, event_date, expires, created_ts: createdAt });
      report.stmAdded += 1;
    }
  }
  const pruned = cleanStm(stm, today, stmSeq);
  return { ltm: cleanLtm(ltm), stm: pruned.stm, stmSeq: pruned.stmSeq, report };
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
  const dialogue = source === 'env' ? envCorpus(library) : dialogueLines(library);
  if (source === 'env') return keywordLines(dialogue, words);
  const lines = dialogue.slice();
  for (const item of dialogueEntries(library)) {
    if (!lines.includes(item.text)) lines.push(item.text);
  }
  return keywordLines(lines, words);
}
