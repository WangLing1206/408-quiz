#!/usr/bin/env python3
"""生成安卓发布签名（keystore + keystore.properties）。

作者: wwl    签名名称: wwl_408

- keystore: mobile/android/keystore/wwl_408.jks
- alias:    wwl_408
- 证书 DN:  CN=wwl, OU=408, O=wwl, L=Beijing, ST=Beijing, C=CN
- 密码:     随机生成，写入 mobile/android/keystore.properties（已被 .gitignore 忽略）

用法: python tools/setup_signing.py
生成后请立刻备份 keystore 与 keystore.properties；丢失后无法覆盖升级已发布的应用。
"""
import os
import secrets
import shutil
import string
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID = os.path.join(ROOT, 'mobile', 'android')
KEY_DIR = os.path.join(ANDROID, 'keystore')
KEYSTORE = os.path.join(KEY_DIR, 'wwl_408.jks')
PROPS = os.path.join(ANDROID, 'keystore.properties')

ALIAS = 'wwl_408'
DNAME = 'CN=wwl, OU=408, O=wwl, L=Beijing, ST=Beijing, C=CN'


def keytool():
    found = shutil.which('keytool')
    if found:
        return found
    java_home = os.environ.get('JAVA_HOME')
    if java_home:
        p = os.path.join(java_home, 'bin', 'keytool.exe' if os.name == 'nt' else 'keytool')
        if os.path.exists(p):
            return p
    sys.exit('未找到 keytool，请安装 JDK 17 并加入 PATH')


def main():
    if os.path.exists(KEYSTORE) or os.path.exists(PROPS):
        sys.exit('签名已存在，未覆盖：%s\n如需重新生成，请先手动备份并删除现有 keystore 与 keystore.properties。' % KEYSTORE)
    os.makedirs(KEY_DIR, exist_ok=True)
    alphabet = string.ascii_letters + string.digits
    password = ''.join(secrets.choice(alphabet) for _ in range(28))
    cmd = [
        keytool(), '-genkeypair', '-v',
        '-keystore', KEYSTORE,
        '-storetype', 'PKCS12',
        '-alias', ALIAS,
        '-keyalg', 'RSA', '-keysize', '4096',
        '-validity', '10000',
        '-storepass', password,
        '-keypass', password,
        '-dname', DNAME,
    ]
    subprocess.run(cmd, check=True)
    with open(PROPS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# 题库练习发布签名（请备份，勿提交到公开仓库）\n')
        f.write('storeFile=keystore/wwl_408.jks\n')
        f.write('storePassword=%s\n' % password)
        f.write('keyAlias=%s\n' % ALIAS)
        f.write('keyPassword=%s\n' % password)
    print('签名已生成')
    print('  keystore :', KEYSTORE)
    print('  alias    :', ALIAS)
    print('  证书 CN  : wwl')
    print('  密码文件 :', PROPS, '（已加入 .gitignore）')


if __name__ == '__main__':
    main()
