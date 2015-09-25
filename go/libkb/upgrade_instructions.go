package libkb

import (
	"os/exec"
	"runtime"
)

func platformSpecificUpgradeInstructions() {
	switch runtime.GOOS {
	case "linux":
		linuxUpgradeInstructions()
	case "darwin":
		darwinUpgradeInstructions()
	case "windows":
		// TODO
	}
}

func linuxUpgradeInstructions() {
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
		printUpgradeCommand("sudo apt-get update && sudo apt-get install " + packageName)
	} else if hasPackageManager("dnf") {
		printUpgradeCommand("sudo dnf upgrade " + packageName)
	} else if hasPackageManager("yum") {
		printUpgradeCommand("sudo yum upgrade " + packageName)
	}
}

func darwinUpgradeInstructions() {
	packageName := "keybase"
	if DefaultRunMode == DevelRunMode {
		packageName = "keybase/beta/kbdev"
	} else if DefaultRunMode == StagingRunMode {
		packageName = "keybase/beta/kbstage"
	}

	if IsBrewBuild {
		printUpgradeCommand("brew update && brew upgrade " + packageName)
	}
	// TODO: non-brew update instructions
}

func printUpgradeCommand(command string) {
	G.Log.Warning("To upgrade, run the following command:")
	G.Log.Warning("    " + command)
}
