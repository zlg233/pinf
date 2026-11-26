# 早护通 GitHub 协作规范

协作仓库为 [zlg233/pinf](https://github.com/zlg233/pinf)，集成分支为 `main`。这些规则适用于所有开发者和 Agent。项目结构、代码约定和部署纪律见 [AGENTS.md](AGENTS.md)。

## 开发分支

- 每个新功能或修复都从协作仓库最新的 `main` 创建独立分支。新增功能、协作工具和流程改进用 `feat/<简短描述>`，修复用 `fix/<简短描述>`。
- 分支名使用能表达任务的短语，例如 `feat/baby-growth-chart` 或 `fix/wechat-video-playback`。一条分支对应一项任务。多人或多个 Agent 共用同一个 checkout 时，可为不同任务使用独立的 Git worktree。
- 禁止在 `main` 上直接提交、推送或强推。紧急修复也走独立分支和 PR。

以下命令假设 `origin` 指向协作仓库。先用 `git status` 和 `git remote -v` 核对工作区和远端，保留已有改动。

```bash
git fetch origin main
git switch --no-track -c feat/baby-growth-chart origin/main
# 在分支完成修改、测试和提交后，推送该分支。
git push -u origin feat/baby-growth-chart
```

## PR 验收与合并

1. 在 GitHub 创建目标为 `zlg233/pinf:main` 的 PR。说明改动目的、影响范围、测试命令和结果。有界面变更时附截图或录屏，有数据库迁移或配置变更时说明执行和回滚方式。
2. 按改动范围运行本地验证。App 使用 `bun run lint`，运行 `bun x expo customize tsconfig.json` 生成 Expo 路由类型，再运行 `bun x tsc --noEmit`。小程序使用 `bun run build:weapp`，Vue 站点使用 `bun run build`。后端使用 `uv run --locked --with pytest==9.1.1 --with pytest-cov==7.1.0 pytest`。各命令在对应项目目录执行。
3. 需要补改时继续更新原分支。确认最新提交已经通过功能验收和 `PR Gate`，再通过 GitHub PR 合并。仓库配置的最低批准人数为 0。PR 仍需记录功能验收结果。
4. 合并后可删除任务分支。如需撤回，创建 `fix/*` 分支并通过新的 PR 提交回退。

## CI 与发布

- [PR CI](.github/workflows/pr-ci.yml) 对每个目标为 `main` 的 PR 检查分支名，并按改动路径运行 App、微信小程序、Vue 站点、后端和 Compose 检查。仅文档改动也会生成 `PR Gate` 结果。新提交会取消同一 PR 的旧检查。
- [main 保护规则](https://github.com/zlg233/pinf/rules/28166594) 要求通过 PR 合并，禁止强推和删除分支。首次接入 CI 时，先让本工作流在 PR 上生成 `PR Gate` 检查记录，再由维护者在保护规则中把它设为 GitHub Actions 的必需状态检查。接入期间，合并人负责在 PR 中确认检查结果。
- [Backend Deploy](.github/workflows/backend-deploy.yml) 在涉及后端、Compose 或部署工作流的变更合并到 `main` 后自动运行。手动重跑时也使用 `main`。部署串行执行。若服务器已包含更新的提交，较早提交对应的部署任务会跳过执行。实际部署完成以 Compose 确认后端通过 `/api/health` 检查为准。部署失败时从 GitHub Actions 查看日志和重跑，服务器操作遵守项目的部署纪律。
- App 标签继续触发现有 EAS 构建。Web 站点继续从 GitHub Actions 手动发布。
