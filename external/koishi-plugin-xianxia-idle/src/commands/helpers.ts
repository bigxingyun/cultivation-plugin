/** 指令外壳：settleAll → 业务逻辑 → 待办摘要 → emit（§4.4 / §4.4.2 / §4.6）。 */

import { h } from 'koishi'
import type { Game, XUser } from '../game'
import type { EffectCode } from '../types'
import { pct } from '../core/fmt'
import type { Body, Line } from '../core/render'
import { pickRender, renderMarkdown, renderText, T, toLines } from '../core/render'
import { fetchSakuraImage } from '../core/sakura'

export type { Body }

export interface Settled {
  sec: { seconds: number; gained: number }
  missions: unknown[]
  chains: unknown[]
}

export function closedMsg (user: XUser): Line | null {
  if (!user.seclusionStart) return null
  return T.title('闭关中', '先发「出关」，再做别的')
}

export interface ShellOpts {
  todo?: boolean
  /** 本指令默认尝试附随机图（可被 ActionResult.image 覆盖） */
  image?: boolean
}

/** 动作可返回 Body，或带插图开关的包装。 */
export type ActionResult = Body | { body: Body; image?: boolean }

export function withImage (body: Body): { body: Body; image: true } {
  return { body, image: true }
}

function unwrap (result: ActionResult): { body: Body; image?: boolean } {
  if (result && typeof result === 'object' && !Array.isArray(result) && 'body' in result && !('kind' in result)) {
    return result as { body: Body; image?: boolean }
  }
  return { body: result as Body }
}

/** 统一回复出口；未走 shell 的指令（如修仙管理）亦须经此函数。 */
export async function emit (
  game: Game,
  argv: any,
  body: Body,
  opts: { image?: boolean } = {},
): Promise<any> {
  const textPart = pickRender(game.renderConfig, argv?.session?.platform) === 'markdown'
    ? h('qq:markdown', {}, renderMarkdown(body))
    : renderText(body)

  if (opts.image && game.images) {
    const url = await fetchSakuraImage(game.ctx)
    if (url) return [h.image(url), textPart]
  }
  return textPart
}

export function shell (
  game: Game,
  fn: (user: XUser, g: Game, argv: any, args: any[], settled: Settled) => Promise<ActionResult>,
  opts: ShellOpts = {},
) {
  return async (argv: any, ...args: any[]): Promise<any> => {
    const session = argv.session
    const userId: string | undefined = session?.userId
    if (!userId) return '无法解析用户 ID，请重试。'
    let user = await game.ensure(userId)
    const settled = await game.settleAll(user)
    user = settled.user

    const raw = await fn(user, game, argv, args, settled)
    const { body, image } = unwrap(raw)
    const lines = toLines(body)

    if (settled.missions.length) lines.push(T.note(`▸ ${settled.missions.length} 个任务已结算`))
    if (settled.chains.length) lines.push(T.note(`▸ ${settled.chains.length} 个链节点已推进`))

    if (opts.todo !== false && game.todoHint) {
      const t = await game.todoLine(user)
      if (t) lines.push(T.div(), T.note(t))
    }

    const wantImage = image ?? opts.image
    return emit(game, argv, lines, { image: !!wantImage })
  }
}

export function effectText (code: EffectCode, v: number): string {
  switch (code) {
    case 'E1': return `淬体 最大生命 +${pct(v)}`
    case 'E2': return `力魄 攻击 +${pct(v)}`
    case 'E3': return `轻身 闪避 +${v.toFixed(2)}pt`
    case 'E4': return `汲元 历练额外返还 +${pct(v)}`
    case 'E5': return `丹心 丹药效果 +${pct(v)}`
    case 'E6': return `通玄 修为增速 ×${(1 + v).toFixed(3)}`
    case 'E7': return `破障 突破成功率 +${v.toFixed(2)}pt`
    case 'E8': return `采药 历练奖励 +${pct(v)}`
  }
}

export const PURPOSE_MAP: Record<string, string> = {
  打怪: 'combat', 战斗: 'combat', 杀: 'combat', combat: 'combat', c: 'combat',
  药田: 'farm', 采药: 'farm', 种药: 'farm', farm: 'farm', f: 'farm',
  修习: 'train', 练功: 'train', 习武: 'train', train: 'train', t: 'train',
  复合: 'compound', 杂役: 'compound', compound: 'compound', p: 'compound',
}

export function parsePurpose (input: string): string | null {
  return PURPOSE_MAP[input.trim().toLowerCase()] ?? null
}

const GRADE_CHARS = '凡黄玄地天仙帝'

export function parseGrade (input: string): number | null {
  const s = input.trim()
  const idx = GRADE_CHARS.indexOf(s)
  if (idx >= 0) return idx + 1
  const n = Number(s)
  if (Number.isInteger(n) && n >= 1 && n <= 7) return n
  return null
}

export const PURPOSE_LABEL: Record<string, string> = {
  combat: '打怪', farm: '药田', train: '修习', compound: '复合',
}

/** 一级父指令：无子参数时列出二级清单（短指令仍可通过 alias 直达）。 */
export function parentMenu (
  game: Game,
  title: string,
  items: Array<[string, string]>,
) {
  return shell(game, async () => [
    T.title(title),
    ...items.map(([cmd, desc]) => T.list(`　/${cmd}　${desc}`)),
    T.note('懒得记路径时，直接发短指令即可，例如「闭关」「签到」'),
  ], { todo: false })
}
