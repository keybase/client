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
	modkernel32        = windows.NewLazySystemDLL("kernel32.dll")
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

type AccountInfo struct {
	Account string `json:"account"`
	Domain  string `json:"domain"`
	Type    uint32 `json:"type"`
	SID     string `json:"SID"`
	Err     error  `json:"error"`
}

type PipeOwnerInfo struct {
	IsOwner     bool        `json:"isOwner"`
	PipeAccount AccountInfo `json:"pipe"`
	UserAccount AccountInfo `json:"user"`
}

func IsPipeowner(log logger.Logger, name string) (owner PipeOwnerInfo, err error) {
	log.Debug("+ IsPipeowner(%s)", name)
	defer func() {
		log.Debug("- IsPiperowner -> (%v, %v)", owner, err)
	}()
	userSid, err := currentProcessUserSid()
	if err != nil {
		return owner, err
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
			return owner, err // return original busy error
		}
		pipeSid, err = GetFileUserSid(name)
	}
	if err != nil {
		return owner, err
	}
	owner.IsOwner = windows.EqualSid(pipeSid, userSid)
	owner.PipeAccount.Account, owner.PipeAccount.Domain, owner.PipeAccount.Type, owner.PipeAccount.Err = pipeSid.LookupAccount("")
	owner.PipeAccount.SID, err = pipeSid.String()
	if err != nil {
		log.Errorf("error getting owner SID: %s", err.Error())
	}
	owner.UserAccount.Account, owner.UserAccount.Domain, owner.UserAccount.Type, owner.UserAccount.Err = userSid.LookupAccount("")
	owner.UserAccount.SID, err = userSid.String()
	if err != nil {
		log.Errorf("error getting user SID: %s", err.Error())
	}

	if !owner.IsOwner {
		// If the pipe is served by an admin, let local security policies control access
		// https://support.microsoft.com/en-us/help/243330/well-known-security-identifiers-in-windows-operating-systems
		if owner.PipeAccount.SID == "S-1-5-32-544" && owner.PipeAccount.Type == syscall.SidTypeAlias {
			owner.IsOwner = true
		}
	}
	log.Debug("%v", owner)
	return owner, nil
}
