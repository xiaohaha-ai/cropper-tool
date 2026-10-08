# 首页新增工具

- `lego/`：积木工坊，保留自由拼搭、模型拼搭、零件图鉴和作品文件导入导出。
- `layout/`：秀米风格本地排版工具，保留图文编辑、素材管理、导入和导出。

本目录保存用于网页版的项目源码，网站实际入口位于仓库根目录的 `lego/` 和 `layout/`。整合时未修改电脑上的原项目。

## 重新构建

需要 Node.js 22.18+、npm 和 Python 3。首次使用分别在 `tools/apps/lego`、`tools/apps/layout` 执行 `npm ci`，然后在仓库根目录运行：

```sh
python3 tools/build-integrated-apps.py --base /cropper-tool/
```

构建脚本在忽略的 `output/integrated-apps-build` 中适配路径和返回入口，生成两个可直接部署的静态工具。秀米的四款字体和扩展字库复用 `font-library` 中的完整字体，许可证随排版工具一起提供；在网络版中按实际文字和字重加载常用字、模板补充字和完整字库，不提前下载全部字重。模板补充字由 `tools/build_layout_supplements.py` 生成；默认构建复用已经提交的小字库。

本地预览时，需要将网站挂载在 `/cropper-tool/` 下；独立站点可以使用 `--base /` 重新构建。更改源码或路径后，应重新构建并提交生成目录。

## 数据和验证

作品和文章保存在当前浏览器、当前网址的本地存储中，不会自动从 `127.0.0.1` 迁移。旧版文章可先导出 JSON 工程，再在新网址导入；积木作品使用 `.brick.json` 文件迁移。

源码测试：在排版目录执行 `npm test`；在积木目录执行 `npm run check:guided`、`npm run check:assembly`、`npm run check:shortcuts`。发布前还需验证真实浏览器中的首页入口、积木拼搭与保存、文章编辑与保存、内嵌字体和图片的 HTML 导出，以及返回首页链接。

## 工具站体验

全站通过 `tool-switcher.js` 提供五个工具的切换入口。首页手机端使用紧凑卡片；积木页支持收起零件栏及就近的模型放置按钮。排版页提供显式 JSON 备份、工程导入，并在切换工具前等待文章保存完成。

`creative-tool-recent:lego` 和 `creative-tool-recent:layout` 只记录已保存作品的标题与时间，首页用它们显示继续入口，实际文章和模型仍使用原有存储。更新网站不会清空作品存储。

Service Worker 只预缓存约 0.4 MB 首页资源；去水印、字体和其他工具资源在实际请求时缓存。升级只淘汰旧版静态缓存，不删除文章、作品或字体库的专用缓存。
