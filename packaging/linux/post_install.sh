#! /usr/bin/env bash

# This script handles distro-independent Linux post-install tasks. Currently
# that means creating the /keybase directory and making it writable. The deb-
# and rpm-specific post-install scripts call into this after doing their
# distro-specific work, which is mainly setting up package repos for updates.

set -u

# Create the /keybase symlink to the first mountpoint, if it doesn't
# already exist. We can't use a regular [ -e ... ] check, because
# stat'ing /keybase fails with a permissions error when kbfsfuse is
# mounted, so that check always returns false. Instead we check
# whether mkdir succeeds.
rootlink="/keybase"
vardir="/var/lib/keybase"
mount1="$vardir/mount1"
sample="/opt/keybase/mount-readme"
khuser="root"
khuserDeprecated="keybasehelper"
khbin="/usr/bin/keybase-mount-helper"

chown "$khuser":"$khuser" "$khbin"
chmod 4755 "$khbin"
if mkdir $vardir &> /dev/null ; then
    ln -s "$sample" "$mount1"
    chown -R "$khuser":"$khuser" "$vardir"
fi

currlink=`readlink $rootlink`
if [ -z "$currlink" ] ; then
    if fusermount -uz "$rootlink" &> /dev/null ; then
        # Remove any existing legacy mount.
        echo Unmounting $rootlink...
        if killall kbfsfuse &> /dev/null ; then
            echo Shutting down kbfsfuse...
        fi
        echo You must run run_keybase to restore file system access.
    fi
    if [ -d "$rootlink" ] ; then
        if rmdir "$rootlink" &> /dev/null ; then
            echo Replacing old $rootlink directory.
        else
            echo WARNING: $rootlink access will not be available, because $rootlink is not empty.
        fi
    fi
    if ln -s -T "$mount1" "$rootlink" &> /dev/null ; then
        chown "$khuser":"$khuser" "$rootlink"
    fi
fi

# Delete the keybasehelper system user, to clean up after older
# versions.  TODO: remove this once sufficient time has passed since
# those old releases.
if userdel $khuserDeprecated &> /dev/null ; then
    echo Removing $khuserDeprecated system user, as it is no longer needed.
    # Switch /var/lib/keybase to be owned by root.
    chown -R "$khuser":"$khuser" "$vardir"
fi

# Update the GTK icon cache, if possible.
if which gtk-update-icon-cache &> /dev/null ; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor
fi
