# dsh-inner-voice

Keep the agent's reasoning as a daily **inner-voice log**, rewrite it into one short line, and show it in a settings page.

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin. Server half only reads session events; client half only reads a local HTTP route.

[中文说明](README.zh.md)

## What it does

| Part | Behavior |
|---|---|
| **A archive** | Takes the `reasoning` of each `assistant/message`, keeps the first sentence (markdown markers stripped, clipped at `maxChars`), appends it to `~/.dsh/inner-voice/YYYY-MM-DD.md` |
| **B rewrite** | Sends the same reasoning to a small chat model and keeps one short line (≤20 chars). Pure procedural reasoning yields `（无）` and is dropped — no fake feelings |
| **C panel** | Settings → **Inner voice**: entries by day, rewritten line plus grey raw excerpt, served by the read-only route `/dsh-inner-voice-api` |

Log format:

```
- 22:12
  小鱼：又来了，这问题问第七遍了。
  raw: Now the user asks whether the plugin is loaded...
```

## Install

```powershell
dsh plugin --profile <your-profile> add dsh-inner-voice
```

Restart the app afterwards — server plugins have no HMR.

## Config

Set these in your profile's `cordis.patch.yml` (override by `id: dsh-inner-voice`):

| Key | Default | Notes |
|---|---|---|
| `enabled` | `true` | Master switch |
| `minChars` | `160` | Skip short reasoning |
| `maxChars` | `400` | Raw excerpt cap |
| `label` | `inner voice` | Prefix of the rewritten line |
| `rewrite` | `true` | Turn B off to archive only |
| `model` | `deepseek-chat` | Any OpenAI-compatible chat model |
| `apiKey` | `''` | Empty → read `DEEPSEEK_API_KEY` |
| `rewritePrompt` | built-in | Override the instruction to fit another persona |

**Do not commit an API key into the package.** Put it in your user-level profile patch or an environment variable.

## Privacy

- Everything is written locally under `~/.dsh/inner-voice/`.
- If `rewrite` is on and a key is present, the reasoning excerpt is sent to the configured chat endpoint (OpenAI-compatible) once per recorded turn. Nothing else leaves the machine.
- The panel only reads from the local route; it sends nothing.

## Why rewrite at all

An agent's raw reasoning is verbose, often English, and packed with tool names (`Installed (linked). Now check if profile patch...`). Showing it verbatim is like opening the engine cover: accurate, unreadable.

The rewrite is a readability layer, not decoration. The **silence rule** guards the other side: when the reasoning carries no attitude, nothing is invented.

## Known limits

- The rewrite costs one small chat call per recorded turn (roughly 100–200 tokens).
- The panel cannot restyle the chat transcript itself; it lives in Settings. Rendering reasoning inline would need a client renderer, which this plugin deliberately avoids.
- The log is plain text; no retention policy is enforced. Delete old files if you like.

## License

MIT
