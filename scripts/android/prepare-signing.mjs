import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const names = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];
const present = names.filter((name) => !!process.env[name]);
if (!process.env.GITHUB_ENV || !process.env.RUNNER_TEMP)
  throw new Error("请通过 GitHub Actions 运行此步骤");
if (present.length && present.length !== names.length) {
  throw new Error(
    "正式签名需要四项 ANDROID_* Secrets 全部设置。删除未完成的配置即可继续零配置体验版。",
  );
}
if (!present.length) {
  appendFileSync(process.env.GITHUB_ENV, "APK_VARIANT=preview\n");
  console.log("无需账号或密钥配置：生成带离线资源的体验版 APK。");
} else {
  const encoded = process.env.ANDROID_KEYSTORE_BASE64.replace(/\s/g, "");
  const bytes = Buffer.from(encoded, "base64");
  if (
    !bytes.length ||
    bytes.length > 1024 * 1024 ||
    bytes.toString("base64") !== encoded
  )
    throw new Error("ANDROID_KEYSTORE_BASE64 格式无效");
  const path = join(process.env.RUNNER_TEMP, "my-calendar-signing.keystore");
  writeFileSync(path, bytes, { mode: 0o600, flag: "wx" });
  appendFileSync(
    process.env.GITHUB_ENV,
    `APK_VARIANT=release\nANDROID_KEYSTORE_PATH=${path}\n`,
  );
  console.log("已从安全设置准备正式签名，私钥不会上传到下载产物。");
}
