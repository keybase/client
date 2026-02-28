// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package winacl

import (
	"syscall"
)

// SID wraps syscall.SID.
type SID syscall.SID

// currentProcessUserSid is a utility to get the
// SID of the current user running the process.
func currentProcessUserSid() (*SID, error) {
	tok, err := syscall.OpenCurrentProcessToken()
	if err != nil {
		return nil, err
	}
	defer tok.Close()
	tokUser, err := tok.GetTokenUser()
	if err != nil {
		return nil, err
	}
	return (*SID)(tokUser.User.Sid), nil
}

func currentProcessPrimaryGroupSid() (*SID, error) {
	tok, err := syscall.OpenCurrentProcessToken()
	if err != nil {
		return nil, err
	}
	defer tok.Close()
	tokGroup, err := tok.GetTokenPrimaryGroup()
	if err != nil {
		return nil, err
	}
	return (*SID)(tokGroup.PrimaryGroup), nil
}
