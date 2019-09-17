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
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-kext"
)

const installPath = "/Library/Filesystems/kbfuse.fs"

// KeybaseFuseStatus returns Fuse status
func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	st := keybase1.FuseStatus{
		BundleVersion: bundleVersion,
		InstallStatus: keybase1.InstallStatus_UNKNOWN,
		InstallAction: keybase1.InstallAction_UNKNOWN,
	}

	var kextInfo *kext.Info

	if _, err := os.Stat(installPath); err == nil {
		st.Path = installPath
		kextID := "com.github.kbfuse.filesystems.kbfuse"
		var loadErr error
		kextInfo, loadErr = kext.LoadInfo(kextID)
		if loadErr != nil {
			st.InstallStatus = keybase1.InstallStatus_ERROR
			st.InstallAction = keybase1.InstallAction_REINSTALL
			st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Error loading kext info: %s", loadErr)}
			return st
		}
		if kextInfo == nil {
			log.Debug("No kext info available (kext not loaded)")
			// This means the kext isn't loaded, which is ok, kbfs will call
			// load_kbfuse when it starts up.
			// We have to get the version from the installed plist.
			installedVersion, fivErr := fuseInstallVersion(log)
			if fivErr != nil {
				st.InstallStatus = keybase1.InstallStatus_ERROR
				st.InstallAction = keybase1.InstallAction_REINSTALL
				st.Status = keybase1.Status{Code: libkb.SCGeneric, Name: "INSTALL_ERROR", Desc: fmt.Sprintf("Error loading (plist) info: %s", fivErr)}
				return st
			}
			if installedVersion != "" {
				kextInfo = &kext.Info{
					Version: installedVersion,
					Started: false,
				}
			}
		}

		// Installed
		st.KextID = kextID
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

	installStatus, installAction, status := ResolveInstallStatus(st.Version, st.BundleVersion, "", log)
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

func findStringInPlist(key string, plistData []byte, log Log) string {
	// Hack to parse plist, instead of parsing we'll use a regex
	res := fmt.Sprintf(`<key>%s<\/key>\s*<string>([\S ]+)<\/string>`, key)
	re := regexp.MustCompile(res)
	submatch := re.FindStringSubmatch(string(plistData))
	if len(submatch) == 2 {
		return submatch[1]
	}
	log.Debug("No key (%s) found", key)
	return ""
}

func loadPlist(plistPath string, log Log) ([]byte, error) {
	if _, err := os.Stat(plistPath); os.IsNotExist(err) {
		log.Debug("No plist found: %s", plistPath)
		return nil, err
	}
	log.Debug("Loading plist: %s", plistPath)
	plistFile, err := os.Open(plistPath)
	defer plistFile.Close()
	if err != nil {
		return nil, err
	}
	return ioutil.ReadAll(plistFile)
}

func fuseInstallVersion(log Log) (string, error) {
	plistPath := filepath.Join(installPath, "Contents/Info.plist")
	plistData, err := loadPlist(plistPath, log)
	if err != nil {
		return "", err
	}
	return findStringInPlist("CFBundleVersion", plistData, log), nil
}
