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
import type { Line } from '../core/render'
import { T } from '../core/render'
import { emit, shell } from './helpers'

const HELP_CARD: Line[] = [
  T.title('修仙 · 指令'),
  T.prose('不知道做什么？日常大致是：出关 → 收任务 / 签到抽签 → 排历练或突破 → 再闭关。'),
  T.prose('一级入口：修炼 · 历练 · 每日 · 成长 · 故事。短指令也能直达（如「闭关」）。'),
  T.sec('修炼'),
  T.list('　/闭关　坐下涨修为　　/出关　起来办事'),
  T.list('　/状态　看自己　　/突破　池满再试'),
  T.sec('历练'),
  T.list('　/历练　　看候选；上方是已接队列'),
  T.list('　/历练 3　选第 3 个　　/历练 换　换一批'),
  T.list('　/任务　　看队列　　/任务 收　读结算'),
  T.list('　/放弃 〈序号〉　撤销还没开始的'),
  T.sec('每日'),
  T.list('　/签到　/抽签　/答题　/奇遇　/天机'),
  T.sec('成长'),
  T.list('　/丹药　/服用　/功法　/升阶　/炼丹　/喂丹　/丹炉'),
  T.sec('故事'),
  T.list('　/任务链　/接链　/链进度　/看故事　/图鉴　/成就'),
  T.sec('其他'),
  T.list('　/修仙　/介绍　/待办　/帮助 〈指令名〉'),
]

const INTRO: Line[] = [
  T.title('介绍 · 玩法概览'),
  T.blank(),
  T.head('一、你在做什么'),
  T.prose('　闭关涨修为，池满了就突破升境。'),
  T.prose('　历练出门拿功法与丹药，让下次历练更稳、闭关更快。'),
  T.prose('　篇章按时间一节节推进，不耗历练次数，也不掷骰。'),
  T.blank(),
  T.head('二、离线结算'),
  T.prose('　闭关、历练队列、篇章节点都会按时间推进。'),
  T.prose('　人离开也照样走表，没有离线上限。'),
  T.prose('　回来时建议：出关 → 收任务 / 排历练 / 突破 → 再闭关。'),
  T.blank(),
  T.head('三、东西从哪来'),
  T.prose('　打怪偏灵材与稀有丹，药田偏丹药，修习偏功法，复合最杂。'),
  T.prose('　灵材用来炼丹，或把功法往上推一阶。'),
  T.blank(),
  T.head('四、大概要多久'),
  T.prose('　纯闭关走到满级大约 36 天；算上突破失手，大约 58 天。'),
  T.prose('　功法与丹药配齐，会短不少。'),
  T.blank(),
  T.head('五、边界'),
  T.prose('　没有血条和装备；变强只靠功法与丹药。'),
  T.prose('　同时只转一门功法。突破失败退回该层七成修为，不伤属性。'),
]

export function registerInfo (ctx: Context, game: Game) {
  const { database } = ctx

  ctx.command('帮助 [指令名]', '看指令清单')
    .alias('菜单')
    .action(shell(game, async (user, g, argv, args) => {
      const key = String(args[0] ?? '')
      if (key && key !== '指令') {
        const table: Record<string, Line[]> = {
          修炼: [
            T.list('/修炼　看子指令　　亦可直发：闭关 / 出关 / 状态 / 突破'),
          ],
          每日: [
            T.list('/每日　看子指令　　亦可直发：签到 / 抽签 / 答题 / 奇遇 / 天机'),
          ],
          成长: [
            T.list('/成长　看子指令　　亦可直发：丹药 / 服用 / 功法 / 升阶 / 炼丹 / 喂丹 / 丹炉'),
          ],
          故事: [
            T.list('/故事　看子指令　　亦可直发：任务链 / 接链 / 链进度 / 看故事 / 图鉴 / 成就'),
          ],
          闭关: [
            T.list('/闭关　进入闭关，修为按时间戳累计。'),
            T.list('闭关中仅允许查询与每日指令；写操作需先「出关」。重复闭关不会重置已挂时长。'),
          ],
          出关: [
            T.list('/出关　结算本段修为并结束闭关。'),
            T.list('已排入的历练队列继续按 finishAt 推进。'),
          ],
          状态: [
            T.list('/状态　境界、修为、增速、属性、战力、丹药状态。'),
            T.list('增速拆解仅在有多个因子时显示。'),
          ],
          突破: [
            T.list('/突破　消耗整层经验池，按概率升一层。'),
            T.list('失败退回该层 70%；连败 3 次后下次成功率 +15pt。'),
          ],
          历练: [
            T.list('/历练　　列出候选（目的、档位、耗时、成功率、修为）；上方显示已接队列。'),
            T.list('/历练 〈编号〉　排队菜单中对应条目；同一条今日不能接第二次。'),
            T.list('/历练 换　　刷新候选（已接条目仍不出现）。'),
            T.list('/历练 〈目的〉 〈档位〉 [数量]　批量排队。目的：打怪 / 药田 / 修习 / 复合；档位：凡–帝或 1–7。'),
            T.kv('掉落', '打怪 灵材·稀有丹｜药田 丹药｜修习 功法｜复合 综合·线索'),
          ],
          任务: [
            T.list('/任务　查看队列　　/任务 收　读取未读结算日志'),
            T.list('到点任务在任意交互时已结算入库；「收」只读日志。接了什么也可在「历练」上方查看。'),
          ],
          签到: [T.list('/签到　连签 7 天一轮，第 7 天大奖；断签不清零，回退 2 格。')],
          抽签: [T.list('/抽签　大吉/吉：增速 buff；小吉：今日首次历练必成；平：修为；凶：故事碎片。')],
          答题: [T.list('/答题　出题　　/答题 A|B|C　作答。答对给修为与丹药。')],
          奇遇: [
            T.list('/奇遇　查看待决事件　　/奇遇 1|2　选择'),
            T.list('选项分为「眼下能拿」与「细水长流」两类。'),
          ],
          丹药: [
            T.list('/丹药　背包　　/服用 〈丹药〉 [数量]'),
            T.list('同种丹冷却 3 分钟；每品级每日最多 3 次。来源：历练、签到、问答、奇遇。'),
          ],
          功法: [
            T.list('/功法　当前功法与收集进度。'),
            T.list('同时仅运转一门；功法主要来自历练（修习 / 复合）。'),
          ],
          升阶: [
            T.list('/升阶　消耗灵材与修为提升当前功法品阶。'),
            T.list('下→中 100%，中→上 90%；失败返还 50% 修为，不扣灵材；成功后冷却 1 小时。'),
          ],
          炼丹: [
            T.list('/炼丹 〈丹药〉 [次数]　3 颗 N 品 + 灵材 20N² → 1 颗同系 N+1 品，成功率 100%。'),
          ],
          喂丹: [T.list('/喂丹 〈丹药〉 [数量]　每颗 N 品提供 N² 丹药经验。')],
          丹炉: [
            T.list('/丹炉　0–15 级，永久加成丹药效果 / 修为增速 / 突破成功率。'),
            T.list('满级累计丹药经验 402,385。'),
          ],
          任务链: [
            T.list('/任务链　篇章列表　　/接链 〈链名〉　接取　　/链进度　推进与倒计时'),
            T.list('不消耗历练次数，不掷骰。'),
          ],
          图鉴: [T.list('/图鉴 [功法|丹药|故事]')],
          成就: [T.list('/成就　条件达成情况。')],
          待办: [T.list('/待办　当前可执行事项摘要。')],
          介绍: [T.list('/介绍　玩法说明。')],
        }
        const hit = table[key]
        if (hit) return [T.title(`帮助 · ${key}`), ...hit]
        return '【没有这条指令】发「帮助」看全部。'
      }
      return HELP_CARD
    }, { todo: false }))

  ctx.command('介绍', '玩法说明')
    .alias('玩法')
    .action(shell(game, async () => INTRO, { todo: false }))

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
      const out: Array<string | Line> = [T.title(`修仙管理 · ${sub}`, `目标 ${userId}`)]
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
          await g.save(userId, { quotaUsed: 0, quotaBonus: 0, quotaResetDate: '', lastCheckinDate: '', drawDate: '', quizDate: '', quizAnswered: '', recentMissions: '', pendingMenu: '' })
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
          return await emit(g, argv, [
            T.title('未知子命令', '可用：'),
            T.list('　查询 / 发灵材 / 发丹 / 改境界 / 重算 / 重置每日 / 重置链 / 清队列'),
          ])
      }
      ctx.logger('xianxia').info(`管理操作 by ${session.userId}: ${sub} ${userId} ${value}`)
      return await emit(g, argv, out)
    })
}

export { HELP_CARD, INTRO }
