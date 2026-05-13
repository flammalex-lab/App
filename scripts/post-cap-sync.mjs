#!/usr/bin/env node
// Runs after `cap sync`. Stamps the iOS Info.plist with the camera +
// photo-library usage strings Apple requires before accepting a build
// that links Capacitor Camera, and adds the matching CAMERA permission
// to AndroidManifest.xml.
//
// Without these, the iOS App Store auto-rejects ("Missing Purpose String
// in Info.plist") and Android crashes the first time the camera button
// is tapped. Re-running is idempotent — we look for our marker comment
// before injecting.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MARKER = "<!-- flf-patch-cap-sync -->";

const IOS_KEYS = {
  NSCameraUsageDescription:
    "Used to scan product barcodes when building your order.",
  NSPhotoLibraryUsageDescription:
    "Used when attaching a photo to a delivery note.",
};

function patchInfoPlist() {
  const path = join(process.cwd(), "ios", "App", "App", "Info.plist");
  if (!existsSync(path)) {
    console.log(`[post-cap-sync] ${path} not found — skipping (run \`npx cap add ios\` first).`);
    return;
  }
  let xml = readFileSync(path, "utf-8");
  if (xml.includes(MARKER)) {
    console.log("[post-cap-sync] iOS Info.plist already patched.");
    return;
  }
  const injection = [
    `\t${MARKER}`,
    ...Object.entries(IOS_KEYS).flatMap(([key, value]) => [
      `\t<key>${key}</key>`,
      `\t<string>${value}</string>`,
    ]),
  ].join("\n");
  // Insert just before the final </dict> of the root plist.
  const finalDictIndex = xml.lastIndexOf("</dict>");
  if (finalDictIndex === -1) {
    console.error("[post-cap-sync] Info.plist has no </dict> — aborting.");
    process.exitCode = 1;
    return;
  }
  xml = xml.slice(0, finalDictIndex) + injection + "\n" + xml.slice(finalDictIndex);
  writeFileSync(path, xml);
  console.log("[post-cap-sync] iOS Info.plist patched with camera + photo strings.");
}

function patchAndroidManifest() {
  const path = join(
    process.cwd(),
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml",
  );
  if (!existsSync(path)) {
    console.log(`[post-cap-sync] ${path} not found — skipping (run \`npx cap add android\` first).`);
    return;
  }
  let xml = readFileSync(path, "utf-8");
  if (xml.includes("android.permission.CAMERA")) {
    console.log("[post-cap-sync] Android manifest already has CAMERA permission.");
    return;
  }
  // Insert the uses-permission inside <manifest> but before <application>.
  const insertAt = xml.indexOf("<application");
  if (insertAt === -1) {
    console.error("[post-cap-sync] AndroidManifest.xml has no <application> — aborting.");
    process.exitCode = 1;
    return;
  }
  const injection =
    '    <uses-permission android:name="android.permission.CAMERA" />\n' +
    '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n\n';
  xml = xml.slice(0, insertAt) + injection + "    " + xml.slice(insertAt);
  writeFileSync(path, xml);
  console.log("[post-cap-sync] Android manifest patched with CAMERA permission.");
}

patchInfoPlist();
patchAndroidManifest();
