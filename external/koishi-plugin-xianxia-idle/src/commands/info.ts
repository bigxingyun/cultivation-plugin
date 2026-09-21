/** F 信息与帮助 + G 管理
 *  规格见《游戏结构与命令设计.md》§4.5 F1–F3 / G1、附录 A
 */

import type { Context } from 'koishi'
import { $ } from 'koishi'
import type { Game } from '../game'
import { T_CHAIN, T_ITEM, T_LOG, T_QUEUE, T_USER } from '../game'
import * as C from '../core/curves'
import * as D from '../data'
import { amount, num } from '../core/fmt'
import { shell } from './helpers'

/** 附录 A 的速查卡，直接作为 `帮助` 的输出 */
const HELP_CARD = [
  '【修仙 · 指令】',
  '■ 修炼',
  '　/闭关　　开始挂机（离线照常累计）',
  '　/出关　　停下，然后才能做别的事',
  '　/状态　　境界 · 修为 · 属性 · 加成来源',
  '　/突破　　概率换境界（需修为池满）',
  '■ 历练（功法和丹药只能从这里来）',
  '　/历练　　　　　　　出菜单，挑一个具体任务',
  '　/历练 3　　　　　　排队菜单里的第 3 个',
  '　/历练 换　　　　　 换一批候选',
  '　/历练 打怪 凡 3　　批量快捷方式（目的+档位+数量）',
  '　/任务　　看队列　　/任务 收　　收取并读故事',
  '■ 每日',
  '　/签到　连签 7 天有奖，断签只回退 2 格',
  '　/抽签　每天一次，凶也有故事',
  '　/答题　答对给奖励，答错不罚',
  '　/奇遇　遇到时的二选一　　/天机　碎片换提示',
  '■ 成长',
  '　/丹药　/服用 聚气丹　/功法　/升阶',
  '　/炼丹　/喂丹　/丹炉',
  '■ 故事',
  '　/任务链　/接链 青云旧籍　/链进度　/看故事 青云旧籍',
  '　/图鉴　/成就',
  '■ 其他',
  '　/介绍　/待办　/修仙',
].join('\n')

const INTRO = [
  '【介绍 · 这是个什么游戏】',
  '',
  '一、三个循环',
  '　闭关涨修为 → 修为池满 → 尝试突破 → 境界更高。这是主轴。',
  '　历练攒功法和丹药 → 变强 → 更难的档位打得动。这是唯一的资源入口。',
  '　任务链读故事 → 一次性、不掷骰、不看脸。这是长线。',
  '',
  '二、你不用一直在线',
  '　闭关离线照常累计，历练队列离线照常推进，每日次数离线也攒满。',
  '　不设离线收益上限——挂机游戏不该惩罚下线。',
  '　你只需要每天上线 5 分钟：出关 → 收任务 / 排任务 / 突破 → 闭关。',
  '',
  '三、资源从哪来',
  '　历练是功法与丹药的唯一来源。打怪出灵材与稀有丹药，药田出丹药，',
  '　习武出功法，复合任务耗时最长但奖励种类最多。',
  '　灵材只有一种，两个出口：炼丹（合高阶丹）与功法升阶。这是唯一的长期取舍。',
  '',
  '四、满级要多久',
  '　纯闭关约 857 小时（约 36 天），含突破失败折损约 58 天。',
  '　堆满功法与丹药能压到约 3 周——这是给重度玩家的正反馈通道。',
  '',
  '五、几条红线',
  '　不设血量管理（所以没有补血药）；不设装备，增益只来自功法与丹药；',
  '　同一时刻只能运转一门功法；突破失败只损失时间，不掉属性、不爆功法。',
].join('\n')

export function registerInfo (ctx: Context, game: Game) {
  const { database } = ctx

  // ── F1 帮助 ─────────────────────────────────────────────────────────
  ctx.command('帮助 [指令名]', '看指令清单')
    .alias('菜单').alias('help')
    .action(shell(game, async (user, g, argv, args) => {
      const key = String(args[0] ?? '')
      if (key && key !== '指令') {
        const table: Record<string, string[]> = {
          闭关: ['/闭关　开始挂机。离线照常累计，不设上限。', '闭关期间只允许查询与每日仪式；要办事先「出关」。'],
          出关: ['/出关　结算并暂停修为增长，之后才能突破、历练、用丹药。', '已排入的历练队列不受影响，仍在离线推进。'],
          状态: ['/状态　境界、修为进度、增速拆解、属性、战力、丹药状态。', '只列数据：加成拆解只在有多个因子时才显示。'],
          突破: ['/突破　消耗整层经验池，按概率升一层。', '失败退回该层 70% 位置，连败 3 次后下次 +15pt。'],
          历练: [
            '/历练　　出菜单：列出候选任务，每条带目的、档位、耗时、成功率、修为奖励。',
            '/历练 <编号>　排队菜单里的第 N 个——排的就是你看到的那一个任务，不是随机抽。',
            '/历练 换　　　换一批候选（不消耗次数）。',
            '/历练 <目的> <档位> [数量]　批量快捷方式：打怪 / 药田 / 修习 / 复合 × 凡 黄 玄 地 天 仙 帝。',
            '越级打高难度永远有意义——收益/时间比恒定。',
            '掉落　打怪 灵材·稀有丹药｜药田 丹药｜修习 功法｜复合 样样都有·必带线索',
          ],
          任务: ['/任务　看队列　　/任务 收　结算并读故事', '已到点的任务不会丢，发「任务 收」结算并读故事。'],
          签到: ['/签到　连签 7 天为一轮，第 7 天给大奖；断签不清零，回退 2 格。'],
          抽签: ['/抽签　大吉/吉给增速 buff，小吉给"今日首次历练必成功"，平给修为，凶给故事碎片。'],
          答题: ['/答题　出题　　/答题 A|B|C　作答。答对给修为+丹药，答错不罚。'],
          奇遇: ['/奇遇　看当前待决奇遇　　/奇遇 1|2　做选择。', '两个选项分「即时资源」与「稳定进度」两类。'],
          丹药: ['/丹药　看背包　　/服用 <丹药> [数量]', '丹药来源：历练、签到、问答、奇遇。'],
          功法: ['/功法　看当前功法与收集进度。', '同一时刻只能运转一门功法；功法和丹药只能从「历练」获得。'],
          升阶: ['/升阶　用灵材与修为把当前功法推上一阶。下→中 100%，中→上 90%，失败只损失修为（返还 50%）。'],
          炼丹: ['/炼丹 <丹药> [次数]　3 颗 N 品 + 灵材 20N² → 1 颗 N+1 品，成功率 100%（资源转换，不是赌博）。'],
          喂丹: ['/喂丹 <丹药> [数量]　喂一颗 N 品给 N² 点丹药经验，只增不减。'],
          丹炉: ['/丹炉　15 级长线，给丹药效果 / 修为增速 / 突破成功率的永久加成。', '满级合计 402,385 点丹药经验，是跨版本的长线目标。'],
          任务链: ['/任务链　看全部篇章的进度　　/接链 <链名>　接取　　/链进度　推进与倒计时', '任务链不消耗历练次数，也不掷骰——故事是奖励，不该被概率挡住。'],
          图鉴: ['/图鉴 [功法|丹药|故事]'],
          成就: ['/成就　成就与长期目标。'],
          待办: ['/待办　看现在有什么该做'],
          介绍: ['/介绍　玩法说明'],
        }
        const hit = table[key]
        if (hit) return [`【帮助 · ${key}】`, ...hit].join('\n')
        return `【没有这条指令】发「帮助」看全部。`
      }
      return HELP_CARD
    }, { todo: false }))

  // ── F2 介绍 ─────────────────────────────────────────────────────────
  ctx.command('介绍', '玩法说明')
    .alias('玩法')
    .action(shell(game, async () => INTRO, { todo: false }))

  // ── G1 修仙管理（authority 4） ──────────────────────────────────────
  ctx.command('修仙管理 <子命令> [目标:string] [值:string] [数量:number]', '管理员指令', { authority: 4 })
    .usage([
      '修仙管理 查询 @某人',
      '修仙管理 发灵材 @某人 1000',
      '修仙管理 发丹 @某人 P1-A 5',
      '修仙管理 改境界 @某人 40',
      '修仙管理 重置每日 @某人',
      '修仙管理 重置链 @某人 shanmen_01',
      '修仙管理 清队列 @某人',
    ].join('\n'))
    .action(async (argv, ...args: any[]) => {
      const session = argv.session!
      const sub = String(args[0] ?? '')
      const target = String(args[1] ?? '').replace(/[<@!>]/g, '')
      const value = String(args[2] ?? '')
      const count = Math.max(1, Math.floor(Number(args[3] ?? 1)) || 1)
      const userId = target || session.userId!
      const g = game
      const user = await g.ensure(userId)
      const out: string[] = [`【修仙管理 · ${sub}】目标 ${userId}`]
      switch (sub) {
        case '查询': {
          const q = await database.get(T_QUEUE, { userId })
          const chains = await database.get(T_CHAIN, { userId })
          out.push(`rank ${user.rank}　${C.rankName(user.rank)}　修为 ${amount(user.exp)} / ${amount(C.EP(user.rank))}`)
          out.push(`灵材 ${num(user.material)}　碎片 ${user.fragments}　丹炉 ${C.furnaceLevel(user.alchemyExp)}`)
          out.push(`闭关　${user.seclusionStart ? '进行中' : '未开启'}　次数　${user.quotaUsed} / ${g.quotaOf(user)}`)
          out.push(`队列 ${q.length} 个　篇章 ${chains.length} 条`)
          break
        }
        case '发灵材':
          await database.set(T_USER, { userId }, (row: any) => ({ material: $.add(row.material, Number(value)) }) as any)
          out.push(`灵材 +${value}`)
          break
        case '发丹':
          await g.addItem(userId, value, count)
          out.push(`已发放 ${value} ×${count}`)
          break
        case '改境界':
          await g.save(userId, { rank: Math.max(1, Math.min(81, Number(value) || 1)) })
          out.push(`rank → ${value}　修为未变`)
          break
        case '重算':
          await g.save(userId, { exp: 0 })
          out.push('修为已清零')
          break
        case '重置每日':
          await g.save(userId, { quotaUsed: 0, quotaBonus: 0, quotaResetDate: '', lastCheckinDate: '', drawDate: '', quizDate: '', quizAnswered: '' })
          out.push('每日状态已重置')
          break
        case '重置链':
          await database.set(T_CHAIN, { userId, chainId: value }, { state: 'available', nodeSeq: 0, finishAt: null, readSeq: 0 } as any)
          out.push(`篇章 ${value} → available`)
          break
        case '清队列':
          await database.remove(T_QUEUE, { userId })
          await database.remove(T_LOG, { userId })
          out.push('队列与日志已清空')
          break
        default:
          return [
            '【未知子命令】可用：',
            '　查询 / 发灵材 / 发丹 / 改境界 / 重算 / 重置每日 / 重置链 / 清队列',
          ].join('\n')
      }
      ctx.logger('xianxia').info(`管理操作 by ${session.userId}: ${sub} ${userId} ${value}`)
      return out.join('\n')
    })
}

export { HELP_CARD, INTRO }
