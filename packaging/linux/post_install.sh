#! /usr/bin/env bash

# This script handles distro-independent Linux post-install tasks. Currently
# that means managing the /keybase redirector mountpoint. The deb-
# and rpm-specific post-install scripts call into this after doing their
# distro-specific work, which is mainly setting up package repos for updates.

# The script also attempts to restart services if the mountpoint is not being used.
# To disable this behavior, create /etc/keybase/config.json if it doesn't exist
# and add the key value pair { "disable-autorestart": true }.

set -u

rootmount="/keybase"
krbin="/usr/bin/keybase-redirector"
BASH=$(command -v bash)

redirector_enabled() {
  keybase --use-root-config-file config get --direct --assert-false --assert-ok-on-nil disable-root-redirector &> /dev/null
}

autorestart_enabled() {
  keybase --use-root-config-file config get --direct --assert-false --assert-ok-on-nil disable-autorestart &> /dev/null
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

systemd_exec_as() {
    user=$1
    shift

    # Keybase supports running with and without systemd. In order for `su`
    # to work with systemd commands, we need to pass in XDG_RUNTIME_DIR.
    # /run/user/{uid} is the default when using systemd. We can't know the
    # true value without installing systemd itself, which we don't want to
    # depend on, so we use this default. Users who want to use a custom
    # XDG_RUNTIME_DIR should specify it in their .profile so it is known
    # by su -, which doesn't load pam_systemd. Unfortunately, this also
    # results in an extra su invocation.
    user_xdg_runtime_dir=""
    # shellcheck disable=SC2016
    # Intentionally do not expand $XDG_RUNTIME_DIR; we want the user's shell to expand it
    if ! user_xdg_runtime_dir="$(su -s "$BASH" --login "$user" -c 'echo $XDG_RUNTIME_DIR')" || [ -z "$user_xdg_runtime_dir" ]; then
        user_xdg_runtime_dir="/run/user/$(id -u "$user")" || return 1
    fi

    # To support restarting without systemd, we'd also have to pass in DISPLAY,
    # but there's no easy way to figure that out.
    # With run_keybase, we pipe environment variables to the user's runtime directory,
    # so Keybase units will get the necessary environment from there, even though this su
    # shell doesn't have, e.g., DISPLAY.
    su --login "$user" -s "$BASH" -c "XDG_RUNTIME_DIR=$user_xdg_runtime_dir $* 2> /dev/null"
}

# Exits with 0 iff the given user is running the service with systemd
systemd_unit_active_for() {
    user=$1
    service=$2
    command -v systemctl &> /dev/null && systemd_exec_as "$user" "systemctl --user -q is-active $service"
}

systemd_restart_if_active() {
    user=$1
    service=$2
    if systemd_unit_active_for "$user" "$service"; then
        systemd_exec_as "$user" "systemctl --user restart $service"
    fi
}

safe_restart_systemd_services() {
    if ! autorestart_enabled; then
        echo "Keybase autorestart disabled. Restart manually by running 'run_keybase' for each user using Keybase."
        return 0
    fi

    while read -r pid; do
        if [ -z "$pid" ]; then
            continue
        fi

        # Since keybase is running, we can assume run_keybase has been run before
        # and the mountdir is configured (so, it is not a fresh install).
        user="$(ps -o user= -p "$pid")"

        # If the process terminated since the loop started somehow, skip
        # restarting
        if [ -z "$user" ]; then
            continue
        fi

        restart_instructions="Restart Keybase manually by running 'run_keybase' as $user."
        abort_instructions="Aborting Keybase autorestart for $user. $restart_instructions"

        if ! systemd_unit_active_for "$user" "keybase.service"; then
            echo "Keybase not running via systemd for $user."
            echo "$restart_instructions"
            continue
        fi

        if systemd_unit_active_for "$user" "kbfs.service"; then
            if ! mount="$(systemd_exec_as "$user" "/usr/bin/keybase config get --direct --bare mountdir")" || [ -z "$mount" ]; then
                echo "Could not find mountdir for $user via systemd."
                echo "$abort_instructions"
                continue
            fi

            # Mount found, abort autorestart for user if currently being used.
            # lsof exits with zero iff there are no errors and mount is being used
            # Be slightly aggressive and restart if lsof did hit errors (e.g., if mount didn't exist)
            if lsof_output="$(systemd_exec_as "$user" "lsof $mount" 2> /dev/null)"; then
                programs_accessing_mount="$(echo "$lsof_output" | tail -n +2 | awk '{print $1}' | tr '\n' ', ')"
                echo "KBFS mount $mount for user $user currently in use by ($programs_accessing_mount)."
                echo "Please stop these processes before restarting manually."
                echo "$abort_instructions"
                continue
            fi
        fi

        echo "Autorestarting Keybase via systemd for $user."
        # Reload possibly-new systemd unit files first
        systemd_exec_as "$user" "systemctl --user daemon-reload"
        systemd_restart_if_active "$user" "keybase.service"
        systemd_restart_if_active "$user" "kbfs.service"
        systemd_restart_if_active "$user" "keybase.gui.service"
        systemd_restart_if_active "$user" "keybase-redirector.service"
    done <<< "$(pidof /usr/bin/keybase | tr ' ' '\n')"
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
    currowner="$(stat -c %U "$rootmount")"
    if [ "$currowner" != "root" ]; then
        # Remove any existing legacy mount.
        echo Unmounting $rootmount...
        if killall kbfsfuse &> /dev/null ; then
            echo Shutting down kbfsfuse...
        fi
        rmdir "$rootmount"
        echo You must run run_keybase to restore file system access.
    elif ! redirector_enabled ; then
        if killall "$(basename "$krbin")" &> /dev/null ; then
            echo "Stopping existing root redirector."
        fi
    elif killall -USR1 "$(basename "$krbin")" &> /dev/null ; then
        echo "Restarting existing root redirector."
        # If the redirector is still owned by root, that probably
        # means we're sill running an old version and it needs to be
        # manually killed and restarted.  Instead, run it as the user
        # currently running kbfsfuse.
        krName="$(basename "$krbin")"
        krUser="$(ps -o user= -C "$krName" 2> /dev/null | head -1)"
        if [ "$krUser" = "root" ]; then
            newUser="$(ps -o user= -C "kbfsfuse" 2> /dev/null | head -1)"
            killall "$krName" &> /dev/null
            if [ -n "$newUser" ] && [ "$newUser" != "root" ]; then
                # Try our best to get the user's $XDG_CACHE_HOME,
                # though depending on how it's set, it might not be
                # available to su.
                userCacheHome="$(su -s "$BASH" -c "echo -n \$XDG_CACHE_HOME" - "$newUser")"
                log="${userCacheHome:-~$newUser/.cache}/keybase/keybase.redirector.log"
                su -s "$BASH" -c "nohup \"$krbin\" \"$rootmount\" &>> $log &" "$newUser"
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
                nohup "$krbin" "$rootmount" &>> "$log" &
            fi
        fi
        t=5
        while ! mountpoint "$rootmount" &> /dev/null; do
            sleep 1
            t=$((t-1))
            if [ $t -eq 0 ]; then
                echo "Redirector hasn't started yet."
                break
            fi
       done
    fi
fi

# Make the mountpoint if it doesn't already exist by this point.
make_mountpoint

# Update the GTK icon cache, if possible.
if command -v gtk-update-icon-cache &> /dev/null ; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor
fi

safe_restart_systemd_services
