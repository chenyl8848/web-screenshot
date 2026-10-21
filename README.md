# WebScreenshot

一款跨浏览器网页截图扩展（Manifest V3），支持 **Chrome / Edge / Firefox**，可**捕获选中元素**和**捕获全页面**，输出 PNG / JPG / SVG 三种格式。

## 功能

- 🎯 **捕获选中元素**：进入选择模式后，鼠标悬停高亮目标元素，点击即可截图。
- 📄 **捕获全页面**：自动隐藏滚动条并撑开页面到完整内容高度，截取整页（含首屏之外的内容）。
- 🖼️ **多格式输出**：PNG / JPG / SVG。
- ⌨️ 选择模式下按 `ESC` 取消。

## 安装

### Chrome / Edge

1. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目目录 `web-screenshot`。

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`。
2. 点击「临时载入附加组件…」。
3. 选择本项目的 `manifest.json`。

> Firefox 下首次使用时，扩展会请求 `<all_urls>` 网站访问权限（用于后台拉取跨域图片）。授权后请**刷新目标页面**再截图——内容脚本只在页面加载时注入。

## 使用

1. 点击浏览器工具栏中的扩展图标，打开弹窗。
2. 选择截图格式（PNG / JPG / SVG）。
3. 点击「捕获全页面」直接截图；或点击「捕获选中元素」，在页面中移动鼠标高亮目标、点击完成截图（按 `ESC` 取消）。
4. 截图完成后自动下载到本地默认下载目录。

## 目录结构

```
web-screenshot/
├── manifest.json         # 扩展清单（MV3，Chrome/Edge/Firefox 共用）
├── background.js         # 后台脚本：Chrome 跑 Service Worker，Firefox 跑事件页；负责下载、跨域拉图
├── content-script.js     # 内容脚本：截图逻辑、选择模式、页面通知
├── popup.html            # 弹窗界面
├── popup.js              # 弹窗交互逻辑（含 Firefox 运行时权限申请）
├── snapdom.min.js        # 第三方 DOM 转图片库（含本地补丁，见下）
└── icons/                # 扩展图标
```

## 浏览器兼容说明

- **Chrome / Edge**：标准 Chromium MV3，直接可用（需 121+；更早版本会拒绝加载同时含 `background.scripts` 的 MV3 清单）。
- **Firefox**：`manifest.json` 同时声明了 `background.service_worker`（Chrome 用）与 `background.scripts`（Firefox 用）；`host_permissions` 在 Firefox 中属于可选权限，`popup.js` 会在用户点击截图时按需申请。`browser_specific_settings.gecko` 提供 Firefox 所需的扩展 ID 与最低版本（109+）。
- 代码统一使用 `chrome.*` 回调 API，Firefox 提供兼容 shim，无需额外 polyfill。

## 工作原理

- 页面截图由 [snapdom](https://github.com/zumerlab/snapdom)（DOM → 图片）完成，`content-script.js` 调用后得到图片 Blob，转成 base64 后发给后台 `background.js` 通过 `chrome.downloads` 下载。
- **跨域图片/图标**：普通页面里的 `<img>`、CSS 背景图若来自跨域源，页面脚本因 CORS 无法读取像素。本扩展通过后台 Service Worker + `host_permissions` 重新拉取图片，绕开页面 CORS 限制；若服务器 CORS 头损坏导致后台也无法拉取，则降级为透明占位，**保证截图不会因图片失败**。

## 已知限制

- 跨域图片若后台拉取也失败（服务器 CORS 头异常），会以空白占位，无法还原原图。
- 全页面截图对「内容放在固定高度的内部滚动容器」里的页面可能截不全（`body` 的 `scrollHeight` 不包含子容器内部滚动内容）。
- 全页面截图中 `position: fixed` 元素的位置可能不准（DOM 转 canvas 的通用局限）。

## 维护注意

`snapdom.min.js` 是 vendored 的压缩文件，且打了本地补丁（跨域图片优雅降级 + 后台拉图）。**升级 snapdom 版本后必须重新应用补丁**，否则跨域图片会导致截图失败。补丁细节见 `manifest.json` 的 `host_permissions`、`background.js` 的 `fetchImage` 处理，以及 `snapdom.min.js` 内 `P`/`d` 两处图片拉取逻辑。
