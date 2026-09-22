/** 游戏服务层：模型扩展、惰性结算、数值聚合。 */

import { Context, $, Logger } from 'koishi'
import type {
  ChainDef, EventDef, Grade, MissionDef, PillDef, Purpose, Realm, TechniqueDef, Tier,
} from './types'
import { CLASS_NAMES, PURPOSE_NAMES, TIER_NAMES } from './types'
import * as C from './core/curves'
import * as D from './data'
import { amount, dur, num, pct } from './core/fmt'
import type { Line, RenderConfig } from './core/render'
import { T } from './core/render'

const logger = new Logger('xianxia')

// ── 表名（一律加前缀，避免与其它插件撞名） ──────────────────────────────
export const T_USER = 'xianxia_user'
export const T_QUEUE = 'xianxia_queue'
export const T_LOG = 'xianxia_log'
export const T_ITEM = 'xianxia_item'
export const T_TECH = 'xianxia_tech'
export const T_CHAIN = 'xianxia_chain'
export const T_CODEX = 'xianxia_codex'
export const T_ACH = 'xianxia_ach'
export const T_FLAG = 'xianxia_flag'
export const T_BUFF = 'xianxia_buff'

export interface XUser {
  userId: string
  rank: number
  exp: number
  /** null = 出关态 */
  seclusionStart: Date | null
  /** 上次闭关结算点。与 seclusionStart 分开：前者是"本次闭关起点"（不随结算移动），
   *  后者是"算到哪了"。合并成一个字段的话，「出关 合计多久」「状态 已挂多久」都会恒为 0。 */
  seclusionLast: Date | null
  techId: string
  techTier: Tier
  techUpgradedAt: Date | null
  material: number
  alchemyExp: number
  fragments: number
  checkinStreak: number
  lastCheckinDate: string
  quotaUsed: number
  quotaBonus: number
  quotaResetDate: string
  logReadId: number
  drawDate: string
  quizDate: string
  quizAnswered: string
  pendingEventId: string
  lastTechMiss: number
  insightUntil: Date | null
  recentMissions: string
  /** 历练菜单的候选 missionId 列表（二级菜单「多选一」用，逗号分隔） */
  pendingMenu: string
  createdAt: Date
}

export interface XQueueRow { userId: string; seq: number; missionId: string; finishAt: Date }
export interface XLogRow {
  id: number
  userId: string
  missionId: string
  success: number
  /** 结算时已发放的修为（只为回放时显示，不是"待领取"） */
  gainExp: number
  /** 一行奖励摘要（不存故事正文） */
  extra: string
  finishAt: Date
}
export interface XItemRow { userId: string; itemId: string; count: number }
export interface XTechRow { userId: string; techId: string; tier: Tier; obtainedAt: Date }
export interface XChainRow {
  userId: string; chainId: string; state: string; nodeSeq: number
  finishAt: Date | null; readSeq: number; completedAt: Date | null
}
export interface XCodexRow { userId: string; codexId: string; unlockedAt: Date }
export interface XAchRow { userId: string; achId: string; unlockedAt: Date }
export interface XFlagRow { userId: string; flagId: string; value: number }
export interface XBuffRow { userId: string; kind: string; value: number; until: Date }

declare module 'koishi' {
  interface Tables {
    xianxia_user: XUser
    xianxia_queue: XQueueRow
    xianxia_log: XLogRow
    xianxia_item: XItemRow
    xianxia_tech: XTechRow
    xianxia_chain: XChainRow
    xianxia_codex: XCodexRow
    xianxia_ach: XAchRow
    xianxia_flag: XFlagRow
    xianxia_buff: XBuffRow
  }
}

/** 注册全部数据模型。必须在任何数据库操作之前调用（官方硬要求）。 */
export function extendModels (ctx: Context) {
  ctx.model.extend(T_USER, {
    userId: 'string',
    rank: { type: 'unsigned', initial: 1 },
    exp: { type: 'double', initial: 0 },
    seclusionStart: 'timestamp',
    seclusionLast: 'timestamp',
    techId: { type: 'string', length: 16, initial: '' },
    techTier: { type: 'string', length: 1, initial: 'M' },
    techUpgradedAt: 'timestamp',
    material: { type: 'double', initial: 0 },
    alchemyExp: { type: 'double', initial: 0 },
    fragments: { type: 'unsigned', initial: 0 },
    checkinStreak: { type: 'unsigned', initial: 0 },
    lastCheckinDate: { type: 'string', length: 10, initial: '' },
    quotaUsed: { type: 'unsigned', initial: 0 },
    quotaBonus: { type: 'unsigned', initial: 0 },
    quotaResetDate: { type: 'string', length: 10, initial: '' },
    logReadId: { type: 'unsigned', initial: 0 },
    drawDate: { type: 'string', length: 10, initial: '' },
    quizDate: { type: 'string', length: 10, initial: '' },
    quizAnswered: { type: 'string', length: 4, initial: '' },
    pendingEventId: { type: 'string', length: 16, initial: '' },
    lastTechMiss: { type: 'unsigned', initial: 0 },
    insightUntil: 'timestamp',
    recentMissions: { type: 'string', length: 255, initial: '' },
    pendingMenu: { type: 'string', length: 255, initial: '' },
    createdAt: 'timestamp',
  }, { primary: 'userId' })

  // 历练队列：串行推进，finishAt 到点即完成
  ctx.model.extend(T_QUEUE, {
    userId: 'string',
    seq: 'unsigned',
    missionId: { type: 'string', length: 16 },
    finishAt: 'timestamp',
  }, { primary: ['userId', 'seq'] })

  // 已结算日志：只存 id + 成败，正文由静态数据还原
  ctx.model.extend(T_LOG, {
    id: { type: 'unsigned' },
    userId: 'string',
    missionId: { type: 'string', length: 16 },
    success: 'unsigned',
    gainExp: { type: 'double', initial: 0 },
    extra: { type: 'string', length: 120, initial: '' },
    finishAt: 'timestamp',
  }, { primary: 'id', autoInc: true })

  ctx.model.extend(T_ITEM, {
    userId: 'string',
    itemId: { type: 'string', length: 24 },
    count: { type: 'double', initial: 0 },
  }, { primary: ['userId', 'itemId'] })

  ctx.model.extend(T_TECH, {
    userId: 'string',
    techId: { type: 'string', length: 8 },
    tier: { type: 'string', length: 1 },
    obtainedAt: 'timestamp',
  }, { primary: ['userId', 'techId'] })

  ctx.model.extend(T_CHAIN, {
    userId: 'string',
    chainId: { type: 'string', length: 24 },
    state: { type: 'string', length: 12, initial: 'available' },
    nodeSeq: { type: 'unsigned', initial: 0 },
    finishAt: 'timestamp',
    readSeq: { type: 'unsigned', initial: 0 },
    completedAt: 'timestamp',
  }, { primary: ['userId', 'chainId'] })

  ctx.model.extend(T_CODEX, {
    userId: 'string',
    codexId: { type: 'string', length: 32 },
    unlockedAt: 'timestamp',
  }, { primary: ['userId', 'codexId'] })

  ctx.model.extend(T_ACH, {
    userId: 'string',
    achId: { type: 'string', length: 24 },
    unlockedAt: 'timestamp',
  }, { primary: ['userId', 'achId'] })

  ctx.model.extend(T_FLAG, {
    userId: 'string',
    flagId: { type: 'string', length: 24 },
    value: { type: 'double', initial: 1 },
  }, { primary: ['userId', 'flagId'] })

  ctx.model.extend(T_BUFF, {
    userId: 'string',
    kind: { type: 'string', length: 12 },
    value: { type: 'double', initial: 0 },
    until: 'timestamp',
  }, { primary: ['userId', 'kind'] })
}

// ── 聚合后的属性 ──────────────────────────────────────────────────────
export interface Stats {
  rank: number
  hpBase: number
  atkBase: number
  dodgePt: number
  /** 综合战力（含功法与丹药加成） */
  punch: number
  /** 修为增速（含全部乘区，每秒） */
  speed: number
  /** 裸境界增速 */
  speedBase: number
  hpPct: number
  atkPct: number
  dodgeBonus: number
  speedMul: number
  breakPt: number
  /** 突破丹加成（pt），服用时一次性加算，突破后清除 */
  breakPill: number
  /** 丹药效果加成（E5 + 丹炉） */
  pillBonus: number
  /** 历练奖励（非修为部分）加成（E8） */
  harvestPct: number
  /** 历练额外返还（E4） */
  drainPct: number
  tech?: TechniqueDef
  tier?: Tier
  buffs: XBuffRow[]
  bodyPct: number
  daoMul: number
  guard: boolean
  speedDebuff: number
  furnace: { level: number; pillPct: number; speedPct: number; breakPt: number }
}

/** 由境界起点 EP 反推丹药品级分布（farm 出同境界 ±0 品） */
export interface MissionOutcome {
  mission: MissionDef
  success: boolean
  exp: number
  material: number
  pills: Array<{ pill: PillDef; count: number }>
  technique?: { tech: TechniqueDef; tier: Tier }
}

export interface GameOptions {
  /** 输出渲染方式：auto 只对 QQ 官方机器人开 Markdown（core/render.ts） */
  render?: RenderConfig
  /** 是否在回复末尾附待办摘要 */
  todoHint?: boolean
}

export class Game {
  constructor (public ctx: Context, public opts: GameOptions = {}) {}

  get renderConfig (): RenderConfig {
    return this.opts.render ?? 'auto'
  }

  get todoHint (): boolean {
    return this.opts.todoHint !== false
  }

  // ── 用户档 ──────────────────────────────────────────────────────────
  async ensure (userId: string): Promise<XUser> {
    const rows = await this.ctx.database.get(T_USER, { userId }, { limit: 1 })
    if (rows.length) return rows[0]
    try {
      return await this.ctx.database.create(T_USER, { userId, createdAt: new Date() })
    } catch {
      const again = await this.ctx.database.get(T_USER, { userId }, { limit: 1 })
      return again[0]
    }
  }

  async save (userId: string, patch: Partial<XUser>) {
    await this.ctx.database.set(T_USER, { userId }, patch as any)
  }

  // ── 每日重置：按服务器日历日比较 ───────────────────────────────────
  async resetDaily (user: XUser): Promise<boolean> {
    const day = C.today()
    if (user.quotaResetDate === day) return false
    await this.save(user.userId, { quotaUsed: 0, quotaBonus: 0, quotaResetDate: day })
    user.quotaUsed = 0
    user.quotaBonus = 0
    user.quotaResetDate = day
    return true
  }

  quotaOf (user: XUser): number {
    return C.dailyQuota(user.rank) + user.quotaBonus
  }

  // ── 惰性结算 ────────────────────────────────────────────────────────
  /** 闭关修为结算：返回**本段**（上次结算至今）的时长与获得量
   *  「本次闭关总共挂了多久」= now − seclusionStart，别用本函数的 seconds 去当合计。 */
  async settleSeclusion (user: XUser): Promise<{ seconds: number; gained: number }> {
    if (!user.seclusionStart) return { seconds: 0, gained: 0 }
    const from = user.seclusionLast ?? user.seclusionStart
    const seconds = Math.floor((Date.now() - new Date(from).getTime()) / 1000)
    if (seconds <= 0) return { seconds: 0, gained: 0 }
    const stats = await this.stats(user)
    const gained = seconds * stats.speed
    await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({
      exp: $.add(row.exp, gained),
      seclusionLast: new Date(),
    }) as any)
    user.exp += gained
    // 顿悟：挂机时有 2% 概率免费升一阶，触发后 7 天冷却
    await this.tryInsight(user)
    return { seconds, gained }
  }

  private async tryInsight (user: XUser) {
    if (!user.techId) return
    if (user.insightUntil && new Date(user.insightUntil).getTime() > Date.now()) return
    if (Math.random() >= C.INSIGHT_CHANCE) return
    if (user.techTier === 'U') return
    const next: Tier = user.techTier === 'L' ? 'M' : 'U'
    await this.save(user.userId, { techTier: next, insightUntil: new Date(Date.now() + C.INSIGHT_COOLDOWN * 1000) })
    user.techTier = next
    user.insightUntil = new Date(Date.now() + C.INSIGHT_COOLDOWN * 1000)
    logger.info(`用户 ${user.userId} 顿悟：功法升为 ${TIER_NAMES[next]}`)
  }

  /** 到点的历练队列：逐条判定 → 写日志 → 清队列。返回本次结算的条目。 */
  async settleMissions (user: XUser): Promise<MissionOutcome[]> {
    const rows = await this.ctx.database.get(T_QUEUE, { userId: user.userId }, { sort: { seq: 'asc' } })
    const due = rows.filter((r) => new Date(r.finishAt).getTime() <= Date.now())
    if (!due.length) return []
    const out: MissionOutcome[] = []
    const fresh = await this.ensure(user.userId)
    const stats = await this.stats(fresh)
    let guarantee = (await this.hasFlag(user.userId, 'F-CE1'))
    for (const row of due) {
      const mission = D.MISSION_BY_ID.get(row.missionId)
      if (!mission) continue
      let success: boolean
      if (stats.guard) {
        success = true
        await this.clearBuff(user.userId, 'guard')
      } else if (guarantee) {
        success = true
        guarantee = false
        await this.clearFlag(user.userId, 'F-CE1')
      } else {
        const rate = C.successRate(stats.punch, C.missionReq(fresh.rank, mission.grade))
        success = Math.random() < rate
      }
      const outcome = await this.grantMission(fresh, mission, success, stats)
      out.push(outcome)
      const extraBits: string[] = []
      if (outcome.material) extraBits.push(`灵材 +${outcome.material}`)
      for (const p of outcome.pills) extraBits.push(`${p.pill.name} ×${p.count}`)
      if (outcome.technique) extraBits.push(`功法 ${outcome.technique.tech.name}·${TIER_NAMES[outcome.technique.tier]}`)
      await this.ctx.database.create(T_LOG, {
        userId: user.userId, missionId: mission.id, success: success ? 1 : 0,
        gainExp: outcome.exp, extra: extraBits.join('　'), finishAt: new Date(),
      })
      await this.ctx.database.remove(T_QUEUE, { userId: user.userId, seq: row.seq })
      await this.addCodex(user.userId, `C-M-${mission.id}`)
    }
    return out
  }

  /** 任务奖励发放（成功全额 / 失败 30% 保底） */
  private async grantMission (
    user: XUser, mission: MissionDef, success: boolean, stats: Stats,
  ): Promise<MissionOutcome> {
    const keep = success ? 1 : C.FAIL_KEEP
    const grade = mission.grade
    // 修为
    let exp = C.EP(user.rank) * C.EXP_MUL[grade - 1] * keep
    exp *= 1 + stats.harvestPct + stats.drainPct
    const rewardMul = 1 + (stats.tech ? this.sumEffect(stats.tech, stats.tier!, 'E8') + this.sumEffect(stats.tech, stats.tier!, 'E4') : 0)
    exp *= rewardMul
    // 灵材（combat / compound）
    let material = 0
    if (mission.purpose === 'combat' || mission.purpose === 'compound') {
      if (Math.random() < C.MATERIAL_DROP[grade - 1] * keep) {
        material = Math.max(1, Math.round(C.materialCount(grade) * keep * rewardMul))
      }
    }
    // 丹药（farm 为主来源）
    const pills: Array<{ pill: PillDef; count: number }> = []
    if (Math.random() < C.PILL_DROP[mission.purpose] * keep) {
      const pg = C.pillGradeOfRealm(C.realmOf(user.rank))
      const pool = D.PILLS.filter((p) => p.grade === pg)
      const pill = this.pick(pool)
      if (pill) pills.push({ pill, count: 1 })
    }
    // 功法（仅 train / compound），带 20 次保底
    let technique: MissionOutcome['technique']
    if (mission.purpose === 'train' || mission.purpose === 'compound') {
      const willDrop = user.lastTechMiss >= C.TECHNIQUE_PITY
      if (willDrop || Math.random() < C.TECHNIQUE_DROP[grade - 1]) {
        const realm = C.realmOf(user.rank)
        const pool = D.droppableTechniques(realm)
        // 当前境界对应品级的权重更高
        const want = Math.min(7, realm)
        const weighted: TechniqueDef[] = []
        for (const t of pool) {
          const w = Math.abs(t.grade - want) === 0 ? 3 : 1
          for (let i = 0; i < w; i++) weighted.push(t)
        }
        const tech = this.pick(weighted)
        if (tech) {
          const r = Math.random()
          const tier: Tier = r < 0.6 ? 'L' : r < 0.9 ? 'M' : 'U'
          technique = { tech, tier }
          await this.setFlag(user.userId, 'F-TECH-TMP', 0)
        }
      }
    }
    // 落库
    await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({
      exp: $.add(row.exp, exp),
      material: $.add(row.material, material),
      lastTechMiss: technique ? 0 : $.add(row.lastTechMiss, 1),
    }) as any)
    user.exp += exp
    user.material += material
    user.lastTechMiss = technique ? 0 : user.lastTechMiss + 1
    for (const p of pills) await this.addItem(user.userId, p.pill.id, p.count)
    if (technique) await this.learnTechnique(user, technique.tech, technique.tier)
    return { mission, success, exp, material, pills, technique }
  }

  /** 学习功法：同时仅运转一门，收集记录保留 */
  async learnTechnique (user: XUser, tech: TechniqueDef, tier: Tier): Promise<{ replaced: boolean }> {
    const had = !!user.techId
    await this.save(user.userId, { techId: tech.id, techTier: tier, techUpgradedAt: null })
    user.techId = tech.id
    user.techTier = tier
    user.techUpgradedAt = null
    await this.ctx.database.upsert(T_TECH, [{
      userId: user.userId, techId: tech.id, tier, obtainedAt: new Date(),
    }], ['userId', 'techId'])
    await this.addCodex(user.userId, `C-${tech.id}`)
    return { replaced: had }
  }

  /** 链节点：到点即推进（**不掷骰、不消耗次数**） */
  async settleChains (user: XUser): Promise<Array<{ chain: ChainDef; seq: number; isLast: boolean }>> {
    const rows = await this.ctx.database.get(T_CHAIN, { userId: user.userId })
    const out: Array<{ chain: ChainDef; seq: number; isLast: boolean }> = []
    for (const row of rows) {
      if (row.state !== 'active' || !row.finishAt) continue
      if (new Date(row.finishAt).getTime() > Date.now()) continue
      const chain = D.CHAIN_BY_ID.get(row.chainId)
      if (!chain) continue
      const seq = row.nodeSeq
      const isLast = seq >= C.CHAIN_NODES
      if (isLast) {
        await this.finishChain(user, chain)
      } else {
        const next = seq + 1
        await this.ctx.database.set(T_CHAIN, { userId: user.userId, chainId: chain.id }, {
          nodeSeq: next,
          finishAt: new Date(Date.now() + C.chainNodeDuration(chain.realm) * 1000),
        } as any)
        await this.grantChainNode(user, chain, seq)
      }
      out.push({ chain, seq, isLast })
    }
    return out
  }

  private async grantChainNode (user: XUser, chain: ChainDef, seq: number) {
    const material = C.chainMaterial(chain.realm, seq === C.CHAIN_NODES - 1)
    await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({
      material: $.add(row.material, material),
    }) as any)
    user.material += material
    // 每 2 个节点必出 1 颗丹药
    if (seq % 2 === 0) {
      const pg = Math.min(7, chain.realm + 1) as Grade
      const pool = D.PILLS.filter((p) => p.grade === pg)
      const pill = this.pick(pool)
      if (pill) await this.addItem(user.userId, pill.id, 1)
    }
    await this.addCodex(user.userId, `C-CH-${chain.id}-${seq}`)
  }

  /** 链末：修为奖励 + 必出功法 + 二选一留给玩家 */
  private async finishChain (user: XUser, chain: ChainDef) {
    const exp = C.chainExpReward(chain.realm)
    await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({
      exp: $.add(row.exp, exp),
    }) as any)
    user.exp += exp
    // 链末必出该境界档位功法
    const want = Math.min(7, chain.realm) as Grade
    const pool = D.TECHNIQUES.filter((t) => t.grade === want)
    const tech = this.pick(pool)
    if (tech) {
      const r = Math.random()
      await this.learnTechnique(user, tech, r < 0.6 ? 'L' : r < 0.9 ? 'M' : 'U')
    }
    await this.ctx.database.set(T_CHAIN, { userId: user.userId, chainId: chain.id }, {
      state: 'completed', nodeSeq: C.CHAIN_NODES, finishAt: null, completedAt: new Date(),
      readSeq: C.CHAIN_NODES - 1,
    } as any)
    logger.info(`用户 ${user.userId} 完成链 ${chain.id}`)
  }

  /** 汇总一次交互能触发的全部惰性结算 */
  async settleAll (user: XUser) {
    await this.resetDaily(user)
    const sec = await this.settleSeclusion(user)
    const fresh = await this.ensure(user.userId)
    const missions = await this.settleMissions(fresh)
    const chains = await this.settleChains(fresh)
    let after = await this.ensure(user.userId)
    // 奇遇：闭关结算出「有意义的时长」或任务结算后掷一次 8%（§9.4）
    if (!after.pendingEventId && (missions.length > 0 || sec.seconds >= 600)) {
      const ev = this.rollEvent(after.rank)
      if (ev) {
        await this.save(after.userId, { pendingEventId: ev.id })
        after = { ...after, pendingEventId: ev.id }
      }
    }
    return { sec, missions, chains, user: after }
  }

  // ── 数值聚合 ────────────────────────────────────────────────────────
  async stats (user: XUser): Promise<Stats> {
    const rank = user.rank
    const hpBase = C.attr(rank)
    const atkBase = C.attr(rank)
    const dodgeBase = C.dodge(rank)
    const tech = user.techId ? D.TECH_BY_ID.get(user.techId) : undefined
    const tier = user.techTier
    const buffs = await this.activeBuffs(user.userId)
    const level = C.furnaceLevel(user.alchemyExp)
    const fb = C.furnaceBonus(level)

    const sum = (code: string) => {
      if (!tech) return 0
      const list = tech.tiers[tier] || []
      return list.filter((e) => e.code === code).reduce((s, e) => s + e.value, 0)
    }
    let hpPct = sum('E1')
    let atkPct = sum('E2')
    const dodgePt = sum('E3')
    let speedMul = 1 + sum('E6')
    const breakPt = sum('E7')
    let pillBonus = sum('E5') + fb.pillPct
    const harvestPct = sum('E8')
    const drainPct = sum('E4')
    let bodyPct = 0, daoMul = 1, guard = false, speedDebuff = 1, breakPill = 0
    for (const b of buffs) {
      if (b.kind === 'body') { bodyPct += b.value; hpPct += b.value; atkPct += b.value }
      else if (b.kind === 'dao') daoMul *= b.value
      else if (b.kind === 'guard') guard = true
      else if (b.kind === 'break') breakPill += b.value
      else if (b.kind === 'speed') { if (b.value >= 1) speedMul *= b.value; else speedDebuff *= b.value }
    }
    daoMul = Math.min(daoMul, C.DAO_PILL_CAP)
    const hp = hpBase * (1 + hpPct)
    const atk = atkBase * (1 + atkPct)
    const dodge = dodgeBase + dodgePt
    const punch = hp + atk * 2 + dodge * 10
    const speedBase = C.R(rank)
    const speed = speedBase * speedMul * daoMul * speedDebuff * (1 + fb.speedPct)
    return {
      rank, hpBase, atkBase, dodgePt: dodgeBase, punch, speed, speedBase,
      hpPct, atkPct, dodgeBonus: dodgePt, speedMul, breakPt, breakPill, pillBonus, harvestPct, drainPct,
      tech, tier, buffs, bodyPct, daoMul, guard, speedDebuff,
      furnace: { level, ...fb },
    }
  }

  private sumEffect (tech: TechniqueDef, tier: Tier, code: string): number {
    return (tech.tiers[tier] || []).filter((e) => e.code === code).reduce((s, e) => s + e.value, 0)
  }

  // ── buff ────────────────────────────────────────────────────────────
  async activeBuffs (userId: string): Promise<XBuffRow[]> {
    const rows = await this.ctx.database.get(T_BUFF, { userId })
    const now = Date.now()
    const live = rows.filter((r) => !r.until || new Date(r.until).getTime() > now)
    const dead = rows.filter((r) => r.until && new Date(r.until).getTime() <= now)
    for (const d of dead) await this.ctx.database.remove(T_BUFF, { userId, kind: d.kind })
    return live
  }

  async addBuff (userId: string, kind: string, value: number, seconds: number) {
    const until: any = seconds > 0 ? new Date(Date.now() + seconds * 1000) : null
    await this.ctx.database.upsert(T_BUFF, [{ userId, kind, value, until }], ['userId', 'kind'])
  }

  async clearBuff (userId: string, kind: string) {
    await this.ctx.database.remove(T_BUFF, { userId, kind })
  }

  // ── 物品 / flag / 图鉴 / 成就 ───────────────────────────────────────
  async addItem (userId: string, itemId: string, n: number) {
    if (!n) return
    const res = await this.ctx.database.set(T_ITEM, { userId, itemId }, (row) => ({
      count: $.add(row.count, n),
    }) as any)
    if (!res.matched) {
      try {
        await this.ctx.database.create(T_ITEM, { userId, itemId, count: n })
      } catch {
        await this.ctx.database.set(T_ITEM, { userId, itemId }, (row) => ({ count: $.add(row.count, n) }) as any)
      }
    }
  }

  async items (userId: string): Promise<XItemRow[]> {
    const rows = await this.ctx.database.get(T_ITEM, { userId })
    return rows.filter((r) => r.count > 0)
  }

  async itemCount (userId: string, itemId: string): Promise<number> {
    const rows = await this.ctx.database.get(T_ITEM, { userId, itemId }, { limit: 1 })
    return rows[0]?.count ?? 0
  }

  /** 原子扣减物品：不足返回 false */
  async consumeItem (userId: string, itemId: string, n: number): Promise<boolean> {
    const res = await this.ctx.database.set(T_ITEM, { userId, itemId, count: { $gte: n } } as any, (row) => ({
      count: $.add(row.count, -n),
    }) as any)
    return !!res.matched
  }

  async setFlag (userId: string, flagId: string, value = 1) {
    await this.ctx.database.upsert(T_FLAG, [{ userId, flagId, value }], ['userId', 'flagId'])
  }

  async hasFlag (userId: string, flagId: string): Promise<boolean> {
    const rows = await this.ctx.database.get(T_FLAG, { userId, flagId }, { limit: 1 })
    return !!rows.length && rows[0].value > 0
  }

  async clearFlag (userId: string, flagId: string) {
    await this.ctx.database.remove(T_FLAG, { userId, flagId })
  }

  async addCodex (userId: string, codexId: string) {
    await this.ctx.database.upsert(T_CODEX, [{ userId, codexId, unlockedAt: new Date() }], ['userId', 'codexId'])
  }

  async codexCount (userId: string, prefix?: string): Promise<number> {
    const rows = await this.ctx.database.get(T_CODEX, { userId })
    return prefix ? rows.filter((r) => r.codexId.startsWith(prefix)).length : rows.length
  }

  async unlockAch (userId: string, achId: string): Promise<boolean> {
    const had = await this.ctx.database.get(T_ACH, { userId, achId }, { limit: 1 })
    if (had.length) return false
    await this.ctx.database.upsert(T_ACH, [{ userId, achId, unlockedAt: new Date() }], ['userId', 'achId'])
    return true
  }

  // ── 奇遇 ────────────────────────────────────────────────────────────
  rollEvent (rank: number): EventDef | undefined {
    if (Math.random() >= C.EVENT_CHANCE) return undefined
    const pool = D.eventsOfRealm(C.realmOf(rank))
    return this.pick(pool)
  }

  async applyEventOption (user: XUser, ev: EventDef, index: number): Promise<string[]> {
    const opt = ev.options[index]
    if (!opt) return ['这个选项不存在。']
    const lines: string[] = []
    for (const eff of opt.effects) {
      switch (eff.t) {
        case 'material':
          await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({ material: $.add(row.material, eff.n) }) as any)
          user.material += eff.n
          lines.push(`灵材 +${eff.n}`)
          break
        case 'frag':
          await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({ fragments: $.add(row.fragments, eff.n) }) as any)
          user.fragments += eff.n
          lines.push(`故事碎片 +${eff.n}`)
          break
        case 'pill': {
          const pg = C.pillGradeOfRealm(C.realmOf(user.rank))
          const pool = D.PILLS.filter((p) => p.grade === pg)
          const pill = this.pick(pool)
          if (pill) { await this.addItem(user.userId, pill.id, eff.n); lines.push(`${pill.name} ×${eff.n}`) }
          break
        }
        case 'exp': {
          const exp = C.EP(user.rank) * eff.pct
          await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({ exp: $.add(row.exp, exp) }) as any)
          user.exp += exp
          lines.push(`修为 +${amount(exp)}`)
          break
        }
        case 'tech': {
          const pool = D.TECHNIQUES.filter((t) => t.grade === eff.grade)
          const tech = this.pick(pool)
          if (tech) {
            const r = Math.random()
            const tier: Tier = r < 0.6 ? 'L' : r < 0.9 ? 'M' : 'U'
            await this.learnTechnique(user, tech, tier)
            lines.push(`习得 ${tech.name}·${TIER_NAMES[tier]}`)
          }
          break
        }
        case 'buff':
          await this.addBuff(user.userId, 'speed', eff.mul, eff.minutes * 60)
          lines.push(`修为增速 ×${eff.mul}（${eff.minutes} 分钟）`)
          break
      }
    }
    await this.save(user.userId, { pendingEventId: '' })
    user.pendingEventId = ''
    return lines
  }

  // ── 工具 ────────────────────────────────────────────────────────────
  pick<T> (arr: T[]): T | undefined {
    if (!arr.length) return undefined
    return arr[Math.floor(Math.random() * arr.length)]
  }

  pickWeighted<T> (arr: Array<[T, number]>): T | undefined {
    const total = arr.reduce((s, [, w]) => s + w, 0)
    let r = Math.random() * total
    for (const [v, w] of arr) { r -= w; if (r <= 0) return v }
    return arr.length ? arr[arr.length - 1][0] : undefined
  }

  /** 待办摘要条目（§4.6） */
  async todos (user: XUser): Promise<string[]> {
    const out: string[] = []
    if (user.rank < 81 && user.exp >= C.EP(user.rank)) {
      const times = Math.floor(user.exp / C.EP(user.rank))
      out.push(`可突破 ${times} 次`)
    }
    const unread = await this.ctx.database.get(T_LOG, { userId: user.userId, id: { $gt: user.logReadId } } as any)
    if (unread.length) out.push(`${unread.length} 个任务可收`)
    const chains = await this.ctx.database.get(T_CHAIN, { userId: user.userId, state: 'active' })
    const dueChain = chains.filter((c) => c.finishAt && new Date(c.finishAt).getTime() <= Date.now())
    if (dueChain.length) out.push(`${dueChain.length} 个链节点可看`)
    if (user.lastCheckinDate !== C.today()) out.push('今日未签到')
    if (user.pendingEventId) out.push('有 1 条奇遇待选')
    const left = this.quotaOf(user) - user.quotaUsed
    if (left > 0) out.push(`历练次数剩 ${left}`)
    // 排最后：它是"该收工了"的提醒，不该挤掉上面那些"现在能做的事"
    if (!user.seclusionStart && user.rank < 81) out.push('未闭关，修为不涨')
    return out
  }

  async todoLine (user: XUser): Promise<string> {
    const list = await this.todos(user)
    if (!list.length) return ''
    return `▸ 待办：${list.slice(0, 3).join(' · ')}`
  }

  // ── 突破 ────────────────────────────────────────────────────────────
  async doBreak (user: XUser): Promise<{ ok: boolean; rate: number; success?: boolean; reason?: string }> {
    const rank = user.rank
    if (rank >= 81) return { ok: false, rate: 0, reason: '已是当前版本终点（金仙九层），无经验池可填。' }
    const pool = C.EP(rank)
    if (user.exp < pool) return { ok: false, rate: 0, reason: '修为不足' }
    const stats = await this.stats(user)
    const pity = await this.pity(user.userId)
    const base = C.breakChance(rank)
    let rate = base + (stats.breakPt + stats.breakPill) / 100
    if (pity >= C.BREAK_PITY_AFTER) rate += C.BREAK_PITY_BONUS
    rate = Math.max(C.CHANCE_MIN, Math.min(C.CHANCE_MAX, rate))
    const success = Math.random() < rate
    // 突破丹是一次性的：无论成败都消耗
    if (stats.breakPill > 0) await this.clearBuff(user.userId, 'break')
    if (success) {
      await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({
        rank: $.add(row.rank, 1),
        exp: $.add(row.exp, -pool),
      }) as any)
      user.rank += 1
      user.exp -= pool
      await this.save(user.userId, { pendingEventId: user.pendingEventId })
      await this.setPity(user.userId, 0)
    } else {
      // 只损失时间：修为退回该层 70% 位置
      const back = pool * (1 - C.BREAK_KEEP)
      await this.ctx.database.set(T_USER, { userId: user.userId }, (row) => ({
        exp: $.add(row.exp, -back),
      }) as any)
      user.exp -= back
      await this.setPity(user.userId, pity + 1)
    }
    return { ok: true, rate, success }
  }

  async pity (userId: string): Promise<number> {
    const rows = await this.ctx.database.get(T_FLAG, { userId, flagId: 'F-PITY' }, { limit: 1 })
    return rows[0]?.value ?? 0
  }

  private async setPity (userId: string, n: number) {
    await this.ctx.database.upsert(T_FLAG, [{ userId, flagId: 'F-PITY', value: n }], ['userId', 'flagId'])
  }

  // ── 状态拆解文本（只摆数据，不做解释：§4.4「数据界面 / 帮助界面」分层） ──
  statLines (s: Stats, user: XUser): Line[] {
    const lines: Line[] = []
    const pool = C.EP(user.rank)
    lines.push(T.kv('修为', `${amount(user.exp)} / ${amount(pool)}　${this.bar(user.rank, user.exp)}　${pct(Math.min(1, user.exp / pool))}`))
    // 加成拆解：只有一个因子时是废话，不显示；多个因子才是「为什么变强」的数据
    const parts = [`境界 ×${s.speedBase.toFixed(2)}`]
    if (s.tech) parts.push(`功法 ×${s.tech.mTech}`)
    if (s.daoMul > 1) parts.push(`悟道 ×${s.daoMul.toFixed(2)}`)
    if (s.speedMul > 1) parts.push(`状态 ×${s.speedMul.toFixed(2)}`)
    if (s.speedDebuff < 1) parts.push(`负面 ×${s.speedDebuff.toFixed(2)}`)
    if (s.furnace.speedPct) parts.push(`丹炉 +${pct(s.furnace.speedPct, 0)}`)
    lines.push(T.kv('增速', `${s.speed.toFixed(2)} /秒${parts.length > 1 ? `　（${parts.join('　')}）` : ''}`))
    lines.push(user.seclusionStart
      ? T.kv('闭关', `进行中　已挂 ${dur((Date.now() - new Date(user.seclusionStart).getTime()) / 1000)}`)
      : T.kv('闭关', '未开启'))
    const hp = s.hpBase * (1 + s.hpPct)
    const atk = s.atkBase * (1 + s.atkPct)
    lines.push(T.kv('生命', `${num(hp)}　攻击　${num(atk)}　闪避　${(C.dodge(user.rank) + s.dodgeBonus).toFixed(2)}%`))
    lines.push(T.kv('战力', num(s.punch)))
    return lines
  }

  private bar (rank: number, exp: number): string {
    const r = Math.max(0, Math.min(1, exp / C.EP(rank)))
    const filled = Math.round(r * 10)
    return '█'.repeat(filled) + '░'.repeat(10 - filled)
  }

  pillInfo (p: PillDef): string {
    return `${CLASS_NAMES[p.cls]}丹 · ${C.gradeName(p.grade)}品`
  }
}
