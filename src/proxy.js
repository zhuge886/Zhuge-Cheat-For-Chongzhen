'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { applyConditionalOverride } = require('./rule-engine');

function tryParseJson(buffer) {
  if (!buffer || buffer.length === 0) return null;
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function buildTargetUrl(base, requestUrl) {
  const normalized = String(base || '').trim().replace(/\/+$/, '');
  if (!requestUrl) return normalized;
  return requestUrl.startsWith('/')
    ? `${normalized}${requestUrl}`
    : `${normalized}/${requestUrl}`;
}

function buildHeaders(req, apiKey) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (
      ['host', 'content-length', 'authorization', 'x-api-key', 'api-key', 'connection'].includes(lower)
    ) {
      continue;
    }
    headers[key] = value;
  }

  headers.Authorization = `Bearer ${apiKey}`;
  if (!headers['content-type']) headers['content-type'] = 'application/json';
  return headers;
}

class ByokProxy extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.config = null;
    this.captureSequence = 0;
  }

  log(level, message, extra = null) {
    const entry = {
      time: new Date().toISOString(),
      level,
      message,
      extra
    };
    this.emit('log', entry);
  }

  getStatus() {
    return {
      running: Boolean(this.server),
      port: this.config ? this.config.port : null,
      localBase: this.server && this.config ? `http://127.0.0.1:${this.config.port}` : ''
    };
  }

  validateConfig(config) {
    if (!config.upstreamBase) throw new Error('请先填写 API Base URL。');
    if (!/^https?:\/\//i.test(config.upstreamBase)) {
      throw new Error('API Base URL 必须以 http:// 或 https:// 开头。');
    }
    if (!config.apiKey) throw new Error('请先填写并保存 API Key。');
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
      throw new Error('代理端口无效。');
    }
  }

  async start(config) {
    if (this.server) throw new Error('代理已经在运行。');
    this.validateConfig(config);
    this.config = { ...config };

    if (this.config.captureEnabled && this.config.logDir) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        this.log('error', `代理请求失败：${error.message}`);
        if (!res.headersSent) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json; charset=utf-8');
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({
            error: { type: 'proxy_error', message: error.message }
          }));
        }
      });
    });

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server = null;
        reject(error);
      };
      this.server.once('error', onError);
      this.server.listen(this.config.port, '127.0.0.1', () => {
        this.server.off('error', onError);
        resolve();
      });
    });

    this.log('info', `代理已启动：http://127.0.0.1:${this.config.port}`);
    this.log('info', `上游地址：${this.config.upstreamBase}`);
    return this.getStatus();
  }

  async stop() {
    if (!this.server) return this.getStatus();
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => server.close(resolve));
    this.log('info', '代理已停止。');
    return this.getStatus();
  }

  captureOriginalRequest(req, bodyBuffer) {
    if (!this.config.captureEnabled || !this.config.logDir) return;

    this.captureSequence += 1;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const seq = String(this.captureSequence).padStart(4, '0');
    const type = req.url && req.url.includes('chat/completions') ? 'chat-completions' : 'request';
    const filename = `${timestamp}_${seq}_${type}.json`;
    const outputPath = path.join(this.config.logDir, filename);
    const bodyJson = tryParseJson(bodyBuffer);

    const record = {
      captured_at: new Date().toISOString(),
      request: {
        method: req.method,
        path: req.url,
        body: bodyJson !== null ? bodyJson : bodyBuffer.toString('utf8')
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(record, null, 2), 'utf8');
    this.log('capture', `已保存原始请求：${filename}`);
  }

  buildForwardBody(req, originalBody) {
    if (
      req.method !== 'POST' ||
      !req.url ||
      !req.url.includes('chat/completions')
    ) {
      return originalBody;
    }

    const payload = tryParseJson(originalBody);
    if (!payload) return originalBody;

    const overrideResult = applyConditionalOverride(payload, {
      enabled: this.config.overrideEnabled,
      keyword: this.config.forceKeyword
    });

    if (overrideResult.triggered) {
      this.log(
        'override',
        `强制规则已触发：关键词 ${this.config.forceKeyword}，命中 ${overrideResult.matches.length} 条 user 消息。`
      );
    } else {
      this.log('debug', '未触发强制规则，保持游戏原始 Prompt。');
    }

    if (this.config.disableThinking) {
      payload.thinking = { type: 'disabled' };
      delete payload.reasoning_effort;
    }

    if (this.config.modelOverride) {
      payload.model = this.config.modelOverride;
    }

    return Buffer.from(JSON.stringify(payload), 'utf8');
  }

  async handleRequest(req, res) {
    const startedAt = Date.now();
    const originalBody = await readRequestBody(req);
    this.captureOriginalRequest(req, originalBody);

    const method = String(req.method || 'GET').toUpperCase();
    const targetUrl = buildTargetUrl(this.config.upstreamBase, req.url);
    const forwardBody = this.buildForwardBody(req, originalBody);

    this.log('request', `${method} ${req.url} → ${targetUrl}`);

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: buildHeaders(req, this.config.apiKey),
      body: ['GET', 'HEAD'].includes(method) ? undefined : forwardBody
    });

    const elapsed = Date.now() - startedAt;
    this.log('response', `${upstreamResponse.status} ${upstreamResponse.statusText} · ${elapsed}ms`);

    res.statusCode = upstreamResponse.status;
    if (upstreamResponse.statusText) res.statusMessage = upstreamResponse.statusText;

    upstreamResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        ['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'keep-alive'].includes(lower)
      ) {
        return;
      }
      try {
        res.setHeader(key, value);
      } catch {
        // 某些 hop-by-hop header 不允许由 Node 重新设置，忽略即可。
      }
    });

    if (!upstreamResponse.body) {
      res.end();
      return;
    }

    const readable = Readable.fromWeb(upstreamResponse.body);
    readable.on('error', (error) => {
      this.log('error', `上游响应流错误：${error.message}`);
      if (!res.destroyed) res.destroy(error);
    });
    readable.pipe(res);
  }
}

module.exports = { ByokProxy };
