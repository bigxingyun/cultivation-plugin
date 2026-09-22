/**
 * koishi-plugin-xianxia-idle —— 修仙挂机
 *
 * 设计依据：
 *   《开发游戏设定.md》         数值与公式（唯一权威）
 *   《游戏结构与命令设计.md》     游戏结构、命令规格、ID 与数据规范
 *   《任务故事库.md》           全部文本
 *   《功法丹药图鉴.md》         功法与丹药条目
 *
 * 实现纪律（踩过的坑，别改回去）：
 *   1. 数值一律由 core/curves.ts 现算，任何表都不许硬编码
 *   2. 一切计时都是时间戳惰性结算，**没有定时器**（重启/离线都不丢）
 *   3. dispose 里不做任何存档——每次变更立即写库
 *   4. 不在 dispose 里用 ctx.logger（服务可能已卸载，改用模块级 Logger）
 *   5. 数据模型必须在任何数据库操作之前 extend
 */

import { Context, Schema, Logger } from 'koishi'
import { dataReport, PLAYABLE_CHAINS } from './data'
import { Game, extendModels } from './game'
import type { RenderConfig } from './core/render'
import { registerCore } from './commands/core'
import { registerDaily } from './commands/daily'
import { registerGrow } from './commands/grow'
import { registerStory } from './commands/story'
import { registerInfo } from './commands/info'

export const name = 'xianxia-idle'

/** ctx.database 不是内置服务，必须声明依赖 */
export const inject = ['database']

const logger = new Logger('xianxia')

export interface Config {
  /** 是否在每条回复末尾附加待办摘要（零主动推送的实现） */
  todoHint: boolean
  /** 单条回复的软上限行数，超出只提示（避免刷屏） */
  quoteLimit: number
  /** 输出渲染：纯文本 / Markdown 两条路，见 core/render.ts */
  render: RenderConfig
}

export const Config: Schema<Config> = Schema.object({
  todoHint: Schema.boolean().default(true).description('在任意指令回复末尾附一行待办摘要。'),
  quoteLimit: Schema.number().default(60).min(10).max(200).description('单条回复的最大行数。'),
  render: Schema.union([
    Schema.const('auto').description('自动：QQ 官方机器人（平台 qq）用 Markdown，其余平台用纯文本。'),
    Schema.const('text').description('一律纯文本。任何平台都能读，Markdown 标记会原样显示。'),
    Schema.const('markdown').description('一律 Markdown。仅 QQ 官方机器人（群 / 单聊）渲染得出来。'),
  ]).default('auto').description('输出渲染方式。'),
})

export function apply (ctx: Context, config: Config) {
  // 官方硬要求：模型扩展必须在使用前完成
  extendModels(ctx)

  const game = new Game(ctx, { render: config.render, todoHint: config.todoHint })

  registerCore(ctx, game)
  registerDaily(ctx, game)
  registerGrow(ctx, game)
  registerStory(ctx, game)
  registerInfo(ctx, game)

  ctx.on('ready', () => {
    logger.info('修仙挂机已就绪。发「修仙」建档，「帮助」看指令。')
    logger.info(`渲染方式 ${config.render}${config.render === 'auto' ? '（平台 qq → Markdown，其余 → 纯文本）' : ''}`)
    for (const line of dataReport()) logger.info(line)
    logger.info(`可玩篇章 ${PLAYABLE_CHAINS.length} 条：${PLAYABLE_CHAINS.map((c) => c.name).join(' / ')}`)
  })

  ctx.on('dispose', () => {
    // 只记一行，不存任何数据（dispose 不保证被调用）
    logger.info('修仙挂机已卸载（数据早已逐次落库，无需存档）')
  })
}

