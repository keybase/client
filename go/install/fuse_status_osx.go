// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package install

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-kext"
)

// KeybaseFuseStatus returns Fuse status
func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
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
			// This means the kext isn't loaded. If kext isn't loaded then kbfs will
			// load it when it start up by calling load_kbfuse (in the kext bundle).
			// TODO: Go ahead and load the kext ahead of time?
			st.InstallStatus = keybase1.InstallStatus_INSTALLED
			st.InstallAction = keybase1.InstallAction_NONE
			st.Status = keybase1.StatusOK(fmt.Sprintf("Fuse installed (%s) but kext was not loaded (%s)", st.Path, kextID))
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
		log.Errorf("Error trying to read mount info: %s", err)
	}
	st.MountInfos = mountInfos

	st.Version = kextInfo.Version
	st.KextStarted = kextInfo.Started

	installStatus, installAction, status := ResolveInstallStatus(st.Version, st.BundleVersion, "")
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
	lines := strings.Split(string(out), "\n")
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

// KeybaseFuseStatusForAppBundle returns Fuse status for application at appPath
func KeybaseFuseStatusForAppBundle(appPath string, log Log) (keybase1.FuseStatus, error) {
	bundleVersion, err := fuseBundleVersion(appPath)
	if err != nil {
		return keybase1.FuseStatus{}, err
	}
	fuseStatus := KeybaseFuseStatus(bundleVersion, log)
	return fuseStatus, err
}

func fuseBundleVersion(appPath string) (string, error) {
	plistPath := filepath.Join(appPath, "Contents/Resources/KeybaseInstaller.app/Contents/Info.plist")

	if _, err := os.Stat(plistPath); os.IsNotExist(err) {
		return "", nil
	}

	f, err := os.Open(plistPath)
	if err != nil {
		return "", err
	}
	data, err := ioutil.ReadAll(f)
	if err != nil {
		return "", err
	}

	// Hack to parse plist
	re := regexp.MustCompile(`<key>KBFuseVersion<\/key>\s*<string>(\S+)<\/string>`)
	submatch := re.FindStringSubmatch(string(data))
	if len(submatch) == 2 {
		return submatch[1], nil
	}
	return "", nil
}

// checkFuseUpgrade will see if the Fuse version in the Keybase.app bundle
// is new, and if so will uninstall KBFS so that it can upgrade Fuse.
// If force is true, the Fuse upgrade is attempted even if it's not needed.
// Returns true if KBFS should be re-installed (after the Fuse upgrade succeeded
// or failed).
func checkFuseUpgrade(context Context, appPath string, force bool, log Log) (reinstallKBFS bool, err error) {
	runMode := context.GetRunMode()
	var mountDir string
	mountDir, err = context.GetMountDir()
	if err != nil {
		return
	}
	log.Info("Checking Fuse status")
	fuseStatus, err := KeybaseFuseStatusForAppBundle(appPath, log)
	if err != nil {
		return
	}
	log.Info("Fuse status: %s", fuseStatus)

	hasKBFuseMounts := false
	for _, mountInfo := range fuseStatus.MountInfos {
		if mountInfo.Fstype == "kbfuse" {
			hasKBFuseMounts = true
			break
		}
	}

	if fuseStatus.InstallAction == keybase1.InstallAction_UPGRADE || force {
		log.Info("Fuse needs upgrade")
		if hasKBFuseMounts {
			log.Info("We have mounts, let's uninstall KBFS so the installer can upgrade")
			reinstallKBFS = true
			err = UninstallKBFS(runMode, mountDir, true, log)
			if err != nil {
				return
			}
		}

		// Do Fuse upgrade
		log.Info("Installing Fuse")
		var out []byte
		out, err = exec.Command(
			filepath.Join(appPath, "Contents/Resources/KeybaseInstaller.app/Contents/MacOS/Keybase"),
			fmt.Sprintf("--app-path=%s", appPath),
			"--run-mode=prod",
			"--install-fuse").CombinedOutput()
		log.Debug("Fuse install: %s", string(out))
		if err != nil {
			return
		}
	}

	return
}
