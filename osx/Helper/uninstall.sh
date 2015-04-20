#!/bin/sh

sudo launchctl unload /Library/LaunchDaemons/keybase.Helper.plist
sudo rm /Library/LaunchDaemons/keybase.Helper.plist
sudo rm /Library/PrivilegedHelperTools/keybase.Helper
