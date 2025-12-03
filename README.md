# WavesMan/Koishi-Registry

一个基于 Koishi 插件生态的插件市场数据构建与静态站点发布方案，整合扫描、数据压缩、服务端接口与前端 UI。此仓库在上游项目的基础上进行了自定义与优化，以便更容易地通过 GitHub Actions 自动生成 `index.json` 并部署到 `pages` 分支。

## 如何使用
1. 首先fork本仓库 >>[Fork](https://github.com/WavesMan/Koishi-Registry/fork)
2. 然后前往你的Fork仓库的设置页，选择 `Action > General`，将 `Workflow permissions` 设置为 `Read and write permissions`，记得**Save**
3. 前往GitHub Actions，你应该会看见一个失败的Action，你可以选择等待15分钟自动运行下一个工作流。但是建议你进入失败的Action，点击 `Re-run jobs` 重新运行。
4. 运行成功后你可以得到一个pages分支，比如 [https://github.com/WavesMan/Koishi-Registry/tree/pages](https://github.com/WavesMan/Koishi-Registry/tree/pages)
5. 打开你的静态网页Pages部署商，比如 `Tencent EdgeOne Pages` `Cloudflare Pages` 等，选择你的Fork仓库的pages分支，并设置好你的域名，等待部署完成即可

## 功能特点
- 扫描并收集 NPM 上的 `koishi-plugin-*` 包，增量/全量更新切换由配置控制（`src/scanner.ts:39-59`）。
- 提供 `/index.json` 接口输出压缩后的市场数据（`src/server.ts:46-59`）。
- 通过 `Ajv` 校验插件元数据 Schema（`src/schemas/koishi-plugin-schema.json`）。
- 分类与评分等辅助逻辑内置于 `src/utils/` 目录。

## 本地开发
- 安装依赖：`pnpm install`
- 同时启动前端与服务端：`pnpm dev`（内部使用并行启动 UI 与服务端，入口 `src/index.ts:6-9`）。
- 仅扫描生成数据：`pnpm scan`（输出至 `public/index.json`）。
- 仅启动服务端：`pnpm start`（提供 `GET /index.json`）。

## 构建与部署
- 构建全部：`pnpm build`（服务端使用 `rolldown` 构建，UI 由 `ui/` 子项目打包）。
- GitHub Actions 自动化：`.github/workflows/Update-Market.yml` 每 15 分钟触发一次扫描与部署，产物推送到 `pages` 分支并可直接用于静态站点。
- 运行所需的机密与环境变量通过仓库 Secrets 提供：`MONGODB_URI`、`CATEGORIES_API_BASE`/`CATEGORIES_API_URL`、`INCREMENTAL_UPDATE` 等（配置解析见 `src/config.ts:51-104`）。


## 目录结构
- `src/` 后端扫描与服务代码（入口 `src/index.ts:1-10`，扫描逻辑 `src/scanner.ts:1-59`，服务端 `src/server.ts:1-73`）。
- `ui/` 前端站点（Vite + Vue），打包产物用于静态部署。
- `public/` 扫描生成的 `index.json` 与静态资源（由工作流推送至 `pages` 分支）。
- `Dockerfile` 与 `docker-compose.yml` 提供容器化运行方式。

## 自动化工作流
- 工作流文件：`.github/workflows/Update-Market.yml`
- 触发条件：`schedule`（每 15 分钟）、`push` 到 `main`、手动 `workflow_dispatch`
- 主要步骤：依赖安装与构建 → 运行 `pnpm scan` → 推送 `public/` 到 `pages` 分支并生成 `CNAME`（如配置）。

## 许可证
- 本仓库遵循 [Mozilla Public License 2.0](LICENSE)
- 上游项目许可证：[Hoshino-Yumetsuki/koishi-registry_LICENSE](Hoshino-Yumetsuki/koishi-registry_LICENSE)，
    上游项目地址 [https://github.com/Hoshino-Yumetsuki/koishi-registry](https://github.com/Hoshino-Yumetsuki/koishi-registry)

## 贡献
欢迎通过 Pull Request 或 Issue 提交改进建议与新功能。
