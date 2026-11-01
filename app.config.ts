import type { ConfigContext, ExpoConfig } from "expo/config";
/** Native configuration only: cloud builds do not use an Expo account or project. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APK_VARIANT || "release";
  if (variant !== "preview" && variant !== "release")
    throw new Error("APK_VARIANT 必须是 preview 或 release");
  const code =
    process.env.ANDROID_VERSION_CODE ||
    String(config.android?.versionCode || 1);
  if (!/^[1-9]\d*$/.test(code) || Number(code) > 2100000000)
    throw new Error("ANDROID_VERSION_CODE 必须是有效的正整数");
  const preview = variant === "preview";
  return {
    ...config,
    name: preview ? "我的日历·体验版" : "我的日历",
    slug: "wo-de-ri-li",
    android: {
      ...config.android,
      package: preview
        ? "com.yutaobai.mycalendar.preview"
        : "com.yutaobai.mycalendar",
      versionCode: Number(code),
    },
  };
};
