// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os/exec"
	"runtime"
)

func PlatformSpecificUpgradeInstructionsString() (string, error) {
	switch runtime.GOOS {
	case "linux":
		return linuxUpgradeInstructionsString()
	}
	return "", nil
}

func platformSpecificUpgradeInstructionsOnRecommendedUpgrade(upgradeURI string) string {
	var ret string
	switch runtime.GOOS {
	case "linux":
		ret, _ = linuxUpgradeInstructionsString()
	case "darwin":
		ret = darwinUpgradeInstructions(upgradeURI)
	case "windows":
		ret = windowsUpgradeInstructions(upgradeURI)
	}
	return ret
}

func linuxUpgradeInstructionsString() (string, error) {
	hasPackageManager := func(name string) bool {
		// Not all package managers are in /usr/bin. (openSUSE for example puts
		// Yast in /usr/sbin.) Better to just do the full check now than to get
		// confused later.
		_, err := exec.LookPath(name)
		return err == nil
	}

	packageName := "keybase"

	var start string
	if hasPackageManager("apt-get") {
		start = "sudo apt-get update; sudo apt-get install " + packageName
	} else if hasPackageManager("dnf") {
		start = "sudo dnf upgrade " + packageName
	} else if hasPackageManager("yum") {
		start = "sudo yum upgrade " + packageName
	} else if hasPackageManager("pacman") {
		if len(PrereleaseBuild) > 0 {
			start = "yaourt -S keybase-git"
		} else {
			start = "sudo pacman -Syu"
		}
	} else {
		return "", fmt.Errorf("Unhandled linux upgrade instruction.")
	}

	complete := start + " && run_keybase"
	return complete, nil
}

func darwinUpgradeInstructions(upgradeURI string) string {
	packageName := "keybase"
	if DefaultRunMode == DevelRunMode {
		packageName = "keybase/beta/kbdev"
	} else if DefaultRunMode == StagingRunMode {
		packageName = "keybase/beta/kbstage"
	}

	if IsBrewBuild {
		return ("To upgrade, run the following command:\n" +
			"    brew update && brew upgrade " + packageName)
	}
	return ("  Please download a new version from " + upgradeURI)
}

func windowsUpgradeInstructions(upgradeURI string) string {
	return ("To upgrade, download the latest Keybase installer from " + upgradeURI)
}
