/** 指令公共外壳：建档 → 惰性结算 → 执行 → 附待办摘要
 *
 *  《游戏结构与命令设计.md》§4.4/§4.6 的落地：
 *   - 每次交互先跑 settleAll（闭关修为 / 历练队列 / 链节点 / 每日重置）
 *   - 闭关态只读（写操作要求先出关）
 *   - 回复末尾附一行待办摘要 = 零主动推送的实现
 */

import type { Game, XUser } from '../game'
import type { EffectCode } from '../types'
import { pct } from '../core/fmt'

export type Body = string | string[]

/** shell 传给指令实现的环境（含本次惰性结算的结果） */
export interface Settled {
  sec: { seconds: number; gained: number }
  missions: unknown[]
  chains: unknown[]
}

export function toLines (body: Body): string[] {
  // 只丢 null/undefined——空字符串是**故意的段落空行**（开场白、介绍），不能吞
  return Array.isArray(body) ? body.filter((x) => x != null) : [body]
}

/** 闭关态门禁：返回提示，或 null 表示放行 */
export function closedMsg (user: XUser): string | null {
  if (!user.seclusionStart) return null
  return '【闭关中】发「出关」后可操作'
}

export interface ShellOpts {
  /** 是否附加待办摘要（默认附加） */
  todo?: boolean
}

/** 指令外壳。fn 收到的是**已结算过**的用户行。 */
export function shell (
  game: Game,
  fn: (user: XUser, g: Game, argv: any, args: any[], settled: Settled) => Promise<Body>,
  opts: ShellOpts = {},
) {
  return async (argv: any, ...args: any[]): Promise<string> => {
    const session = argv.session
    const userId: string | undefined = session?.userId
    if (!userId) return '拿不到你的用户 ID，先随便发一条消息再试。'
    let user = await game.ensure(userId)
    const settled = await game.settleAll(user)
    user = settled.user

    const lines = toLines(await fn(user, game, argv, args, settled))

    const notices: string[] = []
    if (settled.missions.length) notices.push(`▸ ${settled.missions.length} 个任务已结算`)
    if (settled.chains.length) notices.push(`▸ ${settled.chains.length} 个链节点已推进`)
    lines.push(...notices)

    if (opts.todo !== false) {
      const t = await game.todoLine(user)
      if (t) lines.push('──────', t)
    }
    return lines.join('\n')
  }
}

/** 功法特效的展示文案 */
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

/** 重复的展示文案：把档位/目的写成玩家看得懂的样子 */
export const PURPOSE_LABEL: Record<string, string> = {
  combat: '打怪', farm: '药田', train: '修习', compound: '复合',
}
