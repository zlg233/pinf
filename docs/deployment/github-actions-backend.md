# 后端 GitHub Actions 部署

此工作流位于 `.github/workflows/backend-deploy.yml`。它只在 `zlg233/pinf` 的 `main` 分支收到后端、Compose 或工作流文件变更时自动运行，也可以手动运行。部署时通过 SSH 登录服务器，从 `https://github.com/zlg233/pinf.git` 获取触发工作流的提交，再只重建 `backend` 服务。

## 首次配置

1. 打开 `https://github.com/zlg233/pinf` 的 **Actions** 页面，按页面提示启用工作流。
2. 在 **Settings → Secrets and variables → Actions** 中，创建以下仓库配置。不要将值写入代码或提交到 Git：

   | 类型 | 名称 | 内容 |
   | --- | --- | --- |
   | Secret | `DEPLOY_HOST` | 服务器公网 IP 或域名；GitHub 托管 runner 必须能连到它的 SSH 端口 22 |
   | Secret | `DEPLOY_USER` | 有权进入项目目录并运行 Docker Compose 的 SSH 用户 |
   | Secret | `DEPLOY_PASSWORD` | 上述用户的 SSH 密码；沿用原部署方式 |
   | Variable | `BACKEND_PATH` | **包含 `docker-compose.yml` 的项目根目录**，不是 `backend` 子目录 |

3. 在服务器上进入 `BACKEND_PATH`，先检查：

   ```sh
   git branch --show-current
   git status --short
   git ls-remote https://github.com/zlg233/pinf.git refs/heads/main
   docker compose config --services
   ```

   分支应为 `main`，服务列表应包含 `backend`。若有尚未提交的文件，先确认它们不会与即将拉取的代码冲突。服务器还必须能访问 GitHub。

4. 合并工作流和后端代码到 fork 的 `main` 后，到 **Actions → Backend Deploy** 查看首次运行结果。也可使用 **Run workflow** 手动触发。工作流会先检查四项配置；缺少配置时会在连接服务器前失败。

## 部署范围和失败处理

- `git merge --ff-only` 只接受服务器当前提交可快进到触发工作流的提交。若服务器代码与 fork 分叉，工作流会停止；先检查服务器的 `git log` 和 `git status`，不要用强制重置掩盖改动。
- `docker compose up -d --build --no-deps backend` 只重建后端，不重建 `pgvector`、`updatedb` 或 `n8n`。部署后在服务器运行 `docker compose ps backend` 和 `curl -f http://localhost:5010/api/health` 检查状态。
- 微信小程序代码在 `wx_end/`，本工作流不会上传小程序。小程序仍需通过微信开发者工具构建、预览和上传。
- 后续可以将密码认证换成专用 SSH 密钥；这需要在服务器和 fork 的 Actions Secrets 中同时配置，不属于这次迁移。
