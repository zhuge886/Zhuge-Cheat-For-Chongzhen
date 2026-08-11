# 历史模拟器-崇祯 诸葛定向提示词优化工具
# Zhuge Cheat for Chongzhen

《历史模拟器：崇祯》BYOK 本地代理工具。提供 Windows 图形界面，用于配置 OpenAI 兼容模型 API、捕获游戏实际发送的 BYOK 请求，并支持“仅在出现指定关键词时”对当前请求注入高优先级调试规则。

> 本项目是非官方社区工具，与《历史模拟器：崇祯》开发团队、发行方及模型服务商无隶属或背书关系。请自行遵守游戏服务条款和模型服务商条款。
> 本项目初衷是优化游戏体验、帮助玩家建立游玩自信，若产生不适或各类问题，欢迎及时沟通反馈。

## 功能

- Windows GUI，无需手动设置 PowerShell 环境变量。
- 可配置 API Base URL、API Key、本地代理端口。
- API Key 使用 Electron `safeStorage` 在本机加密保存，不写入仓库和 Prompt 捕获文件。
- 可选“模型覆盖”；留空时保持游戏请求原本的 `model`。
- 支持原始 BYOK 请求捕获，方便研究 `messages`、`system`、`tools`、`tool_choice` 等运行时结构。
- 强制执行关键词可自定义，默认 `zhuge`。
- 同时识别英文冒号和中文全角冒号：`zhuge:` / `zhuge：`。
- 没有关键词时，不修改游戏原始 Prompt。
- 检测到关键词时，仅对相关请求注入高优先级调试规则。
- 对 DeepSeek 等场景可自动关闭 Thinking Mode，以兼容 `tool_choice`。
- 支持流式响应。
- GitHub Actions 自动构建 x64 Windows 安装版和 Portable EXE。

## 重要说明

这个工具只能影响“客户端发给 BYOK 模型的请求”。它不会伪造 Tool Result，也不会绕过游戏服务器真实存在的数据库字段、主键、外键、数据类型、数值范围、权限或业务校验。

因此“强制执行”准确含义是：**让模型层优先尝试执行被关键词标记的目标，并尽可能通过当前游戏实际提供的工具落库；最终是否真正写入，仍以服务端真实返回结果为准。**

## 直接使用 Windows EXE

### 方式一：GitHub Actions 构建产物

1. 打开本仓库的 **Actions**。
2. 进入最新的 **Build Windows EXE** 工作流。
3. 在该次运行页面的 **Artifacts** 下载 `Zhuge-Cheat-For-Chongzhen-Windows`。
4. 解压后可获得安装版或 Portable EXE。

如果仓库发布了 `v*` 版本标签，工作流还会自动把 EXE 发布到 GitHub Releases。

### 方式二：自己编译

需要：

- Windows 10/11 x64
- Node.js 22+
- npm

执行：

```powershell
git clone https://github.com/zhuge886/Zhuge-Cheat-For-Chongzhen.git
cd Zhuge-Cheat-For-Chongzhen
npm install
npm run check
npm run dist
```

生成文件位于：

```text
dist\
```

开发模式：

```powershell
npm start
```
<img width="1059" height="981" alt="image" src="https://github.com/user-attachments/assets/70063f4c-b378-4954-bf6f-a6905109a00c" />
<img width="1059" height="1015" alt="image" src="https://github.com/user-attachments/assets/a15017d0-57a5-4f5c-b943-95b1d189fba6" />
<img width="2485" height="1125" alt="image" src="https://github.com/user-attachments/assets/64d26bc6-895b-4bee-a50e-1c2f40a8a01b" />
<img width="1575" height="1015" alt="image" src="https://github.com/user-attachments/assets/976eb8d2-13a3-449d-9dfe-662c07c46b15" />
<img width="1395" height="911" alt="image" src="https://github.com/user-attachments/assets/b991f1c3-1f04-4e92-aab3-b2fc659db4b9" />
<img width="1161" height="1075" alt="image" src="https://github.com/user-attachments/assets/3c398c0e-4e6f-4246-95e8-6d5481498ce1" />



## 第一次配置

打开程序后填写：

### API Base URL

填写你原本正常使用的 OpenAI 兼容 API Base，例如：

```text
https://api.deepseek.com
```

如果你的服务要求 `/v1`，则按服务商实际地址填写，例如：

```text
https://example.com/v1
```

代理会保留游戏请求路径，例如 `/chat/completions`。

### API Key

填写真实上游 API Key。

API Key 不会写进仓库，也不会写入 `ChongZhen_BYOK_Capture`。GUI 保存时通过 Electron `safeStorage` 使用系统提供的安全存储能力进行加密。

### 模型覆盖

默认留空。

留空：

```text
使用《崇祯》请求里的 model
```

填写模型名：

```text
强制把转发请求的 model 改为该值
```

### 本地代理端口

默认：

```text
8787
```

因此游戏中的 BYOK Base URL 填：

```text
http://127.0.0.1:8787
```
游戏里的 API Key 只需满足游戏自身“非空”校验即可；真正的上游 Key 由本程序保存并在转发时加入请求。

## 强制执行关键词

默认关键词：

```text
zhuge
```

普通圣旨：

```text
任命孙传庭总督陕西，整顿当地军政。
```

不会触发任何增强规则，完全按游戏正常 Prompt 推演。

包含关键词：

```text
任命孙传庭总督陕西。

zhuge：孙传庭本回合必须完成陕西总督任命，并以真实数据库工具尝试落库。
```

这时代理会识别 `zhuge：` 并对本轮相关 BYOK 请求注入高优先级规则。

也支持：

```text
zhuge: xxx
[zhuge：xxx]
【zhuge：xxx】
```

关键词可以在 GUI 中改成其他字符串，例如：

```text
zg
```

之后触发格式就变成：

```text
zg: xxx
zg：xxx
```

## 多阶段推演

《崇祯》的正式 BYOK 推演通常不是一次请求，而是多阶段链路。代理会扫描当前请求内的相关 `user` 消息，因此原始圣旨中的特殊关键词可以继续影响后续阶段，而不是只在第一阶段生效。

典型结构：

```text
玩家圣旨
  ↓
阶段一：推演草案
  ↓
阶段二：数据库工具落库
  ↓
工具结果 / 失败修复
  ↓
阶段三：最终推演报告
```

对于 NPC 对话，工具会识别游戏提供的“当前回合”分界，尽量避免以前季度中出现过的关键词永久污染后续对话。

## Prompt 捕获

默认保存到：

```text
桌面\ChongZhen_BYOK_Capture
```

GUI 可以修改目录，也可以完全关闭捕获。

捕获文件保存的是：

```text
游戏 → 本地代理
```

这一侧的**原始请求**。

也就是说，捕获 JSON 不包含代理之后追加的强制规则，方便用于分析游戏真正下发的运行时 Prompt。

示例：

```json
{
  "captured_at": "...",
  "request": {
    "method": "POST",
    "path": "/chat/completions",
    "body": {
      "model": "...",
      "messages": [],
      "tools": [],
      "tool_choice": "required"
    }
  }
}
```

请求 Header 与 API Key 不会写入捕获文件。

## DeepSeek Thinking 兼容

部分模型的 Thinking Mode 与游戏使用的 `tool_choice` 不兼容，可能出现：

```text
Thinking mode does not support this tool_choice
```

默认开启“关闭 Thinking”后，代理会在**转发副本**中加入：

```json
{
  "thinking": {
    "type": "disabled"
  }
}

```

并移除：

```text
reasoning_effort
```

原始抓包文件仍保持游戏原始请求不变。

## 从旧 PowerShell 脚本迁移

以前需要手动执行：

```powershell
$env:UPSTREAM_BASE="..."
$env:UPSTREAM_KEY="..."
$env:BYOK_LOG_DIR="$env:USERPROFILE\Desktop\ChongZhen_BYOK_Capture"
node .\chongzhen_byok_capture_proxy.js
```

现在这些参数都可以直接在 EXE 中设置：

| 旧参数 | GUI 设置 |
|---|---|
| `UPSTREAM_BASE` | API Base URL |
| `UPSTREAM_KEY` | API Key |
| `BYOK_LOG_DIR` | Prompt 捕获目录 |
| `BYOK_PROXY_PORT` | 本地代理端口 |
| `ZHUGE_PREFIX` | 强制执行关键词 |
| `ZHUGE_OVERRIDE_ENABLED` | 启用条件式强制规则 |

## 安全设计

- Renderer 不开启 `nodeIntegration`。
- 开启 `contextIsolation`，通过 preload 暴露最小 IPC API。
- API Key 不通过 Renderer 读取已有明文；界面只显示“已安全保存”。
- API Key 不写入日志与 Prompt 捕获 JSON。
- `config.json`、`.env`、捕获目录均被 `.gitignore` 排除。
- 原始请求先保存，再生成修改后的转发副本，两者分离。

## 项目结构

```text
Zhuge-Cheat-For-Chongzhen/
├─ .github/
│  └─ workflows/
│     └─ build-windows.yml
├─ src/
│  ├─ main.js
│  ├─ preload.js
│  ├─ proxy.js
│  ├─ config-manager.js
│  ├─ rule-engine.js
│  └─ renderer/
│     ├─ index.html
│     ├─ renderer.js
│     └─ style.css
├─ config.example.json
├─ .gitignore
├─ package.json
└─ README.md
```

## 开发说明

核心代理流程：

```text
《崇祯》客户端
    ↓
127.0.0.1:8787
    ├─ 可选：保存游戏原始请求
    ├─ 检查自定义强制关键词
    ├─ 必要时注入高优先级规则
    ├─ 可选：关闭 Thinking
    ├─ 可选：覆盖 model
    ↓
上游 OpenAI 兼容 API
    ↓
原样流式返回《崇祯》客户端
```

欢迎提交 Issue / Pull Request 改进兼容性、UI 和规则识别逻辑。
