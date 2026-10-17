# ⭐ 星星屋

孩子积分成长系统:手机前台(赏罚 / 学习 / 专注 / 商城抽奖 / 我的:时光日历、各类记录)+ 家长网页后台(看板 / 孩子 / 规则 / 商城 / 积分记录 / 学习记录 / 设置),支持多个孩子,粉紫风。

## 部署(Docker)

```bash
git clone <本仓库> && cd star-house
# 修改 docker-compose.yml 里的 PASSWORD
docker compose up -d --build
```

- 手机前台:`http://服务器:8020/`
- 家长后台:`http://服务器:8020/admin.html`
- 数据在 `./data`(db.json + uploads),备份这个目录即可。

## 做成 APK(Capacitor 套壳,云端构建)

APK 只是一个壳,内容始终加载你服务器上的网页,所以**以后改前端不用重新打包**。

1. 仓库 → Actions → **Build APK** → Run workflow
2. 填入手机能访问的服务器地址(如 `https://diary.example.com`;家里局域网可用 `http://192.168.x.x:8020`)
3. 跑完在 Artifacts 下载 `app-debug.apk` 安装

> 不想打包也可以:手机浏览器打开前台地址 → "添加到主屏幕",效果几乎一样。

## 换形象图

后台 → 孩子管理 → 换形象图。建议透明底 PNG 的半身像,会显示在前台每个大卡片右侧。
