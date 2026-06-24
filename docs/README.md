# docs/ — GitHub Pages 门面页

本目录是仓库的 GitHub Pages 静态站点源码。

## 启用方式

在 GitHub 仓库 `Settings → Pages` 中选择：

- **Source**：`Deploy from a branch`
- **Branch**：`master`
- **Folder**：`/docs`

保存后稍等几分钟，访问 `https://smile-xuc.github.io/aihw-starter/` 即可看到门面页。

## 文件构成

- [`index.html`](./index.html)：单文件门面页（含全部样式与导航），Hero + 品类卡片 + 角色入口 + 生态索引 + 路线图
- 后续可拓展：`category-XX.html`（每品类详情页）、`assets/`（静态资源）、`_config.yml`（如改用 Jekyll）

## 设计原则

- **单文件优先**：HTML + CSS 内联，方便 fork / 本地预览
- **客观中立**：站位声明明确，不为单一厂商背书
- **入口清晰**：方案商 / 品牌商 / 开发者 / 研究者 四类角色各有最短路径
- **暗色主题**：长时间阅读友好

## 本地预览

```bash
# 任选其一
python3 -m http.server 8000 --directory docs
npx http-server docs -p 8000
```

然后浏览器访问 `http://localhost:8000/`。

## 贡献

如果想优化门面页：

1. 修改 `index.html`（请保持单文件结构）
2. 在本地或浏览器中预览
3. 提交 PR，标题前缀 `[docs]`

详见根目录 [`CONTRIBUTING.md`](../CONTRIBUTING.md)。
