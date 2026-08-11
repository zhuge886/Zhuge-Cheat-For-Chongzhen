'use strict';

const fs = require('fs/promises');
const path = require('path');
const { app, safeStorage } = require('electron');

const CONFIG_FILE = 'config.json';

function defaultConfig() {
  return {
    upstreamBase: '',
    apiKeyEncrypted: '',
    logDir: path.join(app.getPath('desktop'), 'ChongZhen_BYOK_Capture'),
    port: 8787,
    forceKeyword: 'zhuge',
    overrideEnabled: true,
    captureEnabled: true,
    disableThinking: true,
    modelOverride: ''
  };
}

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeConfig(input, base) {
  const merged = { ...base, ...input };
  const port = Number(merged.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('代理端口必须是 1-65535 的整数。');
  }

  const keyword = String(merged.forceKeyword || '').trim();
  if (!keyword) {
    throw new Error('强制执行关键词不能为空。');
  }

  return {
    ...merged,
    upstreamBase: normalizeBaseUrl(merged.upstreamBase),
    logDir: String(merged.logDir || '').trim(),
    port,
    forceKeyword: keyword,
    overrideEnabled: Boolean(merged.overrideEnabled),
    captureEnabled: Boolean(merged.captureEnabled),
    disableThinking: Boolean(merged.disableThinking),
    modelOverride: String(merged.modelOverride || '').trim()
  };
}

async function readRawConfig() {
  const defaults = defaultConfig();
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed, defaults);
  } catch (error) {
    if (error && error.code === 'ENOENT') return defaults;
    if (error instanceof SyntaxError) {
      throw new Error(`配置文件 JSON 无法解析：${getConfigPath()}`);
    }
    throw error;
  }
}

async function decryptApiKey(encryptedBase64) {
  if (!encryptedBase64) return '';
  const available = await safeStorage.isAsyncEncryptionAvailable();
  if (!available) {
    throw new Error('当前系统无法使用安全存储，无法解密 API Key。');
  }

  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const decrypted = await safeStorage.decryptStringAsync(encrypted);

  if (decrypted.shouldReEncrypt) {
    const reEncrypted = await safeStorage.encryptStringAsync(decrypted.result);
    const raw = await readRawConfig();
    raw.apiKeyEncrypted = reEncrypted.toString('base64');
    await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
    await fs.writeFile(getConfigPath(), JSON.stringify(raw, null, 2), 'utf8');
  }

  return decrypted.result;
}

async function encryptApiKey(apiKey) {
  const available = await safeStorage.isAsyncEncryptionAvailable();
  if (!available) {
    throw new Error('当前系统无法使用安全存储，因此不会以明文保存 API Key。');
  }
  const encrypted = await safeStorage.encryptStringAsync(apiKey);
  return encrypted.toString('base64');
}

async function getPublicConfig() {
  const raw = await readRawConfig();
  const { apiKeyEncrypted, ...publicConfig } = raw;
  return {
    ...publicConfig,
    apiKeySet: Boolean(apiKeyEncrypted),
    configPath: getConfigPath()
  };
}

async function getRuntimeConfig() {
  const raw = await readRawConfig();
  return {
    ...raw,
    apiKey: await decryptApiKey(raw.apiKeyEncrypted)
  };
}

async function saveConfig(input) {
  const current = await readRawConfig();
  const next = normalizeConfig(input, current);

  if (Object.prototype.hasOwnProperty.call(input, 'apiKey')) {
    const apiKey = String(input.apiKey || '').trim();
    if (apiKey) {
      next.apiKeyEncrypted = await encryptApiKey(apiKey);
    }
  }

  if (input.clearApiKey === true) {
    next.apiKeyEncrypted = '';
  }

  delete next.apiKey;
  delete next.clearApiKey;
  delete next.apiKeySet;
  delete next.configPath;

  await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify(next, null, 2), 'utf8');
  return getPublicConfig();
}

module.exports = {
  getPublicConfig,
  getRuntimeConfig,
  saveConfig,
  getConfigPath
};
