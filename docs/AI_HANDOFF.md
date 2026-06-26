# komari-theme-YS AI 交接与维护说明

这份文档给没有上下文的 AI 或开发者快速接手用。先读这里，再动代码。

## 项目定位

`komari-theme-YS` 是一个 Komari Monitor 前端主题，技术栈是 Vite + React + TypeScript + CSS。主题主体运行在 Komari 页面里，通过 Komari 的公开接口、管理员接口和 RPC2 获取节点、历史记录、Ping 任务、主题配置。

当前主题有几类核心能力：

- 首页节点卡片、条形卡片、总览、排序。
- 节点详情页负载/Ping 历史图。
- 图片背景板、渐变背板、本地/全局外观配置。
- 卡片外壳、背板玻璃、信息展板、跑马灯、配色预设。
- 管理员主题设置页 `?view=theme-manage`，负责保存全站默认配置。

## 运行入口

- `src/main.tsx`：React 挂载入口。
- `src/App.tsx`：注入 React Query 和 Router。
- `src/router.tsx`：路由。首页 `/`、详情页 `/instance/:uuid`、404。
- `src/components/shell/AppShell.tsx`：全局外壳，挂载背景板、快捷按钮、页面主体和 footer。
- `src/pages/Home.tsx`：首页。检测 `?view=theme-manage` 后懒加载主题设置页。

## 目录职责

```text
src/
  components/
    shell/       全局外壳、背景板、首页快捷按钮
    node/        首页节点卡片、总览、跑马灯、仪表盘/液位展板
    instance/    节点详情页、负载图、Ping 图
    ui/          小型通用 UI
  hooks/         主题外观、背景、节点排序、记录、登录态等业务 hook
  pages/         Home、Instance、ThemeManage 等页面入口
  pages/themeManage/
                 ThemeManage 拆出的选项、背景上传、Ping 绑定工具
  services/      Komari API、RPC2、节点实时状态 store、QueryClient
  styles/        全局样式入口、设计 token、按功能拆分的 surface 样式
  types/         Komari API 的 zod schema 和 TypeScript 类型
  utils/         格式化、背景设置、排序、Ping 绑定等纯工具
```

## 重点文件说明

| 文件 | 作用 | 修改建议 |
| --- | --- | --- |
| `src/services/api.ts` | 封装 Komari REST/RPC 接口，含 zod 校验和 fallback | 新增接口优先在这里集中封装，不要在组件里散写 `fetch` |
| `src/services/rpc2Client.ts` | RPC2 WebSocket + HTTP fallback 客户端 | 只在 RPC 协议变化时改 |
| `src/services/wsStore.ts` | 首页节点实时状态 store，轮询节点信息和最新状态 | 性能相关改动优先检查这里 |
| `src/types/komari.ts` | API schema、接口类型、主题配置类型 | 新增配置字段先补类型和 normalize |
| `src/pages/ThemeManage.tsx` | 管理员主题设置页主体 | 保持负责状态、保存、渲染，工具逻辑放子目录 |
| `src/pages/themeManage/themeManageOptions.ts` | 主题设置页选项常量和外观 normalize | 新增设置页固定选项放这里 |
| `src/pages/themeManage/backgroundUploads.ts` | 背景上传、DataURL 读取、JPEG 压缩优化 | 改上传限制、压缩策略从这里进 |
| `src/pages/themeManage/pingBindings.ts` | 首页 Ping 任务和节点绑定工具 | 改一键绑定、绑定裁剪从这里进 |
| `src/components/shell/FloatingControls.tsx` | 首页快捷面板：卡片与样式、排序、本地外观 | 渐变背板和背板玻璃都在卡片与样式页签内，实际字段仍属于 `gradientBackground` |
| `src/components/shell/BackgroundBoard.tsx` | 图片背景板和渐变背板实际渲染 | 背景层级、透明度、背板玻璃 CSS 变量从这里查 |
| `src/components/node/NodeGrid.tsx` | 首页节点列表、排序、卡片布局入口 | 新增排序模式时配合 `utils/nodeSort.ts` |
| `src/components/node/NodeCard.tsx` | 节点卡片主体渲染 | 尽量只放组件结构，绘制工具放 `dashboardHelpers.tsx` |
| `src/components/node/dashboardHelpers.tsx` | 弧光/全环/指针/液位展板的数学、SVG、CSS 变量工具 | 新增仪表盘形态或样式优先放这里 |
| `src/components/node/marqueeStyle.ts` | 跑马灯 canvas 绘制和动画节奏 | 新增跑马灯样式从这里进 |
| `src/hooks/useVisualStyle.ts` | 卡片外壳、展板、跑马灯、配色的类型、默认值、normalize、本地状态 | 新增视觉配置字段必须先补这里 |
| `src/hooks/useGradientBackground.ts` | 渐变背板配置、本地/全局来源、CSS 变量设置 | 渐变预设和保存策略从这里改 |
| `src/utils/backgroundSettings.ts` | 图片背景板配置 normalize、URL 解析、上传图来源 | 背景配置字段必须和这里保持一致 |
| `src/utils/nodeSort.ts` | 首页排序模式和排序函数 | 新增排序模式从这里进 |
| `src/styles/index.css` | 样式总入口 | 一般不用改 |
| `src/styles/tokens.css` | 颜色、阴影、基础变量 | 改全局视觉基调先看这里 |
| `src/styles/surface.css` | surface 样式导入文件 | 只维护导入顺序 |
| `src/styles/surface/foundation.css` | 背景板、快捷面板、设置页、总览等基础样式 | 快捷面板和设置页样式从这里进 |
| `src/styles/surface/instance.css` | 节点详情页样式 | 详情页图表和信息块样式从这里进 |
| `src/styles/surface/node-card.css` | 首页节点卡片、仪表盘、液位、卡片外壳样式 | 卡片外观和展板动画从这里进 |

## 数据流

首页数据大致是：

1. `NodeGrid` 调用 `useVisibleNodes()` / `useVisibleNodeUuids()`。
2. `useNode.ts` 启动 `wsStore.ensureStarted()`。
3. `wsStore.ts` 定时拉取 `/api/nodes` 和 RPC `common:getNodesLatestStatus`。
4. `NodeGrid` 读取 `useVisualStyle()`、`useNodeSort()` 后决定布局、排序、样式。
5. 每张 `NodeCard` 自己读取实时节点、Ping mini 数据、流量趋势并渲染。

主题设置保存大致是：

1. 管理员进入 `/?view=theme-manage`。
2. `ThemeManage.tsx` 从 `/api/public` 读取 `theme_settings`，normalize 成草稿。
3. 用户修改草稿后点击保存。
4. `saveThemeSettings(theme, settings)` POST 到 `/api/admin/theme/settings?theme=...`。
5. 保存成功后 invalidate `public-config`，前台 hook 自动读到新全局默认。

快捷面板保存策略：

- 游客/普通用户：多数外观配置保存在 localStorage，只影响当前浏览器。
- 管理员：主题设置页保存的是全站默认配置，由后端管理员接口保护。
- 不要依赖前端隐藏按钮做权限安全，真正安全边界必须是 `/api/admin/*`。

## Komari 接口清单

集中封装位置：`src/services/api.ts`。

| 函数 | 底层接口 | 用途 |
| --- | --- | --- |
| `getMe()` | `GET /api/me` | 判断登录状态、是否可看隐藏节点、是否可进入主题设置 |
| `getPublic()` | `GET /api/public` | 站点公开配置和 `theme_settings` |
| `getVersion()` | `GET /api/version` | Komari 版本信息 |
| `getNodes()` | `GET /api/nodes` | 节点基础信息 |
| `getNodesLatestStatus(uuids?)` | RPC `common:getNodesLatestStatus` | 节点实时状态 |
| `getAdminClients()` | `GET /api/admin/client/list` | 管理员节点列表，用于排序和 Ping 绑定设置 |
| `getLoadRecords(uuid, hours)` | RPC `common:getRecords`，失败回退 `/api/records/load` | 负载历史 |
| `getPingRecords(uuid, hours)` | 优先 `/api/records/ping`，失败回退 RPC `common:getRecords` | 节点 Ping 历史 |
| `getPublicPingTasks()` | `GET /api/task/ping` | 公开 Ping 任务 |
| `getAdminPingTasks()` | `GET /api/admin/ping` | 管理员 Ping 任务 |
| `getPingOverview(hours, taskId?)` | RPC `common:getRecords`，有 taskId 时可回退 `/api/records/ping` | 首页 Ping mini 汇总 |
| `saveThemeSettings(theme, settings)` | `POST /api/admin/theme/settings?theme=...` | 保存全站主题默认配置 |

RPC2 位置：`src/services/rpc2Client.ts`。默认先尝试 WebSocket `/api/rpc2`，失败后走 HTTP POST `/api/rpc2`。

## 主题配置字段

主题配置来自 `PublicConfig.theme_settings`，类型入口是 `src/types/komari.ts` 的 `ThemeSettings`。

常用字段：

```ts
interface ThemeSettings {
  defaultAppearance?: "system" | "light" | "dark";
  background?: ThemeBackgroundSettings;
  gradientBackground?: unknown;
  visualStyle?: unknown;
  homepagePingBindings?: Record<string, string[]>;
  homepageNodeOrder?: string[];
  homepageNodeSort?: unknown;
  showPingChart?: boolean;
  enableAdminButton?: boolean;
}
```

重要 normalize 位置：

- 图片背景板：`normalizeBackgroundSettings()` in `src/utils/backgroundSettings.ts`
- 渐变背板：`normalizeGradientBackgroundSettings()` in `src/hooks/useGradientBackground.ts`
- 视觉样式：`normalizeVisualStyleSettings()` in `src/hooks/useVisualStyle.ts`
- 首页 Ping 绑定：`normalizeHomepagePingTaskBindings()` in `src/utils/pingTasks.ts`
- 首页节点顺序：`normalizeHomepageNodeOrder()` in `src/utils/nodeOrder.ts`
- 首页节点排序：`normalizeHomepageNodeSortSettings()` in `src/utils/nodeSort.ts`

新增配置字段时必须同时处理：

1. 类型：`src/types/komari.ts`
2. 默认值和 normalize：对应 hook 或 util
3. 保存入口：`ThemeManage.tsx` 或 `FloatingControls.tsx`
4. 使用入口：组件或 hook
5. 文档：本文件和必要的 README/CHANGELOG

## 视觉配置关系

`useVisualStyle.ts` 是视觉设置核心：

- `cardStyle`：卡片外壳，当前包含数据面板、清透玻璃、霓虹暗面、柔和彩块、极简白板、复古 CRT。
- `cardLayout`：方卡片或条形卡片。
- `dashboardStyle`：信息展板，当前包含数据条、弧光仪表、全环仪表、指针仪表、液位容器。
- `dashboardSettings`：各展板专属调节项。
- `marqueePalette` / `colors`：跑马灯指标颜色。
- `marqueeStyle`：数据条跑马灯的形态、密度、圆角、光晕、动效。
- `radarLatencyMaxMs`：延迟仪表上限，超过拉满。

首页快捷面板里的渐变背板入口放在“卡片与样式”页签内，和卡片外壳、信息展板、配色同级。背板玻璃也在“卡片外壳”页签里，但配置字段仍是 `gradientBackground.tintSurfaces` 和 `gradientBackground.surfaceOpacity`，因为它依赖当前渐变背板颜色给卡片、总览和部分色块染色。

样式落地主要靠 `:root` 属性和 CSS 变量：

- `data-card-style`
- `data-dashboard-style`
- `data-gradient-surfaces`
- `--ys-metric-*`
- `--ys-gradient-*`

## 常见开发入口

- 加排序：改 `src/utils/nodeSort.ts`，再看 `ThemeManage.tsx` 和 `FloatingControls.tsx` 是否需要设置入口。
- 加卡片外壳：改 `CARD_STYLE_PRESETS`、`normalizeVisualStyleSettings()`、`surface/node-card.css`。
- 改背板玻璃：入口在 `FloatingControls.tsx` 和 `ThemeManage.tsx` 的卡片与样式区，字段在 `useGradientBackground.ts`。
- 加展板样式：改 `DashboardStylePresetId`、默认值、`NodeCard.tsx` 渲染分支、`dashboardHelpers.tsx`、`surface/node-card.css`。
- 加液位形态：改 `LiquidShapeId`、`LIQUID_SHAPE_PRESETS`、`LiquidGauge` / `renderLiquidShape`、`surface/node-card.css`。
- 加跑马灯样式：改 `MarqueeShapeId`、`MARQUEE_STYLE_PRESETS`、`marqueeStyle.ts`。
- 改背景板：图片源在 `backgroundSettings.ts` / `BackgroundBoard.tsx`，渐变在 `useGradientBackground.ts` / `FloatingControls.tsx`。
- 改主题设置页：UI 在 `ThemeManage.tsx`，纯工具放 `src/pages/themeManage/`。

## 开发命令

```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit --pretty false
npm audit --audit-level=high
npm run build
npm run package
```

说明：

- `npm run lint` 使用根 `tsconfig`，有时对新增文件的报错不如 `tsc -p tsconfig.app.json` 直接，所以大改后两个都跑。
- `npm run build` 会先清理 `dist/`，再执行 `tsc -b && vite build`。
- `npm run package` 根据 `komari-theme.json` 生成 `komari-theme-YS-v版本号.zip`，如果同名包已存在会失败，避免覆盖旧版本。

## 发版检查

发版前至少确认：

1. `package.json`、`package-lock.json`、`komari-theme.json` 版本一致。
2. `komari-theme.json.url` 必须是 `https://github.com/youshi01/Komari_theme`。
3. `CHANGELOG.md` 顶部有当前版本更新内容。
4. `npm run lint`、`npx tsc -p tsconfig.app.json --noEmit --pretty false`、`npm audit --audit-level=high`、`npm run build` 通过。
5. `npm run package` 生成新的 zip，不能覆盖旧 zip。
6. 抽查 zip 内的 `komari-theme.json`，确认版本、作者、URL 正确。

## 维护注意事项

- 不要删除旧 zip，用户需要回退测试。
- 不要把管理员权限逻辑只放在前端。前端按钮可以隐藏，但安全必须靠后端 `/api/admin/*`。
- 背景上传会把图片保存成 base64，配置体可能很大。保存卡顿时优先检查 `saveThemeSettings()`、上传图数量、图片大小和压缩策略。
- 动效卡顿优先查 CSS animation、canvas 绘制频率、`wsStore` 更新频率、`NodeCard` 重渲染。
- CSS 已按功能拆分，保持 `src/styles/surface.css` 的导入顺序，不要随意互换。
- 新增样式时先复用现有 CSS 变量，避免每个组件单独硬编码颜色。
