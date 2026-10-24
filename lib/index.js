// dsh-inner-voice
//
// A（archive）：把 assistant/message 里的 reasoning 原文按天写进
//   ~/.dsh/inner-voice/YYYY-MM-DD.md
// B（readable）：同一段思考交给一个便宜模型，压成一句短语（标签名可配）
// C（UI）：只读路由 /dsh-inner-voice-api，供客户端面板读取
//
// 只读事件，不改上下文、不发消息。改写失败或没 key 就只留原文。

import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-inner-voice'
export const inject = ['webServer']

const API_PATH = '/dsh-inner-voice-api'
const API_URL = 'https://api.deepseek.com/chat/completions'

const DEFAULT_PROMPT =
  '把给你的这段 agent 内部思考，改写成一句「心里话」，用第一人称。'
  + '只写情绪、态度、判断；不要复述任务；不要出现日志/测试/接口/用户/回复/文件 这类词；'
  + '不超过 20 字；不加引号；不用敬语。'
  + '如果这段思考里没有任何情绪或态度可言（纯粹的事务性步骤），只输出「（无）」，不要勉强编一句。'
  + '也不要复用示例，示例只是风格参考：'
  + '「又来了，这问题问第七遍了。」「行吧，反正闲着也是闲着。」'

/** 从 assistant message 里取出 reasoning 文本。 */
function reasoningOf(message) {
  const content = message?.content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part) => part?.type === 'reasoning')
    .map((part) => String(part?.text ?? ''))
    .join('\n')
    .trim()
}

function firstSentence(text) {
  const line = String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[#>\-*\s]+/, '').trim())
    .find((l) => l.length > 0)
  return line || ''
}

function stamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return {
    day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** B：把思考压成一句短语。没有 key 直接跳过。 */
async function rewriteLine(text, cfg) {
  if (!cfg.apiKey) return ''
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: cfg.prompt },
      { role: 'user', content: String(text).slice(0, 1200) },
    ],
    max_tokens: 80,
    temperature: 0.7,
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`rewrite http ${res.status}`)
  const data = await res.json()
  return String(data?.choices?.[0]?.message?.content || '').trim()
}

/** 解析一天的 md 文件成结构化条目。兼容旧格式（任意「标签：句子」+「原文：」）。 */
function parseDay(text) {
  const entries = []
  let cur = null
  for (const line of String(text).split('\n')) {
    const head = /^- (\d{2}:\d{2})/.exec(line)
    if (head) {
      cur = { time: head[1], line: '', raw: '' }
      entries.push(cur)
      continue
    }
    if (!cur) continue
    const raw = /^\s*(raw|原文)[:：]\s*(.*)$/i.exec(line)
    if (raw) {
      cur.raw = raw[2].trim()
      continue
    }
    const label = /^\s*([^\s：:]{1,24})[:：]\s*(.*)$/.exec(line)
    if (label && !cur.line) cur.line = label[2].trim()
  }
  return entries.filter((e) => e.line || e.raw)
}

async function readRecent(dir, days) {
  let names = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const files = names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))
    .sort()
    .slice(-days)
    .reverse()
  const out = []
  for (const name of files) {
    let text = ''
    try {
      text = await readFile(join(dir, name), 'utf8')
    } catch {
      continue
    }
    out.push({ date: name.replace(/\.md$/, ''), entries: parseDay(text).reverse() })
  }
  return out
}

export function apply(ctx, config = {}) {
  const enabled = config.enabled !== false
  const minChars = Number(config.minChars ?? 160)
  const maxChars = Number(config.maxChars ?? 400)
  const label = String(config.label || 'inner voice')
  const cfg = {
    apiKey: config.apiKey || process.env.DEEPSEEK_API_KEY || '',
    model: config.model || 'deepseek-chat',
    prompt: config.rewritePrompt || DEFAULT_PROMPT,
  }
  const dir = join(homedir(), '.dsh', 'inner-voice')
  let ready = false

  const webServer = ctx.webServer ?? ctx.get?.('webServer')
  if (webServer?.register) {
    ctx.effect?.(() =>
      webServer.register({
        kind: 'prefix',
        path: API_PATH,
        handler: async (req, res) => {
          try {
            const days = await readRecent(dir, 3)
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            })
            res.end(JSON.stringify({ label, days }))
          } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ error: String(error?.message ?? error) }))
          }
        },
      }),
    )
  }

  if (!enabled) {
    ctx.logger?.info?.('dsh-inner-voice: disabled by config')
    return
  }

  ctx.on('session/event', async (session, event) => {
    try {
      if (event?.type !== 'assistant/message') return
      const message = event?.data?.message
      if (!message || message.role !== 'assistant') return

      const reasoning = reasoningOf(message)
      if (reasoning.length < minChars) return

      const raw = firstSentence(reasoning)
      if (!raw) return
      const clipped = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw

      let line = ''
      if (config.rewrite !== false) {
        try {
          line = await rewriteLine(reasoning, cfg)
        } catch (error) {
          ctx.logger?.warn?.(`dsh-inner-voice rewrite failed: ${error?.message ?? error}`)
        }
      }
      if (!line || /^[（(]\s*无\s*[)）]$/.test(line) || line === '无') line = ''

      const { day, time } = stamp()
      if (!ready) {
        await mkdir(dir, { recursive: true })
        ready = true
      }
      const entry = line
        ? `- ${time}\n  ${label}：${line}\n  raw: ${clipped}\n`
        : `- ${time}\n  raw: ${clipped}\n`
      await appendFile(join(dir, `${day}.md`), entry, 'utf8')
    } catch (error) {
      ctx.logger?.warn?.(`dsh-inner-voice: ${error?.message ?? error}`)
    }
  })
}
