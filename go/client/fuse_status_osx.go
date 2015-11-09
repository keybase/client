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

	// Check osxfuse 3.x
	path3 := "/Library/Filesystems/osxfuse.fs"
	if _, err := os.Stat(path3); err == nil {
		st.Path = path3
		kextID3 := "com.github.osxfuse.filesystems.osxfuse"
		infov3, errv3 := kext.LoadInfo(kextID3)
		if errv3 != nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: errv3.Error()}
			return st
		}
		if infov3 == nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Fuse (3) installed (%s) but kext was not loaded (%s)", st.Path, kextID3)}
			return st
		}

		// Installed (v3)
		st.KextID = kextID3
		kextInfo = infov3
	}

	// Check osxfuse 2.x
	path2 := "/Library/Filesystems/osxfusefs.fs"
	if _, err := os.Stat(path2); err == nil {

		// If Fuse3 exists (above), and we also have Fuse2 then we have a borked
		// install.
		if st.KextID != "" {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: "Fuse 2 and 3 both exist"}
			return st
		}

		st.Path = path2
		kextID2 := "com.github.osxfuse.filesystems.osxfusefs"
		infov2, errv2 := kext.LoadInfo(kextID2)
		if errv2 != nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: errv2.Error()}
			return st
		}
		if infov2 == nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Fuse (2) installed (%s) but kext was not loaded (%s)", st.Path, kextID2)}
			return st
		}
		// Installed (v2)
		st.KextID = kextID2
		kextInfo = infov2
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
