## Building the Keybase.app

Install script dependencies:

    		npm install

To build from a Github release/version, specify versions:

    		KEYBASE_VERSION=1.0.9-0 KBFS_VERSION=1.0.0 ./package_darwin.sh

To build from existing binaries, specify binpaths:

    		KEYBASE_BINPATH=/path/to/keybase KBFS_BINPATH=/path/to/kbfs ./package_darwin.sh

To re-package app from existing binaries from an installed app bundle:

    		KEYBASE_BINPATH=/Applications/Keybase.app/Contents/SharedSupport/bin/keybase KBFS_BINPATH=/Applications/Keybase.app/Contents/SharedSupport/bin/kbfs ./package_darwin.sh

## Prerelease

For building a prerelease, see script in `keybase/client/packaging/prerelease`.
