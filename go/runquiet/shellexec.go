package main

import (
	"errors"
	"fmt"
	"os"
	"syscall"
	"unsafe"
)

const (
	// Windows errors.
	ERROR_BAD_FORMAT       syscall.Errno = 11
	SE_ERR_ACCESSDENIED    syscall.Errno = 5
	SE_ERR_ASSOCINCOMPLETE syscall.Errno = 27
	SE_ERR_DDEBUSY         syscall.Errno = 30
	SE_ERR_DDEFAIL         syscall.Errno = 29
	SE_ERR_DDETIMEOUT      syscall.Errno = 28
	SE_ERR_DLLNOTFOUND     syscall.Errno = 32
	SE_ERR_NOASSOC         syscall.Errno = 31
	SE_ERR_OOM             syscall.Errno = 8
	SE_ERR_SHARE           syscall.Errno = 26
)

func shellExecute(pathname string, verb string) error {
	var hand uintptr = uintptr(0)
	var operator uintptr = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(verb)))
	var fpath uintptr = uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(pathname)))
	var param uintptr = uintptr(0)
	var dirpath uintptr = uintptr(0)
	var ncmd uintptr = uintptr(1)
	shell32 := syscall.NewLazyDLL("shell32.dll")
	ShellExecuteW := shell32.NewProc("ShellExecuteW")
	ret, _, _ := ShellExecuteW.Call(hand, operator, fpath, param, dirpath, ncmd)

	errorMsg := ""
	if ret != 0 && ret <= 32 {
		switch syscall.Errno(ret) {
		case syscall.ERROR_FILE_NOT_FOUND:
			errorMsg = "The specified file was not found."
		case syscall.ERROR_PATH_NOT_FOUND:
			errorMsg = "The specified path was not found."
		case ERROR_BAD_FORMAT:
			errorMsg = "The .exe file is invalid (non-Win32 .exe or error in .exe image)."
		case SE_ERR_ACCESSDENIED:
			errorMsg = "The operating system denied access to the specified file."
		case SE_ERR_ASSOCINCOMPLETE:
			errorMsg = "The file name association is incomplete or invalid."
		case SE_ERR_DDEBUSY:
			errorMsg = "The DDE transaction could not be completed because other DDE transactions were being processed."
		case SE_ERR_DDEFAIL:
			errorMsg = "The DDE transaction failed."
		case SE_ERR_DDETIMEOUT:
			errorMsg = "The DDE transaction could not be completed because the request timed out."
		case SE_ERR_DLLNOTFOUND:
			errorMsg = "The specified DLL was not found."
		case SE_ERR_NOASSOC:
			errorMsg = "There is no application associated with the given file name extension. This error will also be returned if you attempt to print a file that is not printable."
		case SE_ERR_OOM:
			errorMsg = "There was not enough memory to complete the operation."
		case SE_ERR_SHARE:
			errorMsg = "A sharing violation occurred."
		default:
			errorMsg = fmt.Sprintf("Unknown error occurred with error code %v", ret)
		}
	} else {
		return nil
	}

	return errors.New(errorMsg)
}

const (
	SEE_MASK_NOCLOSEPROCESS uint32 = 0x00000040
	SEE_MASK_NOASYNC        uint32 = 0x00000100
)

type SHELLEXECUTEINFO struct {
	Size           uint32
	fMask          uint32
	hwnd           uint32
	lpVerb         uintptr
	lpFile         uintptr
	lpParameters   uintptr
	lpDirectory    uintptr
	nShow          int
	hInstApp       uint32
	lpIDList       uintptr
	lpClass        uintptr
	hkeyClass      uint32
	dwHotKey       uint32
	DUMMYUNIONNAME uint32
	hProcess       uint32
}

func shellExecuteEx(pathname string, verb string) error {
	si := SHELLEXECUTEINFO{

		fMask:  SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
		lpVerb: uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(verb))),
		lpFile: uintptr(unsafe.Pointer(syscall.StringToUTF16Ptr(pathname))),
		nShow:  1, // SW_SHOWNORMAL

	}
	si.Size = uint32(unsafe.Sizeof(si))

	shell32 := syscall.NewLazyDLL("shell32.dll")
	ShellExecuteExW := shell32.NewProc("ShellExecuteExW")
	ret, _, err := ShellExecuteExW.Call(uintptr(unsafe.Pointer(&si)))

	if ret != 0 {
		fmt.Printf("Executed. Now waiting for %x\n", si.hProcess)
		kernel32 := syscall.NewLazyDLL("Kernel32.dll")
		GetProcessID := kernel32.NewProc("GetProcessId")
		pid, _, err := GetProcessID.Call(uintptr(si.hProcess))
		if pid == 0 {
			fmt.Printf("GetProcessID -- %v\n", err)
			return err
		}
		if p, err := os.FindProcess(int(pid)); p != nil && err != nil {
			pstate, err := p.Wait()

			if err == nil && pstate.Success() {
				return nil
			}
		} else {
			fmt.Printf("Couldn't find process\n")
		}
	}

	return err
}
