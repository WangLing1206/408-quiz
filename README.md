# 题库练习 · v2.3 Beta

作者：**wwl** · 发布签名：**wwl_408**

数据结构、计算机组成原理、操作系统、计算机网络四科刷题应用。
同一套代码同时提供 **手机 PWA**、**安卓 App（Capacitor）** 与桌面网页。

> 题库共 **2235 道选择题 + 432 道综合应用题**，含教材配图；题库数据仅供个人学习使用。

---

## 功能

### 原有功能（已保留）
- **选择题练习**：按科目 / 章节逐题作答，提交后显示对错、正确答案与解析；答错自动进入错题本。
- **综合应用题辅导**：先看思路引导，自己动笔后再显示解答。
- **错题本**：本机保存、展开解析、删除、导出 JSON、错题重练。
- **学习统计**：各科 / 章节已做题数、正确率、近 7 天作答趋势。
- 答案默认隐藏；进度、错题均保存在本机。

### 新增
1. **手机 App**
   - 移动优先布局：底部标签栏、大触控区域、安全区适配、深浅色自动切换。
   - **PWA**：可「添加到主屏幕」，离线可用，支持快捷方式（刷题 / 图谱 / AI / 错题本）。
   - **安卓 APK**：`mobile/` 下为 Capacitor 工程，可直接构建安装包。
2. **知识图谱 + 错题诊断**
   - 四科 129 个知识点，按考纲整理先修关系，图谱用颜色表示掌握度、箭头表示先修依赖。
   - 每道题自动标注 1–3 个知识点（`tools/build_kg.py`）。
   - 依据作答与错题，计算掌握度，并沿先修关系**上溯推断疑似缺失的基础知识点**；支持一键生成补短板练习、知识点专项练习。
3. **AI 能力**（OpenAI 兼容协议，Key 仅存本机）
   - **快速问答**：独立对话页，可带当前题目/知识点上下文，流式输出、可停止、可清空。
   - **错题 AI 解析**：答题结果页、错题本内一键调用 AI，逐题分析错因、正确思路、易错点；解析结果本地缓存。
   - 预设 DeepSeek / OpenAI / Kimi / 智谱 / 通义 / Ollama，也可填任意兼容 `Base URL`。
   - 支持「测试连接」；Key 存放于浏览器 `localStorage`，只在发起请求时发送给所配置的服务商。
4. **题库在线更新**
   - 从 GitHub 仓库的 `data/bank.json` 清单检查版本，只下载有变化的分科题库与知识图谱。
   - 先完整下载并校验题量，通过后才写入 IndexedDB；失败不会破坏现有题库。
   - 同步的题库优先于内置题库加载，可随时「恢复内置题库」。
   - 新增题目的配图本地不存在时，自动回退到 GitHub 原始文件。
   - 支持自定义仓库 / 分支 / 加速前缀（如 `https://ghproxy.net/`）。

### v2.2 Beta 更新

- **三级刷题导航**：刷题页先显示四大学科大卡片，进入后显示章节列表，再进入具体答题。
- **两种答题模式**（设置中切换）：
  - **即时判分**：点击选项立即显示对错与解析，无需提交按钮。
  - **小节统一判分**：点击选项自动进入下一题，做完本节后统一显示正确率、每题对错与解析。
- **小节结果页**：正确率、逐题对错、你的答案/正确答案，支持继续答题、重做本节、返回章节。
- **全新图标**：使用 `tubiao.png` 裁剪缩放生成 PWA / iOS / Android / 启动图全套资源。
- **启动动画**：使用 `movie.mp4` 剪辑转换为 H.264 启动视频，PWA 与安卓同步展示启动动画。
- 多选题/填空题保留必要的「确认」按钮；专项练习固定即时判分。

### v2.1 Beta 更新

- **作答状态保留**：做过的题再次打开会直接显示作答结果、选项对错、解析与作答时间；支持「重做本题」。
- **清除本章作答**：章节列表右上角可手动清除该章全部作答记录与错题（热力图记录保留）。
- **完成度进度条**：首页、学习统计、章节圆环等进度条统一按「已做 / 总题数」显示，正确率单独以文字展示。
- **全新 SVG 图标**：重绘渐变知识网络图标，并同步生成 PWA、iOS、Android 与启动页资源。
- **月度做题热力图**：「我的」页新增当月每日做题热力图，按题目数量分级着色。
- **AI Markdown 排版**：支持标题、列表、表格、引用、链接、代码块与代码复制按钮，流式输出带光标效果。
- **刷题上下文保留**：从题目切到 AI 页会显示当前题目卡片，可一键返回题目或围绕该题提问。

---

## 本地运行

```bash
cd 408-quiz
python -m http.server 8000
# 浏览器打开 http://127.0.0.1:8000
```

需通过 HTTP 运行（ES Modules 与 Service Worker 不支持 `file://`）。

---

## 使用手机 App

### 方式一：PWA（最快）
- **Android Chrome**：打开站点 → 菜单 → 「安装应用」/「添加到主屏幕」。
- **iPhone Safari**：打开站点 → 分享 → 「添加到主屏幕」。
- 安装后全屏运行；首次打开后题库与配图会按需缓存，可离线使用。

### 方式二：安卓 APK
环境要求：Node.js 20+、JDK 17、Android SDK（platform 34 / build-tools 34）。

```bash
cd mobile
npm install
npm run build:www          # 复制网站资源到 mobile/www
npx cap sync android
cd android
# 首次构建：把 SDK 路径写入 local.properties
# Windows: sdk.dir=C:/Users/<你>/AppData/Local/Android/Sdk
# macOS/Linux: sdk.dir=/Users/<你>/Library/Android/sdk
./gradlew assembleDebug
```

APK 输出：`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

国内网络如遇 Maven 下载慢或 TLS 握手失败，可使用镜像初始化脚本：

```bash
cd mobile/android
./gradlew -I gradle/init.gradle assembleDebug
```

也可在 GitHub Actions 中手动运行 **「构建 Android APK」** 工作流，直接下载构建产物。

### 图标与启动动画

- 原始素材：`assets/source/tubiao.png`（图标）、`assets/source/movie.mp4`（启动动画）
- 图标生成：`python tools/make_icons.py`，会生成 PWA / iOS / Android 全套图标与安卓启动图
- 启动视频：`assets/media/launch.mp4`（由 movie.mp4 剪辑为 2.2s、H.264、无音轨），`launch-poster.jpg` 为首帧封面
- PWA 启动时在应用内播放启动动画；安卓端同时保留系统启动图，并在 WebView 加载后播放启动动画

### 发布签名（wwl_408）

本仓库使用作者 **wwl** 的发布签名，签名名称 **wwl_408**：

| 项目 | 值 |
| --- | --- |
| keystore | `mobile/android/keystore/wwl_408.jks` |
| alias | `wwl_408` |
| 证书 DN | `CN=wwl, OU=408, O=wwl, L=Beijing, ST=Beijing, C=CN` |
| 密钥 | RSA 4096，有效期 10000 天 |
| 密码 | `mobile/android/keystore.properties`（已被 `.gitignore` 忽略） |

首次生成（若已存在则不会覆盖）：

```bash
python tools/setup_signing.py
```

构建签名 Release APK：

```bash
cd mobile
npm run build:www
npx cap sync android
cd android
./gradlew assembleRelease
```

输出：`mobile/android/app/build/outputs/apk/release/app-release.apk`

验证签名：

```bash
%ANDROID_HOME%\build-tools\34.0.0\apksigner.bat verify --print-certs app\build\outputs\apk\release\app-release.apk
# 应显示 CN=wwl
```

> **务必备份** `wwl_408.jks` 与 `keystore.properties`。私钥丢失后，已发布应用无法覆盖升级。
> 在已经安装 Debug 包的设备上安装 Release 包前，需先卸载旧包（签名不同）。

Beta 构建产物：`mobile/dist/quiz-2.3.0-beta1-wwl_408-release.apk`（versionCode 5 / versionName 2.3.0-beta1，使用 `wwl_408` 签名）。

---

## AI 设置

进入「我的 → AI 设置」：

| 项目 | 说明 |
| --- | --- |
| 服务商 | 选择预设会自动填入 Base URL 与模型；也可选「自定义」 |
| Base URL | OpenAI 兼容地址，通常以 `/v1` 结尾，如 `https://api.deepseek.com/v1` |
| 模型 | 如 `deepseek-chat`、`gpt-4o-mini`、`qwen-plus` |
| API Key | 只保存在本机浏览器；公共设备用完请清除 |
| 温度 | 0 更严谨，1 更发散 |

支持流式（SSE）接口；若服务商不支持流式，可在设置中关闭。AI 请求由浏览器直接发往你填写的服务商，不经过本站服务器。

> **使用本地 Ollama**：Base URL 填 `http://localhost:11434/v1`（手机/模拟器访问电脑时用 `http://10.0.2.2:11434/v1` 或局域网 IP），并给 Ollama 设置跨域来源，例如启动前设置环境变量 `OLLAMA_ORIGINS=*`。
>
> 安卓 App 已允许明文 HTTP，便于连接局域网内的 Ollama；如果只用云端 HTTPS 服务，可自行收紧网络安全配置。

**隐私提示**：作答记录、错题、AI Key、对话缓存均保存在本机 `localStorage` / IndexedDB。清除浏览器数据会一并清空。

---

## 题库更新工作流

1. 修改 `data/<科目>.json`（保持 `sections[章节].qs` / `.bigq` 结构）。
2. 重新生成清单与知识图谱：

   ```bash
   python tools/build_kg.py
   ```

   该命令会：
   - 校验题库与知识体系映射；
   - 为每道题标注知识点，生成 `data/kg.json`；
   - 计算各科 SHA-256，生成 `data/bank.json`（版本号 / 题量 / 校验和）。

3. 提交并推送 `data/`、`tools/kg_source.json` 的变更。
   - 仓库自带 `.github/workflows/rebuild-data.yml`，也会在数据变更后自动重建并提交 `bank.json` / `kg.json`。
4. 用户端进入「我的 → 题库更新 → 检查更新 → 立即同步」即可增量更新。

> 注意：客户端以 `data/bank.json` 的版本号判断更新，**修改题库后必须重新生成清单**，否则不会提示更新。
> 可用 `python tools/build_kg.py --check` 只做校验、不写文件。

### 知识体系维护
- 知识点、关键词、先修关系、章节映射都在 `tools/kg_source.json`。
- 新增知识点后重新运行 `tools/build_kg.py`；脚本会检查：
  - 知识点 id 是否重复；
  - 先修关系是否指向不存在的知识点；
  - 章节映射是否对应真实题库章节；
  - 是否有知识点未关联任何题目（仅警告）。

---

## 项目结构

```
408-quiz/
├─ index.html                 应用壳
├─ manifest.webmanifest       PWA 清单
├─ sw.js                      Service Worker（离线缓存）
├─ assets/
│  ├─ css/style.css           移动优先样式（含深色模式）
│  ├─ js/
│  │  ├─ app.js               路由与全部视图
│  │  ├─ core.js              DOM / 存储 / IndexedDB / Markdown
│  │  ├─ store.js             进度、错题、设置、对话、缓存
│  │  ├─ bank.js              题库加载（内置 + 同步覆盖层）
│  │  ├─ kg.js                知识图谱计算与薄弱点推断
│  │  ├─ ai.js                OpenAI 兼容流式客户端与提示词
│  │  └─ sync.js              GitHub 题库同步
│  ├─ icons/                  PWA / iOS 图标
│  ├─ media/                  启动动画与封面
│  └─ source/                 原始素材（tubiao.png / movie.mp4）
├─ data/
│  ├─ 数据结构.json 等        题库
│  ├─ kg.json                 知识图谱 + 题目知识点标签
│  ├─ bank.json               题库清单（同步用）
│  └─ img/                    题目配图
├─ tools/
│  ├─ kg_source.json          知识体系源数据（人工维护）
│  ├─ build_kg.py             生成 kg.json / bank.json
│  ├─ build_www.py            打包 mobile/www
│  ├─ make_icons.py           由 tubiao.png 生成图标与启动图
│  └─ setup_signing.py        生成 wwl_408 发布签名
├─ mobile/                    Capacitor 安卓工程
└─ .github/workflows/         Pages 部署、数据重建、APK 构建
```

### 题库 JSON 格式
```jsonc
{
  "name": "数据结构",
  "sections": {
    "1.1": {
      "title": "数据结构的基本概念",
      "qs": [[1, "C", "题干", "解析", ["A. ...", "B. ..."], "img/数据结构/1.1/q_1.png"]],
      "bigq": [[1, "题干", "解答", [["", "思路提示"]], "配图", "解答配图"]]
    }
  }
}
```

### 知识图谱格式
```jsonc
{
  "subjects": [{
    "id": "ds", "name": "数据结构",
    "chapters": [{ "id": "ds5", "name": "树与二叉树",
      "kps": [{ "id": "ds5-3", "name": "二叉树的遍历", "keywords": ["先序"], "pre": ["ds5-2"] }] }]
  }],
  "edges": [{ "from": "ds5-2", "to": "ds5-3" }],
  "tags": { "数据结构": { "5.3": { "qs": { "1": ["ds5-3"] } } } }
}
```

---

## 部署

- **GitHub Pages**：`.github/workflows/pages.yml` 会在推送到 `main` 时自动部署；也可在仓库 Settings → Pages 选择分支目录。
- **任意静态服务器**：部署整个仓库根目录即可（`data/` 与 `assets/` 必须可访问）。
- **安卓**：见上文 APK 构建；正式发布请自行生成签名并配置 `signingConfigs`。

---

## 说明

- 题库与配图版权归原书作者 / 出版方所有，本项目仅用于个人学习，请勿用于商业用途。
- AI 生成内容仅供参考，请以教材为准。
- 知识图谱的先修关系与薄弱点推断是启发式估计，样本越多越准确。
