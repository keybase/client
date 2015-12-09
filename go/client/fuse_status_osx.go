// +build darwin

package client

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-kext"
)

func KeybaseFuseStatus(g *libkb.GlobalContext, bundleVersion string) keybase1.FuseStatus {
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
			st.InstallAction = keybase1.InstallAction_REINSTALL
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: err.Error()}
			return st
		}
		if info == nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_REINSTALL
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

	// Try to get mount info, it's non-critical if we fail though.
	mountInfos, err := mountInfo("kbfuse")
	if err != nil {
		g.Log.Errorf("Error trying to read mount info: %s", err)
	}
	st.MountInfos = mountInfos

	st.Version = kextInfo.Version
	st.KextStarted = kextInfo.Started

	installStatus, installAction, status := install.Status(st.Version, st.BundleVersion, "")
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status

	return st
}

func mountInfo(fstype string) ([]keybase1.FuseMountInfo, error) {
	out, err := exec.Command("/sbin/mount", "-t", fstype).Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(string(out)), "\n")
	mountInfos := []keybase1.FuseMountInfo{}
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		info := strings.SplitN(line, " ", 4)
		path := ""
		if len(info) >= 2 {
			path = info[2]
		}
		mountInfos = append(mountInfos, keybase1.FuseMountInfo{
			Fstype: fstype,
			Path:   path,
			Output: line,
		})
	}
	return mountInfos, nil
}
