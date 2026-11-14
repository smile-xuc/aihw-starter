// 玩具、桌宠、同传耳机在浏览器里的产品实时会话。提示词和工具从 live-data 读，这里只做路由和本地动作。

export const LIVE_PRODUCTS = [
  {
    id: 'toy',
    href: '#/live/toy',
    solution: '03-toys-companion.bailian',
    variant: 'default',
    kind: 'omni',
    camera: true,
    title: '毛绒玩具',
    lead: '对着玩具眼睛看到的画面说话。团团用口语回答，动作和灯光显示在这一页。',
    note: '接通 qwen3.8-omni-flash-realtime。页面上的点头、挥手和灯光不会驱动真的玩具。单次最长 3 分钟。',
  },
  {
    id: 'pet',
    href: '#/live/pet',
    solution: '05-desktop-pet.bailian',
    variant: 'default',
    kind: 'omni',
    camera: false,
    diary: true,
    title: '桌宠豆豆',
    lead: '和豆豆说话。它会换表情、做动作；结束时用文字模型写一篇陪伴日记，记在这台浏览器。',
    note: '接通 qwen3.8-omni-flash-realtime。表情只显示在页面上。结束通话后另有一次日记请求。单次最长 3 分钟。',
  },
  {
    id: 'earphone',
    href: '#/live/earphone',
    solution: '06-ai-earphone.bailian',
    variant: 'default',
    kind: 'translate',
    camera: false,
    title: '同传耳机',
    lead: '对着麦克风说话，这一页边听边出译文和译音。',
    note: '接通 qwen3.8-livetranslate-flash-realtime。默认译成英语。结束时发送 session.finish，等最后一句。单次最长 3 分钟。',
  },
  {
    id: 'glasses',
    href: '#/session',
    solution: '02-ai-glasses.bailian',
    variant: 'realtime',
    kind: 'link',
    title: '给 AI 打电话',
    lead: '',
    note: '与看说体验同一条 Omni 实时会话：打开摄像头或屏幕，说完稍停就会回答。',
  },
];

export function liveProduct(id) {
  return LIVE_PRODUCTS.find((item) => item.id === id && item.kind !== 'link') || null;
}

export function liveProductFor(solution, variant) {
  return LIVE_PRODUCTS.find((item) => item.solution === solution && item.variant === variant) || null;
}

export function liveReturn(hash) {
  const item = LIVE_PRODUCTS.find((entry) => entry.href === hash && entry.kind !== 'link');
  return item ? { href: item.href, title: item.title } : null;
}

export function phraseMap(text) {
  const phrases = {};
  for (const line of String(text || '').split('\n')) {
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && value && key.length <= 40 && value.length <= 80) phrases[key] = value;
  }
  return phrases;
}

export function applyTool(constants, name, argumentsText) {
  let args = {};
  try {
    args = typeof argumentsText === 'string' ? JSON.parse(argumentsText || '{}') : (argumentsText || {});
  } catch { args = {}; }
  if (name === 'toy_action') {
    const motion = constants.MOTIONS?.[args.motion] || args.motion || '不动';
    const light = constants.LIGHTS?.[args.light] || args.light || '不变';
    return {
      ok: true,
      output: JSON.stringify({ ok: true, done: [args.motion ?? null, args.light ?? null] }),
      label: `动作：${motion} · 灯光：${light}`,
    };
  }
  if (name === 'pet_expression') {
    const emotion = constants.EMOTIONS?.[args.emotion] ? args.emotion : 'calm';
    const action = constants.ACTIONS?.[args.action] ? args.action : 'none';
    return {
      ok: true,
      output: JSON.stringify({ ok: true, emotion, action }),
      label: `屏幕：${constants.EMOTIONS[emotion]} · 动作：${constants.ACTIONS[action]} · 灯光：${constants.LIGHTS?.[emotion] || ''}`,
      emotion,
      action,
      face: constants.FACES?.[emotion] || constants.FACES?.calm || null,
    };
  }
  return { ok: false, output: JSON.stringify({ ok: false, error: `unknown tool ${name}` }), label: '没有这个动作' };
}

export function petFace(emotion, face) {
  const eyes = String(face?.[0] ?? 'o     o');
  const mouth = String(face?.[1] ?? ' --- ');
  const center = (text) => {
    const raw = text.length > 11 ? text.slice(0, 11) : text;
    const left = Math.floor((11 - raw.length) / 2);
    return `${' '.repeat(Math.max(0, left))}${raw}${' '.repeat(Math.max(0, 11 - raw.length - left))}`;
  };
  const top = `.${'-'.repeat(11)}.${emotion === 'sleepy' ? ' zZ' : ''}`;
  return [top, `|${center(eyes)}|`, `|${center(mouth)}|`, `'${'-'.repeat(11)}'`].join('\n');
}

export function functionCalls(event, limit = 2, used = 0) {
  if (used >= limit) return [];
  const output = event?.response?.output || [];
  return output.filter((item) => item?.type === 'function_call' && item.call_id).slice(0, limit - used);
}

export function instructionsWithPetMemory(base, memory, slot, recall = 10) {
  const items = Array.isArray(memory?.memories) ? memory.memories.slice(-recall) : [];
  if (!items.length && !memory?.follow_up) return base;
  const lines = items.map((item) => `- [${item.type || '记忆'}] ${item.content}（${item.date || ''}）`);
  if (memory?.follow_up) lines.push(`- 上次想关心：${memory.follow_up}`);
  return `${base}${String(slot || '\n\n[记忆]\n{lines}').replace('{lines}', lines.join('\n'))}`;
}

export function formatDiaryPrompt(template, name) {
  return String(template || '').replace(/\{\{|\}\}|\{(\w+)\}/g, (match, key) => {
    if (match === '{{') return '{';
    if (match === '}}') return '}';
    if (key !== 'name') throw new Error('日记提示词变量不可用');
    return name;
  });
}

export function parseDiary(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const diary = JSON.parse(cleaned);
  if (!diary || typeof diary !== 'object' || Array.isArray(diary)) throw new Error('日记不是 JSON');
  return diary;
}

export function mergeMemories(memory, diary, today, limit = 20) {
  const fresh = (Array.isArray(diary?.memories) ? diary.memories : []).flatMap((item) => {
    const content = String(item?.content || '').trim();
    if (!content) return [];
    return [{ date: today, type: String(item.type || '记忆'), content }];
  });
  const items = [...(Array.isArray(memory?.memories) ? memory.memories : []), ...fresh];
  const seen = new Set();
  const merged = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item?.content || seen.has(item.content)) continue;
    seen.add(item.content);
    merged.push(item);
  }
  merged.reverse();
  return {
    pet: memory?.pet || '豆豆',
    updated: today,
    follow_up: String(diary?.follow_up || ''),
    memories: merged.slice(-limit),
  };
}

export function renderDiary(diary, { today, name, turns }) {
  const stars = Math.max(1, Math.min(5, Number(diary?.mood_stars) || 3));
  const lines = [
    `${today} · ${name}的日记：${diary?.title || '今天'}`,
    String(diary?.diary || ''),
    `今日心情：${diary?.mood || '平静'} ${'⭐'.repeat(stars)} | 互动次数：${turns} 次`,
  ];
  if (diary?.follow_up) lines.push(`明天想关心：${diary.follow_up}`);
  for (const item of Array.isArray(diary?.memories) ? diary.memories : []) {
    const content = String(item?.content || '').trim();
    if (content) lines.push(`记住：[${item.type || '记忆'}] ${content}`);
  }
  return lines.filter(Boolean).join('\n');
}
