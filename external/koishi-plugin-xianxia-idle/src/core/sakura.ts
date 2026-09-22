/** 樱花 API（dmoe.cc）随机图：失败静默，不影响正文。 */

import type { Context } from 'koishi'

const JSON_ENDPOINT = 'https://www.dmoe.cc/random.php?return=json'
/** 部分适配器可直接跟跳转到图床 */
const DIRECT_ENDPOINT = 'https://www.dmoe.cc/random.php'
const TIMEOUT_MS = 2800

interface SakuraPayload {
  code?: string | number
  source?: string
  imgurl?: string
}

/** 拉取直链；JSON 失败时回退到 random.php（由适配器跟随跳转）。 */
export async function fetchSakuraImage (ctx: Context): Promise<string | null> {
  try {
    const data = await ctx.http.get<SakuraPayload>(JSON_ENDPOINT, {
      timeout: TIMEOUT_MS,
      responseType: 'json',
    })
    const url = String(data?.source || data?.imgurl || '').trim()
    if (url.startsWith('http') && (data?.code == null || String(data.code) === '200')) {
      return url
    }
  } catch {
    // fall through
  }
  return DIRECT_ENDPOINT
}
