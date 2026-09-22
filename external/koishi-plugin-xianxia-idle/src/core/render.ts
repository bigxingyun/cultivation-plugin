/** 输出层：**一份内容，两条渲染路径**
 *
 *  《游戏结构与命令设计.md》§4.4.2。
 *
 *  为什么要分层：QQ 官方机器人（平台 `qq`）支持原生 Markdown（官方 2026-04-23 起
 *  单聊/群聊自定义 markdown 对所有机器人开放，无需申请模板）；其它平台（QQ 频道
 *  `qqguild`、OneBot 等）只认纯文本。两套输出必须**同时留着**，且不能各写一遍内容
 *  ——否则改一条指令要改两处，早晚会漂移。
 *
 *  做法：指令只产出 `Body`，由这里决定怎么落字。
 *
 *    string / T.prose   → 原样透传（剧情正文、帮助卡本来就是 markdown 写的）
 *    T.*（结构化行）     → text 与 md 是同一条数据的两种排版，见下表
 *
 *  | 构造器           | 纯文本            | Markdown              |
 *  | ---------------- | ----------------- | --------------------- |
 *  | `T.title('状态')` | `【状态】`         | `**状态**`            |
 *  | `T.sec('修炼')`   | `■ 修炼`           | `**修炼**`            |
 *  | `T.kv('修为','0')`| `修为　0`          | `- 修为　0`           |
 *  | `T.list('✔ …')`   | `✔ …`             | `- ✔ …`               |
 *  | `T.sub('　/闭关')`| `　/闭关`          | `    - /闭关`         |
 *  | `T.div()`        | `──────`          | `***`                 |
 *  | `T.note('▸ …')`   | `▸ …`             | `> ▸ …`               |
 *
 *  **唯一不变量**：结构化行在两种模式下的「数据指纹」必须一致（`fingerprint()`，
 *  自检第 41 项）。所以 Markdown 只能改变排版，永远不能改变玩家看到的数据。
 *
 *  两条纪律：
 *   ① 结构化行一律过 `esc()`——玩家输入会被回显（`历练 ###`），不能让输入破坏排版。
 *   ② `T.prose` 按原样送进 markdown，**不转义**：剧情正文里作者写的 `**加粗**`
 *      在纯文本下是刺眼的星号，在 markdown 下才是它本来的样子。
 */

export type Kind =
  /** 空行：纯文本里是刻意的段落间隔，Markdown 交给分块逻辑 */
  | 'blank'
  /** 界面标题 */
  | 'title'
  /** 分组小标题（帮助卡用） */
  | 'sec'
  /** 列表项 / 标签值行，连续的同类行会紧挨着排版 */
  | 'list'
  /** 有序列表项 */
  | 'ord'
  /** 分隔线 */
  | 'div'
  /** 引用行（待办摘要、结算提示） */
  | 'note'
  /** 原样透传 */
  | 'prose'

export interface Line {
  kind: Kind
  /** 纯文本形态 */
  text: string
  /** Markdown 形态 */
  md: string
}

export type Body = string | Line | Array<string | Line | null | undefined | false>

/** 结构化行统一转义：只有能造出强调/删除线/行内代码的字符才需要剥掉。
 *  `_` 故意留着——CommonMark 里词内下划线不是强调符，而链 id（`shanmen_01`）
 *  会被管理指令原样回显，剥掉反而丢信息。 */
export function esc (s: string): string {
  return String(s).replace(/[*`~]/g, '')
}

const line = (kind: Kind, text: string, md: string): Line => ({ kind, text, md })

export const T = {
  /** `【标题】` → `**标题**`；tail 是挂在标题同一行的数据（`练气一层　1 / 81`） */
  title (text: string, tail = ''): Line {
    const md = `**${esc(text)}**`
    return line('title', `【${text}】${tail}`, tail ? `${md} ${esc(tail)}` : md)
  },
  sec (text: string): Line {
    return line('sec', `■ ${text}`, `**${esc(text)}**`)
  },
  /** 小节标题（纯文本里不加 `■`，Markdown 里加粗） */
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

/** 只丢 null / undefined / false——空字符串是**故意的段落空行**，不能吞（踩过的坑） */
export function toLines (body: Body): Array<string | Line> {
  const arr = Array.isArray(body) ? body : [body]
  return arr.filter((x) => x != null && x !== false) as Array<string | Line>
}

function asLine (x: string | Line): Line {
  if (typeof x !== 'string') return x
  return x === '' ? T.blank() : T.prose(x)
}

/** 纯文本：与分层之前**逐字一致**（自检 / docs/输出/纯文本.txt 快照盯着） */
export function renderText (body: Body): string {
  return toLines(body).map((x) => (typeof x === 'string' ? x : x.text)).join('\n')
}

/** Markdown：按块拼接，块之间空行隔开
 *
 *  空行规则来自 QQ 官方文档（`bot.q.qq.com/wiki/.../type/markdown.html`）：
 *  「列表前是普通文本，则需要在列表前用空行隔开，否则无法识别」。
 *  所以连续的同一类列表行内部用单换行，换块一律空行。
 */
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

/** 数据指纹：剥掉两种排版各自附加的标记，只留玩家真正读到的字符。
 *  自检用它断言「Markdown 只改排版，不改数据」。 */
export function fingerprint (s: string): string {
  return s
    .replace(/<\/?qq:markdown>/g, '')
    .replace(/[*`~>#|]/g, '')   // markdown 标记（含正文里作者写的加粗）
    .replace(/[【】■]/g, '')     // 纯文本标题的方括号、分组符号
    .replace(/^[-\s　]+/gm, '')  // 列表符号与行首缩进
    .replace(/─+/g, '')          // 纯文本分隔线
    .replace(/[\s　]/g, '')
}

// ── 渲染模式判定 ────────────────────────────────────────────────────────
export type RenderConfig = 'auto' | 'text' | 'markdown'
export type RenderMode = 'text' | 'markdown'

/** 只有 QQ 官方机器人（群/单聊）走得通 `<qq:markdown>`。
 *  QQ 频道是另一个 platform（`qqguild`），官方文档写明频道原生 markdown 仍需内邀，
 *  且适配器的频道编码器根本不认这个元素——所以它必须留在纯文本。 */
export const MARKDOWN_PLATFORMS = ['qq']

export function pickRender (config: RenderConfig, platform?: string): RenderMode {
  if (config === 'text') return 'text'
  if (config === 'markdown') return 'markdown'
  return platform && MARKDOWN_PLATFORMS.includes(platform) ? 'markdown' : 'text'
}
