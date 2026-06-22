# komari-theme-YS

komari-theme-YS 是一个面向 [Komari](https://github.com/komari-monitor/komari) 的主题，融合了众多主题的交互与展示思路。

![komari-theme-YS Preview](./preview-readme.png)

## 截图

白日模式首页截图：

<img src="https://cdn.nodeimage.com/i/wuhwH0FgiURqIDg1ao0mx5mE3P9v52cJ.webp" alt="wuhwH0FgiURqIDg1ao0mx5mE3P9v52cJ.webp">
<img src="https://cdn.nodeimage.com/i/x8ftY5VfZm5hK7ZgnYYMXltYGKEs3B5R.webp" alt="x8ftY5VfZm5hK7ZgnYYMXltYGKEs3B5R">

夜间模式首页截图：

<img src="https://cdn.nodeimage.com/i/tq7weonNbaXutEGchAmY2zYdF5DuTCkR.webp" alt="tq7weonNbaXutEGchAmY2zYdF5DuTCkR">
<img src="https://cdn.nodeimage.com/i/IPPto39Pc50gO56msFfC2wepdQ5XIVYY.webp" alt="IPPto39Pc50gO56msFfC2wepdQ5XIVYY">
管理面截图：

<img src="https://cdn.nodeimage.com/i/M14h8OZSdb8CyFmlXNCiR4B7XWR1yF2N.webp" alt="M14h8OZSdb8CyFmlXNCiR4B7XWR1yF2N">

<img src="https://cdn.nodeimage.com/i/90WStM408r5i3Rsh66C7MgqL04HWmoW7.webp" alt="90WStM408r5i3Rsh66C7MgqL04HWmoW7">

## 特性

- 首页为节点卡片与 Ping 任务视图做过一轮数据结构和渲染优化，优先保证大量节点下的流畅度。
- 首页顶部提供总览条，可快速查看当前时间、节点总数、在线数量、点亮地区、总上下行流量和总流量速率。
- WebSocket 刷新策略参考官方主题，尽量兼顾实时性与稳定性。
- 详情页整合了 Mochi 与 PurCarte 的一些优点，偏向高信息密度的状态展示。
- 支持首页服务器排序，可按自定义顺序、到期时间、名称和 CPU 占用排序；CPU 排序使用可配置快照间隔，减少实时数据导致的频繁跳动。
- 自定义排序支持拖拽调整，也保留置顶、上移、下移、置底按钮；新服务器会自动追加到列表末尾。
- 首页快捷面板支持本机排序覆盖，管理员可在主题管理页保存全站默认排序。
- 支持首页快捷调整渐变默认背板，内置薄荷、天青、晨粉、极光、灰白预设，也可自定义配色、角度、柔和度和网格；管理员可在主题管理页保存全站默认渐变样式，普通用户仍可保留本机外观覆盖。
- 支持卡片样式与指标配色预设，内置数据面板、清透玻璃、霓虹暗面、柔和彩块、极简白板等风格；CPU、内存、磁盘、负载、延迟、丢包率和上下行点阵都可单独自定义，游客可在首页保存本机样式，管理员可在主题管理页保存全站默认。
- 支持自定义背景板，可选择图片源或上传本地背景图，支持多图轮换、动态图片、透明度调节、图片置顶显示与快捷启用/关闭；大尺寸 JPEG 背景会自动优化，减少主题设置保存时的卡顿。
- 主题配置不走 `/admin/theme_managed` 的托管配置，而是通过 `?view=theme-manage` 提供前端配置页。

## 主题管理面板

komari-theme-YS 自带一个前端主题管理面板，入口不是后台菜单，而是首页右上角的一枚小按钮。

- 入口位置：登录后，首页右上角外观切换按钮旁边的滑杆图标按钮。
- 直接访问：`/?view=theme-manage`
- 主要用途：集中调整 komari-theme-YS 的默认外观、首页排序、首页 Ping 展示绑定与相关主题展示偏好。

目前面板里主要可以做这些事情：

- 设置主题默认外观：浅色、深色或跟随系统。
- 设置首页服务器排序：自定义、到期时间、名称、CPU 占用，并可调整 CPU 快照排序间隔。
- 拖拽调整首页服务器自定义顺序，也可以用按钮快速置顶、上移、下移或置底。
- 配置首页延迟检测：为首页节点卡片绑定对应的 Ping 任务。
- 设置全站默认卡片样式、指标配色和跑马灯配色。
- 设置全站默认渐变背板和图片背景板。
- 统一查看当前已绑定的首页 Ping 节点数量，并按任务筛选和搜索。
- 在保存前预览当前配置状态，必要时一键重置本次修改。

如果首页看不到这个按钮，通常是因为当前还没有登录。

## 安装

1. 下载最新的 `komari-theme-YS-vX.Y.Z.zip`。
2. 登录 Komari 后台，在主题管理中上传 ZIP 包并启用。

主题包内包含以下 Komari 主题所需文件：

- `dist/`
- `komari-theme.json`
- `preview.png`

## 开发

要求：

- Node.js 22+
- npm

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

构建：

```bash
npm run build
```

打包 Komari 主题 ZIP：

```bash
npm run package
```

## 参考

- [Komari 主题开发文档](https://komari-document.pages.dev/dev/theme.html)
- [Komari API 文档](https://komari-document.pages.dev/dev/api.html)
- [Komari RPC 文档](https://komari-document.pages.dev/dev/rpc.html)
- [官方主题 komari-web](https://github.com/komari-monitor/komari-web)
