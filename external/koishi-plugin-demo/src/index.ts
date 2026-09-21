/**
 * koishi-plugin-demo —— 链路连通性测试插件
 *
 * 目的：在写「修仙挂机」正式代码之前，先用最小插件把下面这条链路逐段验证一遍。
 *
 *   QQ/沙盒 发消息
 *      └→ 适配器 → session
 *           └→ 指令解析（参数 / 选项 / 权限）
 *                └→ ctx.database 读写（建表 / 插入 / 原子自增 / 读回）
 *                     └→ 惰性结算（时间戳，不依赖定时器）
 *                          └→ session.send 回复
 *
 * 每条指令只验证链路的一段，输出里直接写明「验的是什么」，
 * 这样跑一遍就知道哪一段断了。
 */

import { Context, Schema, $, Logger } from 'koishi'

export const name = 'demo'

/**
 * ⚠️ 踩坑记录：不要在 dispose 里用 `ctx.logger(...)`。
 * dispose 触发时 logger 服务可能已被卸载，会抛 "ctx.logger is not a function"。
 * 正确做法是在模块加载时创建 Logger 实例，之后一直用它。
 */
const logger = new Logger('demo')

/** ctx.database 不是内置服务，必须声明依赖（开发要点 §6.1） */
export const inject = ['database']

export interface Config {
  probeLimit: number
}

export const Config: Schema<Config> = Schema.object({
  probeLimit: Schema.number()
    .default(5)
    .min(1)
    .max(20)
    .description('测试数据库读取条数上限。'),
})

// ── 自建表：演示「扩展新表」的标准写法（开发要点 §6.2） ────────────────

export interface DemoRecord {
  id: number
  userId: string
  /** 被调用次数 */
  count: number
  /** 闭关开始时间戳；null = 未闭关 */
  seclusionStart: Date | null
  /** 累计闭关秒数（惰性结算后落库） */
  seclusionSeconds: number
  /** 最后一次打卡的服务器日期 YYYY-MM-DD */
  lastCheckinDate: string
  createdAt: Date
}

declare module 'koishi' {
  interface Tables {
    demo_record: DemoRecord
  }
}

function fmtDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function apply(ctx: Context, config: Config) {
  // ⚠️ 官方硬要求：数据模型扩展必须在使用前完成（放在 apply 顶部）
  ctx.model.extend(
    'demo_record',
    {
      id: 'unsigned',
      userId: 'string',
      count: 'unsigned',
      seclusionStart: 'timestamp',
      seclusionSeconds: 'double',
      lastCheckinDate: 'string',
      createdAt: 'timestamp',
    },
    { primary: 'id', autoInc: true, unique: ['userId'] },
  )

  /** 取（或建）当前会话的用户记录 —— 演示 get 永远返回数组 + create 插入 */
  async function ensureRecord(userId: string): Promise<DemoRecord> {
    const rows = await ctx.database.get('demo_record', { userId }, { limit: 1 })
    if (rows.length) return rows[0]
    return await ctx.database.create('demo_record', {
      userId,
      createdAt: new Date(),
    })
  }

  /**
   * 惰性结算：把「上次结算时刻 → 现在」之间流逝的时间折算进去。
   * 这是本项目唯一允许的计时方式（开发要点 §2.5 + 项目开发指南 §5.5）。
   *
   * 返回值 = 本次结算到的秒数，收益由调用方乘速率。
   */
  async function settle(userId: string): Promise<number> {
    const rows = await ctx.database.get('demo_record', { userId }, { limit: 1 })
    if (!rows.length) return 0
    const row = rows[0]
    if (!row.seclusionStart) return 0

    const seconds = Math.floor((Date.now() - new Date(row.seclusionStart).getTime()) / 1000)
    if (seconds <= 0) return 0

    // 原子自增：让数据库基于「行内旧值」做加法，避免先 get 再 set 的竞态
    await ctx.database.set(
      'demo_record',
      { userId },
      (r) => ({
        seclusionSeconds: $.add(r.seclusionSeconds, seconds),
        seclusionStart: new Date(),
      }),
    )
    return seconds
  }

  // ── 指令 1：纯回显，验证「消息进得来、回复出得去」 ──────────────────
  ctx.command('demo.echo <text:text>', '回显：验证消息双向链路')
    .usage('把你说的话原样发回来，并附上会话元信息。')
    .example('demo.echo 你好')
    .action((argv, text) => {
      const session = argv.session!
      return [
        '【链路测试 · 1/6 消息收发】通',
        `你说了：${text}`,
        `平台 platform  = ${session.platform}`,
        `用户 userId    = ${session.userId}`,
        `频道 channelId = ${session.channelId ?? '(私聊)'}`,
        `是否私聊 isDirect = ${session.isDirect}`,
        `机器人 selfId  = ${session.selfId}`,
      ].join('\n')
    })

  // ── 指令 2：延迟测量，验证事件时间戳 ────────────────────────────────
  ctx.command('demo.ping', '测延迟：验证事件时间戳可用')
    .action((argv) => {
      const session = argv.session!
      const eventTs = session.event.timestamp ?? Date.now()
      return `【链路测试 · 2/6 事件时间戳】通\n消息发出 → 现在：${Date.now() - eventTs} ms`
    })

  // ── 指令 3：数据库写入 + 读回 ───────────────────────────────────────
  ctx.command('demo.db', '数据库读写：验证 ctx.database 可用')
    .action(async (argv) => {
      const session = argv.session!
      const userId = session.userId!
      await ensureRecord(userId)

      // 原子自增调用次数
      const result = await ctx.database.set('demo_record', { userId }, (row) => ({
        count: $.add(row.count, 1),
      }))

      const rows = await ctx.database.get('demo_record', { userId }, { limit: 1 })
      const probe = await ctx.database.get('demo_record', {}, { limit: config.probeLimit })
      const stats = await ctx.database.stats()

      return [
        '【链路测试 · 3/6 数据库读写】通',
        `本次 matched = ${result.matched}（0 表示没匹配到行）`,
        `我的记录 count = ${rows[0]?.count ?? '(无)'}`,
        `我的主键 id = ${rows[0]?.id ?? '(无)'}`,
        `全表前 ${probe.length} 行 userId：${probe.map((r) => r.userId).join(', ') || '(空)'}`,
        `库中表：${Object.keys(stats.tables).join(', ') || '(无表)'}`,
      ].join('\n')
    })

  // ── 指令 4：惰性结算（闭关 / 出关） ─────────────────────────────────
  ctx.command('demo.sit', '开始闭关（只记录时间戳，不启动任何定时器）')
    .action(async (argv) => {
      const userId = argv.session!.userId!
      await ensureRecord(userId)
      await ctx.database.set('demo_record', { userId }, { seclusionStart: new Date() })
      return [
        '【链路测试 · 4/6 惰性结算】已开始挂机。',
        '现在可以关掉进程、过几分钟再回来发 demo.stand —— 收益照样算得出来。',
      ].join('\n')
    })

  ctx.command('demo.stand', '出关（惰性结算流逝的时间）')
    .action(async (argv) => {
      const userId = argv.session!.userId!
      const seconds = await settle(userId)
      await ctx.database.set('demo_record', { userId }, { seclusionStart: null })
      const rows = await ctx.database.get('demo_record', { userId }, { limit: 1 })
      return [
        '【链路测试 · 4/6 惰性结算】通',
        `本次流逝 ${seconds} 秒 → 收益 +${(seconds * 2.5).toFixed(0)}（速率 2.5/秒）`,
        `累计闭关秒数 = ${(rows[0]?.seclusionSeconds ?? 0).toFixed(0)} s`,
      ].join('\n')
    })

  // ── 指令 5：服务器日期重置（每日签到） ──────────────────────────────
  ctx.command('demo.daily', '每日重置：验证按服务器日期比较，而不是按 24 小时')
    .action(async (argv) => {
      const userId = argv.session!.userId!
      await ensureRecord(userId)
      const today = fmtDate(new Date())
      const rows = await ctx.database.get('demo_record', { userId }, { limit: 1 })
      const last = rows[0]?.lastCheckinDate || '(从未)'

      // ✅ 正确：比较服务器日期字符串。❌ 错误：判断「距上次 > 24h」
      if (last === today) {
        return `【链路测试 · 5/6 每日重置】今天（${today}）已经签过了，上次 = ${last}。`
      }

      await ctx.database.set('demo_record', { userId }, { lastCheckinDate: today })
      return `【链路测试 · 5/6 每日重置】通\n签到成功：${last} → ${today}`
    })

  // ── 指令 6：权限 + 选项解析 ─────────────────────────────────────────
  ctx.command('demo.admin', '权限分级：验证 authority 生效', { authority: 4 })
    .option('force', '-f', { fallback: false })
    .action((argv) => {
      const session = argv.session!
      const user = session.user as Record<string, unknown> | undefined
      return [
        '【链路测试 · 6/6 权限与选项】通',
        `你的 authority = ${user?.authority ?? '(未加载；需要 userFields 或扩展 User 类型)'}`,
        `选项 --force = ${argv.options?.force}`,
      ].join('\n')
    })

  // ── 收尾：异常路径 + 生命周期 ───────────────────────────────────────
  ctx.command('demo.err', '异常路径：验证报错不会把插件打挂')
    .action(() => {
      throw new Error('这是一条故意抛出的错误，用于验证异常路径')
    })

  ctx.on('ready', () => {
    logger.info('demo 插件已就绪：指令 demo.echo / ping / db / sit / stand / daily / admin / err')
  })

  // dispose 只清副作用，绝不在这里存数据（开发要点 §2.5）
  ctx.on('dispose', () => {
    logger.info('demo 插件已卸载')
  })
}
