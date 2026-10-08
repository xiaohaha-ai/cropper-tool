# 首页新增工具

- `lego/`：积木工坊，保留自由拼搭、模型拼搭、零件图鉴和作品文件导入导出。
- `layout/`：秀米风格本地排版工具，保留图文编辑、素材管理、导入和导出。

本目录保存原项目的源码快照，网站实际入口位于仓库根目录的 `lego/` 和 `layout/`。整合时未修改电脑上的原项目。

## 重新构建

需要 Node.js 22.18+、npm 和 Python 3。首次使用分别在 `tools/apps/lego`、`tools/apps/layout` 执行 `npm ci`，然后在仓库根目录运行：

```sh
python3 tools/build-integrated-apps.py --base /cropper-tool/
```

构建脚本在忽略的 `output/integrated-apps-build` 中适配路径和返回入口，生成两个可直接部署的静态工具。秀米的四款字体和扩展字库复用 `font-library` 中的完整字体，许可证随排版工具一起提供；在网络版中按需加载字体，不提前下载全部字重。

本地预览时，需要将网站挂载在 `/cropper-tool/` 下；独立站点可以使用 `--base /` 重新构建。更改源码或路径后，应重新构建并提交生成目录。

## 数据和验证

作品和文章保存在当前浏览器、当前网址的本地存储中，不会自动从 `127.0.0.1` 迁移。旧版文章可先导出 JSON 工程，再在新网址导入；积木作品使用 `.brick.json` 文件迁移。

源码测试：在排版目录执行 `npm test`；在积木目录执行 `npm run check:guided`、`npm run check:assembly`、`npm run check:shortcuts`。发布前还需验证真实浏览器中的首页入口、积木拼搭与保存、文章编辑与保存、内嵌字体和图片的 HTML 导出，以及返回首页链接。
