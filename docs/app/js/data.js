// 按数据契约读注册表与回放轨迹（aihw/registry@0.1、aihw/trace@0.1、aihw/stack@0.1；说明见 docs/app/README.md）。
// 数据根目录 data/ 由 solutions/demo-standard/build_registry.py 生成并入库，这里只读。

const ROOT = new URL('../data/', import.meta.url);

export class DataMissing extends Error {}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new DataMissing(`${new URL(url).pathname}：HTTP ${res.status}`);
  return res.json();
}

let registryPromise = null;
export function registry() {
  registryPromise ||= getJson(new URL('registry.json', ROOT)).then(normalizeRegistry).catch((e) => {
    registryPromise = null;
    throw e;
  });
  return registryPromise;
}

const byId = (list) => new Map((list || []).map((x) => [x.id, x]));

function normalizeRegistry(raw) {
  if (!/^aihw\/registry@0\./.test(raw.schema || '')) throw new DataMissing(`不认识的注册表格式：${raw.schema}`);
  const vocab = raw.vocab || {};
  const categories = (raw.categories || []).map((c) => ({ ...c, solutionIds: c.solutions || [], solutions: [] }));
  const catById = byId(categories);
  const solutions = (raw.solutions || []).map((s) => ({
    ...s,
    variants: s.experience?.variants || [],
    archetype: s.experience?.archetype || null,
  }));
  const solById = byId(solutions);
  for (const c of categories) c.solutions = c.solutionIds.map((id) => solById.get(id)).filter(Boolean);
  return {
    root: ROOT,
    repo: raw.repo || {},
    standard: raw.standard || '',
    vocab,
    labels: {
      archetypes: labelMap(vocab.archetypes),
      modes: labelMap(vocab.modes),
      parts: labelMap(vocab.parts),
      features: labelMap(vocab.features),
      compliance: byId(vocab.compliance),
    },
    stacks: byId(raw.stacks),
    categories,
    catById,
    solutions,
    byId: solById,
  };
}

function labelMap(list) {
  return new Map((list || []).map((x) => [x.id, x.label]));
}

export const label = (map, id) => map.get(id) || id;

// 仓库里的文件、目录 → GitHub 链接
export function repoLink(reg, path, dir = false) {
  const base = (dir ? reg.repo.tree_base : reg.repo.blob_base) || `https://github.com/smile-xuc/aihw-starter/${dir ? 'tree' : 'blob'}/master/`;
  return base + String(path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
}

// 数据根目录下的文件地址；本地轨迹没有发布的文件（asset 为 null）
export function assetUrl(reg, asset) {
  if (!asset || !reg) return null;
  return new URL(asset, reg.root).href;
}

// demo 目录下的样本（如 samples/meeting.mp3）在数据根目录里的地址
export function sampleUrl(reg, sol, path) {
  const hit = (sol.samples || []).find((s) => s.path === path);
  return assetUrl(reg, hit ? hit.asset : `assets/${sol.id}/${path}`);
}

const traceCache = new Map();
export function trace(reg, sol, variant) {
  const key = `${sol.id}/${variant.id}`;
  if (!variant.trace) return Promise.resolve(null);
  if (!traceCache.has(key)) {
    traceCache.set(key, getJson(new URL(variant.trace, reg.root)).then(normalizeTrace).catch((e) => {
      traceCache.delete(key);
      throw e;
    }));
  }
  return traceCache.get(key);
}

export function normalizeTrace(raw) {
  if (!raw || !/^aihw\/trace@0\./.test(raw.schema || '') || !Array.isArray(raw.events)) {
    throw new DataMissing('不是 aihw/trace@0.x 回放轨迹');
  }
  return {
    solution: raw.solution || null,
    variant: raw.variant || null,
    mode: raw.mode || 'mock',
    timing: raw.timing || 'none',
    title: raw.title || '',
    region: raw.region || '',
    models: raw.models || [],
    args: raw.args || [],
    events: raw.events.map((e, i) => ({
      i: e.i ?? i,
      t_ms: e.t_ms ?? null,
      tag: String(e.tag || ''),
      kind: e.kind || 'other',
      text: String(e.text || ''),
      lines: Array.isArray(e.lines) ? e.lines.map(String) : [],
      assets: Array.isArray(e.assets) ? e.assets : [],
    })),
    result: raw.result || null,
    inputs: raw.inputs || [],
    outputs: raw.outputs || [],
    error: raw.error || null,
  };
}

// 浏览器真跑要用的常量（tools/build.py 从各 demo 的 run.py 导入，入库在 live-data/）
const liveCache = new Map();
export function liveConstants(id) {
  if (!liveCache.has(id)) {
    liveCache.set(id, getJson(new URL(`../live-data/${id}.json`, import.meta.url)).catch((e) => {
      liveCache.delete(id);
      throw e;
    }));
  }
  return liveCache.get(id);
}
