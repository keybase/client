// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb


import (
	"fmt"
	"golang.org/x/sys/windows"
)

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
		if userSID != nil {
			userString, err := userSID.String()
			fmt.Printf("currentProcessUserSid error, SID: %s, %v\n", userString, err)
		}
		return nil, err
	}
	return userSID, nil
}

func Pipeowner(name string) (bool, error){
	userSid, err := currentProcessUserSid()
	if err != nil {
		return false, err
	}

	fileSid, err := GetFileUserSid(name)
	if err != nil {
		return false, err
	}
	return windows.EqualSid(fileSid, userSid), nil
}