// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-updater/util"
	"golang.org/x/sys/windows/registry"
)

func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	status := keybase1.FuseStatus{}
	if checkKeybaseDokanCodes(log) {
		status.InstallStatus = keybase1.InstallStatus_INSTALLED
		status.InstallAction = keybase1.InstallAction_NONE
		status.KextStarted = true
	} else {
		status.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		status.InstallAction = keybase1.InstallAction_INSTALL
	}
	return status
}

func checkKeybaseDokanCodes(log Log) bool {
	foundDokan, err := checkRegistryKeybaseDokan("DOKANPRODUCT64", log)
	if !foundDokan || err != nil {
		foundDokan, err = checkRegistryKeybaseDokan("DOKANPRODUCT86", log)
	}
	if err != nil {
		log.Errorf("checkKeybaseDokanCodes error: %v", err.Error())
	}
	return foundDokan
}

// Our installer writes the dokan product codes to our registry location,
// which we can then look for in the list of windows uninstall keys.
// Another alternative might be to look for %windir%\system32\dokan1.dll
func checkRegistryKeybaseDokan(productIDKey string, log Log) (bool, error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, `SOFTWARE\Keybase\Keybase\`, registry.QUERY_VALUE|registry.WOW64_64KEY)
	defer util.Close(k)
	if err != nil {
		return false, err
	}
	productID, _, err := k.GetStringValue(productIDKey)
	if err != nil {
		return false, err
	}
	log.Info("CheckRegistryKeybaseDokan: Searching registry for %s", productID)
	if productID == "" {
		log.Info("CheckRegistryKeybaseDokan: Empty product ID, returning false")
		return false, err
	}
	k2, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\`+productID, registry.QUERY_VALUE|registry.WOW64_64KEY)
	defer util.Close(k2)
	if err == nil {
		return true, nil
	}
	return false, err
}
