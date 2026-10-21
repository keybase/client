## macOS packaging resources

The macOS app is the Electron app in `shared/desktop`, packaged by
`packaging/desktop/package_darwin.sh`. This directory keeps only the two files
that script uses:

- `Keybase.entitlements`: the entitlements `Keybase.app` is signed with.
- `Resources/ExtendedAttributeFinderInfo.bin`: copied into the app's
  resources.

Keybase no longer ships a native installer, a root helper or its own FUSE
driver on macOS. To use Keybase in Finder, install macFUSE from
https://macfuse.io and turn on Finder access in the app.

Older versions installed a root helper (`keybase.Helper`), Keybase's own FUSE
driver and the `/keybase` redirector. The app removes them once, behind one
administrator prompt, by running `keybase uninstall --components=helper`; the
code is in `go/install` (`retireLegacyHelper`). You can run that command
yourself if you declined the prompt.
