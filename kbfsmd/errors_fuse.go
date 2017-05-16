// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package kbfsmd

import (
	"syscall"

	"bazil.org/fuse"
)

var _ fuse.ErrorNumber = ServerErrorUnauthorized{}

// Errno implements the fuse.ErrorNumber interface for ServerErrorUnauthorized.
func (e ServerErrorUnauthorized) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}

var _ fuse.ErrorNumber = ServerErrorWriteAccess{}

// Errno implements the fuse.ErrorNumber interface for ServerErrorWriteAccess.
func (e ServerErrorWriteAccess) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}
