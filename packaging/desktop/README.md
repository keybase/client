## Building the Keybase.app

1. Install script dependencies:

			npm install

2. In `keybase/client/packaging/desktop`, run:

			package_darwin.sh

### Creating KBFS release

1. Because the repo is private, you need to export KBFS to the beta repo. See `keybase/client/packaging/export/` for details.

2. In `keybase/client/packaging/desktop`, run:

			build_kbfs.sh 1.0.0-27

3. Draft a release at https://github.com/keybase/kbfs-beta/releases with name `v1.0.0-27` and upload the generated file `build_kbfs/kbfs-1.0.0-27.tgz`.


## Re-package

You can specify the binpath for existing keybase and kbfs binaries, and re-package the app using:

```
KEYBASE_BINPATH=/Applications/Keybase.app/Contents/SharedSupport/bin/keybase KBFS_BINPATH=/Applications/Keybase.app/Contents/SharedSupport/bin/kbfs ./package_darwin.sh
```
