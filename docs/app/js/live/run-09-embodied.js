// 09 具身智能 · 浏览器真跑：流程对照 solutions/by-category/09-embodied/demo/bailian/run.py 与 safety_gate.py
import { fmtCny } from '../ui.js';
import { costOf, toBase64 } from './bailian.js';

// 本地安全门：规则表从 safety_gate.py 导入，判定逻辑与 SafetyGate.check() 一致
function makeGate(c, utterance) {
  const forbidden = (text) => {
    for (const [pattern, label] of c.FORBIDDEN_PATTERNS) if (new RegExp(pattern).test(text)) return label;
    return null;
  };
  const allowed = new Set(c.ALLOWED_SKILLS);
  const motion = new Set(c.MOTION_SKILLS);
  const gate = {
    forbidden,
    needsConfirm: new RegExp(c.CONFIRM_PATTERNS).test(utterance),
    confirmReason: '',
    confirmed: false,
    check(skill, args) {
      if (!allowed.has(skill)) return { verdict: 'reject', args, notes: [`技能 ${skill} 不在白名单`] };
      for (const v of Object.values(args)) {
        const label = typeof v === 'string' ? forbidden(v) : null;
        if (label) return { verdict: 'reject', args, notes: [`参数含禁止动作「${label}」`] };
      }
      if (skill === 'wait_confirm') return { verdict: 'allow', args, notes: [] };
      const next = { ...args };
      const notes = [];
      if (skill === 'grasp') {
        const force = Number(args.max_force_n ?? 10);
        if (Number.isNaN(force)) return { verdict: 'reject', args, notes: ['max_force_n 不是数字'] };
        if (force > c.MAX_FORCE_N) {
          next.max_force_n = c.MAX_FORCE_N;
          notes.push(`夹持力 ${force} N 超过上限，改为 ${c.MAX_FORCE_N} N`);
          gate.needsConfirm = true;
          gate.confirmReason = `操作员要求 ${force} N，超过 ${c.MAX_FORCE_N} N 上限`;
        }
      }
      const confirmFirst = motion.has(skill) && gate.needsConfirm && !gate.confirmed;
      if (confirmFirst) notes.push('动作前插入 wait_confirm');
      return { verdict: notes.length ? 'rewrite' : 'allow', args: next, notes, confirmFirst };
    },
  };
  if (gate.needsConfirm) gate.confirmReason = '指令提到小心、易碎或旁边有人';
  return gate;
}

function sceneKey(name) {
  if (name.includes('螺')) return '螺丝';
  if (name.includes('盒') || name.includes('箱')) {
    if (name.includes('左') || name.includes('蓝')) return '左边盒子';
    if (name.includes('右') || name.includes('灰')) return '右边盒子';
    return null;
  }
  if (['零件', '支架', '黑'].some((k) => name.includes(k))) return '黑色零件';
  return null;
}

// 机械臂 + 相机的模拟执行，与 run.py 的 Arm.execute() 一致
function makeArm(x, scene) {
  const arm = { holding: null };
  arm.execute = (skill, args) => {
    if (skill === 'locate') {
      const key = sceneKey(String(args.object ?? ''));
      if (!key) { x.say('设备', `相机：画面里没找到「${args.object}」`); return { ok: true, found: false, object: args.object }; }
      const [px, py] = scene[key];
      x.say('设备', `相机：定位「${args.object}」→ (${px}, ${py}) mm`);
      return { ok: true, found: true, object: args.object, position_mm: [px, py] };
    }
    if (skill === 'grasp') {
      if (arm.holding) return { ok: false, error: `夹爪里已有「${arm.holding}」，先 place` };
      arm.holding = String(args.object);
      x.say('设备', `夹爪：抓取「${arm.holding}」，夹持力上限 ${Number(args.max_force_n)} N`);
      return { ok: true, holding: arm.holding, max_force_n: Number(args.max_force_n) };
    }
    if (skill === 'place') {
      if (!arm.holding) return { ok: false, error: '夹爪是空的，先 grasp' };
      x.say('设备', `机械臂：把「${arm.holding}」移到「${args.target}」上方 → 松开夹爪`);
      const placed = arm.holding;
      arm.holding = null;
      return { ok: true, placed, target: args.target };
    }
    if (skill === 'navigate') { x.say('设备', `底盘：移动到「${args.target}」`); return { ok: true, at: args.target }; }
    if (skill === 'wait_confirm') {
      x.say('设备', `暂停，等待现场确认：${args.reason} → 已确认（demo 自动确认；量产用实体按键或 App）`);
      return { ok: true, confirmed: true };
    }
    return { ok: false, error: `没有技能 ${skill}` };
  };
  return arm;
}

export default async function run(x) {
  const { c } = x;
  const model = c.LLM_MODEL;
  const tiers = c.PRICES[model][x.region];
  const image = await x.asset(c.SAMPLE_IMAGE);
  const imageUrl = `data:image/jpeg;base64,${toBase64(image)}`;
  x.say('设备', `腕部相机 ← ${c.SAMPLE_IMAGE.split('/').pop()}（${Math.floor(image.byteLength / 1024)} KB）`);
  const arm = makeArm(x, c.SCENE);
  const tasks = [];
  for (const [n, text] of c.DEFAULT_COMMANDS.entries()) {
    const task = { text, route: 'cloud', rounds: 0, skills: 0, gate: { allow: 0, rewrite: 0, reject: 0 }, firstAt: null, tokens: [0, 0], cost: 0 };
    x.say('设备', `操作员指令：${text}`);
    task.said = x.now();
    const gate = makeGate(c, text);
    const label = gate.forbidden(text);
    if (label) {
      task.route = 'rejected';
      x.say('设备', `安全门 reject：指令含禁止动作「${label}」→ 不上云、不执行`);
      x.say('机械臂', '这个动作不安全，已拒绝执行。');
    } else {
      x.say('云端', `${model} 看图规划（Function Calling，流式）……`);
      const messages = [{ role: 'system', content: c.SYSTEM },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: imageUrl } }, { type: 'text', text }] }];
      let finished = false;
      for (let round = 1; round <= c.MAX_ROUNDS; round++) {
        task.rounds = round;
        let speech = null;
        const turn = await x.chat({ model, messages, tools: c.TOOLS, enable_thinking: false }, {
          onText: (_, all) => { speech = speech ? speech.update({ text: all }) : x.say('机械臂', all); },
        });
        task.tokens = [task.tokens[0] + turn.usage.prompt, task.tokens[1] + turn.usage.completion];
        task.cost += costOf(tiers, turn.usage);
        if (task.firstAt == null) task.firstAt = turn.firstCallAt;
        if (!turn.calls.length) { finished = true; break; }
        messages.push({ role: 'assistant', content: turn.text, tool_calls: turn.calls.map((k, i) => ({ id: k.id, type: 'function', index: i, function: { name: k.name, arguments: k.arguments } })) });
        for (const call of turn.calls) {
          let args = null;
          try { args = JSON.parse(call.arguments || '{}'); } catch { args = null; }
          x.say('云端', `第 ${round} 轮 → ${call.name} ${call.arguments}`);
          let result;
          if (!args || typeof args !== 'object' || Array.isArray(args)) result = { ok: false, error: 'arguments 不是 JSON 对象' };
          else {
            const d = gate.check(call.name, args);
            task.gate[d.verdict] += 1;
            if (d.verdict === 'reject') {
              x.say('设备', `安全门 reject：${call.name} ${JSON.stringify(args)}（${d.notes.join('；')}）`);
              result = { ok: false, gate: 'reject', reason: d.notes.join('；') };
            } else {
              if (d.verdict === 'rewrite') x.say('设备', `安全门 rewrite：${call.name} — ${d.notes.join('；')}`);
              if (d.confirmFirst) { arm.execute('wait_confirm', { reason: gate.confirmReason }); gate.confirmed = true; }
              if (call.name === 'wait_confirm') gate.confirmed = true;
              result = arm.execute(call.name, d.args);
              task.skills += 1;
              result.gate = d.verdict;
              if (d.notes.length) result.gate_notes = d.notes;
            }
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }
      if (!finished) x.say('云端', `${c.MAX_ROUNDS} 轮后仍在调用技能，停止规划`);
    }
    tasks.push(task);
    if (task.route === 'rejected') x.say('统计', `指令 ${n + 1} · 安全门直接拒绝 · 不上云 · ¥0`);
    else {
      const first = task.firstAt == null ? '—（本条没有调用技能）' : `${Math.round(task.firstAt - task.said)} ms`;
      const g = Object.entries(task.gate).map(([k, v]) => `${k} ${v}`).join(' / ');
      x.say('统计', `指令 ${n + 1} · ${task.rounds} 轮 · 执行技能 ${task.skills} 次 · 安全门 ${g} · 下达指令 → 首个技能调用 ${first} · ¥${fmtCny(task.cost)}（输入 ${task.tokens[0]} / 输出 ${task.tokens[1]} Token）`);
    }
  }
  const cloud = tasks.filter((t) => t.route === 'cloud');
  const firstTask = cloud.find((t) => t.firstAt != null);
  const rewrites = tasks.reduce((s, t) => s + t.gate.rewrite, 0);
  const rejects = tasks.reduce((s, t) => s + t.gate.reject, 0) + tasks.filter((t) => t.route === 'rejected').length;
  return {
    models: [model],
    firstMs: firstTask ? firstTask.firstAt - firstTask.said : null,
    cost: cloud.length ? cloud.reduce((s, t) => s + t.cost, 0) / cloud.length : 0,
    sample: `${c.SAMPLE_IMAGE.split('/').pop()} + ${tasks.length} 条指令`,
    note: `${tasks.length} 条指令：上云 ${cloud.length}、指令级拒绝 ${tasks.length - cloud.length}；安全门 rewrite ${rewrites}、reject ${rejects}；成本为上云指令均值；夹持力上限 ${c.MAX_FORCE_N} N`,
    outputs: [],
  };
}
