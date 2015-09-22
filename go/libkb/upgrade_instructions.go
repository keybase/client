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

	if hasPackageManager("apt-get") {
		printUpgradeCommand("sudo apt-get update && sudo apt-get install " + PackageName)
	} else if hasPackageManager("dnf") {
		printUpgradeCommand("sudo dnf upgrade " + PackageName)
	} else if hasPackageManager("yum") {
		printUpgradeCommand("sudo yum upgrade " + PackageName)
	}
}

func darwinUpgradeInstructions() {
	if IsBrewBuild {
		printUpgradeCommand("brew update && brew upgrade " + PackageName)
	}
	// TODO: non-brew update instructions
}

func printUpgradeCommand(command string) {
	G.Log.Warning("To upgrade, run the following command:")
	G.Log.Warning("    " + command)
}
