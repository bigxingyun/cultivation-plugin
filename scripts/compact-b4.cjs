// 一次性修补：把 b4 的卡片布局转成 b1/b2/b3 的紧凑布局
//   before:  #### id ...【占位】 / 空行 / intro / success / fail
//   after:   #### id ...【占位】 / intro / success / fail
// 理由：b1/b2/b3 是紧凑布局，父代理的 _verify.js（取 i+1..i+3 为三行正文、i+4 为空行）
//       正是按紧凑布局写校验的。统一成紧凑布局，两套校验都能过。
const fs = require('fs')
const p = 'E:/koshi/插件/基础/_frag/b4.md'
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)

const out = []
let fixed = 0
for (let i = 0; i < lines.length; i++) {
  out.push(lines[i])
  if (lines[i].startsWith('#### ') && lines[i + 1] === '') {
    i++          // 吃掉标题后的空行
    fixed++
  }
}

fs.writeFileSync(p, out.join('\n'))
console.log(`已移除标题后空行 ${fixed} 处（应为 48）`)
