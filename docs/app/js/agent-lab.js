// Offline teaching model, not a provider protocol or a backend implementation.
export const CAPABILITIES = [
  {id:'cli', name:'Bailian CLI', title:'把一次调用变成可复用任务', summary:'校验输入、选择文字 / 图片 / ASR / TTS 模板，生成可复制的 POSIX shell 命令。', flow:'任务参数 → bl CLI → 百炼模型服务 → 文本 / 媒体文件', needs:'Node.js ≥18.17；真实调用需对应地域的账号权限与额度。音视频本地路径可能上传临时存储（48 小时），并非全程本地。', source:'https://github.com/modelstudioai/cli/tree/3c8031f4d994c30820eb4d145d9404ba4a0acd39', guide:'cli'},
  {id:'media', name:'Qwen-MM-Plugins', title:'给结论留下可以回看的证据', summary:'在人工编写的教程时间线上查证据，再检查样本图片局部；理解抽帧与模型推理的边界。', flow:'媒体 → core 元数据 / 抽帧 / 裁图 → 宿主多模态模型 → 带时间戳的结论', needs:'Python ≥3.10；视频需 ffmpeg。core 原生模式不另发模型请求，宿主仍可能付费、上传图像；api、video2note 等另需服务配置。', source:'https://github.com/QwenLM/Qwen-MM-Plugins/tree/d7ca19a9c8b60f02a86350706ff5e19095c33850', guide:'media'},
  {id:'voice', name:'qwen-audio-agent', title:'说着话，后台继续做事', summary:'纯语音场景的文字化状态演练：整理巡检记录，修改要求、确认权限、取消任务，再择机交付。', flow:'麦克风 → 实时语音前台 ↔ 编排运行时 ↔ ACP / A2A 后台 → 结果交付', needs:'源码 Node.js ^22.22.2 / ^24.15.0 / ≥26，npm ≥10；语音服务、已配置后台与麦克风权限。AGENT_PROTOCOL=none 不执行后台任务。', source:'https://github.com/QwenAudio/qwen-audio-agent/tree/d2a8dc45b9b49d560c876eb7ed449eb9b90df1b9', guide:'voice'},
  {id:'visual', name:'Qwen-Live-Harness', title:'把“这里”绑定到一张有时效的画面', summary:'选择预制画面，检查上下文变化如何使旧授权与旧结果失效。本站不读取屏幕或摄像头。', flow:'Electron Host → 本机 WebSocket → daemon → Omni Realtime / 视觉子智能体 → 可选后台 Harness', needs:'完整桌面路径 macOS 12+、Node.js ≥22.13；源码需 Xcode 命令行工具。Host / daemon 配套，模型服务需联网；此 Linux 环境未验证桌面运行。', source:'https://github.com/QwenLM/Qwen-Live-Harness/tree/b2d17b8706b226ff7792683ecd8f050f18f9752e', guide:'visual'},
];

export const CLI_TEMPLATES = {
  text:{label:'文字：整理巡检清单', value:'把巡检记录整理成待核对清单，不推测未提供的信息。'},
  image:{label:'图片：说明卡插图', value:'一张简洁的设备巡检说明卡插图，不含文字。'},
  asr:{label:'ASR：转写本地录音', value:'./inspection.wav'},
  tts:{label:'TTS：播报待办', value:'巡检草稿已完成，请核对证据后再发送。'},
};
export function shellQuote(value) { return "'" + value.replaceAll("'", "'\\''") + "'"; }
export function buildCommand(kind, input) {
  if (!Object.hasOwn(CLI_TEMPLATES, kind)) throw Error('请选择受支持的任务模板。');
  const value = String(input).trim();
  if (!value) throw Error('输入不能为空。');
  if (value.length > 2000 || /[\x00-\x1f\x7f]/.test(value)) throw Error('请使用不超过 2000 字的单行输入。');
  if (kind === 'asr' && (!/^(\.\.?\/|\/)[^\r\n]+\.(wav|mp3|m4a|flac)$/i.test(value) || value.includes('://'))) throw Error('请填写以 ./、../ 或 / 开头的本地 WAV / MP3 / M4A / FLAC 路径。网页不能验证文件存在。');
  const q = shellQuote(value);
  return {text:`bl text chat --message ${q} --output json`, image:`bl image generate --prompt ${q} --out-dir ./out/`, asr:`bl speech recognize --url ${q} --out ./transcript.json`, tts:`bl speech synthesize --text ${q} --out ./brief.mp3`}[kind];
}

export const EVIDENCE = [
  {time:'00:00', title:'先确认设备标识', observation:'示意教程要求先记录铭牌；没有提供序列号，不能替设备编造身份。', confidence:'待核实：设备型号', step:'记录型号与拍摄时间'},
  {time:'00:12', title:'对齐接口与局部证据', observation:'示意教程要求检查插头是否松动；抽样帧不能证明整个时段都没有异常。', confidence:'待核实：接触状态', step:'补拍接口近景'},
  {time:'00:28', title:'保存草稿，等待批准', observation:'示意教程结束在本地草稿。没有发送回执，不得写成“已通知维修”。', confidence:'待批准：对外发送', step:'人工核对后另行授权'},
];

export const VISUAL_FRAMES = {
  A:{id:'fixture-panel-a',file:'assets/lab/panel-a.svg',title:'设备铭牌',source:'本仓手绘 SVG 示意图；不是屏幕或相机截图'},
  B:{id:'fixture-port-b',file:'assets/lab/port-b.svg',title:'接口近景',source:'本仓手绘 SVG 示意图；不代表真实连接状态'},
};

export const taskToken = s => `${s.revision}:${s.attempt}`;
export function initialTask({visual=false}={}) {
  return {task:'idle', speech:'silent', userTalking:false, revision:1, attempt:0, requirement:'全部观察与待办', approval:null, result:null, delivered:false, context:'A', visual, clock:0, observedAt:0, log:['本地状态演练；没有麦克风、屏幕采集或后台连接。']};
}
export function transition(state, event) {
  const s = structuredClone(state);
  const note = text => { s.log.push(text); s.log = s.log.slice(-30); };
  const running = s.task === 'running';
  switch(event.type) {
    case 'start':
      if(s.task !== 'idle') break;
      s.task='running';s.attempt++;s.speech='speaking';note('受理：整理巡检记录为本地草稿，后台运行中。');break;
    case 'stop-speech': s.speech='silent';note('已停播；后台任务状态没有改变。');break;
    case 'talk': s.userTalking=!s.userTalking;note(s.userTalking?'用户正在讲话，交付队列等待。':'用户停止讲话，可尝试交付。');break;
    case 'update': case 'context': case 'refresh-context':
      if(!['running','awaiting_approval','completed','awaiting_context'].includes(s.task)) break;
      if(s.task==='awaiting_context' && event.type==='update') break;
      s.revision++;s.task='running';s.approval=null;
      if(event.type==='update') s.requirement='仅待核对项';s.result=null;s.delivered=false;
      if(event.type==='context') s.context=s.context==='A'?'B':'A';
      if(event.type==='context'||event.type==='refresh-context') s.observedAt=s.clock;
      note(`要求更新为 v${s.revision}；旧结果与旧授权失效${event.type==='context'?'，必须重新核对画面':''}。`);break;
    case 'expire-context':
      if(!s.visual||!['running','awaiting_approval','completed'].includes(s.task)) break;
      s.clock+=20;s.revision++;s.task='awaiting_context';s.approval=null;s.result=null;s.delivered=false;
      note('场景时间推进 20 秒：超过本演练 15 秒新鲜度窗口，暂停等待重新核对；旧授权与结果失效。');break;
    case 'permission':
      if(!running) break;
      s.task='awaiting_approval';s.approval={token:taskToken(s),scope:'写入本地 inspection.md 草稿'};note('等待批准：仅写入本地 inspection.md，不包含发送或控制设备。');break;
    case 'approve':
      if(s.task!=='awaiting_approval'||event.token!==s.approval?.token) {note('忽略失效或不匹配的批准。');break;}
      s.task='running';s.approval=null;note('本次草稿写入已批准，任务继续。');break;
    case 'deny':
      if(s.task!=='awaiting_approval') break;
      s.task='failed';s.approval=null;note('批准被拒绝，草稿未写入；可重新定义任务后重试。');break;
    case 'cancel':
      if(!['running','awaiting_approval','awaiting_context'].includes(s.task)) break;
      s.task='cancelling';s.approval=null;note('已发取消请求，等待后台确认；尚未宣称已取消。');break;
    case 'cancelled':
      if(s.task!=='cancelling') break;
      s.task='cancelled';s.result=null;note('收到模拟后台取消确认；既有外部副作用不自动回滚。');break;
    case 'fail':
      if(!running) break;
      s.task='failed';note('模拟后台连接失败，不能推断草稿完成。');break;
    case 'retry':
      if(!['failed','cancelled'].includes(s.task)) break;
      s.task=s.visual && s.clock-s.observedAt>15?'awaiting_context':'running';s.attempt++;s.result=null;s.approval=null;s.delivered=false;note(`开始第 ${s.attempt} 次尝试；真实系统重试前需核对副作用。`);break;
    case 'result':
      if(!running || event.token!==taskToken(s)) {note('忽略迟到 / 旧版本 / 非运行中结果。');break;}
      s.task='completed';s.result=`巡检清单 v${s.revision}：${s.requirement==='仅待核对项'?'待核对：设备型号、接口接触状态。':'样本观察：设备面板有铭牌。待核对：设备型号、接口接触状态。'}${s.visual?` 证据 ${VISUAL_FRAMES[s.context].id}，场景取样 ${s.observedAt} 秒。`:''} 仅为本地草稿，未发送。`;note('后台完成，结果进入交付队列；尚未告知用户。');break;
    case 'deliver':
      if(!s.result||s.task!=='completed'||s.delivered) break;
      if(s.userTalking||s.speech==='speaking') {note('等待安全播报窗口，结果保留在队列。');break;}
      s.delivered=true;s.speech='speaking';note('模拟收到播放开始回执：结果已交付一次，不等于用户已听完。');break;
    default: throw Error('未知演练事件。');
  }
  return s;
}
