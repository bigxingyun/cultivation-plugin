# 修仙挂机 · Koishi 插件

Koishi 4.18 上的中文修仙挂机插件。核心机制为**时间戳惰性结算**，适配 QQ 等被动消息平台（无定时推送依赖）。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Koishi](https://img.shields.io/badge/Koishi-4.18+-green.svg)](https://koishi.chat)

## 状态

开发中，非生产就绪。数值、数据结构与指令输出可能变更，存档不保证兼容。

当前：31 条指令、60 项流程自检通过；192 条任务中 174 条为占位叙事，19 条任务链中 12 条正文未写。

## 架构要点

| 项 | 说明 |
| --- | --- |
| 结算 | 闭关、历练队列、链节点、每日重置均在用户下次交互时按时间戳结算 |
| 数值 | 公式集中于 `external/koishi-plugin-xianxia-idle/src/core/curves.ts` |
| 输出 | 单源 `Body`，`core/render.ts` 渲染为纯文本或 Markdown（平台 `qq`） |
| 数据 | 设计文档位于 `插件/基础/`；`src/data/*.ts` 由 `npm run gen` 生成 |

公比 1.037，`EP(1)=16,500`；纯闭关满级约 856.9 h，含突破折损约 58 天。

## 功能范围

| 模块 | 内容 |
| --- | --- |
| 修炼 | 闭关、突破，9 境界 × 9 层（81 rank） |
| 历练 | 菜单多选、队列、惰性结算 |
| 每日 | 签到、抽签、问答、奇遇、天机 |
| 成长 | 丹药、功法、炼丹、丹炉 |
| 叙事 | 7 条任务链（42 节点）、图鉴、成就 |

未实现：12 条高境界任务链正文、排行榜 PvP、图片帮助、飞升转生。

## 快速开始

```sh
git clone git@github.com:bigxingyun/koishi-plugin-cultivation.git
cd koishi-plugin-cultivation
npm install
npm run dev
```

控制台：http://127.0.0.1:5140 ，沙盒发指令。前缀见 `koishi.yml`（`.` 或 `/`）。

调试时可修改 `data/koishi.db` 中 `finishAt` / `seclusionStart` 为过去时间以跳过等待。

## 目录

```
koishi.yml
external/koishi-plugin-xianxia-idle/src/
  core/curves.ts      数值公式
  core/render.ts      双通道渲染
  game.ts             模型与惰性结算
  commands/           指令实现
插件/基础/             设计文档（真源）
scripts/smoke-xianxia.ts
scripts/golden-render.ts
docs/输出/             渲染回归快照
```

## 测试

```sh
npm run smoke:game    # 60 项集成自检
npm run golden:check  # 65 指令 × text/markdown 快照与指纹
npm run probe:style   # 数据界面样张（人工排版）
```

## 开发约定

1. 数值与配额以 `插件/基础/开发游戏设定.md` 为准；冲突按文档权威顺序上报，不静默改数。
2. 数据界面仅展示数据；规则与引导写入 `帮助` 或 `▸ 待办`（§4.4.1）。
3. 指令输出统一经 `shell` / `emit` 与 `core/render.ts`（§4.4.2）。

详见 [`docs/开发笔记.md`](docs/开发笔记.md)。

## 限制

- 已验证：Koishi 4.18 + SQLite
- Markdown：QQ 官方机器人（`qq`）；`qqguild` 回退纯文本
- 配置项 `render: text` 可强制纯文本

## 许可

[GPL-3.0](LICENSE)
