// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"syscall"
	"unsafe"

	"github.com/keybase/client/go/logger"
	"golang.org/x/sys/windows"
)

var (
	modkernel32        = windows.NewLazyDLL("kernel32.dll")
	procWaitNamedPipeW = modkernel32.NewProc("WaitNamedPipeW")
)

const ERROR_PIPE_BUSY = 231

type _PipeBusyError struct{}

var PipeBusyError _PipeBusyError

func (e _PipeBusyError) Error() string {
	return "All pipe instances are busy"
}

func waitNamedPipe(name string, timeout uint32) (err error) {
	rawName, e1 := syscall.UTF16PtrFromString(name)
	if e1 != nil {
		return e1
	}

	r1, _, e2 := procWaitNamedPipeW.Call(uintptr(unsafe.Pointer(rawName)), uintptr(timeout))
	if r1 == 0 {
		return e2
	}
	return
}

// currentProcessUserSid is a utility to get the
// SID of the current user running the process.
func currentProcessUserSid() (*windows.SID, error) {
	tok, err := windows.OpenCurrentProcessToken()
	if err != nil {
		return nil, err
	}
	defer tok.Close()
	tokUser, err := tok.GetTokenUser()
	if err != nil {
		return nil, err
	}
	return (*windows.SID)(tokUser.User.Sid), nil
}

// currentProcessUserSid is a utility to get the
// SID of the named pipe
func GetFileUserSid(name string) (*windows.SID, error) {
	var userSID *windows.SID
	var secDesc windows.Handle

	err := GetNamedSecurityInfo(name, SE_FILE_OBJECT, OWNER_SECURITY_INFORMATION, &userSID, nil, nil, nil, &secDesc)
	if err != nil {
		return nil, err
	}
	return userSID, nil
}

func IsPipeowner(log logger.Logger, name string) (isOwner bool, err error) {
	log.Debug("+ IsPipeowner(%s)", name)
	defer func() {
		log.Debug("- IsPiperowner -> (%v, %v)", isOwner, err)
	}()
	userSid, err := currentProcessUserSid()
	if err != nil {
		return false, err
	}

	pipeSid, err := GetFileUserSid(name)
	if err == PipeBusyError {
		// If at least one instance of the pipe has been created, this function
		// will wait timeout milliseconds for it to become available.
		// It will return immediately regardless of timeout, if no instances
		// of the named pipe have been created yet.
		// If this returns with no error, there is a pipe available.
		err2 := waitNamedPipe(name, 1000)
		if err2 != nil {
			return false, err // return original busy error
		}
		pipeSid, err = GetFileUserSid(name)
	}
	if err != nil {
		return false, err
	}
	isOwner = windows.EqualSid(pipeSid, userSid)
	if !isOwner {
		pipeAccount, pipeDomain, pipeAccType, pipeErr := pipeSid.LookupAccount("")
		userAccount, userDomain, userAccType, userErr := userSid.LookupAccount("")
		log.Debug("Pipe account: %s, %s, %v, %v", pipeAccount, pipeDomain, pipeAccType, pipeErr)
		log.Debug("User account: %s, %s, %v, %v", userAccount, userDomain, userAccType, userErr)
		// If the pipe is served by an admin, let local security policies control access
		if pipeAccount == "Administrators" && pipeDomain == "BUILTIN" && pipeAccType == syscall.SidTypeAlias {
			isOwner = true
		}
	}
	return isOwner, nil
}
