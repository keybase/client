## Keybase FSKit module

This directory contains the macOS FSKit filesystem module scaffold that
replaces the legacy `kbfuse.bundle` path.

Expected artifact path for packaging/build scripts:

- `osx/FSKit/keybase.fs`

Current files:

- `Info.plist`
- `FSKit.entitlements`
- `KeybaseFSKitExtension.swift`
- `build.sh` (builds the `KeybaseFSKit` Xcode target and stages `keybase.fs`)

The production native FSKit extension target should eventually emit a signed
bundle at this same path so `osx/Scripts/build.sh` can embed it into
`KeybaseInstaller.app`.
