#! /usr/bin/env bash

# This script handles distro-independent Linux post-install tasks. Currently
# that means creating the /keybase directory and making it writable. The deb-
# and rpm-specific post-install scripts call into this after doing their
# distro-specific work, which is mainly setting up package repos for updates.

set -u

# Create the /keybase root dir, if it doesn't already exist. We can't use a
# regular [ -e ... ] check, because stat'ing /keybase fails with a permissions
# error when kbfsfuse is mounted, so that check always returns false. Instead
# we check whether mkdir succeeds.
if mkdir /keybase &>/dev/null ; then
  chmod 777 /keybase
fi

# Update the GTK icon cache, if possible.
if which gtk-update-icon-cache &> /dev/null ; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor
fi
