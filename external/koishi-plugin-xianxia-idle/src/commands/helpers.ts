/** 指令外壳：settleAll → 业务逻辑 → 待办摘要 → emit（§4.4 / §4.4.2 / §4.6）。 */

import { h } from 'koishi'
import type { Game, XUser } from '../game'
import type { EffectCode } from '../types'
import { pct } from '../core/fmt'
import type { Body, Line } from '../core/render'
import { pickRender, renderMarkdown, renderText, T, toLines } from '../core/render'

export type { Body }

export interface Settled {
  sec: { seconds: number; gained: number }
  missions: unknown[]
  chains: unknown[]
}

export function closedMsg (user: XUser): Line | null {
  if (!user.seclusionStart) return null
  return T.title('闭关中', '发「出关」后可操作')
}

export interface ShellOpts {
  todo?: boolean
}

/** 统一回复出口；未走 shell 的指令（如修仙管理）亦须经此函数。 */
export function emit (game: Game, argv: any, body: Body): any {
  if (pickRender(game.renderConfig, argv?.session?.platform) === 'markdown') {
    return h('qq:markdown', {}, renderMarkdown(body))
  }
  return renderText(body)
}

export function shell (
  game: Game,
  fn: (user: XUser, g: Game, argv: any, args: any[], settled: Settled) => Promise<Body>,
  opts: ShellOpts = {},
) {
  return async (argv: any, ...args: any[]): Promise<any> => {
    const session = argv.session
    const userId: string | undefined = session?.userId
    if (!userId) return '无法解析用户 ID，请重试。'
    let user = await game.ensure(userId)
    const settled = await game.settleAll(user)
    user = settled.user

    const lines = toLines(await fn(user, game, argv, args, settled))

    if (settled.missions.length) lines.push(T.note(`▸ ${settled.missions.length} 个任务已结算`))
    if (settled.chains.length) lines.push(T.note(`▸ ${settled.chains.length} 个链节点已推进`))

    if (opts.todo !== false && game.todoHint) {
      const t = await game.todoLine(user)
      if (t) lines.push(T.div(), T.note(t))
    }

    return emit(game, argv, lines)
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
