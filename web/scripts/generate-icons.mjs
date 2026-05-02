/**
 * PLEX ロゴ (web/public/logo.png) からアイコン一式を生成
 *
 * 出力:
 * - mobile/assets/icon.png          1024x1024  白背景 + ロゴ中央
 * - mobile/assets/adaptive-icon.png 1024x1024  ロゴのみ (Android adaptive 前景)
 * - mobile/assets/splash-icon.png   1024x1024  白背景 + ロゴ (余白広め)
 * - mobile/assets/favicon.png       48x48     Expo Web 用
 * - web/public/favicon.png          180x180   iOS ホーム追加
 * - web/public/favicon-32.png       32x32     ブラウザタブ
 *
 * 使い方: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const LOGO = resolve(ROOT, "web/public/logo.png");

const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function makeIcon({ outPath, size, padding, bg = WHITE_BG }) {
  const inner = Math.round(size * (1 - padding * 2));
  const logoBuf = await sharp(LOGO)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([
      {
        input: logoBuf,
        left: Math.round(size * padding),
        top: Math.round(size * padding),
      },
    ])
    .png()
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size})`);
}

// Android adaptive 前景: 透明背景 + ロゴ (安全領域内に収める)
async function makeAdaptiveForeground({ outPath, size = 1024 }) {
  const inner = Math.round(size * 0.55);
  const logoBuf = await sharp(LOGO)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: logoBuf,
        left: Math.round((size - inner) / 2),
        top: Math.round((size - inner) / 2),
      },
    ])
    .png()
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size}, adaptive 透明背景)`);
}

async function main() {
  mkdirSync(resolve(ROOT, "mobile/assets"), { recursive: true });
  mkdirSync(resolve(ROOT, "web/public"), { recursive: true });

  // Mobile
  await makeIcon({
    outPath: resolve(ROOT, "mobile/assets/icon.png"),
    size: 1024,
    padding: 0.18,
  });
  await makeAdaptiveForeground({
    outPath: resolve(ROOT, "mobile/assets/adaptive-icon.png"),
    size: 1024,
  });
  await makeIcon({
    outPath: resolve(ROOT, "mobile/assets/splash-icon.png"),
    size: 1024,
    padding: 0.28,
  });
  await makeIcon({
    outPath: resolve(ROOT, "mobile/assets/favicon.png"),
    size: 48,
    padding: 0.10,
  });

  // Web
  await makeIcon({
    outPath: resolve(ROOT, "web/public/favicon.png"),
    size: 180,
    padding: 0.14,
  });
  await makeIcon({
    outPath: resolve(ROOT, "web/public/favicon-32.png"),
    size: 32,
    padding: 0.08,
  });

  console.log("\nAll icons generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
