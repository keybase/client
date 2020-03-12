#!/usr/bin/env bash
set -euox pipefail

echo smoketest start!

function cleanup {
  echo "cleanup on exit"
  ! command -v keybase || keybase ctl stop
}
trap cleanup EXIT

U=vagrant
whoami

version=$1
datetime=$2
revision=$3

# Electron 8 upgraded to a version of Chromium that needs some flags for x forwarding to work
# properly.
# Source: https://bugs.chromium.org/p/chromium/issues/detail?id=1048186
export QT_X11_NO_MITSHM=1
export _X11_NO_MITSHM=1
export _MITSHM=0

echo "Waypoint: downloading and installing package"
if command -v apt; then
    curl --output ./keybase_amd64.deb --silent --fail "https://s3.amazonaws.com/tests.keybase.io/linux_binaries/deb/keybase_${version}-${datetime}.${revision}_amd64.deb"
    echo vagrant | sudo -S apt -y install ./keybase_amd64.deb
    PIDOF=/bin/pidof
else
    curl --output ./keybase_amd64.rpm --silent --fail "https://s3.amazonaws.com/tests.keybase.io/linux_binaries/rpm/keybase-${version}.${datetime}.${revision}-1.x86_64.rpm"
    echo vagrant | sudo -S yum install -y ./keybase_amd64.rpm
    PIDOF=/usr/sbin/pidof
fi
sleep 2
echo "Waypoint: run_keybase"
run_keybase
sleep 2
echo "Waypoint: id max #1"
keybase id max
[[ $HOME = /home/$U ]]
chk() {
    stat -c "%a %U" "$1"
}
echo "Waypoint: check file perms"
# Check permissions are correctr - 7 or 6 for directories and files so user
# can read/write them, and make sure files are owned by the installing user and not root.
[[ "$(chk "$HOME"/)"                                      =~  7[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.cache)"                                =~  7[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.cache/keybase)"                        =~  7[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.cache/keybase/keybase.service.log)"    =~  6[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.cache/keybase/keybase.kbfs.log)"       =~  6[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.cache/keybase/Keybase.app.log)"        =~  6[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.config)"                               =~  7[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.config/keybase)"                       =~  7[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.config/keybase/config.json)"           =~  6[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.config/keybase/gui_config.json)"       =~  6[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.local)"                                =~  7[0-9]{2}."$U" ]]
[[ "$(chk "$HOME"/.local/share/keybase)"                  =~  7[0-9]{2}."$U" ]]
echo "Waypoint: check services are up #1"
$PIDOF keybase
$PIDOF Keybase
$PIDOF kbfsfuse
$PIDOF keybase-redirector
if command -v apt; then
    systemctl --user is-active keybase kbfs keybase-redirector keybase.gui
fi
sleep 2
echo "Waypoint: keybase ctl stop #1"
keybase ctl stop
sleep 4
echo "Waypoint: check services are down #1"
$PIDOF keybase && exit 1
$PIDOF Keybase && exit 1
$PIDOF kbfsfuse && exit 1
$PIDOF keybase-redirector && exit 1
echo "Waypoint: start keybase (w/ systemd on deb*)"
if command -v apt; then
    systemctl --user start keybase keybase.gui kbfs keybase-redirector
else
    run_keybase
fi
sleep 4
echo "Waypoint: check services are up #2"
$PIDOF keybase
$PIDOF Keybase
$PIDOF kbfsfuse
$PIDOF keybase-redirector
echo "Waypoint: restart keybase (w/ systemd on deb*)"
if command -v apt; then
    systemctl --user start keybase keybase.gui kbfs keybase-redirector
else
    run_keybase
fi
echo "Waypoint: keybase ctl stop #2"
keybase ctl stop
sleep 4
echo "Waypoint: keybase ctl start"
keybase ctl start
sleep 4
echo "Waypoint: ensure keybase is up"
$PIDOF keybase
keybase id max
sleep 4
echo "Waypoint: keybase ctl stop #3"
keybase ctl stop
sleep 4
echo "Waypoint: start keybase via autofork"
keybase id max
sleep 4
echo "Waypoint: only service should be started"
$PIDOF keybase
$PIDOF Keybase && exit 1
echo smoketest success!
