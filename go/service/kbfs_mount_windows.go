// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package service

import (
	"fmt"
	"github.com/kardianos/osext"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"strings"
	"syscall"
	"unsafe"
)

var (
	kernel32DLL        = windows.NewLazySystemDLL("kernel32.dll")
	getVolumeProc      = kernel32DLL.NewProc("GetVolumeInformationW")
	queryDosDeviceProc = kernel32DLL.NewProc("QueryDosDeviceW")
	shell32DLL         = windows.NewLazySystemDLL("shell32.dll")
	shChangeNotifyProc = shell32DLL.NewProc("SHChangeNotify")
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
		drives = append(drives, path)
	}
	var err error
	if len(drives) == 0 {
		err = fmt.Errorf("No drive letters available")
	}
	return drives, err
}

// Notify the shell that the thing located at path has changed
func notifyShell(path string) {
	shChangeNotifyProc.Call(
		uintptr(0x00002000), // SHCNE_UPDATEITEM
		uintptr(0x0005),     // SHCNF_PATHW
		uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(path))),
		0)
}

// Manipulate registry entries to reflect the mount point icon in the shell
func doMountChange(oldMount string, newMount string) error {
	if oldMount != "" {
		// DeleteKey doesn't work if there are subkeys
		registry.DeleteKey(registry.CURRENT_USER, `SOFTWARE\Classes\Applications\Explorer.exe\Drives\`+oldMount[:1]+`\DefaultIcon`)
		registry.DeleteKey(registry.CURRENT_USER, `SOFTWARE\Classes\Applications\Explorer.exe\Drives\`+oldMount[:1]+`\DefaultLabel`)
		registry.DeleteKey(registry.CURRENT_USER, `SOFTWARE\Classes\Applications\Explorer.exe\Drives\`+oldMount[:1])
		notifyShell(oldMount)
	}
	if newMount == "" {
		return nil
	}
	k, _, err := registry.CreateKey(registry.CURRENT_USER, `SOFTWARE\Classes\Applications\Explorer.exe\Drives\`+newMount[:1]+`\DefaultIcon`, registry.SET_VALUE|registry.CREATE_SUB_KEY|registry.WRITE)
	defer k.Close()
	if err != nil {
		return err
	}
	keybaseExe, err := osext.Executable()
	if err != nil {
		return err
	}
	// Use the second icon bound into keybase.exe - hence the 1
	err = k.SetStringValue("", keybaseExe+",1")

	// Also give a nice label
	k2, _, err := registry.CreateKey(registry.CURRENT_USER, `SOFTWARE\Classes\Applications\Explorer.exe\Drives\`+newMount[:1]+`\DefaultLabel`, registry.SET_VALUE|registry.CREATE_SUB_KEY|registry.WRITE)
	defer k2.Close()
	err = k2.SetStringValue("", "Keybase")
	notifyShell(newMount)
	return err
}
