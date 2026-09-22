/** C 每日循环（M3）+ F3 待办
 *  规格见《游戏结构与命令设计.md》§4.5 C1–C5 / F3
 */

import type { Context } from 'koishi'
import { $ } from 'koishi'
import type { Game, XUser } from '../game'
import { T_USER } from '../game'
import * as C from '../core/curves'
import * as D from '../data'
import { amount, num } from '../core/fmt'
import type { Line } from '../core/render'
import { T } from '../core/render'
import type { Grade, Realm } from '../types'
import { CLASS_NAMES } from '../types'
import { pickBySeed } from '../core/deterministic'
import { shell, parentMenu, withImage } from './helpers'

/** 出题档位：按大境界分 5 档（§9.3 只出玩家经历过的内容） */
export function quizBand (rank: number): 1 | 2 | 3 | 4 | 5 {
  const r = C.realmOf(rank)
  if (r <= 1) return 1
  if (r === 2) return 2
  if (r <= 4) return 3
  if (r <= 6) return 4
  return 5
}

function yesterday (): string {
  return C.today(new Date(Date.now() - 86400000))
}

export function registerDaily (ctx: Context, game: Game) {
  const { database } = ctx

  ctx.command('每日', '签到 · 抽签 · 答题 · 奇遇 · 天机')
    .action(parentMenu(game, '每日', [
      ['签到', '连签有奖，断签会退两格'],
      ['抽签', '吉凶都算今日一课'],
      ['答题', '答对有奖，答错不罚'],
      ['奇遇', '路上撞见的二选一'],
      ['天机', '三枚碎片换一条提示'],
    ]))

  // ── C1 签到 ─────────────────────────────────────────────────────────
  ctx.command('每日/签到', '每日签到（连签 7 天为一轮，断签回退 2 格）')
    .alias('签到').alias('打卡')
    .action(shell(game, async (user, g) => {
      const day = C.today()
      if (user.lastCheckinDate === day) {
        return `【今天已经签过了】连签 ${user.checkinStreak} 天`
      }
      let streak: number
      if (user.lastCheckinDate === yesterday()) {
        streak = (user.checkinStreak % 7) + 1
      } else {
        streak = Math.max(1, user.checkinStreak - 1) // 断签回退 2 格后再计本日（= streak-1）
      }
      await g.save(user.userId, { checkinStreak: streak, lastCheckinDate: day })
      user.checkinStreak = streak
      user.lastCheckinDate = day
      const reward = C.CHECKIN_TABLE[streak - 1]
      const lines: Line[] = [T.title(`签到 · 第 ${streak} 天（连签）`)]
      const exp = reward.pct ? C.EP(user.rank) * reward.pct : 0
      if (exp) {
        await database.set(T_USER, { userId: user.userId }, (row: any) => ({ exp: $.add(row.exp, exp) }) as any)
        lines.push(T.kv('修为', `+${amount(exp)}`))
      }
      const pg = C.pillGradeOfRealm(C.realmOf(user.rank))
      if (reward.kind === 'pill') {
        const pool = D.PILLS.filter((p) => p.grade === pg && p.cls === 'B')
        const pill = g.pick(pool)
        if (pill) { await g.addItem(user.userId, pill.id, 1); lines.push(T.kv('丹药', `+${pill.name} ×1`)) }
      }
      if (reward.kind === 'quota') {
        await g.save(user.userId, { quotaBonus: user.quotaBonus + 1 })
        lines.push(T.kv('历练次数', '+1　当日'))
      }
      if (reward.kind === 'dao') {
        const pool = D.PILLS.filter((p) => p.grade === pg && p.cls === 'D')
        const pill = g.pick(pool)
        if (pill) { await g.addItem(user.userId, pill.id, 1); lines.push(T.kv('丹药', `+${pill.name} ×1`)) }
      }
      if (reward.kind === 'break') {
        const pool = D.PILLS.filter((p) => p.grade === pg && p.cls === 'C')
        const pill = g.pick(pool)
        if (pill) { await g.addItem(user.userId, pill.id, 1); lines.push(T.kv('丹药', `+${pill.name} ×1`)) }
      }
      if (streak < 7) lines.push(T.kv('明日', `第 ${streak + 1} 天　${C.CHECKIN_TABLE[streak].text}`))
      else lines.push(T.kv('明日', '回到第 1 天'))
      lines.push(T.list(`已连签 ${streak} 天 ${'█'.repeat(streak)}${'░'.repeat(7 - streak)}`))
      return lines
    }))

  // ── C2 抽签 ─────────────────────────────────────────────────────────
  ctx.command('每日/抽签', '每日一签（凶也有故事）')
    .alias('抽签').alias('求签')
    .action(shell(game, async (user, g) => {
      const day = C.today()
      if (user.drawDate === day) return '【今天已经抽过了】明日再来。'
      await g.save(user.userId, { drawDate: day })
      const entry = g.pickWeighted(C.DRAW_TABLE.map((d) => [d, d.weight] as [typeof d, number]))!
      const flavor: Record<string, string> = {
        大吉: '签筒一震，红签落在掌心。',
        吉: '签上墨色尚新，像刚写完。',
        小吉: '签身微温，像刚被人握过。',
        平: '不咸不淡的一签。日子还是日子。',
        凶: '签面发暗。你还是把它读完了。',
      }
      const lines: Line[] = [
        T.title(`抽签 · ${entry.sign}`),
        T.prose(flavor[entry.sign] ?? '签已落定。'),
      ]
      if (entry.sign === '大吉' || entry.sign === '吉') {
        const mul = entry.sign === '大吉' ? 1.5 : 1.25
        await g.addBuff(user.userId, 'speed', mul, 3600)
        lines.push(T.kv('增速', `×${mul.toFixed(2)}　1 小时`))
      } else if (entry.sign === '小吉') {
        await g.setFlag(user.userId, 'F-CE1', 1)
        lines.push(T.kv('护道', '今日首次历练必成功'))
      } else if (entry.sign === '平') {
        const exp = C.EP(user.rank) * 0.2
        await database.set(T_USER, { userId: user.userId }, (row: any) => ({ exp: $.add(row.exp, exp) }) as any)
        lines.push(T.kv('修为', `+${amount(exp)}`))
      } else {
        await database.set(T_USER, { userId: user.userId }, (row: any) => ({ fragments: $.add(row.fragments, 1) }) as any)
        await g.setFlag(user.userId, 'F-FRAG-DAY', 1)
        const pool = D.badlotsOfRealm(C.realmOf(user.rank) as Realm)
        const bad = g.pick(pool)
        lines.push(T.kv('故事碎片', '+1'))
        if (bad) {
          lines.push(T.kv('签文', bad.sign))
          lines.push(T.prose(bad.fragment))
        }
      }
      return withImage(lines)
    }, { image: true }))

  // ── C3 答题 ─────────────────────────────────────────────────────────
  ctx.command('每日/答题 [选项]', '每日问答：答对给奖励，答错不罚')
    .alias('答题').alias('问答')
    .action(shell(game, async (user, g, argv, args) => {
      const day = C.today()
      const band = quizBand(user.rank)
      const pool = D.quizOfBand(band)
      if (!pool.length) return '【题库为空】'
      const q = pickBySeed(pool, `${day}|${user.userId}`)
      const pick = String(args[0] ?? '').toUpperCase().replace(/[^ABC]/g, '')
      if (!pick) {
        if (user.quizDate === day && user.quizAnswered) {
          return [
            T.title('今天已经答过了', `正确答案 ${'ABC'[q.answer]}`),
            T.prose(q.explain),
          ]
        }
        return [
          T.title(`每日问答 · ${q.id}`),
          T.prose(q.q),
          ...q.options.map((o, i) => T.list(`　${'ABC'[i]}. ${o}`)),
          T.note('发「答题 A」「答题 B」「答题 C」'),
        ]
      }
      if (user.quizDate === day && user.quizAnswered) {
        return '【今天已经答过了】'
      }
      const idx = 'ABC'.indexOf(pick)
      const correct = idx === q.answer
      await g.save(user.userId, { quizDate: day, quizAnswered: pick })
      const lines: Line[] = [T.title('答题 · ' + (correct ? '✔ 正确' : '✘ 不对'))]
      lines.push(T.kv('正确答案', `${'ABC'[q.answer]}. ${q.options[q.answer]}`))
      lines.push(T.prose(q.explain))
      if (q.source) lines.push(T.kv('出处', q.source))
      if (correct) {
        const exp = C.EP(user.rank) * 0.15
        await database.set(T_USER, { userId: user.userId }, (row: any) => ({ exp: $.add(row.exp, exp) }) as any)
        lines.push(T.kv('修为', `+${amount(exp)}`))
        const pg = C.pillGradeOfRealm(C.realmOf(user.rank))
        const pillPool = D.PILLS.filter((p) => p.grade === pg)
        const pill = g.pick(pillPool)
        if (pill) { await g.addItem(user.userId, pill.id, 1); lines.push(T.kv('丹药', `+${pill.name} ×1`)) }
      }
      return lines
    }))

  // ── C4 奇遇 ─────────────────────────────────────────────────────────
  ctx.command('每日/奇遇 [选择]', '被动事件：二选一')
    .alias('奇遇').alias('抉择')
    .action(shell(game, async (user, g, argv, args) => {
      const id = user.pendingEventId
      if (!id) return '【暂时没有奇遇】'
      const ev = D.EVENT_BY_ID.get(id)
      if (!ev) { await g.save(user.userId, { pendingEventId: '' }); return '【这条奇遇的数据丢了】' }
      const pickRaw = String(args[0] ?? '')
      if (!pickRaw) {
        return withImage([
          T.title(`奇遇 · ${ev.title}`),
          T.prose(ev.body),
          ...ev.options.map((o, i) => T.ord(i + 1, `${o.label}：${o.text}　${o.kind === 'res' ? '眼下能拿' : '细水长流'}`)),
          T.note('发「奇遇 1」或「奇遇 2」'),
        ])
      }
      const idx = Number(pickRaw) - 1
      if (idx !== 0 && idx !== 1) return '【选项不对】发「奇遇 1」或「奇遇 2」'
      const gained = await g.applyEventOption(user, ev, idx)
      return [
        T.title(`奇遇 · ${ev.title}`, `选择「${ev.options[idx].label}」`),
        T.prose(ev.options[idx].text),
        ...gained.map((x) => T.list(`+${x}`)),
      ]
    }))

  // ── C5 天机推演 ─────────────────────────────────────────────────────
  ctx.command('每日/天机', '消耗 3 枚故事碎片，换一条提示')
    .alias('天机').alias('推演')
    .action(shell(game, async (user, g) => {
      if (user.fragments < C.INSIGHT_FRAG_COST) {
        return `【碎片不足】需要 ${C.INSIGHT_FRAG_COST} 枚　现有 ${user.fragments} 枚`
      }
      const res = await database.set(T_USER, {
        userId: user.userId, fragments: { $gte: C.INSIGHT_FRAG_COST },
      } as any, (row: any) => ({ fragments: $.add(row.fragments, -C.INSIGHT_FRAG_COST) }) as any)
      if (!res.matched) return `【碎片不足】需要 ${C.INSIGHT_FRAG_COST} 枚`
      user.fragments -= C.INSIGHT_FRAG_COST
      const realm = C.realmOf(user.rank) as Realm
      const locked = D.CHAINS.filter((c) => c.realm >= realm && !(c.unlock.rankMin <= user.rank))
      const pool = D.badlotsOfRealm(realm)
      const bad = g.pick(pool)
      const lines: Line[] = [T.title(`天机推演 · 碎片 -${C.INSIGHT_FRAG_COST}　剩 ${user.fragments}`)]
      if (locked.length && Math.random() < 0.5) {
        const chain = g.pick(locked)!
        lines.push(T.prose(`『${chain.blurb}』`))
        lines.push(T.kv(`《${chain.name}》`, `未解锁 · rank ≥ ${chain.unlock.rankMin}`))
      } else if (bad) {
        lines.push(T.kv('签文', bad.sign))
        lines.push(T.prose(bad.fragment))
      } else {
        lines.push(T.prose('（无）'))
      }
      return lines
    }))

  // ── F3 待办 ─────────────────────────────────────────────────────────
  ctx.command('待办', '看看现在有什么该做')
    .alias('提示')
    .action(shell(game, async (user, g) => {
      const list = await g.todos(user)
      if (!list.length) return '【暂无待办】'
      return [T.title('待办'), ...list.map((x, i) => T.ord(i + 1, x))]
    }, { todo: false }))
}

export type { Grade, XUser, CLASS_NAMES }
