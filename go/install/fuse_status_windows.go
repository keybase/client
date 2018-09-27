// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"

	"github.com/gonutz/w32"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sys/windows/registry"
)

func isDokanCurrent(log Log, path string) (bool, error) {
	size := w32.GetFileVersionInfoSize(path)
	if size <= 0 {
		return false, errors.New("GetFileVersionInfoSize failed")
	}

	info := make([]byte, size)
	ok := w32.GetFileVersionInfo(path, info)
	if !ok {
		return false, errors.New("GetFileVersionInfo failed")
	}

	fixed, ok := w32.VerQueryValueRoot(info)
	if !ok {
		return false, errors.New("VerQueryValueRoot failed")
	}
	version := fixed.FileVersion()

	major := version & 0xFFFF000000000000 >> 48
	minor := version & 0x0000FFFF00000000 >> 32
	patch := version & 0x00000000FFFF0000 >> 16
	build := version & 0x000000000000FFFF

	// we're looking for 1.1.0.2000
	result := major > 1 || (major == 1 && (minor > 1 || (minor == 1 && (patch > 0 || (patch == 0 && build >= 2000)))))
	log.Info("dokan1.dll version: %d.%d.%d.%d, result %v\n", major, minor, patch, build, result)

	return result, nil
}

func detectDokanDll(dokanPath string, log Log) bool {
	exists, _ := libkb.FileExists(dokanPath)

	log.Info("detectDokanDll: returning %v", exists)
	return exists
}

// Read all the uninstall subkeys and find the ones with DisplayName starting with "Dokan Library"
// and containing "Bundle"
func findDokanUninstall(wow64 bool) (result string) {
	dokanRegexp := regexp.MustCompile("^Dokan Library.*Bundle")
	var access uint32 = registry.ENUMERATE_SUB_KEYS | registry.QUERY_VALUE
	// Assume this is build 32 bit, so we need this flag to see 64 bit registry
	//   https://msdn.microsoft.com/en-us/library/windows/desktop/aa384129(v=vs.110).aspx
	if wow64 {
		access = access | registry.WOW64_64KEY
	}

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", access)
	if err != nil {
		fmt.Printf("Error %s opening uninstall subkeys\n", err.Error())
		return
	}
	defer k.Close()

	names, err := k.ReadSubKeyNames(-1)
	if err != nil {
		fmt.Printf("Error %s reading subkeys\n", err.Error())
		return
	}
	for _, name := range names {
		subKey, err := registry.OpenKey(k, name, registry.QUERY_VALUE)
		if err != nil {
			fmt.Printf("Error %s opening subkey %s\n", err.Error(), name)
		}

		displayName, _, err := subKey.GetStringValue("DisplayName")
		if err != nil {
			// this error is not interesting to log
			continue
		}
		if !dokanRegexp.MatchString(displayName) {
			continue
		}

		fmt.Printf("Found %s  %s\n", displayName, name)
		result, _, err := subKey.GetStringValue("UninstallString")
		if err != nil {
			result, _, err = subKey.GetStringValue("QuietUninstallString")
		}
		if err != nil {
			fmt.Printf("Error %s opening subkey UninstallString", err.Error())
		} else {
			return result
		}

	}
	return
}

func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	status := keybase1.FuseStatus{
		InstallStatus: keybase1.InstallStatus_NOT_INSTALLED,
		InstallAction: keybase1.InstallAction_INSTALL,
	}
	dir, err := libkb.SystemDir()
	if err != nil {
		log.Info("KeybaseFuseStatus error getting system directory: %v", err)
		return status
	}
	dokanPath := filepath.Join(dir, "dokan1.dll")
	if !detectDokanDll(dokanPath, log) {
		return status
	}
	status.InstallStatus = keybase1.InstallStatus_INSTALLED
	status.InstallAction = keybase1.InstallAction_NONE
	status.KextStarted = true
	current, err := isDokanCurrent(log, dokanPath)
	if err != nil {
		log.Errorf(err.Error())
	} else if !current {
		status.InstallAction = keybase1.InstallAction_UPGRADE
		uninstallString := findDokanUninstall(true)
		if uninstallString == "" {
			uninstallString = findDokanUninstall(false)
		}
		if uninstallString != "" {
			status.Status.Fields = append(status.Status.Fields, keybase1.StringKVPair{Key: "uninstallString", Value: uninstallString})
		}
	}
	return status
}
