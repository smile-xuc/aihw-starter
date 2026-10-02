// 08 智能手表 · 浏览器真跑：流程对照 solutions/by-category/08-smart-watch/demo/bailian/run.py（本地红线 + JSON Schema 日报）
import { fmtCny } from '../ui.js';
import { costOf, parseJson } from './bailian.js';

// 手表 / App 端的确定性红线，与 run.py 的 red_lines() 一致
function redLines(day) {
  const found = [];
  if (day.spo2_min < 90) found.push({ metric: 'spo2', text: `血氧最低 ${day.spo2_min}%，低于 90%` });
  if (day.rhr > 100) found.push({ metric: 'rhr', text: `静息心率 ${day.rhr} 次/分，高于 100` });
  else if (day.rhr < 40) found.push({ metric: 'rhr', text: `静息心率 ${day.rhr} 次/分，低于 40` });
  return found;
}

function merge(model, reds, disclaimer) {
  const redMetrics = new Set(reds.map((r) => r.metric));
  const alerts = reds.map((r) => ({ level: 'red', ...r }));
  for (const item of model.alerts || []) {
    if (item && typeof item === 'object' && item.text && !redMetrics.has(item.metric)) {
      alerts.push({ level: 'yellow', metric: item.metric || 'other', text: String(item.text) });
    }
  }
  return {
    summary: String(model.summary || '今日数据已同步'),
    alerts: alerts.slice(0, 4),
    advice: (model.advice || []).filter(Boolean).map(String).slice(0, 3),
    disclaimer,
  };
}

// 表盘窄卡片：半角算 1、全角算 2，与 run.py 的 watch_card() 同一排版
const WIDE = /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;
const width = (s) => [...s].reduce((n, ch) => n + (WIDE.test(ch) ? 2 : 1), 0);
function wrap(text, w) {
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (width(cur + ch) > w) { lines.push(cur); cur = ''; }
    cur += ch;
  }
  return cur ? [...lines, cur] : lines;
}
function watchCard(report, cardWidth) {
  const rows = [];
  const add = (text, prefix = '') => wrap(text, cardWidth - width(prefix)).forEach((piece, i) => rows.push((i === 0 ? prefix : ' '.repeat(width(prefix))) + piece));
  const reds = report.alerts.filter((a) => a.level === 'red');
  const status = reds.length ? '红线提醒' : report.alerts.length ? '需关注' : '平稳';
  rows.push(`今日健康${' '.repeat(Math.max(0, cardWidth - width(`今日健康${status}`)))}${status}`);
  add(report.summary);
  rows.push('─'.repeat(cardWidth));
  for (const a of report.alerts) add(a.text, a.level === 'red' ? '红 ' : '黄 ');
  if (!report.alerts.length) add('暂无需要关注的指标');
  for (const tip of report.advice.slice(0, 2)) add(tip, '> ');
  rows.push('─'.repeat(cardWidth));
  add(report.disclaimer);
  return [`╭${'─'.repeat(cardWidth + 2)}╮`, ...rows.map((r) => `│ ${r}${' '.repeat(Math.max(0, cardWidth - width(r)))} │`), `╰${'─'.repeat(cardWidth + 2)}╯`].join('\n');
}

export default async function run(x) {
  const { c } = x;
  const model = c.LLM_MODEL;
  const results = [];
  const outputs = [];
  for (const path of c.SAMPLES) {
    const name = path.split('/').pop();
    const day = JSON.parse(await x.assetText(path));
    const missing = c.FIELDS.filter((k) => !(k in day));
    if (missing.length) throw new Error(`${name} 缺少字段：${missing.join(', ')}`);
    x.say('设备', `手表 → 手机 App 同步完成：${name}（${Object.keys(day).length} 项聚合指标，不含原始波形）`);
    const tSync = x.now();
    const reds = redLines(day);
    x.say('设备', reds.length ? `本地红线 ×${reds.length} → 震动 2 次 + 表盘弹窗：${reds.map((r) => r.text).join('；')}` : '本地红线：未触发');
    x.say('云端', `日报 ${model}（流式 · JSON Schema）……`);
    const user = { 今日指标: day, 本地红线: reds.length ? reds.map((r) => r.text) : '无' };
    const turn = await x.chat({
      model,
      messages: [{ role: 'system', content: c.SYSTEM }, { role: 'user', content: JSON.stringify(user) }],
      response_format: { type: 'json_schema', json_schema: { name: 'watch_daily_report', strict: true, schema: c.REPORT_SCHEMA } },
      enable_thinking: false,
    });
    const report = merge(parseJson(turn.text, '日报'), reds, c.DISCLAIMER);
    const firstMs = turn.firstTextAt == null ? null : turn.firstTextAt - tSync;
    const cost = costOf(c.LLM_PRICES[model][x.region], turn.usage);
    x.say('手表', '表盘卡片：', watchCard(report, c.CARD_WIDTH));
    const out = `out/report_${name.replace(/\.json$/, '')}.json`;
    outputs.push({ path: out, type: 'application/json', text: JSON.stringify({ model, input: day, local_red_lines: reds, report }, null, 2) });
    x.say('App', `推送日报 → ${out}`);
    x.say('统计', `${name} · 同步完成 → 首字 ${firstMs == null ? '—' : `${Math.round(firstMs)} ms`} · ¥${fmtCny(cost)}（输入 ${turn.usage.prompt} / 输出 ${turn.usage.completion} Token）`);
    results.push({ name, firstMs, cost });
  }
  return {
    models: [model],
    firstMs: results[0].firstMs,
    cost: results.reduce((s, r) => s + r.cost, 0) / results.length,
    sample: results.map((r) => r.name).join(' + '),
    note: `${results.length} 份日报均值；首字=数据同步完成→日报首个 token`,
    outputs,
  };
}
