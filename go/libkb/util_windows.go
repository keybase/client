// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

type GUID struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

// 3EB685DB-65F9-4CF6-A03A-E3EF65729F3D
var (
	FOLDERID_RoamingAppData = GUID{0x3EB685DB, 0x65F9, 0x4CF6, [8]byte{0xA0, 0x3A, 0xE3, 0xEF, 0x65, 0x72, 0x9F, 0x3D}}
)

// F1B32785-6FBA-4FCF-9D55-7B8E7F157091
var (
	FOLDERID_LocalAppData = GUID{0xF1B32785, 0x6FBA, 0x4FCF, [8]byte{0x9D, 0x55, 0x7B, 0x8E, 0x7F, 0x15, 0x70, 0x91}}
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

func GetDataDir(id GUID) (string, error) {

	var pszPath uintptr
	r0, _, _ := procSHGetKnownFolderPath.Call(uintptr(unsafe.Pointer(&id)), uintptr(0), uintptr(0), uintptr(unsafe.Pointer(&pszPath)))
	if r0 != 0 {
		return "", errors.New("can't get FOLDERID_RoamingAppData")
	}

	defer coTaskMemFree(pszPath)

	// go vet: "possible misuse of unsafe.Pointer"
	folder := syscall.UTF16ToString((*[1 << 16]uint16)(unsafe.Pointer(pszPath))[:])

	if len(folder) == 0 {
		return "", errors.New("can't get AppData directory")
	}

	return folder, nil
}

func AppDataDir() (string, error) {
	return GetDataDir(FOLDERID_RoamingAppData)
}

func LocalDataDir() (string, error) {
	return GetDataDir(FOLDERID_LocalAppData)
}

// SafeWriteToFile retries safeWriteToFileOnce a few times on Windows,
// in case AV programs interfere with 2 writes in quick succession.
func SafeWriteToFile(g SafeWriteLogger, t SafeWriter, mode os.FileMode) error {

	var err error
	for i := 0; i < 5; i++ {
		if err != nil {
			g.Debug("Retrying failed safeWriteToFileOnce - %s", err)
			time.Sleep(10 * time.Millisecond)
		}
		err = safeWriteToFileOnce(g, t, mode)
		if err == nil {
			break
		}
	}
	return err
}

func RemoteSettingsRepairman(g *GlobalContext) {
	w := Win32{Base{"keybase",
		func() string { return g.Env.getHomeFromCmdOrConfig() },
		func() RunMode { return g.Env.GetRunMode() }}}

	currentPathname := w.Home(false)
	kbDir := filepath.Base(currentPathname)
	oldDir, err := AppDataDir()
	if err != nil {
		return
	}
	oldPathname := filepath.Join(oldDir, kbDir)
	if oldExists, _ := FileExists(oldPathname); oldExists {
		if currentExists, _ := FileExists(currentPathname); !currentExists {
			g.Log.Info("RemoteSettingsRepairman moving from %s to %s", oldPathname, currentPathname)
			err = os.Rename(oldPathname, currentPathname)
			if err != nil {
				g.Log.Error("RemoteSettingsRepairman error - %s", err)
			}
		}
	}
}
