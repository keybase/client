// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin && !ios
// +build darwin,!ios

package install

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/keybase/client/go/install/libnativeinstaller"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

const (
	installPath = "/Library/Filesystems/keybase.fs"
	driverID    = "com.keybase.filesystems.kbfs.fskit"
)

// KeybaseFuseStatus returns Fuse status
func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	st := keybase1.FuseStatus{
		BundleVersion: bundleVersion,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	if _, err := os.Stat(installPath); err == nil {
		st.Path = installPath
		st.KextID = driverID
	}

	// If neither is found, we have no install
	if st.KextID == "" {
		st.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		st.InstallAction = keybase1.InstallAction_INSTALL
		return st
	}

	// Try to get mount info, it's non-critical if we fail though.
	mountInfos, err := mountInfo("keybase")
	if err != nil {
		log.Errorf("Error trying to read mount info: %s", err)
	}
	st.MountInfos = mountInfos

	installedVersion, fivErr := fuseInstallVersion(log)
	if fivErr != nil {
		st.InstallStatus = keybase1.InstallStatus_ERROR
		st.InstallAction = keybase1.InstallAction_REINSTALL
		st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Error loading install metadata: %s", fivErr)}
		return st
	}
	st.Version = installedVersion
	st.KextStarted = len(mountInfos) > 0

	installStatus, installAction, status := ResolveInstallStatus(st.Version, st.BundleVersion, "", log)
	st.InstallStatus = installStatus
	st.InstallAction = installAction
	st.Status = status

	return st
}

func mountInfo(fstype string) ([]keybase1.FuseMountInfo, error) {
	out, err := exec.Command("/sbin/mount").Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(out), "\n")
	mountInfos := []keybase1.FuseMountInfo{}
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		if !strings.Contains(strings.ToLower(line), fstype) {
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

func findStringInPlist(key string, plistData []byte, log Log) string {
	// Keep regex parsing for compatibility with existing tests.
	res := fmt.Sprintf(`<key>%s<\/key>\s*<string>([\S ]+)<\/string>`, key)
	re := regexp.MustCompile(res)
	submatch := re.FindStringSubmatch(string(plistData))
	if len(submatch) == 2 {
		return submatch[1]
	}
	log.Debug("No key (%s) found", key)
	return ""
}

func fuseInstallVersion(log Log) (string, error) {
	appPath, err := libnativeinstaller.AppBundleForPath()
	if err != nil {
		return "", nil
	}
	plistPath := filepath.Join(appPath, "Contents/Resources/KeybaseInstaller.app/Contents/Info.plist")
	cmd := exec.Command(
		"/usr/libexec/PlistBuddy",
		"-c",
		"Print :FSKitVersion",
		plistPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Debug("Unable to read FSKit version from installer plist: %s", strings.TrimSpace(string(out)))
		return "", nil
	}
	return strings.TrimSpace(string(out)), nil
}
