[简体中文](README.md) / [English](README_en.md)

# harvest-auto

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [日报格式示例](#日报格式示例)
- [工时分配逻辑](#工时分配逻辑)
- [命令参考](#命令参考)
- [常见问题 FAQ](#常见问题-faq)
- [反馈与贡献](#反馈与贡献)
- [更新日志](#更新日志)

---

## 项目简介

**harvest-auto** 是一款专为 Harvest 工时系统打造的智能化自动日报填报工具。
它支持命令行直接使用，也可以作为 Node.js 模块集成到 CI/自动化流程，显著提升团队批量统计、日常汇报与个人效率。

---

## 核心特性

- **多种日报格式**
  - 原生 JSON 数组
  - 标签式输入（如 `[project:XXX][task:YYY] 工作内容`，支持全局和行内灵活结合）
- **项目/任务灵活声明优先级**
  - 可全局声明，也可单行独立声明，自动继承，无需多次重复填写
- **智能工时分配**
  - 每事项自动分配 1.46~3 小时，总工时 8~10 小时，分配自然合理，贴合真实场景
- **精准异常提示**
  - 配置缺失、API 异常、格式不符等都会详细提示并定位到具体天/项
- **强健配置/路径处理**
  - 支持文件拖拽，中文/空格/特殊字符路径自动净化
  - 全局/本地 .env 自动引导，支持命令便捷修改配置，支持中英文界面
  - 运行中随时 Ctrl+C 终止

---

## 快速开始

### 安装

**推荐全局安装：**
```bash
npm install -g @whtg/harvest-auto
```

**常用命令：**
```bash
harvest-auto
harvest-auto -f "/完整/路径/日报文件"
harvest-auto -f "/完整/路径/日报文件" --dry-run
harvest-auto -c      # 修改/引导填写 env 配置
harvest-auto -h      # 显示帮助
```
> 也可用 npx 临时运行（无需全局安装）：
> `npx harvest-auto -f "/完整/路径/日报文件"`

---

## 环境配置

首次运行按提示填写，自动生成配置；如需手动编辑，可修改 `~/.harvest-auto.env`。主要配置说明如下：

| 配置项               | 示例值                   | 说明                   |
|--------------------|------------------------|----------------------|
| HARVEST_ACCOUNT_ID | 123456                 | Harvest 账户 ID        |
| HARVEST_TOKEN      | yyy                    | Harvest 的 API Token   |
| USER_AGENT         | someone@example.com    | API 请求标识用邮箱     |
 HARVEST_AUTO_LANG    | CN / EN                     | Language (CN = Chinese, EN = English)|
| PROJECT_MAP        | {"A":123456,"B":33333} | 项目名与ID对应关系     |
| TASK_MAP           | {"开发":12345,"测试":1} | 任务名与ID对应关系     |

---

## 日报格式示例

### 1. 标签式（强烈推荐）

```md
2025-07-01
[project:AAA][task:BBB]
内容A
内容B
[project:SC]
[task:CCC]内容C
内容D
```

**解析规则：**
- 行内标签（如 `[task:CCC]内容C`）只影响所在行，优先级最高
- 全局声明（如单行 `[project:SC]`）影响后续未再独立声明的内容
- 标签缺失时报错，需补全

**解析示例结果：**
```json
[
  {
    "date": "2025-07-01",
    "items": [
      { "project": "AAA", "task": "BBB", "notes": "内容A" },
      { "project": "AAA", "task": "BBB", "notes": "内容B" },
      { "project": "SC",  "task": "CCC", "notes": "内容C" },
      { "project": "SC",  "task": "BBB", "notes": "内容D" }
    ]
  }
]
```

### 2. 标准 JSON 格式

```json
[
  {
    "date": "2025-06-01",
    "items": [
      { "project": "A", "task": "开发", "notes": "xxx" }
    ]
  }
]
```

---

## 工时分配逻辑

- 每事项分配 **1.46~3 小时**，每日总工时 **8~10 小时**，无需手动填写
- 分配失败时不会中断，前 n-1 项分配最小工时，最后一项补足剩余（超额仅日志警告）
- 明细条目不符预期或工时不合理，会在命令行详细提醒用户人工复查
- Harvest API 网络 502 错误自动重试最多 3 次，稳定性高

---

## 命令参考

```
harvest-auto -f <日报文件> [选项]
```

| 选项                 | 说明                                      |
|--------------------|-----------------------------------------|
| -f, --file <file>  | 日报文件路径，支持 .json/.md/.txt/.daylog|
| --dry-run          | 仅打印将要导入的内容，不实际请求           |
| -h, --help         | 显示帮助信息                              |
| -c, --change       | 更改 env 配置（自动引导填写）             |

---

## 常见问题 FAQ

- **Q: 报“缺 project/task”？**
  A: 请补全 `[project:XXX][task:YYY]`，也可单独用一行声明全局（作用后续）
- **Q: 报“未配置映射”？**
  A: 编辑 `PROJECT_MAP`/`TASK_MAP` 增加对应条目，格式为 `{"名称":123456}`
- **Q: 工时分配看起来不均怎么办？**
  A: 命令行会有详细警告提示，建议适当调整条目数量或内容
- **Q: 进程如何强制终止？**
  A: 直接按下 Ctrl+C 即可

---

## 反馈与贡献

如发现 bug、疑惑或有新需求，欢迎直接提交 Issue 或 PR，让工具变得更好！

---

## 更新日志（Changelog）

### 1.0.7
- 优化初始化/更改配置时的 Ctrl+C 友好中止体验，无堆栈输出；
- 首次语言选择支持智能预设，仅选一次即可，无需重复输入；
- 多语言支持字段规范为 HARVEST_AUTO_LANG，取值 CN/EN，文档与实际代码一致；
- 文档结构与 FAQ 更加清晰规范。

### 1.0.6
- 首次使用终端引导填写配置，自动保存并立即可用；
- 增加工单完成与主动终止提示；
- 支持中英文界面及命令行便捷修改配置。

### 1.0.5
- 文档说明优化。

### 1.0.4
- 工时分配范围扩展为 1.46~3 小时，日总工时 8~10 小时，分布更加灵活；
- 工时分配失败自动兜底并提示，无需手动干预；
- 502 等 Harvest API 错误自动重试 3 次，增强稳定性；
- 日志与文档同步优化。
