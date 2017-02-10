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

	"github.com/kardianos/osext"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
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
	shChangeNotifyProc       = modShell32.NewProc("SHChangeNotify")
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

// helper for RemoteSettingsRepairman
func moveNonChromiumFiles(g *GlobalContext, oldHome string, currentHome string) error {
	g.Log.Info("RemoteSettingsRepairman moving from %s to %s", oldHome, currentHome)
	files, _ := filepath.Glob(filepath.Join(oldHome, "*"))
	for _, oldPathName := range files {
		_, name := filepath.Split(oldPathName)
		// Chromium seems stubborn about these - TBD
		switch name {
		case "GPUCache":
			continue
		case "lockfile":
			continue
		case "app-state.json":
			continue
		case "Cache":
			continue
		case "Cookies":
			continue
		case "Cookies-journal":
			continue
		case "Local Storage":
			continue
		}
		// explicitly skip logs
		if strings.HasSuffix(name, ".log") {
			continue
		}
		newPathName := filepath.Join(currentHome, name)
		var err error
		g.Log.Info("   moving %s", name)

		for i := 0; i < 5; i++ {
			if err != nil {
				time.Sleep(100 * time.Millisecond)
			}
			err = os.Rename(oldPathName, newPathName)
			if err == nil {
				break
			}
		}
		if err != nil {
			g.Log.Error("RemoteSettingsRepairman error moving %s to %s - %s", oldPathName, newPathName, err)
			return err
		}
	}
	return nil
}

// RemoteSettingsRepairman does a one-time move of everyting from the roaming
// target directory to local. We depend on the .exe files having been uninstalled from
// there first.
// Note that Chromium still insists on keeping some stuff in roaming,
// exceptions for which are hardcoded.
func RemoteSettingsRepairman(g *GlobalContext) error {
	w := Win32{Base{"keybase",
		func() string { return g.Env.getHomeFromCmdOrConfig() },
		func() RunMode { return g.Env.GetRunMode() }}}

	currentHome := w.Home(false)
	kbDir := filepath.Base(currentHome)
	currentConfig := g.Env.GetConfigFilename()
	oldDir, err := AppDataDir()
	if err != nil {
		return err
	}
	_, configName := filepath.Split(currentConfig)
	oldHome := filepath.Join(oldDir, kbDir)
	oldConfig := filepath.Join(oldHome, configName)
	if oldExists, _ := FileExists(oldConfig); oldExists {
		if currentExists, _ := FileExists(currentConfig); !currentExists {
			return moveNonChromiumFiles(g, oldHome, currentHome)
		}
	}
	return nil
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
func ChangeMountIcon(oldMount string, newMount string) error {
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
	if err != nil {
		return err
	}

	// Also give a nice label
	k2, _, err := registry.CreateKey(registry.CURRENT_USER, `SOFTWARE\Classes\Applications\Explorer.exe\Drives\`+newMount[:1]+`\DefaultLabel`, registry.SET_VALUE|registry.CREATE_SUB_KEY|registry.WRITE)
	defer k2.Close()
	err = k2.SetStringValue("", "Keybase")
	notifyShell(newMount)
	return err
}
