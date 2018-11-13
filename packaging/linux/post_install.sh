#! /usr/bin/env bash

# This script handles distro-independent Linux post-install tasks. Currently
# that means managing the /keybase redirector mountpoint. The deb-
# and rpm-specific post-install scripts call into this after doing their
# distro-specific work, which is mainly setting up package repos for updates.

set -u

rootmount="/keybase"
krbin="/usr/bin/keybase-redirector"
rootConfigFile="/etc/keybase/config.json"
disableConfigKey="disable-root-redirector"

vardirDeprecated="/var/lib/keybase"
khuserDeprecated="keybasehelper"
khbinDeprecated="/usr/bin/keybase-mount-helper"
optDeprecated="/opt/keybase/mount-readme"

redirector_enabled() {
  disableRedirector="false"
  if [ -r "$rootConfigFile" ] ; then
    if keybase --standalone -c "$rootConfigFile" config get -d "$disableConfigKey" &> /dev/null ; then
      disableRedirector="$(keybase --standalone -c "$rootConfigFile" config get -d "$disableConfigKey" 2> /dev/null)"
    fi
  fi
  [ "$disableRedirector" != "true" ]
}

make_mountpoint() {
  if redirector_enabled ; then
    if ! mountpoint "$rootmount" &> /dev/null; then
      mkdir -p "$rootmount"
      chown root:root "$rootmount"
      chmod 755 "$rootmount"
    fi
  fi
}

if redirector_enabled ; then
  chown root:root "$krbin"
  chmod 4755 "$krbin"
else
  # Turn off suid if root has been turned off.
  chmod a-s "$krbin"
fi

currlink="$(readlink "$rootmount")"
if [ -n "$currlink" ] ; then
    # Follow the symlink one level deep if needed, to account for the
    # mount1 link.
    nextlink="$(readlink "$currlink")"
    if [ -n "$nextlink" ]; then
        currlink="$nextlink"
    fi

    # Upgrade from a rootlink-based build.
    if rm "$rootmount" &> /dev/null ; then
        echo Replacing old $rootmount symlink.
    fi
elif [ -d "$rootmount" ] ; then
    # Handle upgrading from old builds that don't have the rootlink.
    currowner=`stat -c %U "$rootmount"`
    if [ "$currowner" != "root" ]; then
        # Remove any existing legacy mount.
        echo Unmounting $rootmount...
        if killall kbfsfuse &> /dev/null ; then
            echo Shutting down kbfsfuse...
        fi
        rmdir "$rootmount"
        echo You must run run_keybase to restore file system access.
    elif ! redirector_enabled ; then
        if killall `basename "$krbin"` &> /dev/null ; then
            echo "Stopping existing root redirector."
        fi
    elif killall -USR1 `basename "$krbin"` &> /dev/null ; then
        echo "Restarting existing root redirector."
        # If the redirector is still owned by root, that probably
        # means we're sill running an old version and it needs to be
        # manually killed and restarted.  Instead, run it as the user
        # currently running kbfsfuse.
        krName=`basename "$krbin"`
        krUser=`ps -o user= -C "$krName" 2> /dev/null | head -1`
        if [ "$krUser" = "root" ]; then
            newUser=`ps -o user= -C "kbfsfuse" 2> /dev/null | head -1`
            killall "$krName" &> /dev/null
            if [ -n "$newUser" -a "$newUser" != "root" ]; then
                # Try our best to get the user's $XDG_CACHE_HOME,
                # though depending on how it's set, it might not be
                # available to su.
                userCacheHome=`su -c 'echo -n $XDG_CACHE_HOME' - $newUser`
                log="${userCacheHome:-~$newUser/.cache}/keybase/keybase.redirector.log"
                su -c "nohup \"$krbin\" \"$rootmount\" &>> $log &" "$newUser"
                echo "Root redirector now running as $newUser."
            else
                # The redirector is running as root, and either root
                # is running kbfsfuse, or no one is.  In either case,
                # just make sure it restarts (since the -USR1 restart
                # won't work for older versions).
                echo "Restarting root redirector as root."
                killall "$krName" &> /dev/null
                logdir="${XDG_CACHE_HOME:-$HOME/.cache}/keybase"
                mkdir -p "$logdir"
                log="$logdir/keybase.redirector.log"
                nohup "$krbin" "$rootmount" &>> $log &
            fi
        fi
        t=5
        while ! mountpoint "$rootmount" &> /dev/null; do
            sleep 1
            t=$[t-1]
            if [ $t -eq 0 ]; then
                echo "Redirector hasn't started yet."
                break
            fi
       done
    fi
fi

# Make the mountpoint if it doesn't already exist by this point.
make_mountpoint

# Delete the keybasehelper system user, to clean up after older
# versions.  TODO: remove this once sufficient time has passed since
# those old releases.
if userdel $khuserDeprecated &> /dev/null ; then
    echo Removing $khuserDeprecated system user, as it is no longer needed.
    rm -f "$khbinDeprecated"
    rm -rf "$vardirDeprecated"
    rm -rf "$optDeprecated"
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
