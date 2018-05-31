// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package install

import (
	"errors"
	"path/filepath"

	"github.com/gonutz/w32"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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
	build := version & 0x000000000000FFFF >> 0

	log.Info("dokan1.dll version: %d.%d.%d.%d\n", major, minor, patch, build)
	// we're looking for 1.1.0.1000
	return (major >= 1 && minor >= 1 && build >= 1000), nil
}

func detectDokanDll(log Log) bool {
	dir, err := libkb.SystemDir()
	if err != nil {
		log.Info("detectDokanDll error getting system directory: %v", err)
		return false
	}
	dokanPath := filepath.Join(dir, "dokan1.dll")
	exists, _ := libkb.FileExists(dokanPath)
	log.Info("detectDokanDll: returning %v", exists)
	if exists {
		current, err := isDokanCurrent(log, dokanPath)
		if err != nil {
			log.Errorf(err.Error())
		} else {
			exists = current
		}
	}
	return exists
}

func KeybaseFuseStatus(bundleVersion string, log Log) keybase1.FuseStatus {
	status := keybase1.FuseStatus{}
	if detectDokanDll(log) {
		status.InstallStatus = keybase1.InstallStatus_INSTALLED
		status.InstallAction = keybase1.InstallAction_NONE
		status.KextStarted = true
	} else {
		status.InstallStatus = keybase1.InstallStatus_NOT_INSTALLED
		status.InstallAction = keybase1.InstallAction_INSTALL
	}
	return status
}
