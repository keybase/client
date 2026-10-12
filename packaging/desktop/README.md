## Building the Keybase.app

Install script dependencies:

    		yarn

package_darwin.sh packages locally built binaries. Specify their paths:

    		KEYBASE_BINPATH=/path/to/keybase KBFS_BINPATH=/path/to/kbfs GIT_REMOTE_KEYBASE_BINPATH=/path/to/git-remote-keybase UPDATER_BINPATH=/path/to/updater ./package_darwin.sh

REDIRECTOR_BINPATH defaults to keybase-redirector next to KBFS_BINPATH.

To re-package app from existing binaries from an installed app bundle:

    		bin=/Applications/Keybase.app/Contents/SharedSupport/bin
    		KEYBASE_BINPATH=$bin/keybase KBFS_BINPATH=$bin/kbfs GIT_REMOTE_KEYBASE_BINPATH=$bin/git-remote-keybase UPDATER_BINPATH=$bin/updater ./package_darwin.sh

## Prerelease

For building a prerelease, see script in `keybase/client/packaging/prerelease`.
