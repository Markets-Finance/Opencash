#!/usr/bin/env bash
set -euo pipefail
version="${1:?usage: deploy/release-apk.sh <version e.g. 1.0.2> [notes]}"
notes="${2:-OpenCash $version}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must look like 1.2.3"; exit 1; }
repo="${RELEASE_REPO:-Markets-Finance/Opencash}"
root="$(cd "$(dirname "$0")/.." && pwd)"
IFS=. read -r major minor patch <<<"$version"
code=$((major * 10000 + minor * 100 + patch))

node -e '
const fs = require("fs");
const file = process.argv[1];
const app = JSON.parse(fs.readFileSync(file, "utf8"));
app.expo.version = process.argv[2];
app.expo.android.versionCode = Number(process.argv[3]);
fs.writeFileSync(file, JSON.stringify(app, null, 2) + "\n");
' "$root/mobile/app.json" "$version" "$code"
sed -i '' -E "s/versionCode [0-9]+/versionCode $code/; s/versionName \"[^\"]+\"/versionName \"$version\"/" "$root/mobile/android/app/build.gradle"

cd "$root/mobile/android"
EXPO_PUBLIC_BACKEND_URL=https://monad-api.opencash.in EXPO_PUBLIC_NETWORK=mainnet \
  ./gradlew :app:createBundleReleaseJsAndAssets --rerun assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a -q
apk="$root/mobile/android/app/build/outputs/apk/release/OpenCash.apk"
cp "$root/mobile/android/app/build/outputs/apk/release/app-release.apk" "$apk"
expected="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).expo.android.package)' "$root/mobile/app.json")"
aapt="$(ls -d "$HOME"/Library/Android/sdk/build-tools/*/ | tail -1)aapt2"
built="$("$aapt" dump badging "$apk" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
[[ "$built" == "$expected" ]] || { echo "APK package $built does not match app.json $expected"; exit 1; }

gh release create "v$version" "$apk" --repo "$repo" --title "OpenCash $version" --notes "$notes"
echo "released v$version (versionCode $code)"
