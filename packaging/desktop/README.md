## Building Keybase.app and DMG

1. Set the run mode by editing `react-native/react/constants/platform.native.desktop.js` and set the `const runMode` and `const isDev`. *TODO: Make this configurable/scripted*

2. Install script dependencies:

			npm install

3. In `keybase/client/packaging/desktop`, run:

			package_darwin.sh 1.0.4-4 1.0.0-28 <comment>

This will look for a keybase v1.0.4-4 release and build an app with that same version. The second arg is the kbfs version. The comment can be a commit sha or something to signify a new build when the keybase version is unchanged.

### Building keybase

This is temporary, I will move this into packaging/release so it's automatic when releases happen.

1. In `keybase/client/packaging/desktop`, run:

			build_keybase.sh 1.0.4-4

2. Draft a release at https://github.com/keybase/client/releases with name `v1.0.4-4` and upload the generated file `build_keybase/keybase-1.0.4-4.tgz`. The packager will look for keybase there.

### Building kbfs

1. Because the repo is private, you need to export kbfs to the beta repo. See `keybase/client/packaging/export/` for details.

2. In `keybase/client/packaging/desktop`, run:

			build_kbfs.sh 1.0.0-27

3. Draft a release at https://github.com/keybase/kbfs-beta/releases with name `v1.0.0-27` and upload the generated file `build_kbfs/kbfs-1.0.0-27.tgz`.

4. Update the packager script `kbfs_url` to point to the new version. *TODO: Make this an argument to script*
