// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package service

import (
	"fmt"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	kernel32DLL        = windows.NewLazySystemDLL("kernel32.dll")
	getVolumeProc      = kernel32DLL.NewProc("GetVolumeInformationW")
	queryDosDeviceProc = kernel32DLL.NewProc("QueryDosDeviceW")
	getDriveTypeProc   = kernel32DLL.NewProc("GetDriveTypeW")
)

const (
	driveUnknown   = 0
	driveNoRootDir = 1
)

// getVolumeName requires a drive letter and colon with a
// trailing backslash
func getVolumeName(RootPathName string) (string, error) {
	var VolumeNameBuffer = make([]uint16, syscall.MAX_PATH+1)
	var nVolumeNameSize = uint32(len(VolumeNameBuffer))

	_, _, callErr := getVolumeProc.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(RootPathName))),
		uintptr(unsafe.Pointer(&VolumeNameBuffer[0])),
		uintptr(nVolumeNameSize),
		uintptr(0),
		uintptr(0),
		uintptr(0),
		uintptr(0),
		uintptr(0),
		0)

	if callErr != nil {
		return "", callErr
	}

	return syscall.UTF16ToString(VolumeNameBuffer), nil
}

// getDosVolumeName requires a drive letter and colon with no
// trailing backslash
func getDosVolumeName(path string) (string, error) {

	var VolumeNameBuffer = make([]uint16, syscall.MAX_PATH+1)
	var nVolumeNameSize = uint32(len(VolumeNameBuffer))

	ret, _, err := queryDosDeviceProc.Call(
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(path))),
		uintptr(unsafe.Pointer(&VolumeNameBuffer[0])),
		uintptr(nVolumeNameSize))

	if ret == 0 {
		return "", err
	}

	return syscall.UTF16ToString(VolumeNameBuffer), nil
}

func isCdRom(path string) bool {
	if name, err := getDosVolumeName(path); err != nil {
		return strings.HasPrefix(strings.ToLower(name), "\\device\\cdrom")
	}
	return false
}

func isDriveFree(drive string) bool {
	driveType, _, _ := getDriveTypeProc.Call(uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(drive))))
	// 3rd return value is non-null even in success case
	if driveType == driveUnknown || driveType == driveNoRootDir {
		return true
	}
	return false
}

func getMountDirs() ([]string, error) {
	//start with drive D
	i := uint(3)
	var drives []string
	for ; i < 26; i++ {
		path := string(byte('A')+byte(i)) + ":"
		// avoid calling GetVolumeInformation() on drives that appear to be cdroms,
		// since they may need to spin up or prompt to have media inserted.
		if isCdRom(path) {
			continue
		}
		volume, _ := getVolumeName(path + "\\")
		// sanity check that it isn't keybase already
		// Assume that no volume name means we can use it,
		// including errors retrieving same.
		// (we plan to change from KBFS to Keybase)
		if len(volume) > 0 && volume != "KBFS" && volume != "Keybase" {
			continue
		}
		if !isDriveFree(path + "\\") {
			continue
		}
		drives = append(drives, path)
	}
	var err error
	if len(drives) == 0 {
		err = fmt.Errorf("No drive letters available")
	}
	return drives, err
}
