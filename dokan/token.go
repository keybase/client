// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package dokan

/*
#include "bridge.h"
*/
import "C"

import (
	"errors"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// GetRequestorToken returns the syscall.Token associated with
// the requestor of this file system operation. Remember to
// call Close on the Token.
func (fi *FileInfo) GetRequestorToken() (syscall.Token, error) {
	hdl := syscall.Handle(C.DokanOpenRequestorToken(fi.ptr))
	var err error
	if hdl == syscall.InvalidHandle {
		// Tokens are value types, so returning nil is impossible,
		// returning an InvalidHandle is the best way.
		err = errors.New("Invalid handle from DokanOpenRequestorHandle")
	}
	return syscall.Token(hdl), err
}

// IsRequestorUserSidEqualTo returns true if the sid passed as
// the argument is equal to the sid of the user associated with
// the filesystem request.
func (fi *FileInfo) IsRequestorUserSidEqualTo(sid *syscall.SID) bool {
	tok, err := fi.GetRequestorToken()
	if err != nil {
		debug("IsRequestorUserSidEqualTo:", err)
		return false
	}
	defer tok.Close()
	tokUser, err := tok.GetTokenUser()
	if err != nil {
		debug("IsRequestorUserSidEqualTo: GetTokenUser:", err)
		return false
	}
	res, _, _ := syscall.Syscall(procEqualSid.Addr(), 2,
		uintptr(unsafe.Pointer(sid)),
		uintptr(unsafe.Pointer(tokUser.User.Sid)),
		0)
	if isDebug {
		u1, _ := sid.String()
		u2, _ := tokUser.User.Sid.String()
		debugf("IsRequestorUserSidEqualTo: EqualSID(%q,%q) => %v (expecting non-zero)\n", u1, u2, res)
	}
	return res != 0
}

// CurrentProcessUserSid is a utility to get the
// SID of the current user running the process.
func CurrentProcessUserSid() (*syscall.SID, error) {
	tok, err := syscall.OpenCurrentProcessToken()
	if err != nil {
		return nil, err
	}
	defer tok.Close()
	tokUser, err := tok.GetTokenUser()
	if err != nil {
		return nil, err
	}
	return tokUser.User.Sid, nil
}

var (
	modadvapi32  = windows.NewLazySystemDLL("advapi32.dll")
	procEqualSid = modadvapi32.NewProc("EqualSid")
)
