/** 输出层：单源 Body，按平台渲染为纯文本或 Markdown（《游戏结构与命令设计.md》§4.4.2）。
 *
 *  QQ 平台 `qq` 使用 `<qq:markdown>`；`qqguild`、OneBot 等走纯文本。
 *  指令只构造 `Body`，禁止为同一指令维护两套文案。
 *
 *  | 构造器           | 纯文本            | Markdown              |
 *  | ---------------- | ----------------- | --------------------- |
 *  | `T.title('状态')` | `【状态】`         | `**状态**`            |
 *  | `T.sec('修炼')`   | `■ 修炼`           | `**修炼**`            |
 *  | `T.kv('修为','0')`| `修为　0`          | `- 修为　0`           |
 *  | `T.list('✔ …')`   | `✔ …`             | `- ✔ …`               |
 *  | `T.div()`        | `──────`          | `***`                 |
 *  | `T.note('▸ …')`   | `▸ …`             | `> ▸ …`               |
 *
 *  不变量：`fingerprint(renderText(body)) === fingerprint(renderMarkdown(body))`。
 *  结构化行经 `esc()`；`T.prose` 不转义（剧情正文保留作者 Markdown）。
 */

export type Kind =
  | 'blank'
  | 'title'
  | 'sec'
  | 'list'
  | 'ord'
  | 'div'
  | 'note'
  | 'prose'

export interface Line {
  kind: Kind
  text: string
  md: string
}

export type Body = string | Line | Array<string | Line | null | undefined | false>

/** 结构化行转义：剥离可触发 Markdown 语法的字符；词内 `_` 保留。 */
export function esc (s: string): string {
  return String(s).replace(/[*`~]/g, '')
}

const line = (kind: Kind, text: string, md: string): Line => ({ kind, text, md })

export const T = {
  title (text: string, tail = ''): Line {
    const md = `**${esc(text)}**`
    return line('title', `【${text}】${tail}`, tail ? `${md} ${esc(tail)}` : md)
  },
  sec (text: string): Line {
    return line('sec', `■ ${text}`, `**${esc(text)}**`)
  },
  head (text: string): Line {
    return line('sec', text, `**${esc(text)}**`)
  },
  kv (label: string, value: string): Line {
    return line('list', `${label}　${value}`, `- ${esc(label)}　${esc(value)}`)
  },
  list (text: string): Line {
    return line('list', text, `- ${esc(text).trimStart()}`)
  },
  ord (n: number, text: string): Line {
    return line('ord', `${n}. ${text}`, `${n}. ${esc(text)}`)
  },
  div (): Line {
    return line('div', '──────', '***')
  },
  note (text: string): Line {
    return line('note', text, `> ${esc(text)}`)
  },
  prose (text: string): Line {
    return line('prose', text, text)
  },
  blank (): Line {
    return line('blank', '', '')
  },
}

/** 过滤 null / undefined / false；保留空字符串（段落空行）。 */
export function toLines (body: Body): Array<string | Line> {
  const arr = Array.isArray(body) ? body : [body]
  return arr.filter((x) => x != null && x !== false) as Array<string | Line>
}

function asLine (x: string | Line): Line {
  if (typeof x !== 'string') return x
  return x === '' ? T.blank() : T.prose(x)
}

export function renderText (body: Body): string {
  return toLines(body).map((x) => (typeof x === 'string' ? x : x.text)).join('\n')
}

/** Markdown 分块拼接；列表块前需空行（QQ Markdown 规范）。 */
export function renderMarkdown (body: Body): string {
  const parts: string[] = []
  let prev: Kind | null = null
  for (const x of toLines(body)) {
    const l = asLine(x)
    if (l.kind === 'blank') { prev = 'blank'; continue }
    const tight = prev === l.kind && (l.kind === 'list' || l.kind === 'ord')
    const gap = parts.length ? (tight ? '\n' : '\n\n') : ''
    parts.push(gap + l.md)
    prev = l.kind
  }
  return parts.join('')
}

/** 剥离排版标记，用于双路径数据一致性校验。 */
export function fingerprint (s: string): string {
  return s
    .replace(/<\/?qq:markdown>/g, '')
    .replace(/[*`~>#|]/g, '')
    .replace(/[【】■]/g, '')
    .replace(/^[-\s　]+/gm, '')
    .replace(/─+/g, '')
    .replace(/[\s　]/g, '')
}

export type RenderConfig = 'auto' | 'text' | 'markdown'
export type RenderMode = 'text' | 'markdown'

export const MARKDOWN_PLATFORMS = ['qq']

export function pickRender (config: RenderConfig, platform?: string): RenderMode {
  if (config === 'text') return 'text'
  if (config === 'markdown') return 'markdown'
  return platform && MARKDOWN_PLATFORMS.includes(platform) ? 'markdown' : 'text'
}
