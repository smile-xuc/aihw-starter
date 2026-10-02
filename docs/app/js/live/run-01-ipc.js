// 01 IPC · 浏览器真跑：流程对照 solutions/by-category/01-ipc/demo/bailian/run.py（看图事件卡 → 检索 → 日报）
import { fmtCny } from '../ui.js';
import { costOf, parseJson, pyFormat, toBase64 } from './bailian.js';

const pad = (n) => String(n).padStart(2, '0');
const minute = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseTime(text) {
  const [date, time = '00:00'] = text.split(' ');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi, s = 0] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, s);
}

// 与 run.py 的 brief() 相同：只给检索和日报需要的字段
const brief = (events) => JSON.stringify(events.map((e) => Object.fromEntries(
  ['id', 'time', 'camera', 'title', 'objects', 'actions', 'event', 'risk_level', 'description'].map((k) => [k, e[k] ?? null]))), null, 1);

export default async function run(x) {
  const { c } = x;
  const model = c.MODEL;
  const tiers = c.PRICES[model][x.region];
  const manifest = JSON.parse(await x.assetText(c.MANIFEST));
  const now = parseTime(manifest.now);
  const events = [];
  const calls = [];
  for (const [i, frame] of manifest.frames.entries()) {
    const data = await x.asset(`samples/${frame.file}`);
    x.say('设备', `${frame.camera} · ${frame.trigger} → 抓拍 1 帧（${Math.floor(data.byteLength / 1024)} KB）· 上传云端`);
    x.say('云端', `事件理解 ${model}（看图 · JSON）……`);
    const t0 = x.now();
    const meta = `时间 ${frame.time}；位置 ${frame.camera}；触发 ${frame.trigger}`;
    const turn = await x.chat({
      model,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(data)}` } },
        { type: 'text', text: pyFormat(c.EVENT_PROMPT, { meta }) },
      ] }],
      response_format: { type: 'json_object' },
      enable_thinking: false,
    });
    const card = parseJson(turn.text, '事件卡');
    const level = String(card.risk_level || 'low').trim().toLowerCase();
    card.risk_level = { 低: 'low', 中: 'medium', 高: 'high' }[level] || level;
    const event = { id: i + 1, time: frame.time, camera: frame.camera, trigger: frame.trigger, image: `samples/${frame.file}`, ...card };
    events.push(event);
    const first = turn.firstTextAt == null ? null : turn.firstTextAt - t0;
    const cost = costOf(tiers, turn.usage);
    calls.push({ first, cost });
    x.say('App', `事件卡 #${event.id} · ${event.time.slice(5, 16)} · ${event.camera} · 风险：${c.RISK[event.risk_level] || event.risk_level}`,
      `${event.title || ''} ｜ ${event.event || ''}\n对象：${(event.objects || []).join('、')} · 动作：${(event.actions || []).join('、')}\n${event.description || ''}`);
    if (event.risk_level === 'high') x.say('设备', '高风险 → 声光告警 · 录制 60 秒云存片段 · App 电话提醒');
    else if (event.risk_level === 'medium') x.say('设备', '中风险 → 录制 30 秒云存片段 · App 强提醒');
    x.say('统计', `抓拍完成 → 事件卡首字 ${first == null ? '—' : `${Math.round(first)} ms`} · ¥${fmtCny(cost)}（输入 ${turn.usage.prompt} / 输出 ${turn.usage.completion} Token）`);
  }
  const outputs = [{ path: 'out/events.json', type: 'application/json', text: JSON.stringify({ now: manifest.now, events }, null, 2) }];
  x.say('App', `事件列表 → out/events.json（${events.length} 条）`);

  x.say('App', `检索「${c.DEFAULT_ASK}」`);
  x.say('云端', `检索 ${model}（${events.length} 个事件 · JSON）……`);
  const ask = await x.chat({
    model,
    messages: [{ role: 'user', content: pyFormat(c.ASK_PROMPT, { now: minute(now), events: brief(events), question: c.DEFAULT_ASK }) }],
    response_format: { type: 'json_object' },
    enable_thinking: false,
  });
  const found = parseJson(ask.text, '检索结果');
  const byId = new Map(events.map((e) => [e.id, e]));
  const lines = (found.matches || []).map((m) => {
    const e = byId.get(Number(m.id));
    return e ? `#${e.id} ${e.time.slice(5, 16)} · ${e.camera} · ${e.title || ''} → ${e.image}\n    理由：${m.reason || ''}` : null;
  }).filter(Boolean);
  x.say('App', found.answer || '（模型没有给出回答）', lines.join('\n'));
  const askCost = costOf(tiers, ask.usage);
  x.say('统计', `检索 · ¥${fmtCny(askCost)}`);

  x.say('云端', `日报 ${model}（流式 Markdown）……`);
  const report = x.say('App', '日报生成中……');
  const daily = await x.chat({
    model,
    messages: [{ role: 'user', content: pyFormat(c.DAILY_PROMPT, { now: minute(now), events: brief(events) }) }],
    enable_thinking: false,
  }, { onText: (_, all) => report.update({ text: '日报生成中……', detail: all }) });
  const markdown = `${daily.text.trim()}\n`;
  report.update({ text: '推送看护日报 → out/daily.md', detail: markdown });
  outputs.push({ path: 'out/daily.md', type: 'text/markdown', text: markdown });
  const dailyCost = costOf(tiers, daily.usage);

  const perEvent = calls.reduce((s, k) => s + k.cost, 0) / calls.length;
  const firsts = calls.map((k) => k.first).filter((v) => v != null);
  x.say('统计', `${calls.length} 个事件合计 ¥${fmtCny(perEvent * calls.length)} · 检索 ¥${fmtCny(askCost)} · 日报 ¥${fmtCny(dailyCost)}`);
  return {
    models: [model],
    firstMs: firsts.length ? firsts.reduce((a, b) => a + b, 0) / firsts.length : null,
    cost: perEvent,
    sample: `${calls.length} 帧事件（samples/events）`,
    note: `首字=抓拍完成→事件卡首字，${calls.length} 帧均值；单次成本=每个事件；检索 ¥${fmtCny(askCost)}；日报 ¥${fmtCny(dailyCost)}`,
    outputs,
  };
}
