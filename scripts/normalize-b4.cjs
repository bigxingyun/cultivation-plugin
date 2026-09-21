// 规范化 b4.md：与 b3.md 保持同一文本约定
//   1) 去掉 UTF-8 BOM（b3 没有；BOM 也会让父代理的分节检测失效）
//   2) 统一 LF 行尾（b3 全是 LF）
//   3) 去掉行尾多余空格（保护 markdown 硬换行的两个空格——本文件不用该语法）
//   4) 结尾恰好一个换行
//   5) 空行数量归一（连续空行压成一个）
const fs = require('fs')
const p = 'E:/koshi/插件/基础/_frag/b4.md'

let s = fs.readFileSync(p, 'utf8')
if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
s = s.replace(/\r\n?/g, '\n')
s = s.split('\n').map((l) => (/ {2,}$/.test(l) ? l.replace(/ +$/, '  ') : l.replace(/[ \t]+$/, ''))).join('\n')
s = s.replace(/\n{3,}/g, '\n\n')
s = s.replace(/\n*$/, '\n')

fs.writeFileSync(p, s)
console.log('已规范化：去 BOM / LF 行尾 / 去行尾空格 / 压缩连续空行 / 结尾单换行')
