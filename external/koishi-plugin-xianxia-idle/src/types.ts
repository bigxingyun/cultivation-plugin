/** 修仙挂机 · 共享类型
 *  本文件是「插件代码」与「由文档生成的数据文件」之间的接口契约。
 *  数据文件由 scripts/gen-*.mjs 从 插件/基础/*.md 生成，**不要手改生成物**。
 */

/** 大境界序数 1..9（练气…金仙） */
export type Realm = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
/** 品级/档位 1..7（凡…帝） */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7
/** 功法品阶 */
export type Tier = 'L' | 'M' | 'U'
/** 历练目的 */
export type Purpose = 'combat' | 'farm' | 'train' | 'compound'
/** 丹药类别 A 修为 / B 淬体 / C 突破 / D 悟道 / E 护道 */
export type PillClass = 'A' | 'B' | 'C' | 'D' | 'E'
/** 功法特效编号 */
export type EffectCode = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8'

export const REALM_NAMES = ['练气', '筑基', '金丹', '紫府', '合道', '渡劫', '人仙', '天仙', '金仙'] as const
export const GRADE_NAMES = ['凡', '黄', '玄', '地', '天', '仙', '帝'] as const
export const TIER_NAMES: Record<Tier, string> = { L: '下品', M: '中品', U: '上品' }
export const PURPOSE_NAMES: Record<Purpose, string> = {
  combat: '打怪', farm: '药田', train: '修习', compound: '复合',
}
export const PURPOSE_CODES: Purpose[] = ['combat', 'farm', 'train', 'compound']
export const CLASS_NAMES: Record<PillClass, string> = {
  A: '修为', B: '淬体', C: '突破', D: '悟道', E: '护道',
}

/** 特效语义：value 的含义由 code 决定
 *  E1 最大生命 +v%   E2 攻击 +v%      E3 闪避 +v pt   E4 汲元（历练额外奖励）+v%
 *  E5 丹药效果 +v%   E6 修为增速 ×(1+v) E7 突破成功率 +v pt  E8 历练奖励(非修为) +v%
 */
export interface TechEffect { code: EffectCode; value: number }

export interface TechniqueDef {
  /** 'T05' */
  id: string
  name: string
  grade: Grade
  /** 倾向：生存 / 输出 / 发育 / 突破 / 丹药 / 闪避 */
  tendency: string
  effects: EffectCode[]
  /** 典出（世界观） */
  dex: string
  /** 形象（一句话画面） */
  image: string
  /** 获取倾向原文 */
  acquire: string
  /** 综合战力倍率，查表 7 值，不得现算 */
  mTech: number
  /** 可掉落的最低大境界序数（来自设定文档 §6.5） */
  unlockRealm: Realm
  /** 三品阶各自的特效数值 */
  tiers: Record<Tier, TechEffect[]>
}

export interface PillDef {
  /** 'P1-A' */
  id: string
  name: string
  grade: Grade
  cls: PillClass
  /** 典出 */
  lore: string
}

export interface MissionDef {
  /** m{realm}-{grade}-{purpose}-{seq} */
  id: string
  name: string
  realm: Realm
  grade: Grade
  purpose: Purpose
  story: { intro: string; success: string; fail: string }
  /** 占位文本标记 */
  placeholder?: boolean
}

/** 奇遇选项的可执行效果（由文档文本机械解析而来） */
export type EventEffect =
  | { t: 'material'; n: number }
  | { t: 'frag'; n: number }
  | { t: 'pill'; n: number }
  | { t: 'tech'; grade: Grade }
  | { t: 'exp'; pct: number }
  | { t: 'buff'; mul: number; minutes: number }

export interface EventOption {
  /** 选项动作，如「采摘」 */
  label: string
  /** 原始收益文本，用于展示 */
  text: string
  /** 'res' 即时资源 / 'exp' 稳定进度 */
  kind: 'res' | 'exp'
  effects: EventEffect[]
}

export interface EventDef {
  /** E{realm}-{seq:3} */
  id: string
  realm: Realm
  title: string
  body: string
  options: EventOption[]
}

export interface BadLotDef {
  /** X{realm}-{seq:2} */
  id: string
  realm: Realm
  /** 签文（四到八字） */
  sign: string
  /** 故事碎片文本 */
  fragment: string
}

export interface QuizDef {
  /** Q{band}-{seq} */
  id: string
  /** 出题档位 1..5 */
  band: 1 | 2 | 3 | 4 | 5
  q: string
  options: string[]
  /** 正确项下标 */
  answer: number
  explain: string
  source: string
}

export interface ChainNodeDef {
  seq: number
  name: string
  story: { intro: string; progress: string; success: string; hook: string }
}

export interface ChainDef {
  /** shanmen_01 */
  id: string
  name: string
  realm: Realm
  unlock: { rankMin: number; chainDone?: string; itemReq?: string; flagReq?: string }
  /** 主题（一句话） */
  theme: string
  /** 人物（≤3） */
  cast: string
  /** locked 时给玩家看的模糊描述（绝不能剧透） */
  blurb: string
  prologue: string
  nodes: ChainNodeDef[]
  epilogue: string
  /** 链末伏笔 */
  hook: string
  /** 链末二选一 */
  finalChoice: [string, string]
}
