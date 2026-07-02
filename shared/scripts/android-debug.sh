#!/usr/bin/env bash
# Build + install + launch the Android debug app, skipping `expo run:android`'s
# dev-client deep link (keybase://expo-development-client/?url=...). That link is
# only handled by expo-dev-client, which this app does not bundle, so it 404s.
# A plain debug build connects to Metro at localhost:8081 via `adb reverse`, so
# we launch MainActivity directly instead.
set -euo pipefail

cd "$(dirname "$0")/.." # shared/

PKG=io.keybase.ossifrage
APK=android/app/build/outputs/apk/debug/app-debug.apk

# Build only the connected device's ABI (much faster). Falls back to the full
# reactNativeArchitectures list from gradle.properties if no device answers.
abi=$(adb shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '[:space:]' || true)
if [ -n "$abi" ]; then
	echo "Building for device ABI: $abi"
fi

# Build debug APK.
(cd android && ./gradlew :app:assembleDebug ${abi:+-PreactNativeArchitectures="$abi"})

# Install on the connected device/emulator.
adb install -r -d "$APK"

# Route the device's localhost:8081 to the host Metro server.
adb reverse tcp:8081 tcp:8081

# Start Metro in the background; kill it when this script exits.
npx expo start &
METRO_PID=$!
trap 'kill "$METRO_PID" 2>/dev/null || true' EXIT

# Wait for Metro to answer before launching, else the app red-screens.
until curl -fs http://localhost:8081/status >/dev/null 2>&1; do sleep 1; done

# Launch the app directly (no deep link).
adb shell am start -n "$PKG/.MainActivity"

# Keep Metro in the foreground.
wait "$METRO_PID"
