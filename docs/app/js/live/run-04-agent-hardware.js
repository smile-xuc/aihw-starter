// 04 Agent 硬件 · 浏览器真跑：流程对照 solutions/by-category/04-agent-hardware/demo/bailian/run.py 与 local_rules.py
import { fmtCny } from '../ui.js';
import { costOf, pyFormat, toBase64, validCount } from './client.js';

const pad = (n) => String(n).padStart(2, '0');

function wavInfo(buffer) {
  const v = new DataView(buffer);
  const idAt = (off) => String.fromCharCode(...new Uint8Array(buffer, off, 4));
  const fallback = { rate: 16000, seconds: 0, durationKnown: false };
  if (buffer.byteLength < 44 || idAt(0) !== 'RIFF' || idAt(8) !== 'WAVE' || v.getUint32(4, true) + 8 !== buffer.byteLength) return fallback;
  let rate = 0, byteRate = 0, bytes = 0;
  for (let off = 12; off + 8 <= buffer.byteLength;) {
    const id = idAt(off), size = v.getUint32(off + 4, true);
    if (off + 8 + size > buffer.byteLength) return fallback;
    if (id === 'fmt ' && size >= 16) {
      rate = v.getUint32(off + 12, true);
      byteRate = v.getUint32(off + 16, true);
    }
    if (id === 'data') bytes = size;
    off += 8 + size + (size % 2);
  }
  const seconds = bytes / byteRate;
  return rate > 0 && byteRate > 0 && Number.isFinite(seconds) && seconds > 0 ? { rate, seconds, durationKnown: true } : fallback;
}
const CN = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const NUM = '(\\d{1,2}|[一二两三四五六七八九十]{1,3})';

// ── 端侧规则：关键词表从 local_rules.py 导入，解析逻辑与 classify / parse_time / local_actions 一致 ──
function classify(c, text) {
  const t = text.trim();
  for (const k of c.HYBRID_PATTERNS) if (t.includes(k)) return { route: 'hybrid', reason: `多步线索「${k}」` };
  for (const [k] of c.LOCAL_PATTERNS) if (t.includes(k)) return { route: 'local', reason: `本地关键词「${k}」` };
  return { route: 'cloud', reason: '没有命中本地规则' };
}

function number(token) {
  if (/^\d+$/.test(token)) return Number(token);
  if (token === '十') return 10;
  if (token.includes('十')) {
    const [tens, ones] = token.split('十');
    return (tens ? (CN[tens] ?? 1) : 1) * 10 + (ones ? (CN[ones] ?? 0) : 0);
  }
  return CN[token] ?? null;
}

function parseTime(text, now) {
  let m = text.match(new RegExp(`${NUM}\\s*分钟后`));
  if (m && number(m[1]) != null) {
    const when = new Date(now.getTime() + number(m[1]) * 60000);
    return [`${pad(when.getHours())}:${pad(when.getMinutes())}`, when.toDateString() === now.toDateString() ? '今天' : '明天'];
  }
  m = text.match(new RegExp(`(明早|明天早上|明天上午|明天下午|明晚|明天晚上|明天|今晚|早上|上午|下午|晚上)?\\s*${NUM}\\s*[点:：]\\s*(半|\\d{1,2}|[一二三四五六七八九十]{1,3})?`));
  if (!m) return null;
  const [, period, hour, min] = m;
  let h = number(hour);
  const mi = min === '半' ? 30 : (min ? number(min) : 0);
  if (h == null || mi == null) return null;
  if (period && (period.includes('下午') || period.includes('晚')) && h < 12) h += 12;
  if (!(h >= 0 && h < 24 && mi >= 0 && mi < 60)) return null;
  return [`${pad(h)}:${pad(mi)}`, period && period.startsWith('明') ? '明天' : '今天'];
}

function localActions(c, text, now) {
  const t = text.trim();
  if (t.includes('灯')) {
    const room = c.ROOMS.find((r) => t.includes(r)) || '全部';
    return [['set_light', { room, on: !['关', '灭'].some((k) => t.includes(k)) }]];
  }
  if (t.includes('音量')) {
    const m = t.match(/(\d{1,3})/);
    return m ? [['set_volume', { level: Number(m[1]) }]] : null;
  }
  if (['叫我', '闹钟', '提醒我', '分钟后'].some((k) => t.includes(k))) {
    const parsed = parseTime(t, now);
    if (!parsed) return null;
    const m = t.match(/提醒我(.+)/);
    const label = m ? m[1].replace(/^[，,。 ]+|[，,。 ]+$/g, '') : t.includes('叫我') ? '起床' : '闹钟';
    return [['set_alarm', { time: parsed[0], date: parsed[1], label: label || '提醒' }]];
  }
  if (t.includes('星期几')) return [['say', { text: `今天是星期${'一二三四五六日'[(now.getDay() + 6) % 7]}。` }]];
  if (t.includes('几点了')) return [['say', { text: `现在是 ${pad(now.getHours())}:${pad(now.getMinutes())}。` }]];
  return null;
}

// ── 盒子本体：本地工具驱动 [设备]，云端工具返回 demo 内的固定示例数据（与 run.py 的 Box 一致） ──
function makeBox(x, rooms) {
  const box = { lights: new Map(), alarms: new Map(), volume: 40 };
  const tools = {
    set_light({ room, on }) {
      if (!rooms.includes(room)) throw new Error(`room 只能是 ${rooms.join(' / ')}`);
      box.lights.set(room, Boolean(on));
      x.say('设备', `灯光：${room} → ${on ? '开' : '关'}`);
      return { ok: true, room, on: Boolean(on) };
    },
    set_alarm({ time, date = '今天', label = '闹钟' }) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) throw new Error('time 必须是 24 小时制 HH:MM');
      box.alarms.set(label, `${date} ${time}`);
      x.say('设备', `闹钟：${date} ${time}「${label}」`);
      return { ok: true, time, date, label };
    },
    set_volume({ level }) {
      if (!(Number(level) >= 0 && Number(level) <= 100)) throw new Error('level 范围 0–100');
      box.volume = Math.trunc(Number(level));
      x.say('设备', `音量 → ${box.volume}`);
      return { ok: true, level: box.volume };
    },
    get_weather({ city, date = '今天' }) {
      x.say('云端', `天气服务（示例数据）：${city} ${date} 小雨 18–23℃，降水概率 70%`);
      return { ok: true, city, date, weather: '小雨', temp_c: '18–23', rain_probability: 0.7, note: 'demo 示例数据，不是真实天气' };
    },
    add_calendar({ title, start, minutes = 60 }) {
      x.say('云端', `日程服务（示例数据）：${start}「${title}」${Math.trunc(Number(minutes))} 分钟`);
      return { ok: true, event_id: 'evt_demo_001', title, start, minutes: Math.trunc(Number(minutes)), note: 'demo 示例数据，没有写入真实日历' };
    },
  };
  box.act = (name, args) => {
    if (!tools[name]) return { ok: false, error: `没有工具 ${name}` };
    try { return tools[name](args); } catch (e) { return { ok: false, error: `${name} 参数无效：${e.message}` }; }
  };
  box.summary = () => {
    const lights = [...box.lights].map(([r, on]) => `${r}${on ? '开' : '关'}`).join('、') || '未操作';
    const alarms = [...box.alarms].map(([l, w]) => `「${l}」${w}`).join('、') || '无';
    return `灯 ${lights} · 闹钟 ${alarms} · 音量 ${box.volume}`;
  };
  return box;
}

function confirmPhrase(name, a) {
  if (name === 'set_light') return `${a.room}的灯已${a.on ? '打开' : '关闭'}。`;
  if (name === 'set_alarm') return `已设好${a.date} ${a.time} 的闹钟。`;
  if (name === 'set_volume') return `音量调到 ${a.level}。`;
  return '';
}

export default async function run(x) {
  const { c } = x;
  const model = c.LLM_MODEL;
  const now = new Date();
  const box = makeBox(x, c.ROOMS);
  const tasks = [];
  for (const [n, [kind, value]] of c.DEFAULT_SESSION.entries()) {
    const task = { source: kind === 'audio' ? value.split('/').pop() : `文本「${value}」`, route: '', toolCalls: 0, rounds: 0, asrTokens: [0, 0], asrCostStatus: 'usage', asrCost: 0, asrMs: null, firstAt: null, llmTokens: [0, 0], llmCost: 0 };
    let text = value;
    if (kind === 'audio') {
      const wav = await x.asset(value);
      const { rate, seconds, durationKnown } = wavInfo(wav);
      x.say('设备', `麦克风 ← ${task.source}（${seconds.toFixed(1)} s）· 松开按键`);
      task.said = x.now();
      x.say('云端', `转写 ${c.ASR_MODEL}……`);
      const resp = await x.post('api', '/services/aigc/multimodal-generation/generation', {
        model: c.ASR_MODEL,
        input: { messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: `data:audio/wav;base64,${toBase64(wav)}` } }] }] },
        parameters: { format: 'wav', sample_rate: String(rate) },
      }, { 'X-DashScope-SSE': 'disable' });
      task.asrMs = x.now() - task.said;
      const out = resp.output || {};
      text = String(out.text || out.sentence?.text || '').trim();
      const u = resp.usage || {};
      if (validCount(u.input_tokens) && validCount(u.output_tokens)) {
        task.asrTokens = [u.input_tokens, u.output_tokens];
      } else {
        const duration = validCount(u.duration) && u.duration > 0 ? u.duration : durationKnown ? seconds : null;
        if (duration != null) {
          task.asrTokens = [duration * 25, text.length];
          task.asrEstimated = true;
          task.asrCostStatus = 'estimated';
        } else task.asrCostStatus = 'unknown';
      }
      x.say('云端', `听到：${text}（${Math.round(task.asrMs)} ms）`);
      if (!text) continue;
    } else {
      x.say('设备', `指令（文本）：${value}`);
      task.said = x.now();
    }
    task.asrCost = task.asrCostStatus === 'unknown' ? null : task.asrMs != null ? costOf(c.PRICES[c.ASR_MODEL][x.region], { prompt: task.asrTokens[0], completion: task.asrTokens[1], known: true }) : 0;
    const route = classify(c, text);
    const actions = route.route === 'local' ? localActions(c, text, now) : null;
    if (actions) {
      task.route = 'local';
      x.say('设备', `端侧规则：${route.reason} → 本地执行，不上云`);
      const phrases = actions.map(([name, args]) => {
        if (name === 'say') return args.text;
        const res = box.act(name, args);
        task.toolCalls += 1;
        return res.ok ? confirmPhrase(name, args) : `没能完成：${res.error}。`;
      });
      x.say('盒子', `好的，${phrases.join('')}`);
      x.say('统计', `指令 ${n + 1} · 端侧执行 · 工具 ${task.toolCalls} 次 · ${task.asrMs == null ? '不上云' : '端侧编排，含云端转写'} · ${task.asrCost == null ? '费用未知' : `¥${fmtCny(task.asrCost)}`}${task.asrEstimated ? '（转写按时长估算）' : ''}`);
      tasks.push(task);
      continue;
    }
    task.route = 'cloud';
    x.say('云端', `${route.reason} → ${model} 编排（Function Calling，流式）`);
    const clock = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} 星期${c.WEEKDAYS[(now.getDay() + 6) % 7]}`;
    const messages = [{ role: 'system', content: pyFormat(c.SYSTEM, { now: clock }) }, { role: 'user', content: text }];
    let finished = false;
    for (let round = 1; round <= c.MAX_ROUNDS; round++) {
      task.rounds = round;
      let speech = null;
      const turn = await x.chat({ model, messages, tools: c.TOOLS, parallel_tool_calls: true, enable_thinking: false }, {
        onText: (_, all) => { speech = speech ? speech.update({ text: all }) : x.say('盒子', all); },
      });
      task.llmTokens = [task.llmTokens[0] + turn.usage.prompt, task.llmTokens[1] + turn.usage.completion];
      task.llmCost += costOf(c.PRICES[model][x.region], turn.usage);
      if (task.firstAt == null) task.firstAt = turn.firstCallAt;
      if (!turn.calls.length) { finished = true; break; }
      x.say('云端', `第 ${round} 轮 → 调用 ${turn.calls.map((k) => k.name).join('、')}`);
      messages.push({ role: 'assistant', content: turn.text, tool_calls: turn.calls.map((k, i) => ({ id: k.id, type: 'function', index: i, function: { name: k.name, arguments: k.arguments } })) });
      for (const call of turn.calls) {
        let args = null;
        try { args = JSON.parse(call.arguments || '{}'); } catch { args = null; }
        const result = args && typeof args === 'object' && !Array.isArray(args) ? box.act(call.name, args) : { ok: false, error: 'arguments 不是 JSON 对象' };
        if (!result.ok) x.say('设备', `拒绝 ${call.name}（${call.arguments}）：${result.error} → 回传给模型修正`);
        task.toolCalls += 1;
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    if (!finished) x.say('云端', `${c.MAX_ROUNDS} 轮后仍在调用工具，停止编排`);
    const asrCost = task.asrCost;
    const first = task.firstAt == null ? '—（本条没有调用工具）' : `${Math.round(task.firstAt - task.said)} ms${task.asrMs != null ? `（含转写 ${Math.round(task.asrMs)} ms）` : ''}`;
    const split = asrCost ? `转写 ¥${fmtCny(asrCost)} + 编排 ¥${fmtCny(task.llmCost)}；` : '';
    const totalCost = asrCost == null ? null : task.llmCost + asrCost;
    x.say('统计', `指令 ${n + 1} · 云端 ${task.rounds} 轮 · 工具 ${task.toolCalls} 次 · 说完指令 → 首个工具调用 ${first} · ${totalCost == null ? '费用未知' : `¥${fmtCny(totalCost)}`}（${split}编排共 ${task.llmTokens[0]} / ${task.llmTokens[1]} Token${task.asrEstimated ? '；转写用量按时长估算' : ''}）`);
    tasks.push(task);
  }
  x.say('设备', `盒子状态：${box.summary()}`);
  const cloud = tasks.filter((t) => t.route === 'cloud');
  const billed = tasks.filter((task) => task.route === 'cloud' || task.asrMs != null);
  const firstTask = cloud.find((t) => t.firstAt != null);
  const counts = { local: tasks.filter((t) => t.route === 'local').length, cloud: cloud.length };
  const costStatus = tasks.some((t) => t.asrCostStatus === 'unknown') ? 'unknown' : tasks.some((t) => t.asrCostStatus === 'estimated') ? 'estimated' : 'usage';
  const warnings = costStatus === 'unknown' ? ['转写 Token 用量及可核验录音时长未知，总成本未知'] : costStatus === 'estimated' ? ['转写 Token 用量未完整返回，按已知录音时长估算费用'] : [];
  for (const warning of warnings) x.say('提示', warning);
  return {
    costStatus, warnings,
    models: [...(tasks.some((t) => t.asrMs != null) ? [c.ASR_MODEL] : []), ...(cloud.length ? [model] : [])],
    firstMs: firstTask ? firstTask.firstAt - firstTask.said : null,
    cost: costStatus === 'unknown' ? null : billed.length ? billed.reduce((sum, task) => sum + task.llmCost + task.asrCost, 0) / billed.length : 0,
    sample: tasks.map((t) => t.source).join(' + '),
    note: `${tasks.length} 条指令：端侧 ${counts.local}、云端 ${counts.cloud}；成本为调用云端的任务均值（含仅转写后端侧执行）；首字=说完指令→首个工具调用（含转写）`,
    outputs: [],
  };
}
