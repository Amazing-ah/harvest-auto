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
  - 每条事项自动分配 1.4~2.4 小时不等、全部不同
  - 每天总时长自动保证大于等于 8 小时，分布自然且有波动

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
[project:Web][task:Notify] 日志内容A
[task:Review] 日志内容B
[project:SC] 日志内容C
无标签的内容D（自动继承最近的全局声明）

2025-07-02
[project:SC]                # 全局声明本段 project
[task:Web] 内容1            # 单条 task 覆盖
[task:Android] 内容2        # 单条 task 覆盖
内容3                       # 继承 [project:SC]，如果有全局 task 也可继承

2025-07-03
[project:Web][task:Review]  # 全局声明
业务重构                    # 继承全局 project/task
需求沟通                    # 继承全局
[project:App] UI联调         # 单条 project 覆盖，全局 task

2025-07-04
[project:API]
[task:开发]
A模组实现                   # 继承全局
B模组重构                   # 继承全局
[task:复盘] C模块问题讨论     # 仅 task 局部覆盖，全局 project
[project:UI][task:测试] UI反馈 # 全部局部覆盖

2025-07-05
[project:Web]
内容A
内容B
[project:App]
内容C
内容D    # 不同天/不同段可多次声明 project，切换极其灵活
```

**优先级说明：**
单条标签 > 全局声明（同一段内可多次全局切换） > 报错（缺失）

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

- 每条事项自动分配 1.4~2.4 小时的**随机不重复工时**
- 总和自动 ≥8 小时，分布更像自然人工填报
- 不必自己人工填写工时

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
