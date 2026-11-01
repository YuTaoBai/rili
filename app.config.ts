import type { ConfigContext, ExpoConfig } from "expo/config";
/** IDs are public configuration. Authentication must stay in secure environment settings. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  const owner = process.env.EXPO_OWNER || config.owner;
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      projectId,
    )
  ) {
    throw new Error("EAS_PROJECT_ID 必须是 Expo 项目的 UUID（不是项目名称）");
  }
  return {
    ...config,
    name: "我的日历",
    slug: "wo-de-ri-li",
    ...(owner ? { owner } : {}),
    ...(projectId
      ? { extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } } }
      : {}),
  };
};
