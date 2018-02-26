#! /usr/bin/env bash

# This script handles distro-independent Linux post-install tasks. Currently
# that means managing the /keybase redirector mountpoint. The deb-
# and rpm-specific post-install scripts call into this after doing their
# distro-specific work, which is mainly setting up package repos for updates.

set -u

rootmount="/keybase"
krbin="/usr/bin/keybase-redirector"

vardirDeprecated="/var/lib/keybase"
khuserDeprecated="keybasehelper"
khbinDeprecated="/usr/bin/keybase-mount-helper"

# Delete the keybasehelper system user, to clean up after older
# versions.  TODO: remove this once sufficient time has passed since
# those old releases.
if userdel $khuserDeprecated &> /dev/null ; then
    echo Removing $khuserDeprecated system user, as it is no longer needed.
    rm -f "$khbinDeprecated"
    rm -rf "$vardirDeprecated"
fi

chown root:root "$krbin"
chmod 4755 "$krbin"

run_redirector() {
  logdir="${XDG_CACHE_HOME:-$HOME/.cache}/keybase"
  mkdir -p "$logdir"
  nohup "$krbin" "$rootmount" >> $logdir/keybase.redirector.log 2>&1 &
}

currlink=`readlink "$rootmount"`
if [ -n "$currlink" ] ; then
    # Upgrade from a rootlink-based build.
    if rm "$rootmount" &> /dev/null ; then
        echo Replacing old $rootmount symlink.
    fi
    if mountpoint "$currlink" &> /dev/null ; then
        echo Starting root redirector at $rootmount.
        run_redirector
    fi
elif [ -d "$rootmount" ] ; then
    # Handle upgrading from old builds that don't have the rootlink.
    currowner=`stat -c %U "$rootmount"`
    if [ $currowner != "root" ]; then
        # Remove any existing legacy mount.
        echo Unmounting $rootmount...
        if killall kbfsfuse &> /dev/null ; then
            echo Shutting down kbfsfuse...
        fi
        rmdir "$rootmount"
        echo You must run run_keybase to restore file system access.
    elif killall `basename "$krbin"` &> /dev/null ; then
        # Restart the root redirector in case the binary has been updated.
        fusermount -u "$rootmount"
        run_redirector
    fi
fi

if ! mountpoint "$rootmount" &> /dev/null; then
    mkdir -p "$rootmount"
    chown root:root "$rootmount"
    chmod 755 "$rootmount"
fi

# Update the GTK icon cache, if possible.
if which gtk-update-icon-cache &> /dev/null ; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor
fi
