// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"errors"
	"os"
	"os/exec"
	"strings"
	"syscall"

	"golang.org/x/sys/windows"
)

type GUID struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

var (
	FOLDERID_RoamingAppData = GUID{0x3EB685DB, 0x65F9, 0x4CF6, [8]byte{0xA0, 0x3A, 0xE3, 0xEF, 0x65, 0x72, 0x9F, 0x3D}}
)

var (
	modShell32               = windows.NewLazySystemDLL("Shell32.dll")
	modOle32                 = windows.NewLazySystemDLL("Ole32.dll")
	procSHGetKnownFolderPath = modShell32.NewProc("SHGetKnownFolderPath")
	procCoTaskMemFree        = modOle32.NewProc("CoTaskMemFree")
)

// LookPath searches for an executable binary named file
// in the directories named by the PATH environment variable.
// If file contains a slash, it is tried directly and the PATH is not consulted.

func canExec(s string) error {
	if strings.IndexAny(s, `:\/`) == -1 {
		s = s + "/"
	}
	_, err := exec.LookPath(s)
	return err
}

func PosixLineEndings(arg string) string {
	return strings.Replace(arg, "\r", "", -1)
}

func coTaskMemFree(pv uintptr) {
	syscall.Syscall(procCoTaskMemFree.Addr(), 1, uintptr(pv), 0, 0)
	return
}

func AppDataDir() (string, error) {

	//  go vet will not let us convert an LPWSTR to a go string.
	//  Seems we'll need to be able to do that sometime - then we can do this.
	//
	//	var pszPath uintptr
	//	r0, _, _ := procSHGetKnownFolderPath.Call(uintptr(unsafe.Pointer(&FOLDERID_RoamingAppData)), uintptr(0), uintptr(0), uintptr(unsafe.Pointer(&pszPath)))
	//	if r0 != 0 {
	//		return "", errors.New("can't get AppData directory")
	//	}

	//	defer coTaskMemFree(pszPath)

	//	// go vet: "possible misuse of unsafe.Pointer"
	//	folder := syscall.UTF16ToString((*[1 << 16]uint16)(unsafe.Pointer(pszPath))[:])

	folder := os.Getenv("APPDATA")
	if len(folder) == 0 {
		return "", errors.New("can't get AppData directory")
	}

	return folder, nil
}
