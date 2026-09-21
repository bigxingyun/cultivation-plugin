/** 输出格式化：所有面向玩家的数字都从这里过一遍，保证格式一致（《游戏结构与命令设计.md》§4.4） */

const N = (x: number, d = 0) => x.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** 千分位整数 */
export function num (x: number): string {
  return N(Math.round(x))
}

/** 一位小数 */
export function f1 (x: number): string {
  return x.toFixed(1)
}

/** 百分比，一位小数 */
export function pct (x: number, d = 1): string {
  return `${(x * 100).toFixed(d)}%`
}

/** 进度条：10 格 */
export function bar (ratio: number): string {
  const filled = Math.max(0, Math.min(10, Math.round(ratio * 10)))
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

/** 时长：<1h → N 分钟；<1d → N 小时 M 分；≥1d → N 天 M 小时 */
export function dur (seconds: number): string {
  seconds = Math.max(0, seconds)
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.round((seconds % 3600) / 60)
    return m ? `${h} 小时 ${m} 分` : `${h} 小时`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.round((seconds % 86400) / 3600)
  return h ? `${d} 天 ${h} 小时` : `${d} 天`
}

/** 「还需约 29 分钟」
 *  进度不足时**必须换算成时间**——只说"修为不足"玩家无法判断要等多久（§4.5 A5）。 */
export function eta (missingExp: number, ratePerSec: number): string {
  if (ratePerSec <= 0) return '（未闭关，修为不增长）'
  return `还需约 ${dur(missingExp / ratePerSec)}`
}

/** 千分位（与 num 同口径：§4.4 规定所有面向玩家的数字都带千分位） */
export function amount (x: number): string {
  return num(x)
}

export function bullet (label: string, value: string): string {
  return `${label}　${value}`
}

/** 统一标题行 */
export function title (text: string): string {
  return `【${text}】`
}
