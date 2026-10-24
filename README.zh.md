# dsh-inner-voice

把 agent 的**深度思考**留成按天的「内心活动」日志，压成一句短话，并在设置页里给一页展示。

DeepSeek Harness 插件。服务端只读会话事件，客户端只读本地 HTTP 路由。

[English](README.md)

## 它做什么

| 部分 | 行为 |
|---|---|
| **A 留档** | 取 `assistant/message` 的 `reasoning` 首句（去 markdown 符号，超 `maxChars` 截断），追加到 `~/.dsh/inner-voice/YYYY-MM-DD.md` |
| **B 改写** | 同一段思考交给小模型，压成一句 ≤20 字的短话。纯事务性思考输出 `（无）` 并被丢弃——不硬编情绪 |
| **C 面板** | 设置 →「Inner voice」：按天列出短句 + 灰字原文，数据来自只读路由 `/dsh-inner-voice-api` |

日志格式：

```
- 22:12
  小鱼：又来了，这问题问第七遍了。
  raw: Now the user asks whether the plugin is loaded...
```

## 安装

```powershell
dsh plugin --profile <你的 profile> add dsh-inner-voice
```

装完**必须重启**应用——服务端插件没有 HMR。

## 配置

在你自己 profile 的 `cordis.patch.yml` 里按 `id: dsh-inner-voice` 覆盖：

| 项 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `minChars` | `160` | 思考短于此不记 |
| `maxChars` | `400` | 原文截断长度 |
| `label` | `inner voice` | 短句前的标签 |
| `rewrite` | `true` | 关掉就只留原文 |
| `model` | `deepseek-chat` | 任意 OpenAI 兼容模型 |
| `apiKey` | 空 | 留空读 `DEEPSEEK_API_KEY` |
| `rewritePrompt` | 内置 | 想换人格语气就改这个 |

**不要把 API key 提交进包里**，放用户层配置或环境变量。

## 隐私

- 所有内容写在本地 `~/.dsh/inner-voice/`。
- 只有开了 `rewrite` 且有 key 时，才会把思考片段发到你配置的模型接口；每记录一轮发一次，别的不会外发。
- 面板只读本地路由，不发送任何数据。

## 为什么要改写

agent 的原始思考是英文、啰嗦、堆满工具名。直接展示等于掀发动机盖：准确，但没法读。改写是**可读性**，不是装饰。而「沉默规则」守的是反面：思考里没有态度时，不编。

## 已知限制

- 每记录一轮多一次小模型调用（约 100–200 token）。
- 面板在设置页里，不能改聊天流里的渲染样式——那需要客户端渲染器，这个插件刻意不碰。
- 日志是纯文本，没有自动清理策略；嫌多就自己删旧文件。

## 许可

MIT
