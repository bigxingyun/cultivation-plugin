// 最后一轮修补：3 条超字数 + 与已定稿的「守夜」重名
const fs = require('fs')
const p = 'E:/koshi/插件/基础/_frag/b4.md'
let s = fs.readFileSync(p, 'utf8')

const patches = [
  // 1) m7-5-combat-01  92 → 90（intro 里"两天走一圈"是冗余，fail 已经说了走碑）
  ['- **intro**：界碑一共十八座，两天走一圈。你要看的是刻痕有没有短。',
   '- **intro**：界碑十八座，两天一圈。你要看的是刻痕有没有短。'],

  // 2) m7-5-combat-02  95 → 90（我上一轮补的"谁也不让谁"是赘语，去掉；再把"对不上"压成"不合"）
  ['- **intro**：青蚨渡的船家不肯卸货，说账对不上。你去的时候围了三十来人，谁也不让谁。',
   '- **intro**：青蚨渡的船家不肯卸货，说账不合。你去时围了三十来人，谁也不让谁。'],

  // 3) m8-6-combat-06  99 → 89（上一轮往 intro 里补的"要核的是他手上的契。"整句删掉，改由 success 承担）
  ['- **intro**：两界之间死了一个记账的人。两边都说是对方。要核的是他手上的契。要核的是他手上的契。',
   '- **intro**：两界之间死了个记账的人。两边都说是对方。'],
  ['- **success**：你翻了死者的册子，最后一页写了两个名字，其中一个是他自己。',
   '- **success**：你核了他手上的契。契上写的是两个人共管一处，其中一个是他自己。'],

  // 4) 与已定稿第 6 条「守夜」重名 → m7-5-train-03 改为「坐更」
  ['#### m7-5-train-03 ｜ 守夜', '#### m7-5-train-03 ｜ 坐更'],
]

const failed = []
const has = (x) => s.includes(x)
let applied = 0
for (const [from, to] of patches) {
  if (has(to)) continue
  const before = s
  s = s.replace(from, to)
  if (s === before) failed.push(from.slice(0, 46)); else applied++
}
fs.writeFileSync(p, s)
console.log(`应用 ${applied} 条`, failed.length ? '\n❌ 未命中:\n' + failed.join('\n') : '')
