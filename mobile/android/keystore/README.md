# 安卓发布签名

本目录存放**发布签名私钥**，已通过 `.gitignore` 排除，不会进入 Git 仓库。

| 项目 | 值 |
| --- | --- |
| keystore | `wwl_408.jks` |
| alias | `wwl_408` |
| 作者 / 证书 CN | `wwl` |
| 密码 | 见 `mobile/android/keystore.properties` |

## 重要

1. **立即备份** `wwl_408.jks` 与 `keystore.properties`（离线保存，至少两份）。
2. 丢失私钥后，已发布的应用将无法再覆盖升级（只能换包名重新发布）。
3. 不要把这两个文件提交到公开仓库，也不要发给他人。
4. 重新生成会覆盖并导致签名不一致，请勿随意执行 `tools/setup_signing.py`。

## 构建签名 APK

```bash
cd mobile
npm run build:www
npx cap sync android
cd android
./gradlew assembleRelease
```

输出：`mobile/android/app/build/outputs/apk/release/app-release.apk`

签名信息查看：

```bash
# Windows
%ANDROID_HOME%\build-tools\34.0.0\apksigner.bat verify --print-certs app\build\outputs\apk\release\app-release.apk
```

首次安装 release 包前，请先卸载之前用其他签名（含 debug）安装的版本，否则会提示签名冲突。
