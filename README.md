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

## 一键生成 APK：只用 GitHub，不需要 Expo 账号

现在使用 **GitHub Actions + Android Gradle 直接编译**。Expo 只作为 App 框架使用，打包不调用 EAS，不要求 Expo 登录、Token、Project ID 或 Mac 原生开发工具。

### 你只需要点击这些位置

1. 打开 [仓库 Actions](https://github.com/YuTaoBai/rili/actions/workflows/android-apk.yml)。
2. 选择 **一键生成 APK（无需 Expo 账号）** → **Run workflow** → 分支选 `main` → 再点 **Run workflow**。
3. 打开最新一次运行，等待绿色成功标记。首次需要下载原生依赖并编译，请预留约 15–40 分钟；实际时间取决于 GitHub runner。
4. 在本次运行的 **Summary** 页面下方找到 **Artifacts**，点击 `my-calendar-preview-编号` 下载压缩包（需登录 GitHub）。
5. 解压，取出 `my-calendar-preview.apk`，发送到安卓手机；允许当前浏览器/文件管理器安装未知应用，打开 APK 安装。

**无需配置任何 Secret 或变量。** 推送应用代码到 main 也会自动开始构建。旧的 EXPO_TOKEN/EAS_PROJECT_ID/EXPO_OWNER 已不被读取，先前失败的运行也不必重跑，请启动最新代码的新运行。

下载得到的是 **release 模式、内置 Hermes JS 和资源、带测试签名的独立体验版**，不需要 Expo Go、Metro、开发服务器或电脑。安装后日历功能全部离线运行。APK 包含 ARM64 和 ARMv7 原生库，面向主流 ARM 安卓手机，不包含 x86 模拟器架构。支持的最低 Android 系统以构建产物的 `minSdkVersion` 为准。

默认显示名“我的日历·体验版”，包名 `com.yutaobai.mycalendar.preview`。为实现零配置，体验版使用 Expo 官方原生模板的**公开测试签名**，适合个人安装试用，不应用作正式分发签名。后续保持同一模板签名和包名，可覆盖安装体验版并保留数据；升级框架前请先导出备份。

下载产物只包含 APK 和 SHA256SUMS.txt，保留 30 天；过期后重新运行即可。**只有本次任务绿色成功且出现 Artifacts，才表示实际生成了 APK。**

### 正式签名（可选，先用默认体验版即可）

<details>
<summary>准备长期正式分发时，再展开配置一次私有签名</summary>

正式版包名为 `com.yutaobai.mycalendar`，与体验版可同时安装，数据库彼此独立。迁移时在体验版导出 JSON，再到正式版导入。

需要在 GitHub 仓库 **Settings → Secrets and variables → Actions → Secrets** 添加四项：

| Secret                    | 内容                             |
| ------------------------- | -------------------------------- |
| ANDROID_KEYSTORE_BASE64   | 私有 keystore 文件的 Base64 编码 |
| ANDROID_KEYSTORE_PASSWORD | keystore 密码                    |
| ANDROID_KEY_ALIAS         | 密钥别名                         |
| ANDROID_KEY_PASSWORD      | 密钥密码                         |

签名文件可在云端用 JDK 自带的 keytool 创建，无需在 Mac 安装工具。已有正式签名应继续复用，不要重新生成。不要把私钥、密码放进代码、聊天、GitHub artifact 或缓存。

四项都存在时，工作流自动生成 `my-calendar-release.apk`；都不存在时直接生成体验版；只填一部分会明确报错，避免悄悄使用错误签名。正式版私钥仅在 runner 临时目录恢复，构建完成后清理。请另行安全备份 keystore 及密码，丢失后无法用相同签名更新应用。

</details>

### 云端构建内部流程

GitHub 自动配置 Node 24、JDK 17，并使用 Ubuntu 24.04 runner 预装的 Android SDK：

```sh
npm ci
npm run check
# 以下仅在有 Android SDK/JDK 的云机器运行，不需要你在 Mac 执行：
APK_VARIANT=preview npm run build:apk
```

构建脚本临时生成被忽略的 `android/` 目录，调用 `:app:assembleRelease`，然后检查 APK 签名、包名、非调试模式、离线 bundle 和 ARM 原生库，最后上传 Artifacts。原生生成会重建 android/，不要在里面保存需要保留的修改。

正式签名 APK 的构建编号取自 GitHub 运行编号，更新时保持原包名和签名。不要先卸载再安装，否则本地数据库会被删除；换包名/签名前先导出备份。

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
app.config.ts          体验版/正式版包名及构建版本
scripts/android/       原生生成、签名配置、Gradle 编译及 APK 校验
.github/workflows/     持续检查和手动 APK 构建
tests/                 日期与真实 SQLite 自动化测试
```

数据库文件 `my-calendar.db` 在应用私有存储中；schema v1，字段包括 `id/date/title/note/startTime/endTime/isAllDay/createdAt/updatedAt`。后续版本在 `migrate` 内递增 `PRAGMA user_version`，不要删除旧库。SQLite 参数绑定处理包括引号在内的用户文字。

## 验证状态与边界

本次云端执行：

- TypeScript 应用代码、测试代码检查通过。
- 19 项自动化测试通过：5 项构建/签名配置测试，4 项真实 Expo Router/React Native 页面测试（月份切换、表单校验与保存、删除确认、未保存退出拦截），以及 10 项 Node 数据/日期测试。数据测试使用真正的 SQLite，不是内存对象模拟数据库：关闭重开持久化、同天多条、移动日期、修改删除、排序、月索引、备份导入导出、重复合并、故障事务回滚及数据库版本检查。
- 日期测试覆盖 2028-02-29、跨年、周一起始，以及 UTC、上海、洛杉矶、基里蒂马蒂和圣地亚哥的本地日期/DST 边界。
- Android 原生配置在仓库外通过 Expo prebuild 验证；应用保留托管工作流，无原生目录入库。
- Android release Hermes JS bundle 成功导出。**JS 打包成功不等于 APK 原生编译或真机验收通过。**
- SDK 离线兼容检查通过；Expo Doctor 本地检查通过，在线 schema / React Native Directory 检查受到云环境网络限制，未宣称全通过。
- 构建入口已改为 GitHub 直接编译，不再依赖 Expo 账户。最终原生编译结果请以最新 Actions 运行和实际 Artifacts 为准；真机交互仍需安装后验收。

安装 APK 后请在手机复核：新建两条安排 → 强制关闭重开 → 修改/删除 → 切换月份与返回今天 → 导出到应用之外 → 在另一台手机导入；测试软键盘、返回退出确认、长备注和系统字体放大。自动测试不替代 Android 原生文件选择器/分享面板与 UI 真机验证。

### Codex 云环境网络限制

Git HTTPS 读写可用。当前 Codex 环境阻止 `api.github.com`，因此可能无法从聊天中触发、监控 GitHub Actions 或下载其产物；这不影响你在 GitHub 网页运行新工作流。该工作流不需要访问 Expo 构建 API。

Codex 本机尝试原生编译仍需要 Google Android SDK、Gradle、Maven 等下载域名可达；如果本机网络阻断，以 GitHub runner 构建为准。不要关闭 TLS/校验或绕过平台代理。
