// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"path/filepath"
	"regexp"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sys/windows/registry"
)

func isDokanCurrent(log Log, path string) (bool, error) {
	v, err := GetFileVersion(path)
	if err != nil {
		return false, err
	}
	// we're looking for 1.2.2.1000
	result := v.Major > 1 || (v.Major == 1 && (v.Minor > 2 || (v.Minor == 2 && (v.Patch > 2 || (v.Patch == 2 && v.Build >= 1000)))))

	if !result {
		log.Info("dokan1.dll version: %d.%d.%d.%d, result %v\n", v.Major, v.Minor, v.Patch, v.Build, result)
	}
	return result, nil
}

func detectDokanDll(dokanPath string, log Log) bool {
	exists, _ := libkb.FileExists(dokanPath)

	log.Info("detectDokanDll: returning %v", exists)
	return exists
}

// Read all the uninstall subkeys and find the ones with DisplayName starting with "Dokan Library"
// and containing "Bundle"
func findDokanUninstall(log Log, wow64 bool) (result string) {
	dokanRegexp := regexp.MustCompile("^Dokan Library.*Bundle")
	var access uint32 = registry.ENUMERATE_SUB_KEYS | registry.QUERY_VALUE
	// Assume this is build 64 bit, so we need this flag to see 32 bit WOW registry
	//   https://msdn.microsoft.com/en-us/library/windows/desktop/aa384129(v=vs.110).aspx
	if wow64 {
		access = access | registry.WOW64_32KEY
	}

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", access)
	if err != nil {
		log.Info("Error %s opening uninstall subkeys\n", err.Error())
		return
	}
	defer k.Close()

	names, err := k.ReadSubKeyNames(-1)
	if err != nil {
		log.Info("Error %s reading subkeys\n", err.Error())
		return
	}
	for _, name := range names {
		subKey, err := registry.OpenKey(k, name, registry.QUERY_VALUE)
		if err != nil {
			log.Info("Error %s opening subkey %s\n", err.Error(), name)
		}

		displayName, _, err := subKey.GetStringValue("DisplayName")
		if err != nil {
			// this error is not interesting to log
			continue
		}
		if !dokanRegexp.MatchString(displayName) {
			continue
		}

		result, _, err := subKey.GetStringValue("UninstallString")
		if err != nil {
			result, _, err = subKey.GetStringValue("QuietUninstallString")
		}
		if err != nil {
			log.Info("Error %s opening subkey UninstallString", err.Error())
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
		return status
	}
	if !current {
		status.InstallAction = keybase1.InstallAction_UPGRADE
	}
	uninstallString := findDokanUninstall(log, true)
	if uninstallString == "" {
		uninstallString = findDokanUninstall(log, false)
	}
	if uninstallString != "" {
		status.Status.Fields = append(status.Status.Fields, keybase1.StringKVPair{Key: "uninstallString", Value: uninstallString})
	} else {
		log.Info("No Dokan uninstall string found\n")
	}
	return status
}
