/**
 * CLI 国际化中英文提示语
 * 用法：const { MSG } = require('../i18n/messages');
 *      MSG[lang].KEY
 */
const MSG = {
  CN: {
    // 环境设置
    HARVEST_ACCOUNT_ID: '请输入你的 Harvest 账号ID',
    HARVEST_TOKEN: '请输入你的 Harvest API Token',
    USER_AGENT: '请输入自定义标识 (比如你的邮箱)',
    PROJECT_MAP: '请输入项目名到ID的映射 (如 {"项目A":12345,"项目B":67890})',
    PROJECT_MAP_ERR: '必须是合法JSON，形如 {"项目A":12345}',
    TASK_MAP: '请输入任务名到ID的映射 (如 {"任务A":11111,"任务B":22222})',
    TASK_MAP_ERR: '必须是合法JSON，形如 {"任务A":11111}',
    CONFIRM: (key, val) => `你输入的${key}为：\n${val}\n确认无误吗？`,
    ENV_SUCCESS: (userEnvPath) =>
      `已成功创建配置文件: ${userEnvPath}。\n将继续执行后续操作...\n`,
    ENV_PATCHED: '[CN] 已补充配置 LANG 字段。\n',
    LANGUAGE_CHOICE: '请选择你偏好的语言：',
    SYSTEM_LANG_DETECTED: (osLocale) => `当前检测到的系统语言: ${osLocale}`,
    // 运行入口与主流程
    CLI_DESC:
      '一键导入日报到Harvest的CLI工具，需配置.env 或 ~/.harvest-auto.env',
    FILE_PATH_ASK: '请输入日报 JSON 文件的路径（可拖入/粘贴完整路径）：',
    FILE_NOT_FOUND: (p) =>
      `找不到此文件（处理后路径：${p}），请确认路径输入正确。`,
    FILE_PATH_CONFIRM: (p) =>
      `你设置的日报 JSON 路径为：\n${p}\n是否确认无误？`,
    READ_FAIL: '读取/解析日报文件失败:',
    NO_VALID_REPORT: '无有效日报内容',
    DRY_RUN: '[dry-run] 未实际上报。',
    CANCEL: '已取消操作。',
    EXIT_MID:
      '⚠️ 检测到你在交互过程中主动中断，程序已终止。如需继续，请重新运行命令。',
    SUBMIT_FINISH: '\n🎉 所有工时已成功自动填报完毕，任务全部结束！',
    // 语言选择
    LANG_ZH: '简体中文 (CN)',
    LANG_EN: 'English (EN)',
    // 交互
    IS_OK: '确认无误吗？',
    // ctrl+c
    SIGINT:
      '⚠️ 检测到你使用 Ctrl + C 主动中断，程序已终止。如需继续，请重新运行命令。',
    // 填报流程
    SUBMIT_OK: (date, project, task, hours, notes) =>
      `✔ 填报成功 | ${date} | ${project} - ${task} | ${hours}h | ${notes}`,
    SUBMIT_FAIL: (date, project, task, hours, notes, err) =>
      `✗ 填报失败 | ${date} | ${project} - ${task} | ${hours}h | ${notes}\n${err}`,
    SUBMIT_PROGRESS: (date, project, task, hours) =>
      `工时填写中: ${date} | ${project} - ${task} - ${hours}h ...`,
    WARNING_HOURS_ITEMS: (date, dayTotal, arrLen, max, isExceed) =>
      isExceed
        ? `⚠️ 警告：${date} 工时分配异常（总工时 ${dayTotal}，明细数 ${arrLen}）。已自动兜底，最后一条工时超出最大单条工时 ${max}，请关注明细合理性。\n如需严格限制，请手动调整该天明细内容。`
        : `⚠️ 警告：${date} 工时分配异常（总工时 ${dayTotal}，明细数 ${arrLen}）。已自动兜底，不符合正常分配分布，请关注该天明细。`,
    PROJECT_MAP_INVALID:
      '\n[配置错误] PROJECT_MAP 配置不是合法 JSON，请编辑 ~/.harvest-auto.env 按如下格式：\n\nPROJECT_MAP={"项目A":12345,"项目B":67890}\n',
    TASK_MAP_INVALID:
      '\n[配置错误] TASK_MAP 配置不是合法 JSON，请编辑 ~/.harvest-auto.env 按如下格式：\n\nTASK_MAP={"任务A":11111,"任务B":22222}\n',
    HOURS_RANGE_ERROR:
      '明细条数与每日总工时、单条区间不符，请减少条数或调整规则。',
    HOURS_SAMPLING_ERROR: '采样超出重试限制，请减少条数或调整工时设置。',
    PROJECT_NOT_MAPPED: (project) => `项目[${project}]未配置映射`,
    TASK_NOT_MAPPED: (task) => `任务[${task}]未配置映射`,
  },
  EN: {
    HARVEST_ACCOUNT_ID: 'Please input your Harvest account ID',
    HARVEST_TOKEN: 'Please input your Harvest API Token',
    USER_AGENT: 'Please input a custom identifier (e.g. your email)',
    PROJECT_MAP:
      'Input project-name to ID mapping (e.g. {"ProjectA":12345,"ProjectB":67890})',
    PROJECT_MAP_ERR: 'Must be valid JSON like {"ProjectA":12345}',
    TASK_MAP:
      'Input task-name to ID mapping (e.g. {"TaskA":11111,"TaskB":22222})',
    TASK_MAP_ERR: 'Must be valid JSON like {"TaskA":11111}',
    CONFIRM: (key, val) => `You entered ${key}:\n${val}\nIs this correct?`,
    ENV_SUCCESS: (userEnvPath) =>
      `Successfully created config file: ${userEnvPath}\nContinuing...\n`,
    ENV_PATCHED: '[EN] LANG field successfully added to config.\n',
    LANGUAGE_CHOICE: 'Please choose your preferred language:',
    SYSTEM_LANG_DETECTED: (osLocale) => `Detected system language: ${osLocale}`,
    CLI_DESC:
      'A CLI tool to import daily logs into Harvest. Requires .env or ~/.harvest-auto.env configuration.',
    FILE_PATH_ASK: 'Please enter the path to your daily report JSON file:',
    FILE_NOT_FOUND: (p) =>
      `File not found (after processing: ${p}), please check your input.`,
    FILE_PATH_CONFIRM: (p) =>
      `You set the daily JSON path as:\n${p}\nIs this correct?`,
    READ_FAIL: 'Failed to read/parse the daily report file:',
    NO_VALID_REPORT: 'No valid daily report content found',
    DRY_RUN: '[dry-run] No actual submission.',
    CANCEL: 'Operation cancelled.',
    EXIT_MID:
      '⚠️ Detected that you cancelled the operation during interaction. Program exited. To continue, please re-run the command.',
    SUBMIT_FINISH:
      '\n🎉 All timesheets have been submitted successfully. Task completed!',
    LANG_ZH: '简体中文 (CN)',
    LANG_EN: 'English (EN)',
    IS_OK: 'Is this correct?',
    SIGINT:
      '⚠️ Detected you used Ctrl+C to interrupt, program exited. Please re-run to continue.',
    // 填报流程
    SUBMIT_OK: (date, project, task, hours, notes) =>
      `✔ Submitted | ${date} | ${project} - ${task} | ${hours}h | ${notes}`,
    SUBMIT_FAIL: (date, project, task, hours, notes, err) =>
      `✗ Failed | ${date} | ${project} - ${task} | ${hours}h | ${notes}\n${err}`,
    SUBMIT_PROGRESS: (date, project, task, hours) =>
      `Submitting: ${date} | ${project} - ${task} - ${hours}h ...`,
    WARNING_HOURS_ITEMS: (date, dayTotal, arrLen, max, isExceed) =>
      isExceed
        ? `⚠️ Warning: Unusual hour allocation at ${date} (total ${dayTotal}, items: ${arrLen}). Fallback: last entry exceeds max single-hour ${max}, please check item logic.\nIf strict limit needed, adjust this day manually.`
        : `⚠️ Warning: Unusual hour allocation at ${date} (total ${dayTotal}, items: ${arrLen}). Fallback used, distribution abnormal, please check this day.`,
    PROJECT_MAP_INVALID:
      '\n[Config Error] PROJECT_MAP is not valid JSON. Please edit ~/.harvest-auto.env as:\n\nPROJECT_MAP={"ProjectA":12345,"ProjectB":67890}\n',
    TASK_MAP_INVALID:
      '\n[Config Error] TASK_MAP is not valid JSON. Please edit ~/.harvest-auto.env as:\n\nTASK_MAP={"TaskA":11111,"TaskB":22222}\n',
    HOURS_RANGE_ERROR:
      'Detail count does not match total hours/interval, reduce item count or adjust rules.',
    HOURS_SAMPLING_ERROR:
      'Sampling exceeded retry limit, please reduce item count or adjust hour settings.',
    PROJECT_NOT_MAPPED: (project) => `Project [${project}] is not mapped.`,
    TASK_NOT_MAPPED: (task) => `Task [${task}] is not mapped.`,
  },
};

module.exports = {
  MSG,
};
