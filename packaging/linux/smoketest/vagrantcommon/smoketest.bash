#!/usr/bin/env bash
set -euox pipefail

echo smoketest start!
whoami
echo pw | sudo -S apt -y install /home/kb/keybase.deb
run_keybase
sleep 2
keybase id max
[[ $HOME = /home/kb ]]
chk() {
	stat -c "%a" "$1" | cut -c 1
}
[[ "7" = "$(chk $HOME/)" ]]
[[ "7" = "$(chk $HOME/.cache)" ]]
[[ "7" = "$(chk $HOME/.cache/keybase)" ]]
[[ "6" = "$(chk $HOME/.cache/keybase/keybase.service.log)" ]]
[[ "6" = "$(chk $HOME/.cache/keybase/keybase.kbfs.log)" ]]
[[ "6" = "$(chk $HOME/.cache/keybase/Keybase.app.log)" ]]
[[ "7" = "$(chk $HOME/.config)" ]]
[[ "7" = "$(chk $HOME/.config/keybase)" ]]
[[ "6" = "$(chk $HOME/.config/keybase/config.json)" ]]
[[ "6" = "$(chk $HOME/.config/keybase/gui_config.json)" ]]
[[ "7" = "$(chk $HOME/.local)" ]]
[[ "7" = "$(chk $HOME/.local/share/keybase)" ]]
pidof keybase
pidof Keybase
pidof kbfsfuse
pidof keybase-redirector
systemctl --user is-active keybase kbfs keybase-redirector keybase.gui
sleep 2
keybase ctl stop
sleep 2
! pidof keybase
! pidof Keybase
! pidof kbfsfuse
! pidof keybase-redirector
sleep 2
systemctl --user start keybase keybase.gui kbfs keybase-redirector
sleep 2
pidof keybase
pidof Keybase
pidof kbfsfuse
pidof keybase-redirector
systemctl --user is-active keybase kbfs keybase-redirector keybase.gui
keybase ctl stop
sleep 2
keybase ctl start
sleep 2
pidof keybase
keybase id max
sleep 2
keybase ctl stop
sleep 2
keybase id max
sleep 2
pidof keybase
echo smoketest success!
