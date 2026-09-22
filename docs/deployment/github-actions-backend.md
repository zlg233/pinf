# 后端 GitHub Actions 部署：root 密钥登录

工作流位于 `.github/workflows/backend-deploy.yml`。它只在 `zlg233/pinf` 的 `main` 分支收到后端、Compose 或工作流文件变更时自动运行，也可以手动运行。GitHub 托管 runner 用专用 SSH 密钥登录服务器的 `root` 账户，校验服务器主机指纹，从 `https://github.com/zlg233/pinf.git` 获取触发工作流的提交，然后只重建 `backend` 服务。

项目文件若只能由 root 操作，`BACKEND_PATH` 就应指向服务器上 **包含 `docker-compose.yml` 的项目根目录**，例如 `/root/pinf`；请以服务器上的实际 `pwd` 为准。这里的 SSH 密钥只用于 GitHub Actions 登录服务器，与服务器拉取公开 GitHub 仓库所用的 HTTPS 地址无关。

## 1. 在自己的电脑生成专用密钥

在 Windows PowerShell 运行（密钥放在个人 `.ssh` 目录，绝不能放进项目仓库）：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -a 100 -C "pinf-github-actions" -f "$env:USERPROFILE\.ssh\pinf-github-actions"
```

按提示设置独立的密钥口令。生成后会有私钥 `pinf-github-actions` 和公钥 `pinf-github-actions.pub`；**公钥**可以复制到服务器，**私钥**只保存在你的电脑和 GitHub Actions Secret 中。查看公钥：

```powershell
Get-Content "$env:USERPROFILE\.ssh\pinf-github-actions.pub"
```

## 2. 在 1Panel 的服务器终端安装公钥

通过 1Panel 打开服务器终端，确认 `whoami` 输出 `root`。执行：

```sh
install -d -m 700 -o root -g root /root/.ssh
cat >> /root/.ssh/authorized_keys
```

把上一步显示的 **整行公钥** 粘贴进去，按 Enter，再按 Ctrl+D 结束输入。接着执行：

```sh
chown root:root /root/.ssh /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
ssh-keygen -l -E sha256 -f /etc/ssh/ssh_host_ed25519_key.pub
```

最后一条输出里的 `SHA256:...` 是**服务器主机指纹**，用于 GitHub 变量 `DEPLOY_HOST_FINGERPRINT`。它与刚生成的个人密钥指纹不同。通过已登录的 1Panel 终端读取该值，不要直接信任网络扫描到的指纹。

如果服务器不允许 root 公钥登录，先在 1Panel 终端检查 `sshd -T | grep -i '^permitrootlogin'` 和 `sshd -T | grep -i '^pubkeyauthentication'`。`PermitRootLogin no` 会阻止 root 的任何 SSH 登录；在实际生效的 `/etc/ssh/sshd_config` 或已有的 `sshd_config.d` 配置中，将 `PermitRootLogin` 设置为 `prohibit-password`，确保 `PubkeyAuthentication yes`。避免在多个文件中留下相互冲突的设置。执行 `sshd -t` 检查语法，再用 `systemctl reload ssh`（部分发行版服务名为 `sshd`）重载，并重新运行 `sshd -T` 核对生效值。操作期间保持现有的 1Panel 终端打开。

## 3. 从自己的电脑验证密钥登录

在 Windows PowerShell 运行，将地址和端口换成实际值：

```powershell
ssh -i "$env:USERPROFILE\.ssh\pinf-github-actions" -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o PasswordAuthentication=no -p 22 root@服务器地址 "id -u"
```

首次连接如提示确认主机指纹，先与 1Panel 终端看到的 `SHA256:...` 比对。命令应输出 `0`，且不能要求输入 root 登录密码；如果设置了密钥口令，输入密钥口令是正常的。失败时先检查公钥内容、`/root/.ssh` 权限、SSH 端口和 `sshd` 配置。

## 4. 配置你的 GitHub fork

打开 `https://github.com/zlg233/pinf`，在 **Actions** 页面启用工作流。在 **Settings → Secrets and variables → Actions** 中设置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Secret | `DEPLOY_HOST` | 服务器公网 IP 或域名；GitHub 托管 runner 必须能访问它的 SSH 端口 |
| Secret | `DEPLOY_SSH_KEY` | `pinf-github-actions` **私钥的完整多行内容**，含首尾标记；不要填 `.pub` 公钥 |
| Secret（若密钥设置了口令） | `DEPLOY_SSH_PASSPHRASE` | 生成密钥时输入的口令；未设置则不创建 |
| Variable | `DEPLOY_HOST_FINGERPRINT` | 服务器主机公钥的 `SHA256:...` 指纹 |
| Variable | `BACKEND_PATH` | 服务器上包含 `docker-compose.yml` 的项目根目录，例如 `/root/pinf` |
| Variable（非 22 端口时） | `DEPLOY_SSH_PORT` | 实际 SSH 端口；未设置时工作流使用 `22` |

工作流固定使用 `root`，不再读取 `DEPLOY_USER` 和 `DEPLOY_PASSWORD`。不要把私钥或口令发到聊天、提交到 Git，或填入 GitHub Variable。GitHub 托管 runner 还必须能从公网访问服务器的 SSH 端口。

## 5. 首次部署和收尾

在服务器的项目根目录先检查：

```sh
pwd
git branch --show-current
git status --short
git ls-remote https://github.com/zlg233/pinf.git refs/heads/main
docker compose config --services
```

分支应为 `main`，服务列表应包含 `backend`。若服务器的 Git 历史与 fork 分叉，工作流的 `git merge --ff-only` 会停止，不会强制重置服务器上的代码。确认 GitHub 配置后再将本地 `main` 推到 fork；工作流随之部署。到 **Actions → Backend Deploy** 查看结果，并在服务器运行：

```sh
docker compose ps backend
curl -f http://localhost:5010/api/health
```

**只有电脑上的密钥登录和首次 GitHub Actions 部署都成功后**，再考虑关闭 root 的 SSH 密码登录：在实际生效的 sshd 配置中设置 `PermitRootLogin prohibit-password`，运行 `sshd -t` 校验并重载 SSH 服务，保持当前 1Panel 终端打开，再开一个新终端验证密钥登录。这个设置保留 root 公钥登录，同时禁用 root 的密码及键盘交互登录。随后可删除 fork 中不再使用的 `DEPLOY_USER`、`DEPLOY_PASSWORD` Secrets；无需在仓库中保存任何服务器密钥。

`docker compose up -d --build --no-deps backend` 只重建后端，不重建 `pgvector`、`updatedb` 或 `n8n`。小程序 `wx_end/` 仍需用微信开发者工具构建、预览和上传。
