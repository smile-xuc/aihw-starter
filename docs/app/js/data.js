// 读 data/ 下的注册表与回放轨迹（由 tools/build.py 生成，不入库），整理成页面用的结构。
// 数据格式变了只改这里的 normalize*，页面代码不动。

const DATA = new URL('../data/', import.meta.url);

export class DataMissing extends Error {}

async function getJson(path) {
  const res = await fetch(new URL(path, DATA), { cache: 'no-cache' });
  if (!res.ok) throw new DataMissing(`${path}：HTTP ${res.status}`);
  return res.json();
}

let registryPromise = null;
export function registry() {
  registryPromise ||= Promise.all([getJson('registry.json'), getJson('build.json').catch(() => null)])
    .then(([raw, build]) => normalizeRegistry(raw, build))
    .catch((e) => {
      registryPromise = null;
      throw e;
    });
  return registryPromise;
}

function normalizeRegistry(raw, build) {
  const categories = (raw.categories || []).map((c) => ({ ...c, solutions: [] }));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const solutions = (raw.solutions || []).map((s) => ({
    ...s,
    archetype: s.experience?.archetype || null,
    tracePath: s.experience?.trace || null,
    cost: s.cost_estimate || null,
  }));
  for (const s of solutions) catById.get(s.category)?.solutions.push(s);
  return {
    categories,
    catById,
    solutions,
    byId: new Map(solutions.map((s) => [s.id, s])),
    source: raw.source || {},
    temporary: /@temp$/.test(raw.schema || ''),
    note: raw.note || '',
    build,
  };
}

const traceCache = new Map();
export function trace(sol) {
  if (!sol.tracePath) return Promise.resolve(null);
  if (!traceCache.has(sol.id)) {
    traceCache.set(sol.id, getJson(sol.tracePath).then(normalizeTrace).catch((e) => {
      traceCache.delete(sol.id);
      throw e;
    }));
  }
  return traceCache.get(sol.id);
}

export function normalizeTrace(raw) {
  if (!raw || !Array.isArray(raw.events)) throw new DataMissing('不是回放轨迹文件');
  return {
    solution: raw.solution,
    mode: raw.mode || 'mock',
    title: raw.title || '',
    region: raw.region || '',
    models: raw.models || [],
    command: raw.command || '',
    events: raw.events.map((e) => ({ tag: String(e.tag || ''), text: String(e.text || ''), detail: e.detail ? String(e.detail) : '' })),
    finish: raw.finish || {},
    inputs: raw.inputs || [],
    outputs: raw.outputs || [],
  };
}

export const demoAsset = (sol, path) => new URL(`demos/${sol.id}/${path}`, DATA).href;

const liveCache = new Map();
export function liveConstants(id) {
  if (!liveCache.has(id)) {
    liveCache.set(id, getJson(`live/${id}.json`).catch((e) => {
      liveCache.delete(id);
      throw e;
    }));
  }
  return liveCache.get(id);
}
