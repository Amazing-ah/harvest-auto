# harvest-auto

## 简介

**harvest-auto** 是一个面向 Harvest 工时系统的智能日报填报工具，支持命令行直接使用，也可作为 Node.js 模块集成进 CI/自动化等业务流。
该工具极大提升团队批量工时统计、日常汇报和个人高效填报 Harvest 的便利性。

---

## 主要特性

- **支持多种日报格式**
  - 原生 JSON 数组
  - 标签化（如 `[project:XXX][task:YYY] 日志内容`，全局/单条任意组合）

- **项目、任务可全局声明或精细到每条优先级**
  - `[project:Web]` / `[task:Android]` 可以单独设置，也可某一天全局声明
  - 行内标签优先于全局声明，不用每条都重复写


- **工时智能分配**
  - 每条事项自动分配 1.46~3 小时（通常分布于 2 小时附近，有轻度浮动）
  - 每天总时长自动分配在 8~10 小时，分配合理、自然且各天不同

- **精准错误提示**
  - 缺少 project 或 task、映射异常、API 错误、格式不符均详细提示并停报（不影响其他天）

- **CLI & Node.js 友好集成**
  - 命令行支持，自动路径优化、可 dry-run
  - 支持直接以模块方式调用, 如：
    ```js
    const { fillAllReports } = require('./index');
    fillAllReports(dailyReportsArray);
    ```

- **路径/配置健壮**
  - 可直接拖入文件
  - 支持中文、空格、符号路径粘贴（自动净化路径）
  - 全局/本地 .env 自动引导与校验（首次运行自动生成 `~/.harvest-auto.env`）
  - 可以在运行中使用 ctrl + c 停止进程

---

## 快速开始

### 安装

**全局安装（推荐）：**
```bash
npm install -g @whtg/harvest-auto
```

然后你可以在任何位置直接使用如下命令（文件不限于 txt，支持 .json/.md/.txt 等格式）：
```bash
harvest-auto
harvest-auto -f "/完整/路径/日报文件"
harvest-auto -f "/完整/路径/日报文件" --dry-run
```
或用 npx 快速调用（无需全局安装）：
```bash
npx harvest-auto
npx harvest-auto -f "/完整/路径/日报文件"
npx harvest-auto -f "/完整/路径/日报文件" --dry-run
```

----
首次运行会自动在主目录生成配置模板 `~/.harvest-auto.env`，需手动完善账号、Token 及项目/任务映射。

**本地开发模式：**
```bash
npm install
```

---

## 配置环境

编辑 `~/.harvest-auto.env`，类似如下：

```
HARVEST_ACCOUNT_ID=xxx
HARVEST_TOKEN=yyy
USER_AGENT=someone@example.com
PROJECT_MAP={"A":123456,"B":345678}
TASK_MAP={"开发":12345,"测试":45678,"Web":33333}
```

---

## 日报格式范例

### **1. 标签型**（推荐）

```md
2025-07-01
[project:AAA][task:BBB]
日志内容A
日志内容B
[project:SC]
[task:CCC]日志内容C
日志内容D

**解析结果：**
```json
[
  {
    "date": "2025-07-01",
    "items": [
      { "project": "AAA", "task": "BBB", "notes": "日志内容A" },
      { "project": "AAA", "task": "BBB", "notes": "日志内容B" },
      { "project": "SC",  "task": "CCC", "notes": "日志内容C" },
      { "project": "SC",  "task": "BBB", "notes": "日志内容D" }
    ]
  }
]
```

**说明：**
- 单条标签（如 `[task:CCC]日志内容C`）仅作用于该行，后续未再声明则回退使用最近的全局声明（如 task:BBB）。
- 全局声明（单独一行，如 `[project:SC]`）影响当前及其后的所有未声明内容。
- 继承规则与优先级：单条标签 > 最近的全局声明 > 缺失时报错。

---

**优先级说明：**
单条标签 > 全局声明（单独一行的即为全局） > 报错（缺失）

---

### **2. 标准 JSON**

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



## 工时分配说明

- 每条事项自动随机分配 **1.46~3 小时** 的工时（均值约 2 小时，不必手动填写）
- 每天总工时随机落在 **8~10 小时** 区间，各天分布不同
- 工时分配失败时不会中断，工具会兜底：前面每条分配最小工时，最后一条补足剩余（若超出最大单条上限则仅日志提醒），所有天都保证填报无遗漏
- 如明细条数与区间、总工时不符，会有详尽的日志警告提醒用户人工复查
- 遇到 Harvest API 502 网关错误时，工具会自动重试最多 3 次（每次递增等待），最大程度保证稳定填报，无需手动干预

---

## 命令行用法

```bash
harvest-auto
harvest-auto -f "/完整/路径/日报.txt"
# 可加 --dry-run 预演
harvest-auto -f "/完整/路径/日报.txt" --dry-run
```
**如果未全局安装，也可用 npx 快捷调用：**
```bash
npx harvest-auto
npx harvest-auto -f "/完整/路径/日报.txt"
npx harvest-auto -f "/完整/路径/日报.txt" --dry-run
```

- 路径含空格要用引号，路径自动净化
- 输入文件支持 `.json`, `.md`, `.txt` 等常见格式，内容自动识别

----

### 查看命令帮助

你可以通过以下命令随时查看所有参数说明：

```bash
harvest-auto -h
harvest-auto --help
```

或用 npx 时：

```bash
npx harvest-auto -h
npx harvest-auto --help
```

**命令帮助输出示例：**
```
用法:
可以直接运行harvest-auto，根据提示进行后续操作
或者
harvest-auto -f <日报文件> [options]

一键导入日报到Harvest的CLI工具，需配置.env 或 ~/.harvest-auto.env

选项:
  -f, --file <file>    日报文件路径（支持 .json/.md/.txt/.daylog 等）
  --dry-run            仅打印将要导入的内容，不实际请求
  -h, --help           显示帮助信息
```
其中：
- `-f`、`--file` ：指定要导入的日报文件（支持 .json/.md/.txt/.daylog 等格式）
- `--dry-run` ：只预览将导出的内容，不提交到Harvest
- `-h`、`--help` ：打印帮助信息

----
---

### 作为 Node.js 模块用法

```js
const { fillAllReports } = require('./index');
fillAllReports([
  { date: "2025-07-01", items: [ { project: "...", task: "...", notes: "..."} ]}
]);
```

---

## 常见问题

- **报“缺 project/task”？**
  补齐 [project:XXX][task:YYY] 或全局声明（可放前一行）

- **报“未配置映射”？**
  编辑 `PROJECT_MAP`/`TASK_MAP` 增加对应项

---

## 反馈/贡献

如有建议、Bug、需求，欢迎提 Issue 或 PR！

---

## 更新日志

### 1.0.4

- 工时分配器大幅增强：每条事项工时分配范围变为 1.46~3 小时，并以 2 小时左右为主要分布。每一天总工时随机在 8~10 小时，且各天总时长随机不同。
- 分配失败时不再报错中断，而是自动兜底（前 n-1 条分配最小，最后一条补足剩余），如超出单条最大工时，仅打印日志警告并不影响填报。
- 遇到 Harvest API 502 网关错误，则自动重试最多 3 次（递增延迟），确保网络偶发问题下自动稳定填报。
- 日志输出优化，对采样异常和超长加班等情况有详细提示但不跳过或中止。
- 文档/说明同步更新，与功能保持一致。

### 1.0.5
优化文档说明
