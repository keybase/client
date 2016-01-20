#! /bin/bash

# This script handles distro-independent Linux post-install tasks. Currently
# that means creating the /keybase directory and making it writable. The deb-
# and rpm-specific post-install scripts call into this after doing their
# distro-specific work, which is mainly setting up package repos for updates.

set -e -u -o pipefail

make_keybase_root_dir() {
  # We can't use a regular [ -e ... ] check, because stat'ing /keybase fails
  # with a permissions error when kbfsfuse is mounted, so that check always
  # returns false. Instead we check whether mkdir succeeds.
  if mkdir /keybase 2>/dev/null ; then
    chmod 777 /keybase
  fi
}

make_keybase_root_dir
