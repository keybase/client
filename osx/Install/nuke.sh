#!/bin/sh

set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

WEB_PID=`ps aux | grep '[i]cake' | awk '{print $2}'`
if ! [ "$WEB_PID" = "" ]; then
  kill $WEB_PID
fi

# Unload launch agents
sh unload.sh

echo "Nuking state (Application Support)"
rm -rf ~/Library/Application\ Support/Keybase

echo "Recreating DB"
# TODO This is hard coded for my setup
mysql -u root -ppassword -e "drop database keybase"
mysql -u root -ppassword -e "create database keybase"
mysql -u root -ppassword keybase < /Users/gabe/Projects/keybase/www/sql/keybase.sql

echo "Done"
