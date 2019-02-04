// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.
//
// Windows utility for silently starting console processes
// without showing a console.
// Must be built with -ldflags "-H windowsgui"

// +build windows

package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/keybase/go-winio"
	"golang.org/x/sys/windows"
)

const flagCreateNewConsole = 0x00000010

var (
	modadvapi32 *windows.LazyDLL = windows.NewLazySystemDLL("advapi32.dll")
	moduser32   *windows.LazyDLL = windows.NewLazySystemDLL("user32.dll")

	procDuplicateTokenEx         *windows.LazyProc = modadvapi32.NewProc("DuplicateTokenEx")
	procGetShellWindow           *windows.LazyProc = moduser32.NewProc("GetShellWindow")
	procGetWindowThreadProcessId *windows.LazyProc = moduser32.NewProc("GetWindowThreadProcessId")
	procCreateProcessWithTokenW  *windows.LazyProc = modadvapi32.NewProc("CreateProcessWithTokenW")
)

func GetWindowThreadProcessId(hwnd syscall.Handle) int {
	var processID int
	_, _, _ = procGetWindowThreadProcessId.Call(
		uintptr(hwnd),
		uintptr(unsafe.Pointer(&processID)))

	return processID
}

const SecurityImpersonation = 2

type TokenType uint32

const (
	TokenPrimary       TokenType = 1
	TokenImpersonation TokenType = 2
)

func DuplicateTokenEx(hExistingToken windows.Token, dwDesiredAccess uint32, lpTokenAttributes *syscall.SecurityAttributes, impersonationLevel uint32, tokenType TokenType, phNewToken *windows.Token) (err error) {
	r1, _, e1 := syscall.Syscall6(procDuplicateTokenEx.Addr(), 6, uintptr(hExistingToken), uintptr(dwDesiredAccess), uintptr(unsafe.Pointer(lpTokenAttributes)), uintptr(impersonationLevel), uintptr(tokenType), uintptr(unsafe.Pointer(phNewToken)))
	if r1 == 0 {
		if e1 != 0 {
			err = syscall.Errno(e1)
		} else {
			err = syscall.EINVAL
		}
	}
	return
}

// makeCmdLine builds a command line out of args by escaping "special"
// characters and joining the arguments with spaces.
func makeCmdLine(args []string) string {
	var s string
	for _, v := range args {
		if s != "" {
			s += " "
		}
		s += syscall.EscapeArg(v)
	}
	return s
}

func CreateProcessWithTokenW(hToken syscall.Token, argv []string, attr *syscall.ProcAttr) (pid int, handle uintptr, err error) {
	var sys = attr.Sys

	var cmdline string
	// Windows CreateProcess takes the command line as a single string:
	// use attr.CmdLine if set, else build the command line by escaping
	// and joining each argument with spaces
	if sys.CmdLine != "" {
		cmdline = sys.CmdLine
	} else {
		cmdline = makeCmdLine(argv)
	}

	var argvp *uint16
	if len(cmdline) != 0 {
		argvp, err = syscall.UTF16PtrFromString(cmdline)
		if err != nil {
			return 0, 0, err
		}
	}

	si := new(syscall.StartupInfo)
	si.Cb = uint32(unsafe.Sizeof(*si))
	if sys.HideWindow {
		si.Flags |= syscall.STARTF_USESHOWWINDOW
		si.ShowWindow = syscall.SW_HIDE
	}

	pi := new(syscall.ProcessInformation)

	flags := sys.CreationFlags | syscall.CREATE_UNICODE_ENVIRONMENT
	r1, _, e1 := procCreateProcessWithTokenW.Call(
		uintptr(hToken),                // HANDLE                hToken,
		0,                              // DWORD                 dwLogonFlags,
		uintptr(0),                     // LPCWSTR               lpApplicationName,
		uintptr(unsafe.Pointer(argvp)), // LPWSTR                lpCommandLine,
		uintptr(flags),                 // DWORD                 dwCreationFlags,
		uintptr(0),                     // LPVOID                lpEnvironment,
		uintptr(0),                     // LPCWSTR               lpCurrentDirectory,
		uintptr(unsafe.Pointer(si)),    // LPSTARTUPINFOW        lpStartupInfo,
		uintptr(unsafe.Pointer(pi)),    // LPPROCESS_INFORMATION lpProcessInformation
	)

	if r1 != 0 {
		e1 = nil
	}

	return int(pi.ProcessId), uintptr(pi.Process), e1
}

// Protection against running elevated: attempt to run as regular user instead.
// Assume an error means we weren't elevated, which should be the normal case.
// see https://blogs.msdn.microsoft.com/aaron_margosis/2009/06/06/faq-how-do-i-start-a-program-as-the-desktop-user-from-an-elevated-app/
func getUserToken() (syscall.Token, error) {
	var err error
	var shellWindow uintptr
	if shellWindow, _, err = procGetShellWindow.Call(); shellWindow == 0 {
		return 0, fmt.Errorf("call native GetShellWindow: %s", err)
	}

	processID := GetWindowThreadProcessId(syscall.Handle(shellWindow))

	if processID == 0 {
		return 0, errors.New("can't get desktop window proc ID")
	}

	h, e := syscall.OpenProcess(syscall.PROCESS_QUERY_INFORMATION, false, uint32(processID))
	if e != nil {
		return 0, fmt.Errorf("OpenProcess error: %s", e)
	}
	defer syscall.CloseHandle(h)

	var token, dupToken windows.Token
	err = windows.OpenProcessToken(windows.Handle(h), windows.TOKEN_DUPLICATE, &token)
	if err != nil {
		return 0, err
	}
	const TOKEN_ADJUST_SESSIONID = 256
	dwTokenRights := uint32(syscall.TOKEN_QUERY | syscall.TOKEN_ASSIGN_PRIMARY | syscall.TOKEN_DUPLICATE | syscall.TOKEN_ADJUST_DEFAULT | TOKEN_ADJUST_SESSIONID)
	err = DuplicateTokenEx(token, dwTokenRights, nil, SecurityImpersonation, TokenPrimary, &dupToken)
	if err != nil || dupToken == 0 {
		return 0, fmt.Errorf("DuplicateTokenEx error: %s", err.Error())
	}

	return syscall.Token(dupToken), nil
}

// elevated means we try running as user
func doRun(elevated bool) error {
	argsIndex := 1 // 0 is the name of this program, 1 is either the one to launch or the "wait" option

	if len(os.Args) < 2 {
		log.Fatal("ERROR: no arguments. Use [-wait] programname [arg arg arg]\n")
	}

	// Do this awkward thing so we can pass along the rest of the command line as-is

	doWait := false
	doHide := true
	for i := 1; i < 3 && (i+1) < len(os.Args); i++ {
		if strings.EqualFold(os.Args[argsIndex], "-wait") {
			argsIndex++
			doWait = true
		} else if strings.EqualFold(os.Args[argsIndex], "-show") {
			argsIndex++
			doHide = false
		}
	}
	attr := &syscall.ProcAttr{
		Files: []uintptr{uintptr(syscall.Stdin), uintptr(syscall.Stdout), uintptr(syscall.Stderr)},
		Env:   syscall.Environ(),
		Sys: &syscall.SysProcAttr{
			HideWindow:    doHide,
			CreationFlags: flagCreateNewConsole,
		},
	}
	fmt.Printf("Launching %s with args %v\n", os.Args[argsIndex], os.Args[argsIndex:])

	var err error
	var pid int

	if elevated {
		token, _ := getUserToken()

		pid, _, err = CreateProcessWithTokenW(token, os.Args[argsIndex:], attr)
		defer syscall.CloseHandle(syscall.Handle(token))
		if err != nil {
			fmt.Printf("CreateProcessWithTokenW error: %s\n", err.Error())
			return err
		}
	} else {
		pid, _, err = syscall.StartProcess(os.Args[argsIndex], os.Args[argsIndex:], attr)
	}

	if err != nil {
		fmt.Printf("StartProcess error: %s\n", err.Error())
		return err
	} else if doWait {
		p, err := os.FindProcess(pid)
		if err != nil {
			fmt.Printf("Launcher can't find %d\n", pid)
			return err
		}

		timeout := make(chan time.Time, 1)

		go func() {
			pstate, err := p.Wait()

			if err == nil && pstate.Success() {
				time.Sleep(100 * time.Millisecond)
			} else {
				fmt.Printf("Unsuccessful wait: Error %v, pstate %v\n", err, *pstate)
			}
			timeout <- time.Now()
		}()

		// Only wait 15 seconds because an erroring command was shown to hang
		// up an installer on Win7
		select {
		case _ = <-timeout:
			// success
		case <-time.After(15 * time.Second):
			fmt.Println("timed out")
		}
	}
	return nil
}

func main() {
	// RunWithPrivilege enables a single privilege for a function call.
	// SeIncreaseQuotaPrivilege will only work when elevated
	err := winio.RunWithPrivilege("SeIncreaseQuotaPrivilege", func() error {
		result := doRun(true)
		if result != nil {
			// Print this failure but not the RunWithPrivilege result, since
			// RunWithPrivilege failure is the normal case
			fmt.Printf("De-elevation failure: %v\n", result)
		}
		return result
	})
	if err != nil {
		// This means we weren't elevated, or de-elevation failed. Run without.
		doRun(false)
	}
}
