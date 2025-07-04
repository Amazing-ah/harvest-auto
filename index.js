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
const {
  parseMarkdownToDailyReports,
} = require('./utils/markdownToDailyReports');
const { ensureUserEnvFileInteractive } = require('./utils/envSetup');

// ------ 环境变量与配置 ------

// ------ 工时生成 ------
// 新采样: 每条1.46-3，偏向2，确保每日总工时[8,10]且分配合理
function normalHoursArr(len, min = 1.46, max = 3, dayTotal = 8) {
  const maxTries = 200;
  // 先快速排除不合法的请求
  if (min * len > dayTotal || max * len < dayTotal) {
    throw new Error(
      '明细条数与每日总工时、单条区间不符，请减少条数或调整规则。'
    );
  }
  for (let t = 0; t < maxTries; t++) {
    let left = dayTotal;
    const arr = [];
    for (let i = 0; i < len; i++) {
      let localMin = min;
      let localMax = max;
      // 剩余最小/最大用于保证必合法
      if (i < len - 1) {
        // 后面条数*最小工时
        localMax = Math.min(max, left - min * (len - i - 1));
        localMin = Math.max(min, left - max * (len - i - 1));
        if (localMax < localMin) {
          // 本轮采样失败，重采
          break;
        }
        // 偏向于2左右
        let bias = 2;
        let range = localMax - localMin;
        // 加入偏好中心
        let v = +(localMin + Math.random() * range).toFixed(2);
        if (range >= 1) {
          // 带中心偏移
          v = +Math.max(
            localMin,
            Math.min(localMax, bias + (Math.random() - 0.5) * range * 0.8)
          ).toFixed(2);
        }
        arr.push(v);
        left -= v;
      } else {
        // 最后一条直接补齐
        arr.push(+left.toFixed(2));
      }
    }
    // 验证合法
    if (
      arr.length === len &&
      arr.every((v) => v >= min && v <= max) &&
      +arr.reduce((a, b) => a + b, 0).toFixed(2) === +dayTotal.toFixed(2)
    ) {
      return arr;
    }
  }
  throw new Error('采样超出重试限制，请减少条数或调整工时设置。');
}

// ------ Harvest接口 ------
// 传递 PROJECT_MAP、TASK_MAP、HARVEST_ACCOUNT_ID、HARVEST_TOKEN、USER_AGENT 作为参数
async function createTimeEntry(
  { date, project, task, notes, hours },
  { PROJECT_MAP, TASK_MAP, HARVEST_ACCOUNT_ID, HARVEST_TOKEN, USER_AGENT }
) {
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

// ------ 502自动重试封装 ------
async function createTimeEntryWithRetry(
  args,
  opts,
  maxRetry = 3,
  delay = 1000
) {
  let lastErr;
  for (let i = 0; i < maxRetry; i++) {
    try {
      return await createTimeEntry(args, opts);
    } catch (err) {
      lastErr = err;
      // 检查是否是502网关错误
      const status = err.response?.status || err.status;
      if (status !== 502) throw err;
      // 502: 自动重试，延迟递增
      if (i < maxRetry - 1) {
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ------ 核心导入逻辑（可单独require引用） ------
/**
 * 导入所有日报，每日总工时保证 >=8 小时，单条工时1.4~2.4随机，最后一条补足。
 * 传入 opts 以携带PROJECT_MAP、TASK_MAP等
 */
async function fillAllReports(dailyReports, opts) {
  for (const { date, items } of dailyReports) {
    const arrLen = items.length;
    // 区间必须吻合采样逻辑
    const min = 1.46;
    const max = 3;
    // 求最大、最小允许总和
    const minSum = +(min * arrLen).toFixed(2);
    const maxSum = +(max * arrLen).toFixed(2);
    // 动态生成 dayTotal，使其处于允许区间且几个工作日不会完全一样
    let dayTotal;
    let tries = 0;
    do {
      dayTotal = +(8 + Math.random() * 2).toFixed(2); // 8~10 之间取2位
      tries++;
      // 超范围自动强收敛
      if (dayTotal < minSum) dayTotal = minSum;
      if (dayTotal > maxSum) dayTotal = maxSum;
    } while (++tries < 5 && (dayTotal < minSum || dayTotal > maxSum));

    let hoursArr;
    try {
      hoursArr = normalHoursArr(arrLen, min, max, dayTotal);
    } catch (e) {
      // 容错：前n-1条为min，最后一条补足
      hoursArr = Array(arrLen).fill(min);
      hoursArr[arrLen - 1] = +(dayTotal - min * (arrLen - 1)).toFixed(2);
      if (hoursArr[arrLen - 1] > max) {
        console.warn(
          `⚠️ 警告：${date} 工时分配异常（总工时 ${dayTotal}，明细数 ${arrLen}）。已自动兜底，最后一条工时 ${hoursArr[arrLen - 1]} 超出最大单条工时 ${max}，请关注明细合理性。\n如需严格限制，请手动调整该天明细内容。`
        );
      } else {
        console.warn(
          `⚠️ 警告：${date} 工时分配异常（总工时 ${dayTotal}，明细数 ${arrLen}）。已自动兜底，不符合正常分配分布，请关注该天明细。`
        );
      }
    }

    for (let i = 0; i < arrLen; i++) {
      const item = items[i];
      const hours = hoursArr[i];

      // project/task都去除全角/半角空白，始终取明细自身字段
      const project =
        item.project && typeof item.project === 'string'
          ? item.project.replace(/[\s\u3000]/g, '').trim()
          : '';
      const task =
        item.task && typeof item.task === 'string'
          ? item.task.replace(/[\s\u3000]/g, '').trim()
          : '';

      // 使用 ora 动画
      const spinner = ora(
        `工时填写中: ${date} | ${project} - ${task} - ${hours}h ...`
      ).start();

      try {
        await createTimeEntryWithRetry(
          {
            ...item,
            date,
            project,
            task,
            hours,
          },
          opts
        );
        spinner.succeed(
          `✔ 填报成功 | ${date} | ${project} - ${task} | ${hours}h | ${item.notes}`
        );
      } catch (err) {
        spinner.fail(
          `✗ 填报失败 | ${date} | ${project} - ${task} | ${hours}h | ${item.notes}\n${err.response?.data || err.message || err}`
        );
      }
    }
  }
}

module.exports = { fillAllReports };

// ------ CLI部分 ------
if (require.main === module) {
  // 捕获 Ctrl+C，友好中断提示
  process.on('SIGINT', () => {
    console.log(
      '\n\x1b[33m%s\x1b[0m',
      '⚠️ 检测到你使用 Ctrl + C 主动中断，程序已终止。如需继续，请重新运行命令。'
    );
    process.exit(130);
  });
  // 首次运行时交互式创建配置
  (async () => {
    const homedir = os.homedir();
    const userEnvPath = path.join(homedir, '.harvest-auto.env');
    await ensureUserEnvFileInteractive();

    // 这里确保 env 文件已经确保存在，然后动态加载
    require('dotenv').config({ path: userEnvPath });

    // 重新读取配置
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
      return (
        val
          .trim()
          .replace(/^"+|"+$/g, '')
          .replace(/\r?\n/g, '')
          // 通用反斜杠转义字符还原（空格、&, (, )、中文符号等终端粘贴都支持）
          .replace(/\\(.)/g, '$1')
      );
    }

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
        try {
          // 先尝试 JSON 格式
          dailyReports = JSON.parse(content);
        } catch {
          // 非 JSON 时，尝试用 md/daylog 转换器
          dailyReports = parseMarkdownToDailyReports(content);
        }
        if (!Array.isArray(dailyReports) || dailyReports.length === 0)
          throw new Error('无有效日报内容');
      } catch (e) {
        console.error('读取/解析日报文件失败:', e.message || e);
        process.exit(1);
      }

      if (dryRun) {
        console.log(JSON.stringify(dailyReports, null, 2));
        console.log('[dry-run] 未实际上报。');
      } else {
        await fillAllReports(dailyReports, {
          PROJECT_MAP,
          TASK_MAP,
          HARVEST_ACCOUNT_ID,
          HARVEST_TOKEN,
          USER_AGENT,
        });
        // 所有填报完成后全局成功提示
        console.log(
          '\x1b[32m%s\x1b[0m',
          '\n🎉 所有工时已成功自动填报完毕，任务全部结束！'
        );
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
