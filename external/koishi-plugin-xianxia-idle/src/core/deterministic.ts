/** 确定性伪随机：按种子从数组取元素，不依赖 Math.random()（每日题库等须跨刷新稳定）。 */

const FNV_OFFSET = 2166136261
const FNV_PRIME = 16777619

export function fnv1a (seed: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

export function pickBySeed<T> (arr: T[], seed: string): T {
  if (!arr.length) throw new RangeError('pickBySeed: empty array')
  return arr[fnv1a(seed) % arr.length]
}
