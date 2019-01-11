// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"os"
	"syscall"
)

func isSet(bit, value int) bool {
	return value&bit == bit
}

// OpenFile opens a file with FILE_SHARE_DELETE set.
// This means that the file can be renamed or deleted while it is open.
func OpenFile(filename string, mode, perm int) (*os.File, error) {
	path, err := syscall.UTF16PtrFromString(filename)
	if err != nil {
		return nil, err
	}
	var access uint32 = syscall.GENERIC_READ
	if isSet(os.O_WRONLY, mode) || isSet(os.O_RDWR, mode) || isSet(os.O_CREATE, mode) {
		access |= syscall.GENERIC_WRITE
	}
	var create uint32 = syscall.OPEN_EXISTING
	switch {
	case isSet(os.O_CREATE, mode) && isSet(os.O_EXCL, mode):
		create = syscall.CREATE_NEW
	case isSet(os.O_CREATE, mode) && isSet(os.O_TRUNC, mode):
		create = syscall.CREATE_ALWAYS
	case isSet(os.O_CREATE, mode):
		create = syscall.OPEN_ALWAYS
	case isSet(os.O_TRUNC, mode):
		create = syscall.TRUNCATE_EXISTING
	}
	h, err := syscall.CreateFile(path, access,
		syscall.FILE_SHARE_READ|syscall.FILE_SHARE_WRITE|syscall.FILE_SHARE_DELETE,
		nil, create, syscall.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(h), filename), nil
}

func Open(filename string) (*os.File, error) {
	return OpenFile(filename, os.O_RDONLY, 0666)
}
func Create(filename string) (*os.File, error) {
	return OpenFile(filename, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0666)
}
