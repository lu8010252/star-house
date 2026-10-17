# ⭐ 星星屋

孩子积分成长系统:手机前台(赏罚 / 学习 / 专注 / 商城抽奖 / 我的:时光日历、各类记录)+ 家长网页后台(看板 / 孩子 / 规则 / 商城 / 积分记录 / 学习记录 / 设置),支持多个孩子,粉紫风。

## 部署(GitHub 自动构建镜像,服务器不需要源码)

推送到 `main` 后,GitHub Actions 自动构建 `ghcr.io/lu8010252/star-house:latest`(amd64 + arm64)。

服务器上只需要 `docker-compose.yml`(1Panel 编排里直接粘贴即可):

```bash
# 改 PASSWORD 后
docker compose up -d
# 更新:docker compose pull && docker compose up -d
```

- 手机前台:`http://服务器:8020/`
- 家长后台:`http://服务器:8020/admin.html`
- 数据在 `./data`,备份这个目录即可。
- 首次构建完成后,到 GitHub 个人主页 → Packages → star-house → Package settings,把可见性改为 **Public**,服务器才能免登录拉取。

## 安装包 APK(自动发布到 Releases)

APK 只是个壳,内容加载你服务器上的网页,所以以后改前端不用重新打包。

1. 仓库 Settings → Secrets and variables → Actions → **Variables** 新建 `SERVER_URL`(手机能访问到的地址,如 `https://home.example.com`)
2. Actions → **Build APK** → Run workflow(或推送标签 `git tag v1.0.0 && git push --tags`)
3. 构建完成后,APK 在仓库 [Releases](https://github.com/lu8010252/star-house/releases) 下载安装

> 不想装 APK 也可以:手机浏览器打开前台地址 → "添加到主屏幕"。

## 换形象图

后台 → 孩子管理 → 换形象图。建议透明底 PNG 的半身像,会显示在前台每个大卡片右侧。
