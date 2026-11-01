import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { configureGradle } from "../scripts/android/configure-gradle.mjs";
import appConfig from "../app.config";
const template = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Native template default
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;
test("APK preview/release signing stays separate and template changes fail closed", () => {
  assert.equal(configureGradle(template, "preview"), template);
  const formal = configureGradle(template, "release");
  assert.match(
    formal,
    /storePassword System.getenv\('ANDROID_KEYSTORE_PASSWORD'\)/,
  );
  assert.equal(
    (formal.match(/signingConfig signingConfigs.release/g) || []).length,
    1,
  );
  assert.equal(
    (formal.match(/signingConfig signingConfigs.debug/g) || []).length,
    1,
  );
  assert.throws(() => configureGradle(formal, "release"));
  assert.throws(() =>
    configureGradle(
      template
        .replace("signingConfigs.debug", "signingConfigs.other")
        .replace("signingConfigs.debug", "signingConfigs.other"),
      "release",
    ),
  );
  assert.throws(() => configureGradle("unknown template", "preview"));
});
function signingStep(settings: Record<string, string | undefined>) {
  const dir = mkdtempSync(join(tmpdir(), "calendar-signing-"));
  const environmentFile = join(dir, "github-env");
  const env = {
    ...process.env,
    RUNNER_TEMP: dir,
    GITHUB_ENV: environmentFile,
    ANDROID_KEYSTORE_BASE64: "",
    ANDROID_KEYSTORE_PASSWORD: "",
    ANDROID_KEY_ALIAS: "",
    ANDROID_KEY_PASSWORD: "",
    ...settings,
  };
  const result = spawnSync(
    process.execPath,
    [resolve("scripts/android/prepare-signing.mjs")],
    { env, encoding: "utf8" },
  );
  return { dir, environmentFile, result };
}
test("zero-configuration signing needs no Expo account or secrets", () => {
  const run = signingStep({});
  try {
    assert.equal(run.result.status, 0, run.result.stderr);
    assert.equal(
      readFileSync(run.environmentFile, "utf8"),
      "APK_VARIANT=preview\n",
    );
    assert.equal(
      existsSync(join(run.dir, "my-calendar-signing.keystore")),
      false,
    );
  } finally {
    rmSync(run.dir, { recursive: true, force: true });
  }
});
test("private signing never writes passwords to generated source or logs", () => {
  const placeholder = "unit-test-placeholder-only";
  const settings = {
    ANDROID_KEYSTORE_BASE64: Buffer.from(
      "unit test bytes, not a real private key",
    ).toString("base64"),
    ANDROID_KEYSTORE_PASSWORD: placeholder,
    ANDROID_KEY_ALIAS: "test-alias",
    ANDROID_KEY_PASSWORD: placeholder,
  };
  const run = signingStep(settings);
  try {
    assert.equal(run.result.status, 0, run.result.stderr);
    const out = readFileSync(run.environmentFile, "utf8");
    assert.match(out, /APK_VARIANT=release/);
    assert.doesNotMatch(
      out + run.result.stdout + run.result.stderr,
      new RegExp(placeholder),
    );
    assert.equal(
      readFileSync(join(run.dir, "my-calendar-signing.keystore"), "utf8"),
      "unit test bytes, not a real private key",
    );
  } finally {
    rmSync(run.dir, { recursive: true, force: true });
  }
});
test("incomplete or malformed private signing never silently falls back to preview", () => {
  for (const settings of [
    { ANDROID_KEYSTORE_PASSWORD: "test-placeholder" },
    {
      ANDROID_KEYSTORE_BASE64: "!invalid!",
      ANDROID_KEYSTORE_PASSWORD: "test-placeholder",
      ANDROID_KEY_ALIAS: "alias",
      ANDROID_KEY_PASSWORD: "test-placeholder",
    },
  ]) {
    const run = signingStep(settings);
    try {
      assert.notEqual(run.result.status, 0);
      assert.equal(existsSync(run.environmentFile), false);
    } finally {
      rmSync(run.dir, { recursive: true, force: true });
    }
  }
});
test("preview has its own app identity; update version is validated and no EAS project is required", () => {
  const oldVariant = process.env.APK_VARIANT;
  const oldVersion = process.env.ANDROID_VERSION_CODE;
  const base = {
    name: "我的日历",
    slug: "wo-de-ri-li",
    android: { package: "com.yutaobai.mycalendar", versionCode: 1 },
  };
  const context = {
    config: base,
    projectRoot: resolve("."),
    staticConfigPath: resolve("app.json"),
    packageJsonPath: resolve("package.json"),
  };
  try {
    process.env.APK_VARIANT = "preview";
    process.env.ANDROID_VERSION_CODE = "42";
    const preview = appConfig(context);
    assert.equal(preview.android?.package, "com.yutaobai.mycalendar.preview");
    assert.equal(preview.android?.versionCode, 42);
    assert.equal(preview.extra?.eas, undefined);
    process.env.APK_VARIANT = "release";
    assert.equal(
      appConfig(context).android?.package,
      "com.yutaobai.mycalendar",
    );
    for (const invalid of ["0", "-1", "1.5", "abc", "2100000001"]) {
      process.env.ANDROID_VERSION_CODE = invalid;
      assert.throws(() => appConfig(context));
    }
  } finally {
    if (oldVariant === undefined) delete process.env.APK_VARIANT;
    else process.env.APK_VARIANT = oldVariant;
    if (oldVersion === undefined) delete process.env.ANDROID_VERSION_CODE;
    else process.env.ANDROID_VERSION_CODE = oldVersion;
  }
});
