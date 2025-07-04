const fs = require('fs');
const os = require('os');
const path = require('path');
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();

/**
 * 交互式创建~/.harvest-auto.env文件
 * 首次使用时让用户逐项填写并确认各项参数，无需手动编辑文件。
 * 调用：
 *   await ensureUserEnvFileInteractive();
 */
async function ensureUserEnvFileInteractive() {
  const homedir = os.homedir();
  const userEnvPath = path.join(homedir, '.harvest-auto.env');
  if (!fs.existsSync(userEnvPath)) {
    // 字段定义与说明
    const FIELDS = [
      {
        key: 'HARVEST_ACCOUNT_ID',
        message: '请输入你的 Harvest 账号ID',
        validate: (v) => !!v || '不能为空',
      },
      {
        key: 'HARVEST_TOKEN',
        message: '请输入你的 Harvest API Token',
        validate: (v) => !!v || '不能为空',
      },
      {
        key: 'USER_AGENT',
        message: '请输入自定义标识 (比如你的邮箱)',
        validate: (v) => !!v || '不能为空',
      },
      {
        key: 'PROJECT_MAP',
        message: '请输入项目名到ID的映射 (如 {"项目A":12345,"项目B":67890})',
        validate: (v) => {
          try {
            const r = JSON.parse(v);
            return typeof r === 'object' && !Array.isArray(r)
              ? true
              : '必须是合法JSON，形如 {"项目A":12345}';
          } catch {
            return '必须是合法JSON，形如 {"项目A":12345}';
          }
        },
        filter: (v) => JSON.stringify(JSON.parse(v)),
      },
      {
        key: 'TASK_MAP',
        message: '请输入任务名到ID的映射 (如 {"任务A":11111,"任务B":22222})',
        validate: (v) => {
          try {
            const r = JSON.parse(v);
            return typeof r === 'object' && !Array.isArray(r)
              ? true
              : '必须是合法JSON，形如 {"任务A":11111}';
          } catch {
            return '必须是合法JSON，形如 {"任务A":11111}';
          }
        },
        filter: (v) => JSON.stringify(JSON.parse(v)),
      },
    ];

    let envData = {};

    for (const f of FIELDS) {
      let confirmed = false;
      let val;
      while (!confirmed) {
        const { inputVal } = await prompt([
          {
            type: 'input',
            name: 'inputVal',
            message: f.message,
            validate: f.validate,
          },
        ]);
        val = f.filter ? f.filter(inputVal) : inputVal;
        const { isOk } = await prompt([
          {
            type: 'confirm',
            name: 'isOk',
            message: `你输入的${f.key}为：\n${val}\n确认无误吗？`,
            default: true,
          },
        ]);
        confirmed = isOk;
      }
      envData[f.key] = val;
    }

    // 拼装env内容
    const envTemplate = [
      `HARVEST_ACCOUNT_ID=${envData.HARVEST_ACCOUNT_ID}`,
      `HARVEST_TOKEN=${envData.HARVEST_TOKEN}`,
      `USER_AGENT=${envData.USER_AGENT}`,
      `PROJECT_MAP=${envData.PROJECT_MAP}`,
      `TASK_MAP=${envData.TASK_MAP}`,
      '',
    ].join('\n');
    fs.writeFileSync(userEnvPath, envTemplate, { encoding: 'utf-8' });

    console.log(
      '\x1b[32m%s\x1b[0m',
      `已成功创建配置文件: ${userEnvPath}。\n将继续执行后续操作...\n`
    );
    // 不退出，让主程序可以直接继续
    return;
  }
}

module.exports = {
  ensureUserEnvFileInteractive,
};
