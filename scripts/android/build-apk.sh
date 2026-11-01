#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export CI=1
export EXPO_OFFLINE=1
export APK_VARIANT="${APK_VARIANT:-preview}"
# Generated native files stay ignored; source and the lockfile are the canonical project.
node scripts/android/prebuild.mjs
node scripts/android/configure-gradle.mjs
(
  cd android
  ./gradlew :app:assembleRelease --no-daemon --max-workers=2 \
    -PreactNativeArchitectures=arm64-v8a,armeabi-v7a \
    -Pandroid.enableMinifyInReleaseBuilds=false \
    -Dorg.gradle.parallel=false \
    '-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m'
)
mkdir -p artifacts
cp android/app/build/outputs/apk/release/app-release.apk "artifacts/my-calendar-${APK_VARIANT}.apk"
(cd artifacts && sha256sum *.apk > SHA256SUMS.txt)
