// +build darwin

package client

import (
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-kext"
)

func KeybaseFuseStatus(kextLabel string, bundleVersion string) keybase1.FuseStatus {
	status := keybase1.FuseStatus{
		BundleVersion: bundleVersion,
		KextLabel:     kextLabel,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	info, err := kext.LoadInfo(kextLabel)
	if err != nil {
		status.InstallStatus = keybase1.InstallStatus_ERROR
		status.Error = &keybase1.StatusError{Message: err.Error()}
		return status
	}

	if info != nil {
		status.Version = info.Version
		status.KextStarted = info.Started
	}

	installStatus, installAction, se := installStatus(status.Version, status.BundleVersion, "")
	status.InstallStatus = installStatus
	status.InstallAction = installAction
	status.Error = se

	return status
}
