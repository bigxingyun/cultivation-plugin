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
  T.sec('修炼'),
  T.list('　/闭关　　进入闭关（按时间戳累计修为）'),
  T.list('　/出关　　结束闭关，之后可执行写操作'),
  T.list('　/状态　　境界 · 修为 · 属性 · 加成'),
  T.list('　/突破　　消耗满池修为，按概率升境'),
  T.sec('历练'),
  T.list('　/历练　　　　　　　列出候选任务'),
  T.list('　/历练 3　　　　　　排队第 3 个'),
  T.list('　/历练 换　　　　　 刷新候选'),
  T.list('　/历练 打怪 凡 3　　按目的·档位批量排队'),
  T.list('　/任务　　查看队列　　/任务 收　　读取已结算日志'),
  T.sec('每日'),
  T.list('　/签到　连签 7 天一轮，断签回退 2 格'),
  T.list('　/抽签　每日一次'),
  T.list('　/答题　答对给奖，答错无罚'),
  T.list('　/奇遇　待决事件二选一　　/天机　3 碎片换提示'),
  T.sec('成长'),
  T.list('　/丹药　/服用 聚气丹　/功法　/升阶'),
  T.list('　/炼丹　/喂丹　/丹炉'),
  T.sec('故事'),
  T.list('　/任务链　/接链 青云旧籍　/链进度　/看故事 青云旧籍'),
  T.list('　/图鉴　/成就'),
  T.sec('其他'),
  T.list('　/介绍　/待办　/修仙'),
]

const INTRO: Line[] = [
  T.title('介绍 · 玩法概览'),
  T.blank(),
  T.head('一、核心循环'),
  T.prose('　闭关积累修为 → 经验池满 → 突破升境。'),
  T.prose('　历练获取功法与丹药，提升属性与任务成功率。'),
  T.prose('　任务链按节点计时推进，不消耗历练次数、不掷骰。'),
  T.blank(),
  T.head('二、离线结算'),
  T.prose('　闭关、历练队列、链节点均按时间戳惰性结算。'),
  T.prose('　离线收益照常累计，无离线上限。'),
  T.prose('　日流程参考：出关 → 收任务 / 排历练 / 突破 → 闭关。'),
  T.blank(),
  T.head('三、资源'),
  T.prose('　功法与丹药来自历练：打怪（灵材·稀有丹）、药田（丹药）、'),
  T.prose('　修习（功法）、复合（综合奖励）。'),
  T.prose('　灵材用于炼丹或功法升阶。'),
  T.blank(),
  T.head('四、进度参考'),
  T.prose('　纯闭关满级约 857 小时（约 36 天）；计入突破失败约 58 天。'),
  T.prose('　功法与丹药满配可缩短周期。'),
  T.blank(),
  T.head('五、规则边界'),
  T.prose('　无血量与装备；增益仅来自功法与丹药。'),
  T.prose('　同时仅运转一门功法；突破失败退回该层 70% 修为，不损属性与功法。'),
]

export function registerInfo (ctx: Context, game: Game) {
  const { database } = ctx

  ctx.command('帮助 [指令名]', '看指令清单')
    .alias('菜单').alias('help')
    .action(shell(game, async (user, g, argv, args) => {
      const key = String(args[0] ?? '')
      if (key && key !== '指令') {
        const table: Record<string, Line[]> = {
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
            T.list('/历练　　列出候选（目的、档位、耗时、成功率、修为）。'),
            T.list('/历练 〈编号〉　排队菜单中对应条目。'),
            T.list('/历练 换　　刷新候选，不消耗次数。'),
            T.list('/历练 〈目的〉 〈档位〉 [数量]　批量排队。目的：打怪 / 药田 / 修习 / 复合；档位：凡–帝或 1–7。'),
            T.kv('掉落', '打怪 灵材·稀有丹｜药田 丹药｜修习 功法｜复合 综合·线索'),
          ],
          任务: [
            T.list('/任务　查看队列　　/任务 收　读取未读结算日志'),
            T.list('到点任务在任意交互时已结算入库；「收」只读日志。'),
          ],
          签到: [T.list('/签到　连签 7 天一轮，第 7 天大奖；断签不清零，回退 2 格。')],
          抽签: [T.list('/抽签　大吉/吉：增速 buff；小吉：今日首次历练必成；平：修为；凶：故事碎片。')],
          答题: [T.list('/答题　出题　　/答题 A|B|C　作答。答对给修为与丹药。')],
          奇遇: [
            T.list('/奇遇　查看待决事件　　/奇遇 1|2　选择'),
            T.list('选项分为即时资源与稳定进度两类。'),
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
          return emit(g, argv, [
            T.title('未知子命令', '可用：'),
            T.list('　查询 / 发灵材 / 发丹 / 改境界 / 重算 / 重置每日 / 重置链 / 清队列'),
          ])
      }
      ctx.logger('xianxia').info(`管理操作 by ${session.userId}: ${sub} ${userId} ${value}`)
      return emit(g, argv, out)
    })
}

export { HELP_CARD, INTRO }
