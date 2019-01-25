// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"unicode/utf16"

	"github.com/keybase/client/go/utils"
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
	// F1B32785-6FBA-4FCF-9D55-7B8E7F157091

	FOLDERIDLocalAppData = GUID{0xF1B32785, 0x6FBA, 0x4FCF, [8]byte{0x9D, 0x55, 0x7B, 0x8E, 0x7F, 0x15, 0x70, 0x91}}
	FOLDERIDSystem       = GUID{0x1AC14E77, 0x02E7, 0x4E5D, [8]byte{0xB7, 0x44, 0x2E, 0xB1, 0xAE, 0x51, 0x98, 0xB7}}
)

var (
	modShell32               = windows.NewLazySystemDLL("Shell32.dll")
	modOle32                 = windows.NewLazySystemDLL("Ole32.dll")
	kernel32                 = windows.NewLazySystemDLL("kernel32.dll")
	procSHGetKnownFolderPath = modShell32.NewProc("SHGetKnownFolderPath")
	procCoTaskMemFree        = modOle32.NewProc("CoTaskMemFree")
	shChangeNotifyProc       = modShell32.NewProc("SHChangeNotify")
	procCreateMutex          = kernel32.NewProc("CreateMutexW")
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

func coTaskMemFree(pv unsafe.Pointer) {
	syscall.Syscall(procCoTaskMemFree.Addr(), 1, uintptr(pv), 0, 0)
	return
}

func GetDataDir(id GUID, name, envname string) (string, error) {
	var pszPath unsafe.Pointer
	// https://msdn.microsoft.com/en-us/library/windows/desktop/bb762188(v=vs.85).aspx
	// When this method returns, pszPath contains the address of a pointer to a null-terminated
	// Unicode string that specifies the path of the known folder. The calling process
	// is responsible for freeing this resource once it is no longer needed by calling
	// coTaskMemFree.
	//
	// It's safe for pszPath to point to memory not managed by Go:
	// see
	// https://groups.google.com/d/msg/golang-nuts/ls7Eg7Ye9pU/ye1GLs8dBwAJ
	// for details.
	r0, _, _ := procSHGetKnownFolderPath.Call(uintptr(unsafe.Pointer(&id)), uintptr(0), uintptr(0), uintptr(unsafe.Pointer(&pszPath)))
	if uintptr(pszPath) != 0 {
		defer coTaskMemFree(pszPath)
	}
	// Sometimes r0 == 0 and there still isn't a valid string returned
	if r0 != 0 || uintptr(pszPath) == 0 {
		return "", fmt.Errorf("can't get %s; HRESULT=%d, pszPath=%x", name, r0, pszPath)
	}

	var rawUnicode []uint16
	for i := uintptr(0); ; i++ {
		u16 := *(*uint16)(unsafe.Pointer(uintptr(pszPath) + 2*i))
		if u16 == 0 {
			break
		}
		if i == 1<<16 {
			return "", fmt.Errorf("%s path has more than 65535 characters", name)
		}

		rawUnicode = append(rawUnicode, u16)
	}

	folder := string(utf16.Decode(rawUnicode))

	if len(folder) == 0 {
		// Try the environment as a backup
		folder = os.Getenv(envname)
		if len(folder) == 0 {
			return "", fmt.Errorf("can't get %s directory", envname)
		}
	}

	return folder, nil
}

func AppDataDir() (string, error) {
	return GetDataDir(FOLDERIDRoamingAppData, "FOLDERIDRoamingAppData", "APPDATA")
}

func LocalDataDir() (string, error) {
	return GetDataDir(FOLDERIDLocalAppData, "FOLDERIDLocalAppData", "LOCALAPPDATA")
}

func SystemDir() (string, error) {
	return GetDataDir(FOLDERIDSystem, "FOLDERIDSystem", "")
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
	keybaseExe, err := utils.BinPath()
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
