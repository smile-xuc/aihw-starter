// 播报语言跟用户真的说过的话走。页面默认中文；短句、网址和命令不改语言。
// 判断方式和 Qwen-Live-Harness orchestrator/conversation-language.ts 一致。

const PREFERENCE = /^(?:请|麻烦)?(?:以后|接下来|今后)?(?:请)?(?:一直|都)?(?:用|使用|改用|切换(?:成|为|到)?|改成|改为)(中文|简体中文|汉语|英文|英语)(?:和我(?:交流|说话|聊天)|(?:来)?(?:回答|回复|交流|说话|聊天))?(?:就好|好吗|可以吗)?[。！？.!?]*$/u;
const ENGLISH_PREFERENCE = /^(?:please\s+)?(?:(?:respond|reply|answer|speak|talk)(?:\s+to\s+me)?\s+(?:in|using)|(?:switch|change)(?:\s+back)?\s+to|use)\s+(simplified\s+chinese|chinese|mandarin|english)(?:\s+from\s+now\s+on|\s+for\s+(?:your\s+)?(?:replies|responses|answers))?[.!?]*$/iu;
const ACK = /^(?:ok(?:ay)?|yes|no|yep|nope|sure|thanks?|thank you|go ahead|好的?|可以|行|嗯|是的?|不是|谢谢)[\s。！？.!?]*$/iu;
const COMMAND = /^(?:git|npm|npx|pnpm|yarn|node|python\d*|cd|ls|pwd|cat|rg|curl|wget|ssh|sudo)\s/iu;

export function observeConversationLanguage(state, transcript) {
  const current = state?.current;
  const preference = state?.preference;
  const text = String(transcript || '').trim();
  if (!text) return { current, preference };
  const requested = text.match(PREFERENCE)?.[1] ?? text.match(ENGLISH_PREFERENCE)?.[1];
  if (requested) {
    const next = /^(?:英文|英语|english)$/iu.test(requested) ? 'en' : 'zh-CN';
    return { current: next, preference: next };
  }
  if (preference) return { current, preference };
  const prose = text
    .replace(/```[\s\S]*?```|`[^`]*`/gu, ' ')
    .replace(/https?:\/\/\S+|\bwww\.\S+/giu, ' ')
    .replace(/(?:^|\s)(?:~?\/|[A-Za-z]:\\)\S+/gu, ' ')
    .trim();
  if (ACK.test(prose) || COMMAND.test(prose)) return { current, preference };
  if ((prose.match(/\p{Script=Han}/gu)?.length ?? 0) >= 2) return { current: 'zh-CN', preference };
  if (
    !/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}]/u.test(prose)
    && (prose.match(/\b[A-Za-z]+(?:'[A-Za-z]+)?\b/gu)?.length ?? 0) >= 3
  ) return { current: 'en', preference };
  return { current, preference };
}

export function resolveConversationLanguage(state, fallback = 'zh-CN') {
  return state?.current || fallback;
}

export function replyLanguageLine(language) {
  if (language !== 'en') return '';
  return '\n这一通改用英文回答。查询、看图和提醒的播报也用英文。不要改回中文，除非用户明确要求。';
}

const CHINESE_REPLY_WITH_CONCLUSION = '用口语化中文回答，每次两三句话，先给结论。';
const CHINESE_REPLY = '用口语化中文回答，每次两三句话。';

export function applyReplyLanguage(instructions, language) {
  const text = String(instructions || '');
  if (language !== 'en') return text;
  return text
    .split(CHINESE_REPLY_WITH_CONCLUSION).join('Answer in spoken English, in two or three sentences, and lead with the conclusion.')
    .split(CHINESE_REPLY).join('Answer in spoken English, in two or three sentences.');
}
