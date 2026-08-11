'use strict';

const $ = (id) => document.getElementById(id);
const logLines = [];

function appendLog(entry) {
  const level = String(entry.level || 'info').toUpperCase();
  const localTime = new Date(entry.time || Date.now()).toLocaleTimeString('zh-CN', { hour12: false });
  logLines.push(`[${localTime}] [${level}] ${entry.message}`);
  if (logLines.length > 300) logLines.splice(0, logLines.length - 300);
  $('logBox').textContent = logLines.join('\n');
  $('logBox').scrollTop = $('logBox').scrollHeight;
}

function showError(error) {
  appendLog({ level: 'error', message: error && error.message ? error.message : String(error) });
}

function formValue() {
  return {
    upstreamBase: $('upstreamBase').value.trim(),
    apiKey: $('apiKey').value.trim(),
    modelOverride: $('modelOverride').value.trim(),
    port: Number($('port').value),
    forceKeyword: $('forceKeyword').value.trim(),
    logDir: $('logDir').value.trim(),
    overrideEnabled: $('overrideEnabled').checked,
    captureEnabled: $('captureEnabled').checked,
    disableThinking: $('disableThinking').checked
  };
}

function applyConfig(config) {
  $('upstreamBase').value = config.upstreamBase || '';
  $('modelOverride').value = config.modelOverride || '';
  $('port').value = config.port || 8787;
  $('forceKeyword').value = config.forceKeyword || 'zhuge';
  $('logDir').value = config.logDir || '';
  $('overrideEnabled').checked = config.overrideEnabled !== false;
  $('captureEnabled').checked = config.captureEnabled !== false;
  $('disableThinking').checked = config.disableThinking !== false;
  $('apiKey').value = '';
  $('apiKey').placeholder = config.apiKeySet ? '已安全保存；留空表示保持不变' : '请输入 API Key';
  $('apiKeyHint').textContent = config.apiKeySet
    ? 'API Key 已使用本机安全存储加密；留空保存不会清除已有 Key。'
    : 'API Key 仅保存在本机，并使用 Electron safeStorage 加密。';
  updateLocalBase();
}

function updateLocalBase() {
  const port = Number($('port').value) || 8787;
  $('localBase').textContent = `http://127.0.0.1:${port}`;
}

function applyStatus(status) {
  const running = Boolean(status.running);
  const badge = $('statusBadge');
  badge.className = `status ${running ? 'running' : 'stopped'}`;
  badge.querySelector('b').textContent = running ? '运行中' : '已停止';
  $('startBtn').disabled = running;
  $('stopBtn').disabled = !running;
  $('saveBtn').disabled = running;
  $('port').disabled = running;
  if (running && status.localBase) $('localBase').textContent = status.localBase;
}

async function save() {
  const config = await window.zhugeProxy.saveConfig(formValue());
  applyConfig(config);
  appendLog({ level: 'info', message: '配置已保存。' });
  return config;
}

async function init() {
  try {
    applyConfig(await window.zhugeProxy.getConfig());
    applyStatus(await window.zhugeProxy.getStatus());
  } catch (error) {
    showError(error);
  }

  window.zhugeProxy.onLog(appendLog);
}

$('port').addEventListener('input', updateLocalBase);

$('toggleKey').addEventListener('click', () => {
  const input = $('apiKey');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('toggleKey').textContent = showing ? '显示' : '隐藏';
});

$('chooseDir').addEventListener('click', async () => {
  try {
    const dir = await window.zhugeProxy.chooseLogDir();
    if (dir) $('logDir').value = dir;
  } catch (error) {
    showError(error);
  }
});

$('openDir').addEventListener('click', async () => {
  try {
    await window.zhugeProxy.openLogDir();
  } catch (error) {
    showError(error);
  }
});

$('saveBtn').addEventListener('click', async () => {
  try {
    await save();
  } catch (error) {
    showError(error);
  }
});

$('startBtn').addEventListener('click', async () => {
  try {
    await save();
    applyStatus(await window.zhugeProxy.startProxy());
  } catch (error) {
    showError(error);
  }
});

$('stopBtn').addEventListener('click', async () => {
  try {
    applyStatus(await window.zhugeProxy.stopProxy());
  } catch (error) {
    showError(error);
  }
});

$('clearLog').addEventListener('click', () => {
  logLines.length = 0;
  $('logBox').textContent = '';
});

init();
