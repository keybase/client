# Updater

Updater uses Sparkle appcasts to update the app.

### Pre-requisites

 * Github markup `gem install github-markup`

### Build

1. Create notes/Keybase-x.y.z.md
1. Run `sh generate.sh x.y.z`
1. Update site/appcast.xml with new version info (at top)
1. Upload site/* and Keybase-x.y.z.dmg to the update host.
