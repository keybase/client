// +build darwin

package client

import (
	"fmt"
	"os"

	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-kext"
)

func KeybaseFuseStatus(bundleVersion string) keybase1.FuseStatus {
	status := keybase1.FuseStatus{
		BundleVersion: bundleVersion,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	var kextInfo *kext.Info

	// Check osxfuse 3.x
	path3 := "/Library/Filesystems/osxfuse.fs"
	if _, err := os.Stat(path3); err == nil {
		status.Path = path3
		kextID3 := "com.github.osxfuse.filesystems.osxfuse"
		infov3, errv3 := kext.LoadInfo(kextID3)
		if errv3 != nil {
			status.InstallStatus = keybase1.InstallStatus_ERROR
			status.InstallAction = keybase1.InstallAction_NONE
			status.Error = &keybase1.StatusError{Message: errv3.Error()}
			return status
		}
		if infov3 == nil {
			status.InstallStatus = keybase1.InstallStatus_ERROR
			status.InstallAction = keybase1.InstallAction_NONE
			status.Error = &keybase1.StatusError{
				Message: fmt.Sprintf("Fuse (3) installed (%s) but kext was not loaded (%s)", status.Path, kextID3)}
			return status
		}

		// Installed (v3)
		status.KextID = kextID3
		kextInfo = infov3
	}

	// Check osxfuse 2.x
	path2 := "/Library/Filesystems/osxfusefs.fs"
	if _, err := os.Stat(path2); err == nil {

		// Make sure Fuse2 isn't still lingering around
		if status.KextID != "" {
			status.InstallStatus = keybase1.InstallStatus_ERROR
			status.InstallAction = keybase1.InstallAction_NONE
			status.Error = &keybase1.StatusError{Message: "Fuse 2 and 3 both exist"}
			return status
		}

		status.Path = path2
		kextID2 := "com.github.osxfuse.filesystems.osxfusefs"
		infov2, errv2 := kext.LoadInfo(kextID2)
		if errv2 != nil {
			status.InstallStatus = keybase1.InstallStatus_ERROR
			status.InstallAction = keybase1.InstallAction_NONE
			status.Error = &keybase1.StatusError{Message: errv2.Error()}
			return status
		}
		if infov2 == nil {
			status.InstallStatus = keybase1.InstallStatus_ERROR
			status.InstallAction = keybase1.InstallAction_NONE
			status.Error = &keybase1.StatusError{
				Message: fmt.Sprintf("Fuse (2) installed (%s) but kext was not loaded (%s)", status.Path, kextID2)}
			return status
		}
		// Installed (v2)
		status.KextID = kextID2
		kextInfo = infov2
	}

	// If neither is found, we have no install
	if status.KextID == "" || kextInfo == nil {
		status.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		status.InstallAction = keybase1.InstallAction_INSTALL
		return status
	}

	status.Version = kextInfo.Version
	status.KextStarted = kextInfo.Started

	installStatus, installAction, se := installStatus(status.Version, status.BundleVersion, "")
	status.InstallStatus = installStatus
	status.InstallAction = installAction
	status.Error = se

	return status
}
