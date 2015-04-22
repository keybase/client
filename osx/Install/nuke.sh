#!/bin/sh

set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

WEB_PID=`ps aux | grep '[i]cake' | awk '{print $2}'`
if ! [ "$WEB_PID" = "" ]; then
  kill $WEB_PID
fi

echo "Unloading keybased"
launchctl unload -w ~/Library/LaunchAgents/keybase.keybased.plist
launchctl unload -w ~/Library/LaunchAgents/keybase-debug.keybased.plist

echo "Nuking state"
rm -rf ~/Library/Application\ Support/Keybase
rm -rf ~/.config/keybase
rm -rf ~/.cache/keybase
rm -rf ~/.local/share/keybase

echo "Recreating DB"
# TODO This is hard coded for my setup
mysql -u root -ppassword -e "drop database keybase"
mysql -u root -ppassword -e "create database keybase"
mysql -u root -ppassword keybase < /Users/gabe/Projects/keybase/www/sql/keybase.sql

echo "Launching keybased"
launchctl load -w ~/Library/LaunchAgents/keybase.keybased.plist
launchctl load -w ~/Library/LaunchAgents/keybase-debug.keybased.plist

echo "Done"
