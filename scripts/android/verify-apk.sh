#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
apk="artifacts/my-calendar-${APK_VARIANT:-preview}.apk"
test -s "$apk"
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
test -n "$sdk_root"
build_tools="$(find "$sdk_root/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
"$build_tools/apksigner" verify --verbose "$apk"
badging="$("$build_tools/aapt" dump badging "$apk")"
if [[ "$badging" == *"application-debuggable"* ]]; then
  echo '错误：APK 开启了调试模式'; exit 1
fi
if [[ "${APK_VARIANT:-preview}" = preview ]]; then
  expected=com.yutaobai.mycalendar.preview
else
  expected=com.yutaobai.mycalendar
fi
[[ "$badging" == *"package: name='$expected'"* ]] || { echo 'APK 包名与签名模式不匹配'; exit 1; }
# A release build must contain its JS/Hermes bundle: an open port is not enough.
python3 - "$apk" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as apk:
    bundle = apk.getinfo('assets/index.android.bundle')
    if bundle.file_size < 1000:
        raise SystemExit('APK 缺少完整离线 JS bundle')
    libs = {name.split('/')[1] for name in apk.namelist() if name.startswith('lib/') and name.endswith('.so')}
    if not {'arm64-v8a', 'armeabi-v7a'}.issubset(libs):
        raise SystemExit('APK 缺少目标手机架构的原生库')
print('签名、包名、非调试模式、离线资源和 ARM 架构检查通过。')
PY
