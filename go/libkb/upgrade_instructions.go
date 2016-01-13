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
	case "darwin":
		return "", fmt.Errorf("Darwin Not implemented")
	case "windows":
		return "", fmt.Errorf("Windows Not implemented")
	}
	return "", fmt.Errorf("Not implemented")
}

func platformSpecificUpgradeInstructions(g *GlobalContext, upgradeURI string) {
	switch runtime.GOOS {
	case "linux":
		linuxUpgradeInstructions(g)
	case "darwin":
		darwinUpgradeInstructions(g, upgradeURI)
	case "windows":
		windowsUpgradeInstructions(g, upgradeURI)
	}
}

func linuxUpgradeInstructions(g *GlobalContext) {
	upgradeInstructions, err := linuxUpgradeInstructionsString()
	if err == nil {
		printUpgradeCommand(g, upgradeInstructions)
	}
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
	if DefaultRunMode == DevelRunMode {
		packageName = "kbdev"
	} else if DefaultRunMode == StagingRunMode {
		packageName = "kbstage"
	}

	if hasPackageManager("apt-get") {
		return "sudo apt-get update && sudo apt-get install " + packageName, nil
	} else if hasPackageManager("dnf") {
		return "sudo dnf upgrade " + packageName, nil
	} else if hasPackageManager("yum") {
		return "sudo yum upgrade " + packageName, nil
	}

	return "", fmt.Errorf("Unhandled linux upgrade instruction.")
}

func darwinUpgradeInstructions(g *GlobalContext, upgradeURI string) {
	packageName := "keybase"
	if DefaultRunMode == DevelRunMode {
		packageName = "keybase/beta/kbdev"
	} else if DefaultRunMode == StagingRunMode {
		packageName = "keybase/beta/kbstage"
	}

	if IsBrewBuild {
		printUpgradeCommand(g, "brew update && brew upgrade "+packageName)
	} else {
		g.Log.Warning("  Please download a new version from " + upgradeURI)
	}
	// TODO: non-brew update instructions
}

func windowsUpgradeInstructions(g *GlobalContext, upgradeURI string) {

	g.Log.Warning("To upgrade, download the latest Keybase installer from " + upgradeURI)
}
func printUpgradeCommand(g *GlobalContext, command string) {
	g.Log.Warning("To upgrade, run the following command:")
	g.Log.Warning("    " + command)
}
