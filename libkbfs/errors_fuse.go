// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import (
	"syscall"

	"bazil.org/fuse"
)

var _ fuse.ErrorNumber = NoSuchUserError{""}

// Errno implements the fuse.ErrorNumber interface for
// NoSuchUserError
func (e NoSuchUserError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOENT)
}

var _ fuse.ErrorNumber = DirNotEmptyError{""}

// Errno implements the fuse.ErrorNumber interface for
// DirNotEmptyError
func (e DirNotEmptyError) Errno() fuse.Errno {
	return fuse.Errno(syscall.ENOTEMPTY)
}

var _ fuse.ErrorNumber = ReadAccessError{}

// Errno implements the fuse.ErrorNumber interface for
// ReadAccessError.
func (e ReadAccessError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = WriteAccessError{}

// Errno implements the fuse.ErrorNumber interface for
// WriteAccessError.
func (e WriteAccessError) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

// Errno implements the fuse.ErrorNumber interface for BServerErrorUnauthorized.
func (e BServerErrorUnauthorized) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

// Errno implements the fuse.ErrorNumber interface for MDServerErrorUnauthorized.
func (e MDServerErrorUnauthorized) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}
