import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
/** Fail closed if a future Expo template changes its release signing structure. */
export function configureGradle(source, variant) {
  if (!["preview", "release"].includes(variant))
    throw new Error("Unknown APK variant");
  const parts = source.split("    buildTypes {");
  if (parts.length !== 2 || !parts[0].includes("    signingConfigs {"))
    throw new Error(
      "Expo Android 模板已变化：找不到 signingConfigs/buildTypes",
    );
  if (source.includes("// MyCalendar private signing"))
    throw new Error("请重新 prebuild 后配置签名");
  const releaseStart = parts[1].indexOf("        release {");
  if (releaseStart < 0) throw new Error("找不到 release 构建类型");
  const release = parts[1].slice(releaseStart);
  if (
    (release.match(/signingConfig signingConfigs\.debug/g) || []).length !== 1
  )
    throw new Error("Expo release 签名模板已变化，需要重新检查");
  if (variant === "preview") return source;
  const privateSigning = `    signingConfigs {
        // MyCalendar private signing: values stay in process environment, never in source.
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }`;
  const head = parts[0].replace("    signingConfigs {", privateSigning);
  const tail =
    parts[1].slice(0, releaseStart) +
    release.replace(
      "signingConfig signingConfigs.debug",
      "signingConfig signingConfigs.release",
    );
  return head + "    buildTypes {" + tail;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const variant = process.env.APK_VARIANT || "preview";
  if (variant === "release") {
    for (const name of [
      "ANDROID_KEYSTORE_PATH",
      "ANDROID_KEYSTORE_PASSWORD",
      "ANDROID_KEY_ALIAS",
      "ANDROID_KEY_PASSWORD",
    ]) {
      if (!process.env[name]) throw new Error(`正式签名缺少 ${name}`);
    }
    if (!existsSync(process.env.ANDROID_KEYSTORE_PATH))
      throw new Error("正式签名文件不存在");
  }
  const path = resolve("android/app/build.gradle");
  writeFileSync(path, configureGradle(readFileSync(path, "utf8"), variant));
  console.log(
    variant === "preview"
      ? "体验版：使用模板测试签名，release 构建内置离线资源。"
      : "正式版：已配置环境变量签名。",
  );
}
