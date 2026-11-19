import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKEND_TOOLS, HANDOFF_TOOL, NO_BACKEND_NOTE, NO_BACKEND_NOTE_EN, isBackendTool, noBackendReceipt, noBackendTitle } from '../js/live/no-backend.js';
import { backgroundRows, openBackground, patchBackground } from '../js/live/monitor.js';

test('coding delegation returns no_backend and does not describe a started job', () => {
  assert.deepEqual(BACKEND_TOOLS.map((item) => item.function.name), [
    'session_list', 'session_create', 'handoff', 'session_monitor', 'session_stop', 'respond_permission',
  ]);
  for (const item of BACKEND_TOOLS) {
    assert.equal(isBackendTool(item.function.name), true);
    assert.match(item.function.description, /no_backend/);
    assert.match(item.function.description, /不会创建会话/);
  }
  assert.equal(isBackendTool('web_search'), false);
  const receipt = JSON.parse(noBackendReceipt());
  assert.equal(receipt.status, 'error');
  assert.equal(receipt.code, 'no_backend');
  assert.equal(receipt.note, NO_BACKEND_NOTE);
  assert.equal(JSON.parse(noBackendReceipt('en')).note, NO_BACKEND_NOTE_EN);
  assert.match(HANDOFF_TOOL.function.description, /hand this to the coding assistant/);
  assert.equal(receipt.job, undefined);
  assert.equal(receipt.session, undefined);
  assert.equal(noBackendTitle('handoff', { task: '  把按钮改成蓝色  ' }), '把按钮改成蓝色');
  assert.equal(noBackendTitle('session_list', { task: '不会用这段' }), '编码委托');
  const row = patchBackground(
    openBackground([], { id: 'b', lane: 'delegate', title: noBackendTitle('handoff', { task: '把按钮改成蓝色' }) }),
    'b',
    { state: 'failed', note: '没有编码后台，没有创建会话，也没有执行。' },
  );
  assert.match(backgroundRows(row)[0], /编码「把按钮改成蓝色」没完成。没有编码后台，没有创建会话，也没有执行。/);
  assert.match(HANDOFF_TOOL.function.description, /改代码/);
});
