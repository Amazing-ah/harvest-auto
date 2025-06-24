#!/usr/bin/env node
/**
 * harvest-auto CLI 工具
 * 支持: 命令行导入日报JSON至Harvest (需.env配置)、也支持 require 引用
 * 路径健壮升级：自动去除路径首尾空格、引号、换行
 */
require('dotenv').config();
const { program } = require('commander');
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();
const ora = require('ora').default;

// ------ 环境变量与配置 ------

// 检查/创建用户主目录下的 .harvest-auto.env 文件
const homedir = os.homedir();
const userEnvPath = path.join(homedir, '.harvest-auto.env');

function ensureUserEnvFile() {
  if (!fs.existsSync(userEnvPath)) {
    const envTemplate = [
      'HARVEST_ACCOUNT_ID=你的Harvest账号ID',
      'HARVEST_TOKEN=你的Harvest API Token',
      'USER_AGENT=自定义标识(如 your-email@example.com)',
      'PROJECT_MAP={"项目A":项目A 的 id,"项目B":项目B 的 id}',
      'TASK_MAP={"任务A":任务A 的 id,"任务B":任务B 的 id}',
      '',
    ].join('\n');
    fs.writeFileSync(userEnvPath, envTemplate, { encoding: 'utf-8' });
    // 红色字体提醒用户手动编辑配置
    console.log(
      '\x1b[31m%s\x1b[0m',
      `\n已为你在 ${userEnvPath} 创建配置模板。\n请用文本编辑器手动编辑该文件，根据实际信息填写参数后再运行本工具。\n`
    );
    // 终止进程，待用户编辑完成后重新执行
    process.exit(0);
  }
}
// 先本地加载.env，后自动加载 ~/.harvest-auto.env（支持全局CLI）
require('dotenv').config({ path: userEnvPath });

const HARVEST_ACCOUNT_ID = process.env.HARVEST_ACCOUNT_ID;
const HARVEST_TOKEN = process.env.HARVEST_TOKEN;
const USER_AGENT = process.env.USER_AGENT;

let PROJECT_MAP = {};
try {
  PROJECT_MAP = JSON.parse(process.env.PROJECT_MAP || '{}');
} catch (e) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    '\n[配置错误] PROJECT_MAP 配置不是合法 JSON，请编辑 ~/.harvest-auto.env 按如下格式：\n\nPROJECT_MAP={"项目A":12345,"项目B":67890}\n'
  );
  process.exit(1);
}

let TASK_MAP = {};
try {
  TASK_MAP = JSON.parse(process.env.TASK_MAP || '{}');
} catch (e) {
  console.error(
    '\x1b[31m%s\x1b[0m',
    '\n[配置错误] TASK_MAP 配置不是合法 JSON，请编辑 ~/.harvest-auto.env 按如下格式：\n\nTASK_MAP={"任务A":11111,"任务B":22222}\n'
  );
  process.exit(1);
}

// ------ 工时生成 ------
function getRandomHours() {
  return Math.round((Math.random() + 1.5) * 10) / 10;
}

// ------ Harvest接口 ------
async function createTimeEntry({ date, project, task, notes, hours }) {
  const project_id = PROJECT_MAP[project];
  const task_id = TASK_MAP[task];
  if (!project_id) throw new Error(`项目[${project}]未配置映射`);
  if (!task_id) throw new Error(`任务[${task}]未配置映射`);

  const data = { project_id, task_id, spent_date: date, hours, notes };

  return axios({
    url: 'https://api.harvestapp.com/v2/time_entries',
    method: 'post',
    headers: {
      'Harvest-Account-Id': HARVEST_ACCOUNT_ID,
      Authorization: `Bearer ${HARVEST_TOKEN}`,
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/json',
    },
    data,
  });
}

// ------ 核心导入逻辑（可单独require引用） ------
/**
 * 导入所有日报，每日总工时保证 >=8 小时，单条工时随机，最后一条补足。
 */
async function fillAllReports(dailyReports) {
  for (const { date, items } of dailyReports) {
    const arrLen = items.length;
    // 先为每条明细分配初始随机工时（1.5-2.5）
    let hoursArr = Array.from(
      { length: arrLen },
      () => Math.round((Math.random() + 1.5) * 10) / 10
    );
    let sum = hoursArr.reduce((a, b) => a + b, 0);

    // 如果当天总时长 < 8 小时，则补足差值
    if (sum < 8 && arrLen > 0) {
      const diff = 8 - sum;
      if (arrLen === 1) {
        hoursArr[0] = Math.round((hoursArr[0] + diff) * 10) / 10;
      } else {
        // 前n-1条加少量，最后一条补齐
        const perAdd = Math.floor((diff / arrLen) * 10) / 10;
        for (let i = 0; i < arrLen - 1; i++) {
          hoursArr[i] = Math.round((hoursArr[i] + perAdd) * 10) / 10;
        }
        // 最后一条直接用目标总量-前n-1条累加
        const partialSum = hoursArr
          .slice(0, arrLen - 1)
          .reduce((a, b) => a + b, 0);
        hoursArr[arrLen - 1] = Math.round((8 - partialSum) * 10) / 10;
      }
      // 理论上总和正好8，如果分配有偏差（浮点误差），完全可忽略
    }

    for (let i = 0; i < arrLen; i++) {
      const item = items[i];
      const hours = hoursArr[i];
      // 使用 ora 动画
      const spinner = ora(
        `工时填写中: ${date} | ${item.project} - ${item.task} ...`
      ).start();

      try {
        await createTimeEntry({
          ...item,
          date,
          hours,
        });
        spinner.succeed(
          `✔ 填报成功 | ${date} | ${item.project} - ${item.task} | ${hours}h | ${item.notes}`
        );
      } catch (err) {
        spinner.fail(
          `✗ 填报失败 | ${date} | ${item.project} - ${item.task} | ${item.notes}\n${err.response?.data || err.message || err}`
        );
      }
    }
  }
}

module.exports = { fillAllReports };

// ------ CLI部分 ------
if (require.main === module) {
  ensureUserEnvFile();

  program
    .name('harvest-auto')
    .usage('-f <日报json> [options]')
    .description(
      '一键导入日报到Harvest的CLI工具，需配置.env 或 ~/.harvest-auto.env'
    )
    .option('-f, --file <file>', '日报JSON文件路径')
    .option('--dry-run', '仅打印将要导入的内容，不实际请求')
    .helpOption('-h, --help', '显示帮助信息')
    .parse(process.argv);

  let { file, dryRun } = program.opts();

  // 路径净化函数：去除首尾空格、引号和换行
  function cleanPath(val) {
    if (!val) return val;
    return val
      .trim()
      .replace(/^"+|"+$/g, '')
      .replace(/\r?\n/g, '');
  }

  (async () => {
    try {
      // 如未指定文件参数，则用inquirer交互获取
      if (!file) {
        const { inputFile } = await prompt([
          {
            type: 'input',
            name: 'inputFile',
            message: '请输入日报 JSON 文件的路径（可拖入/粘贴完整路径）：',
            validate(val) {
              let p = cleanPath(val);
              if (p.startsWith('~')) {
                p = path.join(process.env.HOME, p.slice(1));
              }
              if (!fs.existsSync(p)) {
                return `找不到此文件（处理后路径：${p}），请确认路径输入正确。`;
              }
              return true;
            },
          },
        ]);
        file = inputFile;
      }

      // 确认环节和后续都清理路径
      let p = cleanPath(file);
      if (p.startsWith('~')) {
        p = path.join(process.env.HOME, p.slice(1));
      }
      const { confirmRead } = await prompt([
        {
          type: 'confirm',
          name: 'confirmRead',
          message: `你设置的日报 JSON 路径为：\n${p}\n是否确认无误？`,
          default: true,
        },
      ]);
      if (!confirmRead) {
        console.log('已取消操作。');
        process.exit(0);
      }

      let dailyReports = [];
      try {
        const content = fs.readFileSync(p, 'utf-8');
        dailyReports = JSON.parse(content);
      } catch (e) {
        console.error('读取日报 JSON 文件失败:', e.message || e);
        process.exit(1);
      }

      if (dryRun) {
        console.log(JSON.stringify(dailyReports, null, 2));
        console.log('[dry-run] 未实际上报。');
      } else {
        await fillAllReports(dailyReports);
      }
    } catch (err) {
      if (err && err.name === 'ExitPromptError') {
        console.log('\n已取消操作。');
        process.exit(0);
      }
      throw err;
    }
  })();
}
