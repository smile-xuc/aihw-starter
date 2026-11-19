import test from 'node:test';
import assert from 'node:assert/strict';
import { observeConversationLanguage, replyLanguageLine, resolveConversationLanguage } from '../js/live/conversation-language.js';

test('conversation language follows a real request and ignores short replies', () => {
  assert.equal(resolveConversationLanguage({}), 'zh-CN');
  assert.equal(replyLanguageLine('zh-CN'), '');
  assert.match(replyLanguageLine('en'), /改用英文/);
  let state = observeConversationLanguage({}, 'OK');
  assert.equal(resolveConversationLanguage(state), 'zh-CN');
  state = observeConversationLanguage(state, '请用英文和我说话');
  assert.equal(state.preference, 'en');
  assert.equal(resolveConversationLanguage(state), 'en');
  state = observeConversationLanguage(state, '今天天气很好');
  assert.equal(resolveConversationLanguage(state), 'en');
  state = observeConversationLanguage(state, '请用中文和我说话');
  assert.equal(state.preference, 'zh-CN');
  assert.equal(resolveConversationLanguage(state), 'zh-CN');
  state = observeConversationLanguage({}, 'What is the weather');
  assert.equal(resolveConversationLanguage(state), 'en');
  state = observeConversationLanguage({}, 'please speak in English');
  assert.equal(state.preference, 'en');
  state = observeConversationLanguage({}, 'git clone https://example.com/demo.git');
  assert.equal(state.current, undefined);
  state = observeConversationLanguage({}, '用英文翻译这段话');
  assert.equal(state.preference, undefined);
});
