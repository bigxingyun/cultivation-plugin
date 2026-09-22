/** E 叙事（M5）：任务链 · 图鉴 · 成就
 *  规格见《游戏结构与命令设计.md》§3.3/§3.4/§4.5 E1–E7
 */

import type { Context } from 'koishi'
import type { Game, XUser } from '../game'
import { T_ACH, T_CHAIN, T_CODEX } from '../game'
import * as C from '../core/curves'
import * as D from '../data'
import { num } from '../core/fmt'
import type { Line } from '../core/render'
import { T } from '../core/render'
import type { ChainDef, Realm } from '../types'
import { CLASS_NAMES, TIER_NAMES } from '../types'
import { closedMsg, shell } from './helpers'

/** 链的四态（§3.4）：未解锁的对玩家只显示链名 + 模糊描述 + 量化条件 */
async function chainState (game: Game, user: XUser, chain: ChainDef) {
  const rows = await game.ctx.database.get(T_CHAIN, { userId: user.userId, chainId: chain.id }, { limit: 1 })
  const row = rows[0]
  if (row?.state === 'active') return { state: 'active' as const, row }
  if (row?.state === 'completed') return { state: 'completed' as const, row }
  const unlockRank = chain.unlock.rankMin <= user.rank
  let unlockChain = true
  if (chain.unlock.chainDone) {
    const pre = await game.ctx.database.get(T_CHAIN, {
      userId: user.userId, chainId: chain.unlock.chainDone, state: 'completed',
    }, { limit: 1 })
    unlockChain = !!pre.length
  }
  if (unlockRank && unlockChain) return { state: 'available' as const, row }
  return { state: 'locked' as const, row }
}

export function registerStory (ctx: Context, game: Game) {
  const { database } = ctx

  // ── E1 任务链 ───────────────────────────────────────────────────────
  ctx.command('任务链', '看全部篇章的进度')
    .alias('故事').alias('篇章')
    .action(shell(game, async (user, g) => {
      const lines: Line[] = [T.title('篇章')]
      let done = 0
      for (const chain of D.CHAINS) {
        const st = await chainState(g, user, chain)
        if (st.state === 'completed') { done++; lines.push(T.list(`✔ ${chain.name}　已读完`)) }
        else if (st.state === 'active') {
          const row = st.row!
          const node = chain.nodes[row.nodeSeq - 1]
          const left = row.finishAt ? (new Date(row.finishAt).getTime() - Date.now()) / 1000 : 0
          lines.push(T.list(`▶ ${chain.name}　节点 ${row.nodeSeq} / ${C.CHAIN_NODES}　${node ? node.name : ''}${left > 0 ? `　还需 ${Math.ceil(left / 60)} 分` : '　可推进'}`))
        } else if (st.state === 'available') {
          lines.push(T.list(`○ ${chain.name}　可接`))
        } else {
          const cond = [`rank ≥ ${chain.unlock.rankMin}`]
          if (chain.unlock.chainDone) cond.push('需先完成前置篇章')
          lines.push(T.list(`· ？　${chain.blurb}　${cond.join(' · ')}`))
        }
      }
      lines.push(T.div())
      lines.push(T.kv('已完成', `${done} / ${D.CHAINS.length}`))
      return lines
    }))

  // ── E2 接链 ─────────────────────────────────────────────────────────
  ctx.command('接链 <链名>', '接取一个已解锁的篇章')
    .alias('接故事')
    .action(shell(game, async (user, g, argv, args) => {
      const key = String(args[0] ?? '')
      if (!key) return '【用法】接链 青云旧籍'
      const chain = D.CHAINS.find((c) => c.name === key) ?? D.CHAINS.find((c) => c.id === key)
      if (!chain) return `【没有这个篇章】`
      const st = await chainState(g, user, chain)
      if (st.state === 'locked') {
        const cond = [`rank ≥ ${chain.unlock.rankMin}`]
        if (chain.unlock.chainDone) cond.push('需先完成前置篇章')
        return `【还没解锁】${chain.blurb}\n${cond.join(' · ')}`
      }
      if (st.state === 'completed') return '【已经读完了】'
      if (st.state === 'active') return '【已经在推了】'
      await database.upsert(T_CHAIN, [{
        userId: user.userId, chainId: chain.id, state: 'active', nodeSeq: 1,
        finishAt: new Date(Date.now() + C.chainNodeDuration(chain.realm) * 1000),
        readSeq: 0, completedAt: null,
      }], ['userId', 'chainId'])
      const first = chain.nodes[0]
      const lines: Line[] = [
        T.title(`已接 · ${chain.name}`),
        T.prose(chain.prologue),
        T.div(),
        T.kv(`节点 1 / ${C.CHAIN_NODES}`, `${first ? first.name : ''}　需 ${Math.ceil(C.chainNodeDuration(chain.realm) / 3600)} 小时`),
      ]
      return lines
    }))

  // ── E3 链进度 ───────────────────────────────────────────────────────
  ctx.command('链进度', '看当前节点、倒计时，并领取已完成的节点文本')
    .action(shell(game, async (user, g) => {
      const rows = await database.get(T_CHAIN, { userId: user.userId })
      const active = rows.filter((r) => r.state === 'active')
      const completed = rows.filter((r) => r.state === 'completed')
      if (!rows.length) return '【还没接过任何篇章】'
      const lines: Line[] = []
      for (const row of active) {
        const chain = D.CHAIN_BY_ID.get(row.chainId)
        if (!chain) continue
        // 先补发未读节点
        for (let seq = row.readSeq + 1; seq <= Math.max(0, row.nodeSeq - 1); seq++) {
          const node = chain.nodes[seq - 1]
          if (!node) continue
          lines.push(T.title(`${chain.name} · 节点 ${seq} ｜ ${node.name}`))
          lines.push(T.prose(node.story.success))
          if (node.story.hook) lines.push(T.prose(`　${node.story.hook}`))
          lines.push(T.blank())
        }
        if (row.readSeq < row.nodeSeq - 1) {
          await database.set(T_CHAIN, { userId: user.userId, chainId: chain.id }, { readSeq: row.nodeSeq - 1 } as any)
        }
        const node = chain.nodes[row.nodeSeq - 1]
        const left = row.finishAt ? (new Date(row.finishAt).getTime() - Date.now()) / 1000 : 0
        lines.push(T.list(`▶ ${chain.name}　节点 ${row.nodeSeq} / ${C.CHAIN_NODES}　${node ? node.name : ''}`))
        if (node?.story.progress) lines.push(T.prose(`　${node.story.progress}`))
        lines.push(T.list(left > 0 ? `　还需 ${Math.ceil(left / 60)} 分钟` : '　已到点'))
        lines.push(T.blank())
      }
      for (const row of completed) {
        const chain = D.CHAIN_BY_ID.get(row.chainId)
        if (chain) lines.push(T.list(`✔ ${chain.name}　已读完全部 ${C.CHAIN_NODES} 个节点`))
        if (row.readSeq < C.CHAIN_NODES) {
          await database.set(T_CHAIN, { userId: user.userId, chainId: row.chainId }, { readSeq: C.CHAIN_NODES } as any)
        }
      }
      return lines.length ? lines : '【没有进行中的篇章】'
    }))

  // ── E4 看故事 ───────────────────────────────────────────────────────
  ctx.command('看故事 <链名> [节点:number]', '回看已完成的篇章节点')
    .alias('回看')
    .action(shell(game, async (user, g, argv, args) => {
      const key = String(args[0] ?? '')
      const chain = D.CHAINS.find((c) => c.name === key) ?? D.CHAINS.find((c) => c.id === key)
      if (!chain) return '【没有这个篇章】'
      const rows = await database.get(T_CHAIN, { userId: user.userId, chainId: chain.id }, { limit: 1 })
      const row = rows[0]
      const reached = row ? (row.state === 'completed' ? C.CHAIN_NODES : Math.max(row.readSeq, row.nodeSeq - 1)) : 0
      if (!reached) return `【还没读到】`
      const seq = args[1] ? Math.floor(Number(args[1])) : 0
      if (!seq) {
        return [
          T.title(chain.name, `已解锁 ${reached} / ${C.CHAIN_NODES} 节`),
          ...chain.nodes.slice(0, reached).map((n, i) => T.list(`　${i + 1}. ${n.name}`)),
          T.note(`发「看故事 ${chain.name} 1」读第 1 节`),
        ]
      }
      if (seq < 1 || seq > C.CHAIN_NODES || seq > reached) return `【还没到这一段】可读到第 ${reached} 节`
      const node = chain.nodes[seq - 1]
      const out: Line[] = [
        T.title(`${chain.name} · 节点 ${seq} ｜ ${node.name}`),
        T.prose(node.story.intro),
        T.div(),
        T.prose(node.story.progress),
        T.div(),
        T.prose(node.story.success),
      ]
      if (node.story.hook) out.push(T.prose(`　${node.story.hook}`))
      return out
    }))

  // ── E5 放弃链 ───────────────────────────────────────────────────────
  ctx.command('放弃链 <链名>', '中途放弃一个篇章（已完成的节点不回退）')
    .action(shell(game, async (user, g, argv, args) => {
      const blocked = closedMsg(user)
      if (blocked) return blocked
      const key = String(args[0] ?? '')
      const chain = D.CHAINS.find((c) => c.name === key) ?? D.CHAINS.find((c) => c.id === key)
      if (!chain) return '【没有这个篇章】'
      const rows = await database.get(T_CHAIN, { userId: user.userId, chainId: chain.id }, { limit: 1 })
      if (!rows.length || rows[0].state !== 'active') return '【没在推这个篇章】'
      await database.set(T_CHAIN, { userId: user.userId, chainId: chain.id }, { state: 'available', finishAt: null } as any)
      return [
        T.title(`已放弃 · ${chain.name}`),
        T.list(`进度停在节点 ${rows[0].nodeSeq}　奖励不退`),
      ]
    }))

  // ── E6 图鉴 ─────────────────────────────────────────────────────────
  ctx.command('图鉴 [类别]', '收集进度')
    .alias('收集')
    .action(shell(game, async (user, g, argv, args) => {
      const kind = String(args[0] ?? '')
      const ownedTech = await database.get('xianxia_tech', { userId: user.userId })
      const items = await g.items(user.userId)
      const codex = await database.get(T_CODEX, { userId: user.userId })
      if (kind === '功法' || kind === 'technique') {
        const lines: Line[] = [T.title(`功法图鉴 · ${ownedTech.length} / ${D.TECHNIQUES.length}`)]
        for (let gr = 1; gr <= 7; gr++) {
          const all = D.TECHNIQUES.filter((t) => t.grade === gr)
          const got = all.filter((t) => ownedTech.some((o) => o.techId === t.id))
          lines.push(T.kv(`${C.gradeName(gr)}品`, `${got.length} / ${all.length}　${got.map((t) => t.name).join('　') || '—'}`))
        }
        return lines
      }
      if (kind === '丹药' || kind === 'pill') {
        const lines: Line[] = [T.title(`丹药图鉴 · ${items.filter((i) => i.itemId.startsWith('P')).length} / ${D.PILLS.length}`)]
        for (let gr = 1; gr <= 7; gr++) {
          const all = D.PILLS.filter((p) => p.grade === gr)
          const got = all.filter((p) => items.some((i) => i.itemId === p.id))
          lines.push(T.kv(`${C.gradeName(gr)}品`, `${got.length} / ${all.length}　${got.map((p) => p.name).join('　') || '—'}`))
        }
        return lines
      }
      if (kind === '故事' || kind === 'story') {
        const rows = codex.filter((c) => c.codexId.startsWith('C-CH-') || c.codexId.startsWith('C-M-'))
        const chainRows = codex.filter((c) => c.codexId.startsWith('C-CH-'))
        return [
          T.title(`故事图鉴 · ${rows.length} 条`),
          T.kv('篇章节点', `${chainRows.length} / ${D.CHAINS.length * C.CHAIN_NODES}`),
          T.kv('历练履历', `${rows.length - chainRows.length} / ${D.MISSIONS.length}`),
        ]
      }
      return [
        T.title('图鉴'),
        T.kv('功法', `${ownedTech.length} / ${D.TECHNIQUES.length}`),
        T.kv('丹药', `${items.filter((i) => i.itemId.startsWith('P')).length} / ${D.PILLS.length}`),
        T.kv('篇章', `${codex.filter((c) => c.codexId.startsWith('C-CH-')).length} / ${D.CHAINS.length * C.CHAIN_NODES}`),
        T.note('发「图鉴 功法|丹药|故事」'),
      ]
    }))

  // ── E7 成就 ─────────────────────────────────────────────────────────
  ctx.command('成就', '成就与长期目标')
    .action(shell(game, async (user, g) => {
      const realm = C.realmOf(user.rank)
      const ownedTech = await database.get('xianxia_tech', { userId: user.userId })
      const items = await g.items(user.userId)
      const defs: Array<{ id: string; name: string; cond: string; ok: boolean }> = []
      for (let r = 1; r <= 9; r++) {
        defs.push({
          id: `A-REALM-${String(r).padStart(2, '0')}`,
          name: `抵达${['练气', '筑基', '金丹', '紫府', '合道', '渡劫', '人仙', '天仙', '金仙'][r - 1]}`,
          cond: `rank ≥ ${(r - 1) * 9 + 1}`,
          ok: user.rank >= (r - 1) * 9 + 1,
        })
      }
      for (let gr = 1; gr <= 7; gr++) {
        const all = D.TECHNIQUES.filter((t) => t.grade === gr)
        defs.push({
          id: `A-TECH-${gr}`, name: `集齐${C.gradeName(gr)}品功法`,
          cond: `${all.length} 门`, ok: all.every((t) => ownedTech.some((o) => o.techId === t.id)),
        })
      }
      for (let gr = 1; gr <= 7; gr++) {
        const all = D.PILLS.filter((p) => p.grade === gr)
        defs.push({
          id: `A-PILL-${gr}`, name: `集齐${C.gradeName(gr)}品丹药`,
          cond: `${all.length} 种`, ok: all.every((p) => items.some((i) => i.itemId === p.id)),
        })
      }
      defs.push({ id: 'A-CHK-100', name: '连签 100 天', cond: '连签 100 天', ok: user.checkinStreak >= 100 })
      defs.push({ id: 'A-FUR-15', name: '丹炉满级', cond: '15 级', ok: C.furnaceLevel(user.alchemyExp) >= 15 })

      const newly: string[] = []
      for (const d of defs) {
        if (!d.ok) continue
        if (await g.unlockAch(user.userId, d.id)) newly.push(d.name)
      }
      const got = await database.get(T_ACH, { userId: user.userId })
      const lines: Line[] = [T.title(`成就 · ${got.length} / ${defs.length}`)]
      lines.push(...defs.filter((d) => d.ok).map((d) => T.list(`✔ ${d.name}`)))
      lines.push(T.kv('未解锁', `${defs.filter((d) => !d.ok).length} 个`))
      if (newly.length) lines.push(T.kv('本次新解锁', newly.join('　')))
      return lines
    }))
}
