---
name: bumping-versions
description: Use when upgrading the Keybase client version number - lists all files that must be updated together
---

# Bumping Versions

Update all four files together when changing the version number:

| File | Field |
|------|-------|
| `go/libkb/version.go` | `const Version = "X.X.X"` |
| `shared/ios/Keybase/Info.plist` | `CFBundleShortVersionString` |
| `shared/ios/KeybaseShare/Info.plist` | `CFBundleShortVersionString` |
| `shared/android/app/build.gradle` | `def VERSION_NAME = "X.X.X"` |
