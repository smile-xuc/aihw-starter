// 浏览器页面没有 ACP / 编码后台。这些工具仍要留在前台：调用后立刻返回 no_backend，
// 不创建会话，不执行任务，也不要假装结果稍后会到。

export const NO_BACKEND_NOTE = '这个页面没有编码后台。不会创建会话，不会执行任务，也不会改权限。编码委托仍在 Mac 上的 Qwen-Live-Harness。';

const UNAVAILABLE = `这个页面没有编码后台。调用后立即返回 no_backend，不会创建会话，不会执行任务，也不会改权限。只用一句话告诉用户这里做不了，不要说已经开始或已经做完。${NO_BACKEND_NOTE}`;

function tool(name, description, properties = {}, required = []) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties, required },
    },
  };
}

export const HANDOFF_TOOL = tool(
  'handoff',
  `用户要求改代码、跑命令、操作网页，或明确交给编码助手、Codex、Claude Code、Qwen Code、Gemini 时调用。task 写用户原话。${UNAVAILABLE}`,
  {
    task: { type: 'string', description: '用户要交给编码助手的原话。' },
    session: { type: 'string', description: '会话编号。这个页面不会使用。' },
  },
  ['task'],
);

export const SESSION_LIST_TOOL = tool(
  'session_list',
  `用户询问有哪些编码会话或编码助手时调用。${UNAVAILABLE}`,
);

export const SESSION_CREATE_TOOL = tool(
  'session_create',
  `用户明确要求新建一个编码会话时调用。${UNAVAILABLE}`,
  { label: { type: 'string', description: '会话名称。这个页面不会创建。' } },
);

export const SESSION_MONITOR_TOOL = tool(
  'session_monitor',
  `用户询问某个编码任务进展时调用。${UNAVAILABLE}`,
  { session: { type: 'string', description: '会话编号。这个页面没有编码会话。' } },
);

export const SESSION_STOP_TOOL = tool(
  'session_stop',
  `用户明确要求停下某个编码任务时调用。停下说话或换话题不算。${UNAVAILABLE}`,
  { session: { type: 'string', description: '会话编号。这个页面没有可停的编码任务。' } },
);

export const PERMISSION_TOOL = tool(
  'respond_permission',
  `只在用户口头回答一条编码权限请求时调用。这个页面没有待批准的编码权限。${UNAVAILABLE}`,
  {
    request_id: { type: 'string', description: '权限请求编号。' },
    decision: { type: 'string', enum: ['allow', 'deny'], description: 'allow 或 deny。这个页面不会执行。' },
  },
  ['request_id', 'decision'],
);

export const BACKEND_TOOLS = [SESSION_LIST_TOOL, SESSION_CREATE_TOOL, HANDOFF_TOOL, SESSION_MONITOR_TOOL, SESSION_STOP_TOOL, PERMISSION_TOOL];

const BACKEND_NAMES = new Set(BACKEND_TOOLS.map((item) => item.function.name));

export function isBackendTool(name) {
  return BACKEND_NAMES.has(name);
}

export function noBackendReceipt() {
  return JSON.stringify({ status: 'error', code: 'no_backend', note: NO_BACKEND_NOTE });
}

export function noBackendTitle(name, args) {
  if (name !== 'handoff') return '编码委托';
  const task = String(args?.task || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return task || '编码委托';
}
