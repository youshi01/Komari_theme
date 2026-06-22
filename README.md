# komari-theme-YS

komari-theme-YS 是一个面向 [Komari](https://github.com/komari-monitor/komari) 的主题，融合了众多主题的交互与展示思路。

![komari-theme-YS Preview](./preview-readme.png)

## 截图

白日模式首页截图：

[![nL9GD3QcqtLla7kWrqaAXj8Xfg0f9pPA.webp](https://cdn.nodeimage.com/i/nL9GD3QcqtLla7kWrqaAXj8Xfg0f9pPA.webp)](https://cdn.nodeimage.com/i/lsH75Tsk8zX9ACedXWo5VciZ0IKAu9Ln.webp)

夜间模式首页截图：

![pCDfjaqYE9gYxP0VJeAnX1zdFugqDiLD.webp](https://cdn.nodeimage.com/i/pCDfjaqYE9gYxP0VJeAnX1zdFugqDiLD.webp)

管理面截图：

![UQa2pV5jv1UPlJXLHoPia3QQO7Xn6jAS.webp](https://cdn.nodeimage.com/i/UQa2pV5jv1UPlJXLHoPia3QQO7Xn6jAS.webp)

## 特性

- 首页为节点卡片与 Ping 任务视图做过一轮数据结构和渲染优化，优先保证大量节点下的流畅度。
- WebSocket 刷新策略参考官方主题，尽量兼顾实时性与稳定性。
- 详情页整合了 Mochi 与 PurCarte 的一些优点，偏向高信息密度的状态展示。
- 主题配置不走 `/admin/theme_managed` 的托管配置，而是通过 `?view=theme-manage` 提供前端配置页。

## 主题管理面板

komari-theme-YS 自带一个前端主题管理面板，入口不是后台菜单，而是首页右上角的一枚小按钮。

- 入口位置：登录后，首页右上角外观切换按钮旁边的滑杆图标按钮。
- 直接访问：`/?view=theme-manage`
- 主要用途：集中调整 komari-theme-YS 的默认外观、首页 Ping 展示绑定与相关主题展示偏好。

目前面板里主要可以做这些事情：

- 设置主题默认外观：浅色、深色或跟随系统。
- 配置首页延迟检测：为首页节点卡片绑定对应的 Ping 任务。
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
- [Mochi 主题](https://github.com/svnmoe/komari-web-mochi)
- [PurCarte 主题](https://github.com/Montia37/komari-theme-purcarte)
