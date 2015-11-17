// +build darwin

package client

import (
	"fmt"
	"os"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-kext"
)

func KeybaseFuseStatus(bundleVersion string) keybase1.FuseStatus {
	st := keybase1.FuseStatus{
		BundleVersion: bundleVersion,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	var kextInfo *kext.Info

	// Check kbfuse 3.x
	path := "/Library/Filesystems/kbfuse.fs"
	if _, err := os.Stat(path); err == nil {
		st.Path = path
		kextID := "com.github.kbfuse.filesystems.kbfuse"
		info, err := kext.LoadInfo(kextID)
		if err != nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: err.Error()}
			return st
		}
		if info == nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Fuse installed (%s) but kext was not loaded (%s)", st.Path, kextID)}
			return st
		}

		// Installed
		st.KextID = kextID
		kextInfo = info
	}

	// If neither is found, we have no install
	if st.KextID == "" || kextInfo == nil {
		st.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		st.InstallAction = keybase1.InstallAction_INSTALL
		return st
	}

	st.Version = kextInfo.Version
	st.KextStarted = kextInfo.Started

	installStatus, installAction, status := installStatus(st.Version, st.BundleVersion, "")
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status

	return st
}
