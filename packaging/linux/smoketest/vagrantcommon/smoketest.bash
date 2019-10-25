#!/usr/bin/env bash
set -euox pipefail

echo smoketest start!


function cleanup {
  echo "cleanup on exit"
  keybase ctl stop
}
trap cleanup EXIT

U=vagrant
whoami
if command -v apt; then
	curl -O https://prerelease.keybase.io/keybase_amd64.deb
	echo vagrant | sudo -S apt -y install ./keybase_amd64.deb
    PIDOF=/bin/pidof
else
	curl -O https://prerelease.keybase.io/keybase_amd64.rpm
	echo vagrant | sudo -S rpm -Uvh --force ./keybase_amd64.rpm
    PIDOF=/usr/sbin/pidof
fi
sleep 1
run_keybase
sleep 1
keybase id max
[[ $HOME = /home/$U ]]
chk() {
	stat -c "%a %U" "$1"
}
[[ "$(chk "$HOME"/)" 										=~  7[0-9]{2}."$U" ]]
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
$PIDOF keybase
$PIDOF Keybase
$PIDOF kbfsfuse
$PIDOF keybase-redirector
if command -v apt; then
    systemctl --user is-active keybase kbfs keybase-redirector keybase.gui
fi
sleep 1
keybase ctl stop
sleep 1
$PIDOF keybase && exit 1
$PIDOF Keybase && exit 1
$PIDOF kbfsfuse && exit 1
$PIDOF keybase-redirector && exit 1
sleep 1
if command -v apt; then
    systemctl --user start keybase keybase.gui kbfs keybase-redirector
else
    run_keybase
fi
sleep 1
$PIDOF keybase
$PIDOF Keybase
$PIDOF kbfsfuse
$PIDOF keybase-redirector
if command -v apt; then
    systemctl --user start keybase keybase.gui kbfs keybase-redirector
else
    run_keybase
fi
keybase ctl stop
sleep 1
keybase ctl start
sleep 1
$PIDOF keybase
keybase id max
sleep 1
keybase ctl stop
sleep 1
keybase id max
sleep 1
$PIDOF keybase
$PIDOF Keybase && exit 1
echo smoketest success!
