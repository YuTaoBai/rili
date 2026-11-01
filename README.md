# 我的日历

简洁的中文个人 Android 日历，使用 **Expo SDK 58 + React Native + TypeScript + Expo Router + expo-sqlite**。全部日历功能离线运行，无后端、账号、云数据库或 AI API。

## 已实现

- 周一开始的月历；箭头和左右滑动切换月份；返回今天；独立的今日标记、选中高亮和日程圆点。
- 每天多条日程；新增、查看完整内容、编辑、删除确认；可修改日期，多行备注，全天、开始/结束时间或纯文字记录。
- 全天安排在前，其次按开始时间排列，纯备注在后；同类同时间按创建时间、ID 稳定排序。
- 保存立即写入 SQLite；日期索引范围查询月份，列表复用月查询结果；保存、删除、导入后刷新。
- 数据库版本管理、事务迁移、初始化重试、读写错误提示、防重复保存及未保存退出确认。
- 设置页 JSON 导出和文件导入；格式、日期、时间、长度和 ID 校验；相同 ID 可跳过或覆盖；合并不清空本机，失败整批回滚。
- 浅色蓝白界面、安全区域、长备注滚动、表单校验、空状态和加载状态。
- Android 内部分发 APK 配置，以及 GitHub Actions 代码检查与手动云构建。

日期使用手机的**本地民用日期**（`YYYY-MM-DD`），不用 `toISOString()` 计算日历日期。创建/更新时间才使用 UTC 时间戳；跨时区旅行不会让已有记录移到另一天。

## 云端开发，无需 Mac 原生工具

只需在 Codex Cloud 中操作已有的 `/workspace/rili` 检出，不要另建 worktree。Node **24.3+（24.x）**、npm 即可；Mac 不需要 Android Studio、SDK、Java、Gradle或模拟器。

```sh
cd /workspace/rili
npm ci
npm run check
EXPO_OFFLINE=1 npm run bundle:android
```

依赖锁定在 `package-lock.json`；原生依赖来自 SDK 58 官方匹配版本。升级时用 `npx expo install`，不要单独升级 React Native。

开发时 `npm start` 启动 Metro，在 Android Expo Go（需支持 SDK 58）扫码调试。云环境需配置可访问的 Metro 网络或隧道；**独立 APK 不需要 Metro**。本项目以 Android 原生为目标，不提供浏览器版 SQLite 兼容层。

## 生成独立 APK（全部在云端）

### 1. 创建自己的 Expo 项目并授权

1. 在浏览器打开 [Expo](https://expo.dev)，注册/登录。应用使用者不需要这个账号，它仅用于构建。
2. 在 Expo Dashboard 创建项目，建议 slug 为 `wo-de-ri-li`；从 Project settings 复制 **Project ID（UUID）**，记下所属账号/组织名。
3. 在 Expo 账户设置的 **Access tokens** 创建构建用 token。在 Codex 云环境的安全配置中提供 `EXPO_TOKEN`；把公开配置 `EAS_PROJECT_ID`、`EXPO_OWNER` 设置为对应项目和账号/组织。Token 只放安全设置，不要发到聊天或提交到代码。
4. 如使用平台代理注入凭据，`EXPO_TOKEN` 的 HTTPS 目标为 `api.expo.dev`。保留平台代理和 TLS 校验。

`app.config.ts` 会读取上述公开项目配置；也可将公开的 `owner` 和 `extra.eas.projectId` 填入 `app.json`。本仓库没有虚构或绑定他人的 Project ID。

### 2. 在 Codex Cloud 执行

```sh
cd /workspace/rili
npx --yes eas-cli@27.2.0 whoami
npx --yes eas-cli@27.2.0 project:info
npm run build:apk
# 等价于 eas build -p android --profile preview
```

首次构建选择让 EAS 生成并保管 Android Keystore；以后使用同一签名。首次创建签名可能需要交互确认；已有远程签名后可使用 `--non-interactive`。

`eas.json` 的 preview 使用 `distribution: internal` 与 `android.buildType: apk`。这是带 JS 和资源的独立 release 应用，不是要求开发服务器的调试包。生产配置另提供 AAB，不能作为 APK 直接安装。EAS 免费额度、排队和服务政策以 Expo 当前说明为准。

当前包名 `com.yutaobai.mycalendar`，版本 1.0.0 / versionCode 1。发布后更新请保留包名、项目及签名，并递增版本号。不要卸载旧版再安装，否则本地数据库会丢失。

### 3. 也可仅用浏览器触发 GitHub Actions

首次 EAS 项目和签名准备好后：

1. GitHub 仓库 → **Settings → Secrets and variables → Actions**。
2. Secrets 添加 `EXPO_TOKEN`；Variables 添加 `EAS_PROJECT_ID` 和 `EXPO_OWNER`。
3. 仓库 → **Actions → 云端生成 Android APK → Run workflow**。
4. 打开任务日志中的真实 EAS 构建链接。该工作流等待 EAS 结果，APK 由 Expo 托管，不是 GitHub artifact。

### 4. 在 Android 手机上安装

在 EAS 成功构建页点击 **Install / Download** 下载 `.apk`，或用手机扫描该页二维码。按系统提示允许当前浏览器/文件管理器“安装未知应用”，打开 APK 安装。以后正常使用不需要 Expo 账号、Expo Go、电脑或联网。

**只有 EAS 显示 Finished 且实际产出 APK 后才能下载。当前开发交付没有成功 APK 链接，见下方验证状态。**

## 备份与换机

旧手机：设置 → 导出全部日程 → 在系统分享中保存文件或传给自己。系统分享目标因设备而异；取消分享不会在应用之外保存文件。应用缓存中的临时副本不能代替外部备份。

新手机：安装应用 → 设置 → 选择备份文件 → 选择“跳过重复”或“覆盖重复”。使用 Android 系统文件选择器，无需申请存储危险权限。导入期间会暂时阻止离开，避免中断反馈。

- 备份为 UTF-8 JSON，含 `format: "my-calendar-backup"`、`version: 1`、`exportedAt`、`events`。
- 相同 ID 视为同一安排；不同 ID 即使文字相同也保留。重复导入同一文件不会额外复制相同 ID。
- 文件上限 20 MiB、50000 条；标题最多 120 字符，备注最多 20000 字符；只接受本格式 v1。
- 导入前完整校验，写入使用独立 SQLite 事务，出错回滚。导入不会删除备份外的本机记录。
- 文件是明文，请妥善保管；卸载、清除应用数据、丢失手机会导致本机数据丢失。请定期导出到应用之外。

## 主要文件

```text
app/_layout.tsx         导航、全局错误界面与数据库启动
app/index.tsx           月历、手势、日程标记及当天列表
app/event.tsx           新增/编辑、时间校验、删除、未保存确认
app/settings.tsx        官方文件选择/分享、备份恢复
src/calendar.ts        本地日期、月历格子与月份边界
src/events.ts          数据模型、输入与备份校验
src/database.ts        参数化 SQL、迁移、日期索引及事务
src/store.tsx          SQLite 生命周期、初始化重试与刷新通知
src/theme.ts           颜色与通用样式
assets/                原创日历图标和启动图
app.json               应用信息、Android 包名与权限配置
app.config.ts          可配置的 Expo 项目归属
.easignore / eas.json   云构建上传与 APK 配置
.github/workflows/     持续检查和手动 APK 构建
tests/                 日期与真实 SQLite 自动化测试
```

数据库文件 `my-calendar.db` 在应用私有存储中；schema v1，字段包括 `id/date/title/note/startTime/endTime/isAllDay/createdAt/updatedAt`。后续版本在 `migrate` 内递增 `PRAGMA user_version`，不要删除旧库。SQLite 参数绑定处理包括引号在内的用户文字。

## 验证状态与边界

本次云端执行：

- TypeScript 应用代码、测试代码检查通过。
- 14 项自动化测试通过：4 项真实 Expo Router/React Native 页面测试（月份切换、表单校验与保存、删除确认、未保存退出拦截），以及 10 项 Node 数据/日期测试。数据测试使用真正的 SQLite，不是内存对象模拟数据库：关闭重开持久化、同天多条、移动日期、修改删除、排序、月索引、备份导入导出、重复合并、故障事务回滚及数据库版本检查。
- 日期测试覆盖 2028-02-29、跨年、周一起始，以及 UTC、上海、洛杉矶、基里蒂马蒂和圣地亚哥的本地日期/DST 边界。
- Android 原生配置在仓库外通过 Expo prebuild 验证；应用保留托管工作流，无原生目录入库。
- Android release Hermes JS bundle 成功导出。**JS 打包成功不等于 APK 原生编译或真机验收通过。**
- SDK 离线兼容检查通过；Expo Doctor 本地检查通过，在线 schema / React Native Directory 检查受到云环境网络限制，未宣称全通过。
- `eas whoami` 返回未登录，无可用 Expo 授权/项目签名，**未生成 APK**。首次原生编译和真机交互验收仍需完成。

安装 APK 后请在手机复核：新建两条安排 → 强制关闭重开 → 修改/删除 → 切换月份与返回今天 → 导出到应用之外 → 在另一台手机导入；测试软键盘、返回退出确认、长备注和系统字体放大。自动测试不替代 Android 原生文件选择器/分享面板与 UI 真机验证。

### 当前云环境网络限制

Git HTTPS 读取可用。Expo API、React Native Directory 和 GitHub PR API 检查遇到代理白名单限制；尝试保存域名配置时，环境草稿已不可编辑，**新增域名未保存/应用**。

请在环境设置保留已有 package_managers 预设，并添加 `api.expo.dev`、`exp.host`、`expo.dev`、`reactnative.directory`、`api.github.com`。后续 EAS 上传如报告其他目标受限，应按错误添加所需精确域名。不要关闭 TLS 校验或绕过平台代理。联网 Node 工具可通过 `NODE_USE_ENV_PROXY=1` 使用平台代理。
