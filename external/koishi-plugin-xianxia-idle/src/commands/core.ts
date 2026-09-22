/** A 修炼核心（M1）+ B 历练（M2）
 *  规格见《游戏结构与命令设计.md》§4.5 A1–A5 / B1–B3
 *
 *  B1 历练是**二级菜单 + 多选一**：
 *    `历练`            → 列出当前境界的候选任务（带档位/耗时/成功率/奖励），玩家挑一个
 *    `历练 1`          → 排队第 1 个（菜单里看到的那一个，不是随机抽的）
 *    `历练 换`         → 换一批候选
 *    `历练 打怪 凡 3`  → 批量快捷方式（老玩家/脚本用）
 */

import type { Context } from 'koishi'
import { $ } from 'koishi'
import type { Game, XUser } from '../game'
import { T_CHAIN, T_LOG, T_QUEUE, T_USER } from '../game'
import * as C from '../core/curves'
import * as D from '../data'
import { amount, dur, eta, num, pct } from '../core/fmt'
import type { Line } from '../core/render'
import { T } from '../core/render'
import type { Grade, MissionDef, Purpose, Realm } from '../types'
import { GRADE_NAMES, TIER_NAMES } from '../types'
import { closedMsg, effectText, parentMenu, parseGrade, parsePurpose, PURPOSE_LABEL, shell, withImage } from './helpers'

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩'

/** missionId 自带全部信息：m{境界}-{档位}-{purpose}-{序号} */
function parseMissionId (id: string) {
  const m = /^m(\d)-(\d)-(combat|farm|train|compound)-\d+$/.exec(id)
  if (!m) return null
  return { realm: Number(m[1]) as Realm, grade: Number(m[2]) as Grade, purpose: m[3] as Purpose }
}

export function registerCore (ctx: Context, game: Game) {
  const { database } = ctx

  /** 排队一个具体任务（菜单与批量都走这里，保证计时口径一致） */
  async function enqueue (g: Game, user: XUser, mission: MissionDef, grade: Grade) {
    const rows = await database.get(T_QUEUE, { userId: user.userId }, { sort: { seq: 'asc' } })
    let cursor = Date.now()
    if (rows.length) cursor = Math.max(...rows.map((r) => new Date(r.finishAt).getTime()))
    const seq = rows.length ? Math.max(...rows.map((r) => r.seq)) : 0
    cursor += C.missionDuration(user.rank, grade) * 1000
    await database.create(T_QUEUE, {
      userId: user.userId, seq: seq + 1, missionId: mission.id, finishAt: new Date(cursor),
    })
    return cursor
  }

  /** 原子扣历练次数；成功则同步内存中的 quotaUsed */
  async function spendQuota (user: XUser, quota: number, n: number): Promise<boolean> {
    const res = await database.set(T_USER, {
      userId: user.userId, quotaUsed: { $lte: quota - n },
    } as any, (row: any) => ({ quotaUsed: $.add(row.quotaUsed, n) }) as any)
    if (!res.matched) return false
    user.quotaUsed += n
    return true
  }

  /** 今日已接 missionId 列表；存于 recentMissions：`YYYY-MM-DD|id1,id2`（跨日作废）。 */
  function dayTaken (user: XUser): string[] {
    const raw = user.recentMissions || ''
    const day = C.today()
    const prefix = `${day}|`
    if (!raw.startsWith(prefix)) return []
    return raw.slice(prefix.length).split(',').filter(Boolean)
  }

  async function markTaken (user: XUser, ids: string[]) {
    if (!ids.length) return
    const day = C.today()
    const set = new Set(dayTaken(user))
    for (const id of ids) set.add(id)
    const v = `${day}|${[...set].join(',')}`
    await gSaveTaken(user, v)
  }

  async function unmarkTaken (user: XUser, id: string) {
    const day = C.today()
    const left = dayTaken(user).filter((x) => x !== id)
    const v = left.length ? `${day}|${left.join(',')}` : ''
    await gSaveTaken(user, v)
  }

  async function gSaveTaken (user: XUser, v: string) {
    await database.set(T_USER, { userId: user.userId }, { recentMissions: v } as any)
    user.recentMissions = v
  }

  /** 生成一批候选：今日已接的条目不再出现；池空则跳过该槽。 */
  function buildCandidates (g: Game, user: XUser, taken: string[]): MissionDef[] {
    const realm = C.realmOf(user.rank)
    const clamp = (n: number) => Math.max(1, Math.min(7, n)) as Grade
    const plan: Array<[Purpose, Grade]> = [
      ['combat', clamp(realm)],
      ['farm', clamp(realm)],
      ['train', clamp(realm)],
      ['compound', clamp(realm)],
      ['combat', clamp(realm + 1)],   // 挑战
      ['farm', clamp(realm - 1)],     // 轻松
    ]
    const seen = new Set<string>()
    const picked = new Set<string>(taken)
    const out: MissionDef[] = []
    for (const [purpose, grade] of plan) {
      const key = `${purpose}|${grade}`
      if (seen.has(key)) continue
      seen.add(key)
      const pool = D.missionPool(realm as Realm, grade, purpose).filter((m) => !picked.has(m.id))
      if (!pool.length) continue
      const mission = g.pick(pool)
      if (mission) {
        out.push(mission)
        picked.add(mission.id)
      }
    }
    return out
  }

  /** 渲染菜单：上方展示队列，下方是今日还可选的候选。 */
  async function renderMenu (g: Game, user: XUser, top?: Line[]): Promise<Line[]> {
    const quota = g.quotaOf(user)
    const left = quota - user.quotaUsed
    const taken = dayTaken(user)
    const lines: Line[] = []
    if (top) lines.push(...top)

    const queue = await database.get(T_QUEUE, { userId: user.userId }, { sort: { seq: 'asc' } })
    const now = Date.now()
    if (queue.length) {
      lines.push(T.head('已接 · 队列'))
      queue.forEach((r, i) => {
        const m = D.MISSION_BY_ID.get(r.missionId)
        const info = m ? parseMissionId(m.id) : null
        const label = m
          ? `${PURPOSE_LABEL[m.purpose]}·${GRADE_NAMES[m.grade - 1]}档　${m.name}`
          : r.missionId
        const leftSec = (new Date(r.finishAt).getTime() - now) / 1000
        const whenText = leftSec <= 0 ? '已到点，发「任务 收」' : `剩 ${dur(leftSec)}`
        lines.push(T.list(`${CIRCLED[i] ?? `${i + 1}.`} ${label}　${whenText}`))
      })
      lines.push(T.div())
    } else if (taken.length) {
      lines.push(T.head('今日已接'))
      for (const id of taken) {
        const m = D.MISSION_BY_ID.get(id)
        lines.push(T.list(`　${m?.name ?? id}　（已完成或已结算）`))
      }
      lines.push(T.div())
    }

    if (left <= 0) {
      lines.push(T.title('历练', `今日次数已用尽　${user.quotaUsed} / ${quota}`))
      if (queue.length) lines.push(T.note('发「任务」看队列　「任务 收」领取结算'))
      return lines
    }

    const cands = buildCandidates(g, user, taken)
    await g.save(user.userId, { pendingMenu: cands.map((m) => m.id).join(',') })
    user.pendingMenu = cands.map((m) => m.id).join(',')
    const stats = await g.stats(user)
    lines.push(T.title(`历练 · 今日剩 ${left} / ${quota} 次`))
    if (!cands.length) {
      lines.push(T.prose('今日可接的条目已接完，明日再来。'))
      return lines
    }
    cands.forEach((m, i) => {
      const info = parseMissionId(m.id)!
      const rate = C.successRate(stats.punch, C.missionReq(user.rank, info.grade))
      const secs = C.missionDuration(user.rank, info.grade)
      const exp = C.EP(user.rank) * C.EXP_MUL[info.grade - 1]
      lines.push(T.list(`${CIRCLED[i]} ${PURPOSE_LABEL[info.purpose]}·${GRADE_NAMES[info.grade - 1]}档　${m.name}　${dur(secs)}　${pct(rate)}　修为 ${amount(exp)}`))
    })
    lines.push(T.div())
    lines.push(T.note('发编号选择 · 「历练 换」换一批 · 已接条目今日不再出现'))
    return lines
  }

  // ── A1 修仙：建档 + 开场引导 ────────────────────────────────────────
  ctx.command('修仙', '开始你的修仙路')
    .alias('开始').alias('启程')
    .action(shell(game, async (user) => {
      const isNew = !(await game.hasFlag(user.userId, 'F-INTRO'))
      await game.setFlag(user.userId, 'F-INTRO', 1)
      if (!isNew) {
        const pool = C.EP(user.rank)
        return T.title(C.rankName(user.rank), `修为 ${amount(user.exp)} / ${amount(pool)}　${pct(Math.min(1, user.exp / pool))}`)
      }
      return withImage([
        T.title('青云宗 · 杂役院'),
        T.prose('你是青云宗扫东院的杂役。没有名字，没有功法，也不配参加问道试。'),
        T.prose('但你捡到了一块不该出现的玉简。'),
        T.blank(),
        T.prose('闭关时修为会自己涨，人不在也一样。'),
        T.list('　/闭关　先坐下'),
        T.list('　/历练　出门找机缘'),
        T.list('　/帮助　迷路时再看'),
      ])
    }))

  // ── A 修炼（一级）───────────────────────────────────────────────────
  ctx.command('修炼', '闭关 · 出关 · 状态 · 突破')
    .action(parentMenu(game, '修炼', [
      ['闭关', '坐下，让时间替你养气'],
      ['出关', '起来，才能出门办事'],
      ['状态', '境界 · 修为 · 属性'],
      ['突破', '池满了，赌一层天'],
    ]))

  // ── A2 闭关 ─────────────────────────────────────────────────────────
  ctx.command('修炼/闭关', '进入闭关（时间戳累计修为）')
    .alias('闭关').alias('静修')
    .action(shell(game, async (user) => {
      if (user.seclusionStart) {
        const stats = await game.stats(user)
        const pool = C.EP(user.rank)
        const left = Math.max(0, pool - user.exp)
        const hung = (Date.now() - new Date(user.seclusionStart).getTime()) / 1000
        return withImage([
          T.title('已在闭关中'),
          T.prose('你还坐着。外面的风没有进来。'),
          T.kv('已挂', dur(hung)),
          T.kv('增速', `${stats.speed.toFixed(2)} /秒`),
          T.kv('本层还需', dur(left / stats.speed)),
        ])
      }
      await game.save(user.userId, { seclusionStart: new Date(), seclusionLast: null })
      const stats = await game.stats(user)
      const pool = C.EP(user.rank)
      const left = Math.max(0, pool - user.exp)
      return withImage([
        T.title('闭关 · 开始'),
        T.prose('你盘膝坐下。脚步声远了一截。'),
        T.kv('增速', `${stats.speed.toFixed(2)} /秒`),
        T.kv('本层还需', dur(left / stats.speed)),
      ])
    }, { image: true }))

  // ── A3 出关 ─────────────────────────────────────────────────────────
  ctx.command('修炼/出关', '结算并暂停，之后才能做别的事')
    .alias('出关').alias('收功')
    .action(shell(game, async (user, g, argv, args, settled) => {
      if (!user.seclusionStart) {
        return '【没在闭关】想涨修为，先发「闭关」。'
      }
      // 「本次闭关合计」= now − seclusionStart（settleSeclusion 只移动 seclusionLast，不动起点）
      const total = (Date.now() - new Date(user.seclusionStart).getTime()) / 1000
      await g.save(user.userId, { seclusionStart: null, seclusionLast: null })
      user.seclusionStart = null
      const pool = C.EP(user.rank)
      const sec = settled.sec
      const lines: Line[] = [
        T.title(`出关 · 合计 ${dur(total)}`),
        T.prose('你睁开眼。院里的光又贴回眼皮上。'),
      ]
      if (sec.gained) lines.push(T.kv('修为', `+${amount(sec.gained)}`))
      lines.push(T.kv('当前', `${amount(user.exp)} / ${amount(pool)}　${pct(Math.min(1, user.exp / pool))}`))
      return withImage(lines)
    }, { image: true }))

  // ── A4 状态 ─────────────────────────────────────────────────────────
  ctx.command('修炼/状态', '境界 · 修为 · 属性 · 加成来源')
    .alias('状态').alias('属性').alias('me')
    .action(shell(game, async (user) => {
      const s = await game.stats(user)
      const lines: Line[] = []
      lines.push(T.title('状态', `${C.rankName(user.rank)}　${user.rank} / 81`))
      lines.push(...game.statLines(s, user))
      lines.push(T.div())
      if (s.tech) {
        lines.push(T.kv('功法', `${s.tech.name} · ${TIER_NAMES[s.tier!]}　×${s.tech.mTech}`))
        const fx = (s.tech.tiers[s.tier!] || []).map((e) => effectText(e.code, e.value))
        if (fx.length) lines.push(T.kv('特效', fx.join('　')))
      } else {
        lines.push(T.kv('功法', '无'))
      }
      const buffText: string[] = []
      for (const b of s.buffs) {
        const left = b.until ? dur((new Date(b.until).getTime() - Date.now()) / 1000) : '—'
        if (b.kind === 'body') buffText.push(`淬体 +${pct(b.value)}（剩 ${left}）`)
        else if (b.kind === 'dao') buffText.push(`悟道 ×${b.value.toFixed(2)}（剩 ${left}）`)
        else if (b.kind === 'speed') buffText.push(`增速 ×${b.value.toFixed(2)}（剩 ${left}）`)
        else if (b.kind === 'break') buffText.push(`破境 +${b.value}pt（下一次突破）`)
        else if (b.kind === 'guard') buffText.push('护道（下一次历练必成功）')
      }
      lines.push(T.kv('丹药', buffText.length ? buffText.join('　') : '无'))
      lines.push(T.kv('灵材', `${num(user.material)}　碎片　${user.fragments}　丹炉　${s.furnace.level} 级`))
      return lines
    }))

  // ── A5 突破 ─────────────────────────────────────────────────────────
  ctx.command('修炼/突破', '用概率换境界（需修为池满）')
    .alias('突破').alias('破境')
    .action(shell(game, async (user, g) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      if (user.rank >= 81) {
        return '【已是终点】金仙九层没有经验池。往后靠收集与图鉴。'
      }
      const pool = C.EP(user.rank)
      if (user.exp < pool) {
        const s = await g.stats(user)
        return [
          T.title('修为不足', `${amount(user.exp)} / ${amount(pool)}　${pct(user.exp / pool)}`),
          T.list(`还差 ${amount(pool - user.exp)}　${eta(pool - user.exp, s.speed)}`),
          T.note('回去闭关，池满再来。'),
        ]
      }
      const s = await g.stats(user)
      const pityBefore = await g.pity(user.userId)
      const before = user.rank
      const r = await g.doBreak(user)
      if (!r.ok) return `【突破失败】${r.reason}`
      const comp = [`基础 ${pct(C.breakChance(before))}`]
      if (s.breakPill > 0) comp.push(`丹药 +${s.breakPill.toFixed(1)}pt`)
      if (s.breakPt > 0) comp.push(`功法 +${s.breakPt.toFixed(1)}pt`)
      if (pityBefore >= C.BREAK_PITY_AFTER) comp.push(`连败 +${(C.BREAK_PITY_BONUS * 100).toFixed(0)}pt`)
      // 只有一个因子时不给拆解（§4.4.1 约束 3）
      const compText = comp.length > 1 ? `　${comp.join('　')}` : ''
      if (r.success) {
        return withImage([
          T.title(`突破 · ${C.rankName(before)} → ${C.rankName(user.rank)}`),
          T.prose('那一层薄障裂开了。风从缝里进来。'),
          T.kv('成功率', `${pct(r.rate)}${compText}`),
          T.kv('判定', '✔ 成功'),
          T.kv('消耗', `修为 ${amount(pool)}　剩余 ${amount(user.exp)}`),
          T.div(),
          T.kv('当前', `${C.rankName(user.rank)}　${user.rank} / 81　下一层 ${amount(C.EP(user.rank))}`),
        ])
      }
      const pity = pityBefore + 1
      return withImage([
        T.title(`突破 · ${C.rankName(before)}`, '失败'),
        T.prose('气息一滞，又退回原处。天还在，只是暂不认你。'),
        T.kv('成功率', `${pct(r.rate)}${compText}`),
        T.kv('判定', '✘'),
        T.kv('修为退回 70%', `${amount(user.exp)} / ${amount(pool)}`),
        T.kv('连败', `${pity} / ${C.BREAK_PITY_AFTER}${pity >= C.BREAK_PITY_AFTER ? `　下次 +${(C.BREAK_PITY_BONUS * 100).toFixed(0)}pt` : ''}`),
      ])
    }, { image: true }))

  // ── B1 历练：二级菜单 + 多选一 ──────────────────────────────────────
  ctx.command('历练 [选择] [档位] [数量:number]', '出门做事：功法与丹药的唯一来源')
    .alias('出门')
    .usage([
      '历练　　　　　　　看菜单，挑一个任务',
      '历练 3　　　　　　排队菜单里的第 3 个',
      '历练 换　　　　　换一批候选',
      '历练 打怪 凡 3　　批量快捷方式（目的 + 档位 + 数量）',
      '目的：打怪 / 药田 / 修习 / 复合　　档位：凡 黄 玄 地 天 仙 帝（或 1–7）',
    ].join('\n'))
    .example('历练')
    .action(shell(game, async (user, g, argv, args) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      const sel = String(args[0] ?? '').trim()
      const gradeRaw = String(args[1] ?? '').trim()
      const want = Math.max(1, Math.floor(Number(args[2] ?? 1)) || 1)
      const quota = g.quotaOf(user)

      // ① 换一批
      if (['换', '更多', '刷新', '重来'].includes(sel)) return renderMenu(g, user)

      // ② 纯数字：从菜单里选第 N 个（多选一）
      if (/^\d+$/.test(sel)) {
        const idx = Number(sel) - 1
        const menu = user.pendingMenu ? user.pendingMenu.split(',') : []
        if (!menu.length) return renderMenu(g, user, [T.title('还没有菜单')])
        if (idx < 0 || idx >= menu.length) {
          return renderMenu(g, user, [T.title(`没有第 ${sel} 个`, `菜单里只有 ${menu.length} 个。`)])
        }
        const missionId = menu[idx]
        const mission = D.MISSION_BY_ID.get(missionId)
        const info = parseMissionId(missionId)
        if (!mission || !info) return renderMenu(g, user, [T.title('这条任务的数据丢了')])
        if (dayTaken(user).includes(missionId)) {
          return renderMenu(g, user, [T.title('今天已经接过这条', mission.name)])
        }
        if (user.quotaUsed >= quota) return renderMenu(g, user)
        if (!(await spendQuota(user, quota, 1))) return renderMenu(g, user, [T.title('次数不足')])
        const finish = await enqueue(g, user, mission, info.grade)
        await markTaken(user, [missionId])
        const rate = C.successRate((await g.stats(user)).punch, C.missionReq(user.rank, info.grade))
        const top: Line[] = [
          T.title(`已排 · ${PURPOSE_LABEL[info.purpose]}·${GRADE_NAMES[info.grade - 1]}档　${mission.name}`),
          T.list(`完成于 ${dur((finish - Date.now()) / 1000)}后　预计成功率 ${pct(rate)}`),
          T.blank(),
        ]
        return renderMenu(g, user, top)
      }

      // ③ 目的 + 档位：批量快捷方式
      if (sel) {
        const purpose = parsePurpose(sel) as Purpose | null
        if (!purpose) {
          return renderMenu(g, user, [T.title(`没有「${sel}」这个选项`)])
        }
        if (!gradeRaw) {
          // 只给了目的 → 只列该目的的候选（排除今日已接）
          const realm = C.realmOf(user.rank)
          const grade = Math.min(7, realm) as Grade
          const taken = new Set(dayTaken(user))
          const pool = D.missionPool(realm as Realm, grade, purpose).filter((m) => !taken.has(m.id)).slice(0, 6)
          if (!pool.length) return `【这个境界今天没有可接的「${PURPOSE_LABEL[purpose]}」了】`
          await g.save(user.userId, { pendingMenu: pool.map((m) => m.id).join(',') })
          user.pendingMenu = pool.map((m) => m.id).join(',')
          const stats = await g.stats(user)
          const lines: Line[] = [T.title(`历练 · ${PURPOSE_LABEL[purpose]}　${GRADE_NAMES[grade - 1]}档`)]
          pool.forEach((m, i) => {
            lines.push(T.list(`${CIRCLED[i]} ${m.name}　${dur(C.missionDuration(user.rank, grade))}　${pct(C.successRate(stats.punch, C.missionReq(user.rank, grade)))}　修为 ${amount(C.EP(user.rank) * C.EXP_MUL[grade - 1])}`))
          })
          lines.push(T.note('发编号选择 · 已接条目今日不再出现'))
          return lines
        }
        const grade = parseGrade(gradeRaw)
        if (!grade) return '【档位不对】可用 凡 黄 玄 地 天 仙 帝 或 1–7'
        const left = quota - user.quotaUsed
        if (left <= 0) {
          return `【次数不足】今日 ${user.quotaUsed} / ${quota}`
        }
        const n = Math.min(want, left)
        if (!(await spendQuota(user, quota, n))) return `【次数不足】今日剩余 ${left} 次。`
        const taken = new Set(dayTaken(user))
        const created: Array<{ id: string; name: string; finish: number }> = []
        for (let i = 0; i < n; i++) {
          const pool = D.missionPool(C.realmOf(user.rank) as Realm, grade as Grade, purpose)
            .filter((m) => !taken.has(m.id))
          const mission = g.pick(pool)
          if (!mission) break
          taken.add(mission.id)
          const finish = await enqueue(g, user, mission, grade as Grade)
          created.push({ id: mission.id, name: mission.name, finish })
        }
        if (!created.length) {
          // 次数已扣但没排上：退还
          await database.set(T_USER, { userId: user.userId, quotaUsed: { $gte: n } } as any, (r: any) => ({
            quotaUsed: $.add(r.quotaUsed, -n),
          }) as any)
          user.quotaUsed -= n
          return '【今天这类任务已接完】换目的或档位再试。'
        }
        if (created.length < n) {
          const refund = n - created.length
          await database.set(T_USER, { userId: user.userId, quotaUsed: { $gte: refund } } as any, (r: any) => ({
            quotaUsed: $.add(r.quotaUsed, -refund),
          }) as any)
          user.quotaUsed -= refund
        }
        await markTaken(user, created.map((c) => c.id))
        const rate = C.successRate((await g.stats(user)).punch, C.missionReq(user.rank, grade as Grade))
        const top: Line[] = [T.title(`历练 · ${created.length} 个任务已排入`)]
        created.forEach((c, i) => {
          top.push(T.list(`${CIRCLED[i]} ${PURPOSE_LABEL[purpose]} · ${GRADE_NAMES[grade - 1]}档　${c.name}　完成于 ${dur((c.finish - Date.now()) / 1000)}后`))
        })
        top.push(T.kv('预计成功率', pct(rate)))
        top.push(T.kv('今日次数', `${user.quotaUsed} / ${quota}`))
        top.push(T.blank())
        return renderMenu(g, user, top)
      }

      // ④ 无参：出菜单
      return renderMenu(g, user)
    }))

  // ── B2 任务：队列 / 收取 ────────────────────────────────────────────
  ctx.command('历练/任务 [收]', '查看历练队列，或收取已完成的任务')
    .alias('任务').alias('队列')
    .action(shell(game, async (user, g, argv, args) => {
      const mode = String(args[0] ?? '')
      const rows = await database.get(T_QUEUE, { userId: user.userId }, { sort: { seq: 'asc' } })
      if (mode === '收' || mode === '收取' || mode === '领取') {
        const block = closedMsg(user)
        if (block) return block
        const logs = await database.get(T_LOG, {
          userId: user.userId, id: { $gt: user.logReadId },
        } as any, { sort: { id: 'asc' }, limit: 20 })
        if (!logs.length) {
          const pending = rows.filter((r) => new Date(r.finishAt).getTime() > Date.now())
          return [
            T.title('没有可收的任务'),
            pending.length
              ? T.list(`队列里还有 ${pending.length} 个未完成　最早 ${dur((new Date(pending[0].finishAt).getTime() - Date.now()) / 1000)}后`)
              : T.prose('队列是空的'),
          ]
        }
        const lines: Line[] = [
          T.title(`任务结算 · ${logs.length} 个`),
          T.prose('门外烟尘落定，你把这一趟记进心里。'),
        ]
        let totalExp = 0
        for (const log of logs) {
          const m = D.MISSION_BY_ID.get(log.missionId)
          const ok = log.success === 1
          lines.push(T.blank())
          lines.push(T.list(`${m ? `${PURPOSE_LABEL[m.purpose]} · ${GRADE_NAMES[m.grade - 1]}档　${m.name}` : log.missionId}　${ok ? '✔' : '✘'}`))
          if (m) lines.push(T.prose(`　${ok ? m.story.success : m.story.fail}`))
          lines.push(T.list(`　+修为 ${amount(log.gainExp)}${log.extra ? `　+${log.extra}` : ''}${ok ? '' : '（保底 30%）'}`))
          totalExp += log.gainExp
        }
        lines.push(T.blank())
        lines.push(T.list(`合计修为 +${amount(totalExp)}`))
        await g.save(user.userId, { logReadId: logs[logs.length - 1].id })
        return withImage(lines)
      }
      const now = Date.now()
      const done = rows.filter((r) => new Date(r.finishAt).getTime() <= now)
      const waiting = rows.filter((r) => new Date(r.finishAt).getTime() > now)
      const unread = await database.get(T_LOG, { userId: user.userId, id: { $gt: user.logReadId } } as any)
      const quota = g.quotaOf(user)
      const lines: Line[] = [T.title(`任务 · 队列 ${rows.length} 个`)]
      if (waiting.length) {
        lines.push(T.head('进行中'))
        waiting.slice(0, 8).forEach((r, i) => {
          const m = D.MISSION_BY_ID.get(r.missionId)
          lines.push(T.list(`${CIRCLED[i] ?? ''} ${m?.name ?? r.missionId}　剩 ${dur((new Date(r.finishAt).getTime() - now) / 1000)}`))
        })
      }
      if (done.length) lines.push(T.kv('已到点', `${done.length} 个`))
      if (!rows.length) lines.push(T.prose('队列是空的'))
      lines.push(T.kv('今日次数', `${user.quotaUsed} / ${quota}　可收 ${unread.length} 条`))
      return lines
    }))

  // ── B3 放弃 ─────────────────────────────────────────────────────────
  ctx.command('历练/放弃 <序号:number>', '撤销一个尚未开始的历练任务')
    .alias('放弃').alias('撤任务')
    .action(shell(game, async (user, g, argv, args) => {
      const seq = Math.floor(Number(args[0]))
      // 漏参数时必须自己拦：`Number(undefined)` 是 NaN，直接丢给 sqlite 会抛异常，
      // 回复文案禁用半角尖括号；指令参数声明中的 <> 除外
      if (!Number.isInteger(seq)) return '【用法】放弃 序号　序号见「任务」'
      const rows = await database.get(T_QUEUE, { userId: user.userId, seq }, { limit: 1 })
      if (!rows.length) return `【没有这个任务】队列里没有第 ${seq} 个。`
      const row = rows[0]
      const m = D.MISSION_BY_ID.get(row.missionId)
      const total = C.missionDuration(user.rank, (m?.grade ?? 1) as Grade) * 1000
      if (new Date(row.finishAt).getTime() - total <= Date.now()) {
        return '【已经开始】撤不掉'
      }
      await database.remove(T_QUEUE, { userId: user.userId, seq })
      // 放弃不该变成惩罚：把次数还回去，并允许今日再接这条
      await database.set(T_USER, { userId: user.userId, quotaUsed: { $gte: 1 } } as any, (r: any) => ({
        quotaUsed: $.add(r.quotaUsed, -1),
      }) as any)
      user.quotaUsed = Math.max(0, user.quotaUsed - 1)
      await unmarkTaken(user, row.missionId)
      return T.title('已放弃', `${m?.name ?? row.missionId}　次数已退还`)
    }))
}
