/** D 成长（M4/M6）：丹药 · 功法 · 丹道
 *  规格见《游戏结构与命令设计.md》§4.5 D1–D7
 */

import type { Context } from 'koishi'
import { $ } from 'koishi'
import type { Game, XUser } from '../game'
import { T_ITEM, T_TECH, T_USER } from '../game'
import * as C from '../core/curves'
import * as D from '../data'
import { amount, dur, num, pct } from '../core/fmt'
import type { Grade, Tier } from '../types'
import { CLASS_NAMES, TIER_NAMES } from '../types'
import { closedMsg, effectText, shell } from './helpers'

const CD_PREFIX = 'cd:'

export function registerGrow (ctx: Context, game: Game) {
  const { database } = ctx

  // ── D1 丹药 / 背包 ──────────────────────────────────────────────────
  ctx.command('丹药', '看背包：丹药 · 灵材 · 故事碎片')
    .alias('背包').alias('物品')
    .action(shell(game, async (user) => {
      const items = await game.items(user.userId)
      const lines = [`【丹药 · 灵材 ${num(user.material)} · 碎片 ${user.fragments}】`]
      for (const cls of ['A', 'B', 'C', 'D', 'E'] as const) {
        const rows = items
          .map((r) => ({ row: r, pill: D.PILL_BY_ID.get(r.itemId) }))
          .filter((x) => x.pill && x.pill.cls === cls)
          .sort((a, b) => (a.pill!.grade - b.pill!.grade))
        if (!rows.length) continue
        lines.push(`${CLASS_NAMES[cls]}　${rows.map((x) => `${x.pill!.name} ×${Math.round(x.row.count)}`).join('　')}`)
      }
      if (items.length === 0) lines.push('（空）')
      return lines
    }))

  // ── D2 服用 ─────────────────────────────────────────────────────────
  ctx.command('服用 <丹药> [数量:number]', '使用丹药')
    .alias('吃药')
    .action(shell(game, async (user, g, argv, args) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      const pill = D.findPill(String(args[0] ?? ''))
      if (!pill) return '【找不到这颗丹药】'
      const n = Math.max(1, Math.floor(Number(args[1] ?? 1)) || 1)
      const have = await g.itemCount(user.userId, pill.id)
      if (have < n) return `【数量不够】你有 ${pill.name} ×${Math.round(have)}`

      // 同类冷却 3 分钟
      const cds = await g.activeBuffs(user.userId)
      if (cds.some((b) => b.kind === CD_PREFIX + pill.id)) {
        return `【冷却中】${pill.name}　同类冷却 3 分钟`
      }
      // 每品级每日 3 次
      const day = C.today()
      const flagId = `F-PD-${day}-${pill.grade}`
      const usedRows = await database.get('xianxia_flag', { userId: user.userId, flagId }, { limit: 1 })
      const used = usedRows[0]?.value ?? 0
      if (used + n > C.PILL_DAILY_LIMIT) {
        return `【今日该品级已用 ${used} / ${C.PILL_DAILY_LIMIT} 次】`
      }

      const stats = await g.stats(user)
      const lines = [`【服用 · ${pill.name}（${C.gradeName(pill.grade)}品 · ${CLASS_NAMES[pill.cls]}）】`]

      if (pill.cls === 'C') {
        // 突破丹：已满 95% 时**拒绝服用**，不让玩家白吃
        const base = C.breakChance(user.rank) + (stats.breakPt + stats.breakPill) / 100
        if (base >= C.CHANCE_MAX) {
          return `【不必服用】突破成功率已到上限 ${pct(C.CHANCE_MAX)}`
        }
      }

      if (!(await g.consumeItem(user.userId, pill.id, n))) return '【扣减失败】'
      await g.addBuff(user.userId, CD_PREFIX + pill.id, 0, C.PILL_COOLDOWN)
      await database.upsert('xianxia_flag', [{ userId: user.userId, flagId, value: used + n }], ['userId', 'flagId'])

      const bonus = 1 + stats.pillBonus
      switch (pill.cls) {
        case 'A': {
          const each = C.expPillRate(pill.grade) * C.EP(user.rank) * bonus
          const exp = each * n
          await database.set(T_USER, { userId: user.userId }, (row: any) => ({ exp: $.add(row.exp, exp) }) as any)
          lines.push(`修为　+${amount(exp)}${bonus > 1 ? `　丹药加成 ${pct(bonus - 1)}` : ''}`)
          lines.push(`当前　${amount(user.exp + exp)} / ${amount(C.EP(user.rank))}　${pct(Math.min(1, (user.exp + exp) / C.EP(user.rank)))}`)
          break
        }
        case 'B': {
          const p = C.bodyPillBonus(pill.grade) * bonus
          await g.addBuff(user.userId, 'body', p, C.PILL_DURATION)
          lines.push(`生命 攻击　+${pct(p)}　30 分钟`)
          break
        }
        case 'C': {
          const p = C.breakPillBonus(pill.grade) * n
          const cur = stats.breakPill + p
          await g.addBuff(user.userId, 'break', cur, 0)
          lines.push(`突破成功率　+${p.toFixed(1)}pt　下一次突破`)
          break
        }
        case 'D': {
          const mult = Math.min(C.DAO_PILL_CAP, C.daoPillMul(pill.grade) * bonus)
          await g.addBuff(user.userId, 'dao', mult, C.PILL_DURATION)
          lines.push(`增速　×${mult.toFixed(2)}　30 分钟`)
          break
        }
        case 'E': {
          await g.addBuff(user.userId, 'guard', 1, 0)
          lines.push('护道　下一次历练必成功')
          break
        }
      }
      lines.push(`今日该品级已用 ${used + n} / ${C.PILL_DAILY_LIMIT}　同类冷却 3 分钟`)
      return lines
    }))

  // ── D3 功法 ─────────────────────────────────────────────────────────
  ctx.command('功法', '看当前功法与收集进度')
    .alias('心法')
    .action(shell(game, async (user) => {
      const tech = user.techId ? D.TECH_BY_ID.get(user.techId) : undefined
      const owned = await database.get(T_TECH, { userId: user.userId })
      const lines: string[] = []
      if (!tech) {
        lines.push('【功法 · 无】')
      } else {
        lines.push(`【功法 · ${tech.name} · ${TIER_NAMES[user.techTier]}】`)
        lines.push(`品级　${C.gradeName(tech.grade)}品　倾向　${tech.tendency}　倍率　×${tech.mTech}`)
        lines.push(`典出　${tech.dex}`)
        const fx = (tech.tiers[user.techTier] || []).map((e) => effectText(e.code, e.value))
        lines.push(`特效　${fx.join('　')}`)
        const mat = user.techTier === 'U' ? 0 : C.upgradeMaterial(tech.grade as Grade, user.techTier === 'L' ? 'M' : 'U')
        if (user.techTier === 'U') lines.push('已是上品　封顶')
        else lines.push(`升阶需灵材　${mat}`)
      }
      lines.push('──────')
      lines.push(`已收集　${owned.length} / ${D.TECHNIQUES.length}`)
      return lines
    }))

  // ── D4 升阶 ─────────────────────────────────────────────────────────
  ctx.command('升阶', '用灵材与修为把当前功法推上一阶')
    .alias('升品')
    .action(shell(game, async (user, g) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      const tech = user.techId ? D.TECH_BY_ID.get(user.techId) : undefined
      if (!tech) return '【没有功法】'
      if (user.techTier === 'U') return '【已是上品】'
      const toTier: 'M' | 'U' = user.techTier === 'L' ? 'M' : 'U'
      if (user.techUpgradedAt && Date.now() - new Date(user.techUpgradedAt).getTime() < C.UPGRADE_COOLDOWN * 1000) {
        const left = C.UPGRADE_COOLDOWN - (Date.now() - new Date(user.techUpgradedAt).getTime()) / 1000
        return `【升阶冷却中】还需 ${dur(left)}`
      }
      const mat = C.upgradeMaterial(tech.grade as Grade, toTier)
      const expCost = C.upgradeExp(user.rank, toTier)
      if (user.material < mat) return `【灵材不足】需要 ${mat}　现有 ${num(user.material)}`
      if (user.exp < expCost) return `【修为不足】需要 ${amount(expCost)}　现有 ${amount(user.exp)}`
      // 原子扣灵材
      const res = await database.set(T_USER, { userId: user.userId, material: { $gte: mat } } as any, (row: any) => ({
        material: $.add(row.material, -mat), exp: $.add(row.exp, -expCost),
      }) as any)
      if (!res.matched) return '【灵材不足】'
      const rate = C.UPGRADE_RATE[toTier]
      const ok = Math.random() < rate
      if (ok) {
        await g.save(user.userId, { techTier: toTier as Tier, techUpgradedAt: new Date() })
        await database.upsert(T_TECH, [{ userId: user.userId, techId: tech.id, tier: toTier as Tier, obtainedAt: new Date() }], ['userId', 'techId'])
        return [
          `【升阶 · ${tech.name} → ${TIER_NAMES[toTier]}】`,
          `消耗　灵材 ${mat}　修为 ${amount(expCost)}`,
          `倍率　×${tech.mTech}`,
          '冷却　1 小时',
        ].join('\n')
      }
      // 失败只损失修为（返还 50%），不掉材料
      const refund = expCost * C.UPGRADE_FAIL_REFUND
      await database.set(T_USER, { userId: user.userId }, (row: any) => ({ exp: $.add(row.exp, refund) }) as any)
      return [
        `【升阶 · 失败】${tech.name}　成功率 ${pct(rate)}`,
        `消耗　灵材 ${mat}　修为 ${amount(expCost)}`,
        `返还　修为 50%　+${amount(refund)}`,
      ].join('\n')
    }))

  // ── D5 炼丹 ─────────────────────────────────────────────────────────
  ctx.command('炼丹 <丹药> [次数:number]', '3 颗同品丹药 + 灵材 → 1 颗高一品丹药')
    .alias('合丹')
    .action(shell(game, async (user, g, argv, args) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      const src = D.findPill(String(args[0] ?? ''))
      if (!src) return '【找不到这颗丹药】'
      if (src.grade >= 7) return '【七品封顶】'
      const targetGrade = (src.grade + 1) as Grade
      const target = g.pick(D.PILLS.filter((p) => p.grade === targetGrade && p.cls === src.cls))
      if (!target) return '【配方缺失】'
      const want = Math.max(1, Math.floor(Number(args[1] ?? 1)) || 1)
      const have = await g.itemCount(user.userId, src.id)
      const matPer = C.alchemyMaterial(src.grade as Grade)
      const maxByPill = Math.floor(have / C.ALCHEMY_PILL_COST)
      const maxByMat = Math.floor(user.material / matPer)
      const times = Math.min(want, maxByPill, maxByMat)
      if (times <= 0) {
        return [
          '【炼不了】',
          `需要　${src.name} ×${C.ALCHEMY_PILL_COST} + 灵材 ${matPer}（每炼一次）`,
          `你有　${src.name} ×${Math.round(have)}　灵材 ${num(user.material)}`,
        ].join('\n')
      }
      if (!(await g.consumeItem(user.userId, src.id, times * C.ALCHEMY_PILL_COST))) return '【扣减失败】'
      await database.set(T_USER, { userId: user.userId, material: { $gte: matPer * times } } as any, (row: any) => ({
        material: $.add(row.material, -matPer * times),
      }) as any)
      await g.addItem(user.userId, target.id, times)
      return [
        `【炼丹 · ${times} 次】`,
        `消耗　${src.name} ×${times * C.ALCHEMY_PILL_COST}　灵材 ${matPer * times}`,
        `得到　${target.name} ×${times}（${C.gradeName(targetGrade)}品）`,
      ].join('\n')
    }))

  // ── D6 喂丹 ─────────────────────────────────────────────────────────
  ctx.command('喂丹 <丹药> [数量:number]', '把多余的丹药喂给丹炉')
    .alias('投炉')
    .action(shell(game, async (user, g, argv, args) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      const pill = D.findPill(String(args[0] ?? ''))
      if (!pill) return '【找不到这颗丹药】'
      const have = await g.itemCount(user.userId, pill.id)
      const want = String(args[1] ?? '') === '全部' ? Math.floor(have) : Math.max(1, Math.floor(Number(args[1] ?? 1)) || 1)
      const n = Math.min(want, Math.floor(have))
      if (n <= 0) return `【没有${pill.name}】`
      if (!(await g.consumeItem(user.userId, pill.id, n))) return '【扣减失败】'
      const gain = C.furnaceExp(pill.grade as Grade) * n
      const before = C.furnaceLevel(user.alchemyExp)
      await database.set(T_USER, { userId: user.userId }, (row: any) => ({ alchemyExp: $.add(row.alchemyExp, gain) }) as any)
      const after = C.furnaceLevel(user.alchemyExp + gain)
      const lines = [
        `【喂丹 · ${pill.name} ×${n}】`,
        `丹药经验　+${num(gain)}`,
        `丹炉　${before} 级 → ${after} 级`,
      ]
      if (after > before) lines.push('新加成已生效')
      return lines
    }))

  // ── D7 丹炉 ─────────────────────────────────────────────────────────
  ctx.command('丹炉', '丹炉等级与永久加成')
    .action(shell(game, async (user) => {
      const level = C.furnaceLevel(user.alchemyExp)
      const fb = C.furnaceBonus(level)
      let acc = 0
      for (let i = 0; i < C.FURNACE_THRESHOLDS.length; i++) acc += C.FURNACE_THRESHOLDS[i]
      const nextAcc = level < 15 ? C.FURNACE_THRESHOLDS.slice(0, level + 1).reduce((a, b) => a + b, 0) : acc
      const lines = [
        `【丹炉 · ${level} / 15 级】`,
        level < 15
          ? `丹药经验　${num(user.alchemyExp)} / ${num(nextAcc)}`
          : `丹药经验　${num(user.alchemyExp)}　满级`,
        `加成　丹药效果 +${pct(fb.pillPct, 0)}　增速 +${pct(fb.speedPct, 0)}　突破成功率 +${fb.breakPt}pt`,
      ]
      if (level < 15) lines.push(`本级还需　${num(nextAcc - user.alchemyExp)}`)
      return lines
    }))
}
