#! /bin/bash

# This is a script that you can run on boot to kick off a nightly build loop.
# It requires tmux and gnome-terminal. One way to make it autostart, if you're
# running a standard desktop like Gnome or KDE, is to create
# ~/.config/autostart/nightly_build.desktop with the following:
#
# [Desktop Entry]
# Name=Keybase Nightly Build
# Type=Application
# Exec=bash -c "$HOME/client/packaging/linux/tmux_nightly.sh"
#
# Bash is required to interpret the $HOME variable. Adjust the path as needed.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

build_script="$here/docker_build.sh"

bash_target="$(mktemp)"
cat << END > "$bash_target"
# Wait for the network to come up.
while ! ping -c 3 github.com ; do
  sleep 1
done

"$build_script" nightly && \
  echo "That's weird, I didn't expect to quit." || \
  echo "OH NO! ERROR!"

# hang forever to keep tmux from dying
cat
END

gnome-terminal -e "tmux new-session bash $bash_target"
