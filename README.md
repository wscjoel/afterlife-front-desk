# 忘川前台 — AFTERLIFE FRONT DESK

> 死亡是免费的，但死后的一切都要排队。

1-bit 美学短篇视觉小说。玩家扮演已故的灵魂「澪 Mio」，在前往死后世界的最后一站被引导者招募成打工人，与两位前辈「奈美 Nami」「玲 Rei」一同处理各类逝者的接引事务。

## 特性

- **1-bit 双色美学**：纸色 × 墨色，抖动纹理 + 像素字体 + 涂鸦灵魂球
- **金句系统《亡语集》**：剧情中的高光台词自动收录，一键复制直接发社媒
- **灵魂参数面板**：不安 / 烦躁 / 嫉妒 / 愧疚 / 丧 / 清醒，随选择实时变化
- **好感度与多结局**：奈美线 / 玲线 / 离开线，结局附「灵魂鉴定书」
- **零依赖纯静态**：原生 HTML/CSS/JS，无构建步骤，打开即玩
- 自动存档（localStorage），支持移动端

## 本地运行

任意静态服务器即可：

```bash
cd 忘川前台
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 线上部署（任选其一）

### GitHub Pages

```bash
git init && git add -A && git commit -m "init"
# 推到 GitHub 后，在仓库 Settings → Pages → Source 选择 main 分支根目录
```

### Vercel

```bash
npm i -g vercel
vercel --prod
```

### Netlify

直接把整个文件夹拖进 [app.netlify.com/drop](https://app.netlify.com/drop) 即可。

## 项目结构

```
├── index.html        # 页面骨架
├── css/style.css     # 1-bit 美学样式
├── js/story.js       # 剧本数据（序章 + 三章 + 终章）
├── js/main.js        # 视觉小说引擎
└── assets/img/       # 角色立绘 / 标题图
```

## 改剧本

剧情全部在 `js/story.js`，节点格式见文件头注释。给任意台词加 `q:true` 即可让它进入《亡语集》。
