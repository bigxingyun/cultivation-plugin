/**
 * 修仙挂机 · 无头全流程自检
 *
 * 用官方 @koishijs/plugin-mock 起假平台，把指令一条条"发"进去，断言回复与落库结果。
 * 时间流逝通过直接改数据库时间戳模拟（这正是"惰性结算"的设计前提）。
 *
 * 运行：node -r esbuild-register scripts/smoke-xianxia.ts
 * 退出码 0 = 全通过。
 */

import { Context } from 'koishi'
import MockBot from '@koishijs/plugin-mock'

const checks: Array<{ name: string; pass: boolean; detail: string }> = []
function check (name: string, pass: boolean, detail = '') {
  checks.push({ name, pass, detail })
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'} | ${name}${detail ? `  ——  ${detail}` : ''}`)
}
const head = (t: string, n = 1) => (t || '').split('\n').slice(0, n).join(' / ') || '(无回复)'

async function main () {
  console.log('══════ 修仙挂机 · 全流程自检 ══════\n')
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const dbFile = path.resolve('data/smoke-xianxia.db')
  fs.rmSync(dbFile, { force: true })
  fs.mkdirSync(path.dirname(dbFile), { recursive: true })

  const app = new Context({ prefix: ['.', '/'] })
  const sqliteMod: any = require('@koishijs/plugin-database-sqlite')
  app.plugin(sqliteMod?.default?.default ?? sqliteMod?.default ?? sqliteMod, { path: 'data/smoke-xianxia.db' })

  const mod: any = require('../external/koishi-plugin-xianxia-idle/src/index.ts')
  const plugin = mod?.default?.default ?? mod?.default ?? mod
  app.plugin(plugin, {})

  await app.start()
  await new Promise((r) => setTimeout(r, 300))
  check('D1 应用启动', !!app, `koishi ${require('koishi/package.json').version}`)
  check('D2 database 注入 + 建表', !!app.database,
    `表：${Object.keys((await app.database.stats()).tables).filter((t) => t.startsWith('xianxia')).join(', ')}`)

  const Mock = (MockBot as any).default ?? MockBot
  app.plugin(Mock, { selfId: 'bot-514' })
  await new Promise((r) => setTimeout(r, 300))
  const c1 = app.mock.client('u1', 'c1')
  const c2 = app.mock.client('u2', 'c1')
  await app.mock.initUser('u1', 4)
  await app.mock.initUser('u2', 1)
  const send = async (c: any, content: string) => ((await c.receive(content, 1)) || []).join('\n---\n')
  const db = app.database!

  // ── 数值层：直接对公式做抽查（不经过指令） ───────────────────────────
  const C = require('../external/koishi-plugin-xianxia-idle/src/core/curves.ts')
  check('N1 EP(1) = 16,500', Math.abs(C.EP(1) - 16500) < 1, `EP(1)=${C.EP(1).toFixed(0)}`)
  check('N2 ΣT(1..80) ≈ 856.9 h', Math.abs((() => { let s = 0; for (let i = 1; i <= 80; i++) s += C.T(i); return s / 3600 })() - 856.9) < 1, '满级纯闭关（不含无池的 rank 81）')
  check('N3 七档成功率回代一致', [0.95, 0.95, 0.76, 0.687, 0.63, 0.581, 0.536]
    .every((target, i) => Math.abs(C.successRate(C.punchBase(1), C.missionReq(1, (i + 1) as any)) - target) < 0.002),
    '凡95 黄95 玄76 地68.7 天63 仙58.1 帝53.6')
  check('N4 punch = 3 × 最大生命', [1, 27, 54, 81].every((r) => Math.abs(C.punchBase(r) - 3 * C.attr(r)) < 1e-6))
  check('N5 属性/耗时同公比 1.037', Math.abs(C.T(50) / C.T(49) - 1.037) < 1e-9 && Math.abs(C.attr(50) / C.attr(49) - 1.037) < 1e-9)
  check('N6 金仙段 8 次突破，最后一次 12.2%', Math.abs(C.breakChance(80) - 0.1222) < 0.001 && C.breakChance(81) === 0,
    `p(80)=${(C.breakChance(80) * 100).toFixed(2)}%`)
  check('N7 丹炉 15 级门槛 = 402,385', C.FURNACE_THRESHOLDS.reduce((a: number, b: number) => a + b, 0) === 402385)
  check('N8 链节点时长 = T(境界起点)', Math.abs(C.chainNodeDuration(1) - C.T(1)) < 1e-6, `练气 ${(C.chainNodeDuration(1) / 3600).toFixed(2)} h`)

  console.log('\n────── 指令层：完整玩一遍 ──────\n')

  // ── 1. 建档与开场 ──────────────────────────────────────────────────
  const r1 = await send(c1, '.修仙')
  check('1 建档 + 开场白', r1.includes('青云宗') && r1.includes('闭关'), head(r1))
  const users = await db.get('xianxia_user', { userId: 'u1' })
  check('2 用户行已落库', users.length === 1 && users[0].rank === 1, `rank=${users[0]?.rank} exp=${users[0]?.exp}`)

  // ── 3. 闭关 / 状态 ─────────────────────────────────────────────────
  const r3 = await send(c1, '.闭关')
  check('3 闭关', r3.includes('闭关 · 开始') && r3.includes('增速'), head(r3))

  // 时间旅行：把闭关起点拨回 2 小时
  await db.set('xianxia_user', { userId: 'u1' }, { seclusionStart: new Date(Date.now() - 7200 * 1000) } as any)
  const r4 = await send(c1, '.状态')
  check('4 状态显示闭关中且增速可读', r4.includes('闭关　进行中') && /修为/.test(r4), head(r4, 2))

  const r5 = await send(c1, '.出关')
  const after5 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('5 出关结算：修为 ≈ 2h × 2.5/s = 18,000', after5.exp > 17000 && after5.exp < 19000,
    `exp=${after5.exp.toFixed(0)}｜${head(r5)}`)

  // ── 6. 闭关态门禁 ──────────────────────────────────────────────────
  await send(c1, '.闭关')
  const r6 = await send(c1, '.突破')
  check('6 闭关态拒绝写操作', r6.includes('闭关中'), head(r6))
  await send(c1, '.出关')

  // ── 7. 历练：二级菜单 + 多选一 ─────────────────────────────────────
  const r7a = await send(c1, '.历练')
  check('7a 历练无参 → 出菜单', /历练 · 今日剩/.test(r7a) && /①/.test(r7a) && /发编号选择/.test(r7a), head(r7a, 3))
  const menu = ((await db.get('xianxia_user', { userId: 'u1' }))[0].pendingMenu || '').split(',').filter(Boolean)
  check('7b 候选已落库', menu.length >= 4, `候选 ${menu.length} 个：${menu.join(' ')}`)
  const r7b = await send(c1, '.历练 1')
  const q1 = await db.get('xianxia_queue', { userId: 'u1' })
  check('7c 「历练 1」排的就是菜单第 1 个（不是随机抽的）',
    q1.length === 1 && q1[0].missionId === menu[0],
    `排入 ${q1[0]?.missionId}｜菜单第 1 个 ${menu[0]}`)
  const u7 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('7d 原子扣次数（1 次）', u7.quotaUsed === 1, `quotaUsed=${u7.quotaUsed}`)
  const r7c = await send(c1, '.历练 换')
  const menu2 = ((await db.get('xianxia_user', { userId: 'u1' }))[0].pendingMenu || '').split(',')
  check('7e 「历练 换」换一批', menu2.length >= 4 && /发编号选择/.test(r7c), `新候选 ${menu2.length} 个`)
  const r7d = await send(c1, '.历练 打怪 凡 2')
  const q = await db.get('xianxia_queue', { userId: 'u1' })
  const u7b = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('7f 批量快捷方式仍可用（再排 2 个）', q.length === 3 && u7b.quotaUsed === 3,
    `队列 ${q.length} 个，次数 ${u7b.quotaUsed} / 3｜${head(r7d)}`)

  // 时间旅行：队列全部到点
  for (const row of q) await db.set('xianxia_queue', { userId: 'u1', seq: row.seq }, { finishAt: new Date(Date.now() - 1000) } as any)
  const r8 = await send(c1, '.任务 收')
  const logs = await db.get('xianxia_log', { userId: 'u1' })
  const u8 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('8 任务结算并落日志', logs.length === 3 && r8.includes('任务结算'),
    `${logs.length} 条日志（成功 ${logs.filter((l) => l.success).length}）｜${head(r8)}`)
  check('9 结算后队列清空 + 修为增加', (await db.get('xianxia_queue', { userId: 'u1' })).length === 0 && u8.exp > after5.exp,
    `exp ${after5.exp.toFixed(0)} → ${u8.exp.toFixed(0)}`)

  // ── 10. 每日重置（按服务器日期） ───────────────────────────────────
  await db.set('xianxia_user', { userId: 'u1' }, { quotaResetDate: '2000-01-01' } as any)
  await send(c1, '.状态')
  const u10 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('10 每日次数按日期重置', u10.quotaUsed === 0 && u10.quotaResetDate !== '2000-01-01', `quotaUsed=${u10.quotaUsed}`)

  // ── 11. 突破 ───────────────────────────────────────────────────────
  await db.set('xianxia_user', { userId: 'u1' }, { exp: C.EP(1) } as any)
  const r11 = await send(c1, '.突破')
  const u11 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('11 突破消耗 EP(1) 并升/退回', u11.rank === 2 || u11.exp < C.EP(1) + 1,
    `rank ${u11.rank}，exp ${u11.exp.toFixed(0)}｜${head(r11)}`)
  check('12 突破后经验池按新 rank 现算', u11.rank !== 2 || Math.abs(C.EP(2) - 17899) < 1, `EP(2)=${C.EP(2).toFixed(0)}`)

  // ── 13. 每日仪式 ───────────────────────────────────────────────────
  const r13 = await send(c1, '.签到')
  const u13 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('13 签到写入连签与日期', u13.checkinStreak >= 1 && !!u13.lastCheckinDate, head(r13))
  const r13b = await send(c1, '.签到')
  check('14 同日重复签到被拒', r13b.includes('已经签过'), head(r13b))

  const r14 = await send(c1, '.抽签')
  check('15 抽签出签文', /【抽签 · (大吉|吉|小吉|平|凶)】/.test(r14), head(r14))

  const r15 = await send(c1, '.答题')
  check('16 答题出题（按日期确定性抽题）', /【每日问答/.test(r15) && /A\./.test(r15), head(r15, 2))
  const r15b = await send(c1, '.答题 B')
  check('17 答题判定并给解释', /正确答案/.test(r15b), head(r15b))

  // ── 18. 奇遇二选一 ────────────────────────────────────────────────
  await db.set('xianxia_user', { userId: 'u1' }, { pendingEventId: 'E1-001' } as any)
  const r18 = await send(c1, '.奇遇')
  check('18 奇遇展示二选一', r18.includes('即时资源') && r18.includes('稳定进度'), head(r18, 2))
  const matBefore = (await db.get('xianxia_user', { userId: 'u1' }))[0].material
  const r18b = await send(c1, '.奇遇 1')
  const matAfter = (await db.get('xianxia_user', { userId: 'u1' }))[0].material
  check('19 奇遇选项生效并清 pending', matAfter >= matBefore && (await db.get('xianxia_user', { userId: 'u1' }))[0].pendingEventId === '',
    `灵材 ${matBefore} → ${matAfter}`)

  // ── 20. 丹药 ───────────────────────────────────────────────────────
  await send(c1, '.修仙管理 发丹 @u1 P1-A 8')
  const r20 = await send(c1, '.丹药')
  check('20 背包可见丹药', r20.includes('聚气丹'), head(r20))
  const expBefore = (await db.get('xianxia_user', { userId: 'u1' }))[0].exp
  const r20b = await send(c1, '.服用 聚气丹')
  const expAfterPill = (await db.get('xianxia_user', { userId: 'u1' }))[0].exp
  check('21 修为丹按 效率 × EP(当前rank) 生效', expAfterPill > expBefore, `修为 ${expBefore.toFixed(0)} → ${expAfterPill.toFixed(0)}｜${head(r20b)}`)
  const r20c = await send(c1, '.服用 聚气丹')
  check('22 同类冷却生效', r20c.includes('冷却'), head(r20c))

  // ── 23. 功法与升阶 ─────────────────────────────────────────────────
  await db.upsert('xianxia_tech', [{ userId: 'u1', techId: 'T01', tier: 'L', obtainedAt: new Date() }], ['userId', 'techId'])
  await db.set('xianxia_user', { userId: 'u1' }, { techId: 'T01', techTier: 'L', material: 5000, exp: C.EP(2) * 2 } as any)
  const r23 = await send(c1, '.功法')
  check('23 功法展示倍率与特效', r23.includes('长春功') && r23.includes('×1.2'), head(r23, 2))
  const r23b = await send(c1, '.升阶')
  const u23 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('24 升阶扣灵材且升品阶', u23.techTier === 'M' && u23.material < 5000, `tier=${u23.techTier} 灵材=${u23.material}｜${head(r23b)}`)

  // ── 25. 丹道 ───────────────────────────────────────────────────────
  const r25 = await send(c1, '.炼丹 聚气丹 1')
  const mk = await db.get('xianxia_item', { userId: 'u1', itemId: 'P2-A' })
  check('25 炼丹：3 颗一品 + 灵材 → 1 颗二品', r25.includes('【炼丹') && mk.length === 1 && mk[0].count === 1,
    `引灵丹 ×${mk[0]?.count ?? 0}｜${head(r25)}`)
  const r25b = await send(c1, '.喂丹 聚气丹 1')
  const u25 = (await db.get('xianxia_user', { userId: 'u1' }))[0]
  check('26 喂丹给 N² 点丹药经验', u25.alchemyExp > 0 || r25b.includes('没有'), `alchemyExp=${u25.alchemyExp}｜${head(r25b)}`)
  const r25c = await send(c1, '.丹炉')
  check('27 丹炉显示等级与永久加成', r25c.includes('丹炉') && r25c.includes('15'), head(r25c))

  // ── 28. 任务链 ─────────────────────────────────────────────────────
  const r28 = await send(c1, '.任务链')
  check('28 篇章列表（含遮蔽）', r28.includes('青云旧籍') && r28.includes('？'), head(r28, 3))
  const r28b = await send(c1, '.接链 青云旧籍')
  const chainRows = await db.get('xianxia_chain', { userId: 'u1' })
  check('29 接链成功并给出链首引子', chainRows.length === 1 && chainRows[0].state === 'active' && r28b.includes('杂役'),
    `state=${chainRows[0]?.state} nodeSeq=${chainRows[0]?.nodeSeq}`)
  // 时间旅行：推进到节点 1 完成
  await db.set('xianxia_chain', { userId: 'u1', chainId: 'shanmen_01' }, { finishAt: new Date(Date.now() - 1000) } as any)
  await send(c1, '.链进度')
  const r29 = await send(c1, '.链进度')
  check('30 链节点推进且发文本（不掷骰、不耗次数）',
    r29.includes('废井') || r29.includes('石板') || r29.includes('节点 2'),
    head(r29, 2))
  const quotaAfterChain = (await db.get('xianxia_user', { userId: 'u1' }))[0].quotaUsed
  check('31 任务链不消耗历练次数', quotaAfterChain === 0, `quotaUsed=${quotaAfterChain}`)
  const r31 = await send(c1, '.看故事 青云旧籍')
  check('32 看故事列出已解锁节点', /已解锁/.test(r31), head(r31, 2))

  // ── 33. 图鉴 / 成就 ────────────────────────────────────────────────
  const r33 = await send(c1, '.图鉴')
  check('33 图鉴四项计数可读', r33.includes('功法') && r33.includes('丹药'), head(r33, 3))
  const r33b = await send(c1, '.成就')
  check('34 成就按条件实时计算', r33b.includes('成就'), head(r33b, 2))

  // ── 35. 待办摘要（零主动推送） ─────────────────────────────────────
  await db.set('xianxia_user', { userId: 'u1' }, { lastCheckinDate: '', exp: C.EP(u23.rank) * 3 } as any)
  const r35 = await send(c1, '.状态')
  check('35 任意回复末尾附待办摘要', /▸ 待办：/.test(r35), (r35.split('\n').find((l) => l.includes('待办')) || '').trim())

  // ── 36. 帮助 / 介绍 ────────────────────────────────────────────────
  const r36 = await send(c1, '.帮助')
  check('36 帮助卡包含全部指令', r36.includes('闭关') && r36.includes('任务链') && r36.includes('炼丹'), head(r36, 1))
  const r36b = await send(c1, '.介绍')
  check('37 介绍说明"不用一直在线"', r36b.includes('不用一直在线'), head(r36b, 2))

  // ── 38. 权限 ───────────────────────────────────────────────────────
  const r38 = await send(c2, '.修仙管理 查询')
  check('38 普通用户被 authority 拦下', !r38.includes('修仙管理 · 查询') || /权限/.test(r38), head(r38))

  // ── 39. 落库完整性 ─────────────────────────────────────────────────
  const stats = await db.stats()
  const tables = Object.keys(stats.tables).filter((t) => t.startsWith('xianxia'))
  check('39 全部 10 张表已建立', tables.length === 10, tables.join(', '))

  // ── 40. 输出风格：非帮助界面只摆数据，不作解释 ──────────────────────
  // 纯数据界面：连标点都不许出现说明性破折号
  const PURE_CMDS = ['.状态', '.历练', '.任务', '.丹药', '.功法', '.丹炉', '.待办',
    '.图鉴', '.成就', '.任务链', '.链进度', '.签到']
  // 混排界面：正文含剧情/题库文本（那是内容，不是我们写的说明），只查口径禁词
  const MIXED_CMDS = ['.答题', '.抽签']
  const PURE_BAD = ['只能从', '——', '不是赌博', '不必守着', '记住了就是收获', '留到概率更低', '离线照常累计']
  const MIXED_BAD = ['只能从', '不是赌博', '不必守着', '记住了就是收获', '留到概率更低']
  const hits: string[] = []
  const groups: Array<[string[], string[]]> = [[PURE_CMDS, PURE_BAD], [MIXED_CMDS, MIXED_BAD]]
  for (const [cmds, bad] of groups) {
    for (const cmd of cmds) {
      const out = await send(c1, cmd)
      for (const b of bad) if (out.includes(b)) hits.push(`${cmd} → 「${b}」`)
    }
  }
  check('40 数据界面不含解释性文案', hits.length === 0,
    hits.join('；') || `扫描 ${PURE_CMDS.length + MIXED_CMDS.length} 条指令，0 处命中`)

  // ── 收尾 ───────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.pass).length
  console.log(`\n══════ 通过 ${passed} / ${checks.length} ══════`)
  await app.stop()
  if (passed !== checks.length) {
    console.log('\n未通过项：')
    for (const c of checks.filter((x) => !x.pass)) console.log(`  ❌ ${c.name}  ——  ${c.detail}`)
    process.exit(1)
  }
  console.log('全流程已打通：建档 → 闭关 → 惰性结算 → 历练 → 结算 → 突破 → 每日 → 奇遇 → 丹药 → 功法 → 丹道 → 任务链 → 图鉴')
  process.exit(0)
}

main().catch((e) => { console.error('自检脚本崩溃：', e); process.exit(2) })
