// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/kardianos/osext"

	"unicode/utf16"

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
	FOLDERIDRoamingAppData = GUID{0x3EB685DB, 0x65F9, 0x4CF6, [8]byte{0xA0, 0x3A, 0xE3, 0xEF, 0x65, 0x72, 0x9F, 0x3D}}
)

// F1B32785-6FBA-4FCF-9D55-7B8E7F157091
var (
	FOLDERIDLocalAppData = GUID{0xF1B32785, 0x6FBA, 0x4FCF, [8]byte{0x9D, 0x55, 0x7B, 0x8E, 0x7F, 0x15, 0x70, 0x91}}
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

func GetDataDir(id GUID, envname string) (string, error) {

	var pszPath uintptr
	// https://msdn.microsoft.com/en-us/library/windows/desktop/bb762188(v=vs.85).aspx
	// When this method returns, contains the address of a pointer to a null-terminated
	// Unicode string that specifies the path of the known folder. The calling process
	// is responsible for freeing this resource once it is no longer needed by calling
	// CoTaskMemFree.
	r0, _, _ := procSHGetKnownFolderPath.Call(uintptr(unsafe.Pointer(&id)), uintptr(0), uintptr(0), uintptr(unsafe.Pointer(&pszPath)))
	// Sometimes r0 == 0 and there still isn't a valid string returned
	if r0 != 0 || pszPath == 0 {
		return "", fmt.Errorf("can't get %s", envname)
	}

	defer coTaskMemFree(pszPath)

	var rawUnicode []uint16
	for i := uintptr(0); ; i++ {
		// This triggers a "possible misuse of unsafe.Pointer"
		// warning in go vet, but it is safe to ignore it: see
		// https://groups.google.com/forum/#!msg/golang-nuts/0JYB0-ZcFpk/Zt5q1rPbBQAJ
		// .
		u16 := *(*uint16)(unsafe.Pointer(pszPath + 2*i))
		if u16 == 0 {
			break
		}
		if i == 1<<16 {
			return "", fmt.Errorf("%s path has more than 65535 characters", envname)
		}

		rawUnicode = append(rawUnicode, u16)
	}

	folder := string(utf16.Decode(rawUnicode))

	if len(folder) == 0 {
		// Try the environment as a backup
		folder = os.Getenv(envname)
		if len(folder) == 0 {
			return "", errors.New("can't get AppData directory")
		}
	}

	return folder, nil
}

func AppDataDir() (string, error) {
	return GetDataDir(FOLDERIDRoamingAppData, "APPDATA")
}

func LocalDataDir() (string, error) {
	return GetDataDir(FOLDERIDLocalAppData, "LOCALAPPDATA")
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

// renameFile performs some retries on Windows,
// similar to SafeWriteToFile
func renameFile(g *GlobalContext, src string, dest string) error {
	var err error
	for i := 0; i < 5; i++ {
		if err != nil {
			g.Log.Debug("Retrying failed os.Rename - %s", err)
			time.Sleep(10 * time.Millisecond)
		}
		err = os.Rename(src, dest)
		if err == nil {
			break
		}
	}
	return err
}

func copyFile(src string, dest string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	destFile, err := os.Create(dest) // creates if file doesn't exist
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, srcFile) // check first var for number of bytes copied
	if err != nil {
		return err
	}

	err = destFile.Sync()
	return err
}

// These are the really important ones, so we'll copy first and then delete the old ones,
// undoing on failure.
func moveKeyFiles(g *GlobalContext, oldHome string, currentHome string) (bool, error) {
	var err error

	// See if any secret key files are in the new location. If so, don't repair.
	if newSecretKeyfiles, _ := filepath.Glob(filepath.Join(currentHome, "*.ss")); len(newSecretKeyfiles) > 0 {
		return false, nil
	}

	files, _ := filepath.Glob(filepath.Join(oldHome, "*.mpack"))
	oldSecretKeyfiles, _ := filepath.Glob(filepath.Join(oldHome, "*.ss"))
	files = append(files, oldSecretKeyfiles...)
	var newFiles []string

	for _, oldPathName := range files {
		_, name := filepath.Split(oldPathName)
		newPathName := filepath.Join(currentHome, name)

		// If both copies exist, skip
		if exists, _ := FileExists(newPathName); !exists {
			g.Log.Error("RemoteSettingsRepairman copying %s to %s", oldPathName, newPathName)
			err = copyFile(oldPathName, newPathName)
			if err != nil {
				g.Log.Error("RemoteSettingsRepairman fatal error copying %s to %s - %s", oldPathName, newPathName, err)
				break
			} else {
				newFiles = append(newFiles, newPathName)
			}
		}

	}
	if err != nil {
		// Undo any of the new copies and quit
		for _, newPathName := range newFiles {
			os.Remove(newPathName)
		}
		return false, err
	}
	// Now that we've successfully copied, delete the old ones - BUT don't bail out on error here
	for _, oldPathName := range files {
		os.Remove(oldPathName)
	}

	// Return true if we copied any
	if len(files) > 0 {
		return true, err
	}

	return false, err
}

// helper for RemoteSettingsRepairman
func moveNonChromiumFiles(g *GlobalContext, oldHome string, currentHome string) error {

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
			g.Log.Error("RemoteSettingsRepairman error moving %s to %s (continuing) - %s", oldPathName, newPathName, err)
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
		func() RunMode { return g.Env.GetRunMode() },
		g.GetLog,
	}}

	if g.Env.GetRunMode() != ProductionRunMode {
		return nil
	}

	currentHome := w.Home(false)
	kbDir := filepath.Base(currentHome)
	oldDir, err := AppDataDir()
	if err != nil {
		return err
	}
	oldHome := filepath.Join(oldDir, kbDir)

	// Only continue repairing if key files needed to be moved
	if moved, err := moveKeyFiles(g, oldHome, currentHome); !moved || err != nil {
		return err
	}
	// Don't fail the repairmain if these others can't be moved
	moveNonChromiumFiles(g, oldHome, currentHome)
	return nil
}

// Notify the shell that the thing located at path has changed
func notifyShell(path string) {
	pathEncoded := utf16.Encode([]rune(path))
	if len(pathEncoded) > 0 {
		shChangeNotifyProc.Call(
			uintptr(0x00002000), // SHCNE_UPDATEITEM
			uintptr(0x0005),     // SHCNF_PATHW
			uintptr(unsafe.Pointer(&pathEncoded[0])),
			0)
	}
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
