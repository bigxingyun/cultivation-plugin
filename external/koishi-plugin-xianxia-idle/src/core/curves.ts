/** 修仙挂机 · 数值核心
 *
 *  ⚠️ 全项目唯一的数值来源。任何表都不许硬编码——文档里的表都是"按公式实算后取整"。
 *  依据：《开发游戏设定.md》§4 / §5 / §6 / §7 / §10 / §11。
 */

import type { Grade, Purpose, Realm } from '../types'
import { GRADE_NAMES, REALM_NAMES } from '../types'

/** 核心公比。**唯一**：改它必须同时改 T / attr / req 三处，并重跑断言 1–5。 */
export const RATIO = 1.037

/** 1) 单层挂机耗时（秒）—— 节奏的唯一来源 */
export function T (rank: number): number {
  return 6600 * Math.pow(RATIO, rank - 1)
}

/** 2) 裸属性（最大生命与攻击同值） */
export function attr (rank: number): number {
  return 100 * Math.pow(RATIO, rank - 1)
}

/** 3) 修为增速倍率：9 个锚点，段内几何插值 */
const ANCHORS = [1.0, 1.5, 2.2, 3.2, 4.6, 6.5, 9.0, 12.5, 17.0]

export function mult (rank: number): number {
  const seg = Math.min(8, Math.floor((rank - 1) / 9))
  const lo = ANCHORS[seg]
  const hi = seg < 8 ? ANCHORS[seg + 1] : ANCHORS[8]
  return lo * Math.pow(hi / lo, ((rank - 1) % 9) / 9)
}

/** 4) 修为增速（每秒，裸值，不含功法/丹药） */
export function R (rank: number): number {
  return 2.5 * mult(rank)
}

/** 5) 经验池 —— 派生量，不是调参旋钮 */
export function EP (rank: number): number {
  return R(rank) * T(rank)
}

/** 裸闪避率（百分点）。百分比连乘会爆炸，所以是分段线性累加。 */
export function dodge (rank: number): number {
  const a = Math.min(rank, 27) * 0.3                                  // 练气–金丹：+0.3
  const b = Math.min(Math.max(rank - 27, 0), 45) * 0.2               // 紫府–天仙：+0.2
  const c = Math.min(Math.max(rank - 72, 0), 9) * 0.15               // 金仙：+0.15
  return a + b + c
}

/** 大境界序数 1..9 */
export function realmOf (rank: number): Realm {
  return Math.min(9, Math.ceil(rank / 9)) as Realm
}

/** 该大境界的起始 rank */
export function realmStart (realm: number): number {
  return (realm - 1) * 9 + 1
}

/** rank 在该大境界内的层数 k = 1..9 */
export function layerOf (rank: number): number {
  return ((rank - 1) % 9) + 1
}

export function realmName (rank: number): string {
  return REALM_NAMES[realmOf(rank) - 1]
}

/** 「筑基三层」 */
export function rankName (rank: number): string {
  return `${realmName(rank)}${'一二三四五六七八九'[layerOf(rank) - 1]}层`
}

/** 丹药品级所对应的境界序数（天仙/金仙沿用七品） */
export function pillGradeOfRealm (realm: number): Grade {
  return Math.min(7, realm) as Grade
}

export function gradeName (g: number): string {
  return GRADE_NAMES[g - 1]
}

// ── 突破（§5.1 / §5.2 / §5.3） ─────────────────────────────────────────

/** 从 rank 突破到 rank+1 的基础成功率（0..1）。
 *  层内 k = 1..9：p = (900 − 90(g−1) − 10(k−1)) / 900
 *  ⚠️ 用闭式，不要循环累减（会积累浮点误差并与表对不上）。rank 81 无突破。 */
export function breakChance (rank: number): number {
  if (rank >= 81) return 0
  const g = realmOf(rank)
  const k = layerOf(rank)
  return (900 - 90 * (g - 1) - 10 * (k - 1)) / 900
}

/** 突破失败退回比例（回到该层 70% 位置） */
export const BREAK_KEEP = 0.7
/** 连败保护：同一层连续失败 3 次后，第 4 次 +15pt */
export const BREAK_PITY_AFTER = 3
export const BREAK_PITY_BONUS = 0.15
export const CHANCE_MIN = 0.05
export const CHANCE_MAX = 0.95

/** 单次突破的期望耗池数 E(p)（§5.3，用于"还要多久"的估算） */
export function expectedBreakCost (p: number): number {
  return 0.3 + 0.7 / (1 - 0.7 * (1 - p))
}

/** 大境界级折损系数（§5.3）。注意：金仙段只有 8 次突破，文档的 2.016 是 9 次口径。 */
export const REALM_BREAK_LOSS = [1.023, 1.079, 1.145, 1.223, 1.317, 1.432, 1.577, 1.764, 1.999]

// ── 历练（§7） ────────────────────────────────────────────────────────

/** req_coef = req / punch，由目标成功率反解而来（§7.3）。**档位为权威，不要硬编码 req。** */
export const REQ_COEF = [0.833, 0.833, 1.250, 1.471, 1.680, 1.892, 2.121]

/** 反解公式：req = punch × (1.9 / 目标成功率 − 1) / 1.2 */
export function reqCoefFromRate (rate: number): number {
  return (1.9 / rate - 1) / 1.2
}

/** 任务要求（req 只锚定裸属性基准，**绝不要让 req 去乘功法倍率**） */
export function missionReq (rank: number, grade: Grade): number {
  return punchBase(rank) * REQ_COEF[grade - 1]
}

/** 裸综合战力基准 */
export function punchBase (rank: number): number {
  return 3 * attr(rank)
}

/** 成功率 = clamp(1.9 × punch / (punch + 1.2 × req), 0.05, 0.95) */
export function successRate (myPunch: number, req: number): number {
  const raw = (1.9 * myPunch) / (myPunch + 1.2 * req)
  return Math.max(CHANCE_MIN, Math.min(CHANCE_MAX, raw))
}

/** 单次任务耗时（秒）= 120 × 1.5^(档位−1) × 1.037^(rank−1) */
export function missionDuration (rank: number, grade: Grade): number {
  return 120 * Math.pow(1.5, grade - 1) * Math.pow(RATIO, rank - 1)
}

/** 任务修为奖励系数（× EP(rank)） */
export const EXP_MUL = [0.03, 0.06, 0.10, 0.16, 0.22, 0.30, 0.40]

/** 灵材掉落率（combat / compound）与数量 */
export const MATERIAL_DROP = [0.20, 0.35, 0.50, 0.65, 0.80, 0.90, 1.00]
export function materialCount (grade: Grade): number {
  return 2 * grade
}

/** 功法出货率（仅 train / compound；§6.6） */
export const TECHNIQUE_DROP = [0.50, 0.70, 0.60, 0.35, 0.18, 0.07, 0.02]
/** 同一来源连续 20 次未出货，第 21 次必出 */
export const TECHNIQUE_PITY = 20

/** 丹药掉落率（按目的区分；farm 是主来源 §10.5） */
export const PILL_DROP: Record<Purpose, number> = {
  farm: 0.75, combat: 0.25, compound: 0.45, train: 0.05,
}

/** 每日历练次数上限（按大境界） */
export const DAILY_QUOTA = [3, 3, 4, 4, 5, 5, 6, 6, 8]
export function dailyQuota (rank: number): number {
  return DAILY_QUOTA[realmOf(rank) - 1]
}

/** 失败保底：满额奖励的 30% */
export const FAIL_KEEP = 0.3

// ── 功法（§6） ────────────────────────────────────────────────────────

/** 功法倍率表：**查表，不要用指数函数现算**（帝品 8.45 是权威值） */
export const M_TECHNIQUE = [1.20, 1.62, 2.19, 2.95, 3.99, 5.39, 8.45]

export const TIER_MUL = { L: 0.90, M: 1.00, U: 1.15 }

/** 功法所在品级的序号 n（凡1…帝7）——升阶消耗按它算，**不是 rank 也不是境界序数** */
export function techGradeIndex (grade: Grade): number {
  return grade
}

/** 升阶：下→中 15n²，中→上 40n² */
export function upgradeMaterial (grade: Grade, toTier: 'M' | 'U'): number {
  const n = techGradeIndex(grade)
  return toTier === 'M' ? 15 * n * n : 40 * n * n
}

/** 升阶修为消耗：下→中 30% EP，中→上 60% EP */
export function upgradeExp (rank: number, toTier: 'M' | 'U'): number {
  return (toTier === 'M' ? 0.3 : 0.6) * EP(rank)
}

/** 升阶成功率与冷却（秒） */
export const UPGRADE_RATE = { M: 1.0, U: 0.9 }
export const UPGRADE_COOLDOWN = 3600
/** 升阶失败只损失修为，返还 50% */
export const UPGRADE_FAIL_REFUND = 0.5

// ── 丹药（§10 / §11） ─────────────────────────────────────────────────

/** 修为丹效率：6% × 1.26^(N−1)。**效果 = 效率 × EP(当前 rank)，绝不用固定值** */
export function expPillRate (grade: Grade): number {
  return 0.06 * Math.pow(1.26, grade - 1)
}

/** 淬体丹：+10% × 品级序号，30 分钟 */
export function bodyPillBonus (grade: Grade): number {
  return 0.10 * grade
}

/** 突破丹：+5pt × 品级序号 */
export function breakPillBonus (grade: Grade): number {
  return 5 * grade
}

/** 悟道丹：×(1 + 0.15 × 品级序号)，硬上限 ×2.5，30 分钟 */
export function daoPillMul (grade: Grade): number {
  return 1 + 0.15 * grade
}
export const DAO_PILL_CAP = 2.5

export const PILL_DURATION = 1800
export const PILL_COOLDOWN = 180
export const PILL_DAILY_LIMIT = 3

/** 炼丹：3 颗 N 品 + 灵材 20N² → 1 颗 (N+1) 品 */
export const ALCHEMY_PILL_COST = 3
export function alchemyMaterial (grade: Grade): number {
  return 20 * grade * grade
}

/** 喂丹：一颗 N 品给 N² 点丹药经验 */
export function furnaceExp (grade: Grade): number {
  return grade * grade
}

/** 丹炉 15 级门槛（逐级），合计 402,385 */
export const FURNACE_THRESHOLDS = [
  10, 25, 50, 100, 200,
  400, 800, 1600, 3200, 6400,
  12800, 25600, 51200, 100000, 200000,
]

/** 丹炉等级与累计门槛 */
export function furnaceLevel (exp: number): number {
  let sum = 0
  for (let i = 0; i < FURNACE_THRESHOLDS.length; i++) {
    sum += FURNACE_THRESHOLDS[i]
    if (exp < sum) return i
  }
  return FURNACE_THRESHOLDS.length
}

export function furnaceBonus (level: number): { pillPct: number; speedPct: number; breakPt: number } {
  return {
    pillPct: Math.min(level, 5) * 0.02,
    speedPct: Math.min(Math.max(level - 5, 0), 5) * 0.01,
    breakPt: Math.min(Math.max(level - 10, 0), 5) * 0.5,
  }
}

// ── 任务链（§8） ──────────────────────────────────────────────────────

/** 链节点时长 = 该境界起点 rank 的闭关单层时长 T(起点)
 *  ⚠️ 依据《游戏结构与命令设计.md》差异 D-1：源文档 §8.4 把这一格误标成 "110 秒 / 1.8 min"，
 *  同表的 11.0 h / 22.0 h / 1,022 h 都只在"节点 = T(起点)"时成立。 */
export function chainNodeDuration (realm: Realm): number {
  return T(realmStart(realm))
}

/** 链节点数固定 6 */
export const CHAIN_NODES = 6

/** 每条链的修为奖励 = 该境界 9 层 EP 之和 × 6% */
export const CHAIN_EXP_MUL = 0.06
export function chainExpReward (realm: Realm): number {
  let sum = 0
  for (let k = 0; k < 9; k++) sum += EP(realmStart(realm) + k)
  return sum * CHAIN_EXP_MUL
}

/** 链的灵材奖励：5 × 境界序数²，最后一个节点 ×2 */
export function chainMaterial (realm: Realm, isLast: boolean): number {
  return 5 * realm * realm * (isLast ? 2 : 1)
}

/** 链末必出功法的品阶掷定：下 60% / 中 30% / 上 10% */
export const CHAIN_TIER_WEIGHT: Array<[string, number]> = [['L', 0.6], ['M', 0.3], ['U', 0.1]]

// ── 每日循环（§9） ────────────────────────────────────────────────────

/** 签到 7 天奖励表（0 = 修为百分比，1 = 特殊） */
export const CHECKIN_TABLE: Array<{ kind: 'exp' | 'pill' | 'quota' | 'dao' | 'break'; pct?: number; text: string }> = [
  { kind: 'exp', pct: 0.05, text: '修为 5% × EP' },
  { kind: 'exp', pct: 0.08, text: '修为 8% × EP' },
  { kind: 'pill', text: '淬体类丹药 ×1' },
  { kind: 'exp', pct: 0.12, text: '修为 12% × EP' },
  { kind: 'quota', text: '历练次数 +1　当日' },
  { kind: 'dao', text: '悟道丹 ×1' },
  { kind: 'exp', pct: 0.25, text: '修为 25% × EP　突破丹 ×1' },
]

/** 抽签表 */
export const DRAW_TABLE: Array<{ sign: string; weight: number; text: string }> = [
  { sign: '大吉', weight: 0.05, text: '增速　×1.50　1 小时' },
  { sign: '吉', weight: 0.20, text: '增速　×1.25　1 小时' },
  { sign: '小吉', weight: 0.30, text: '护道　今日首次历练必成功' },
  { sign: '平', weight: 0.35, text: '修为　20% × EP' },
  { sign: '凶', weight: 0.10, text: '故事碎片　+1' },
]

/** 奇遇触发率 */
export const EVENT_CHANCE = 0.08
/** 顿悟：挂机时 2% 免费升一阶，触发后 7 天冷却 */
export const INSIGHT_CHANCE = 0.02
export const INSIGHT_COOLDOWN = 7 * 86400

/** 天机推演：消耗 3 枚故事碎片 */
export const INSIGHT_FRAG_COST = 3

/** 服务器日期 YYYY-MM-DD（每日重置一律按它比较，绝不能按"距上次 24 小时"） */
export function today (now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
