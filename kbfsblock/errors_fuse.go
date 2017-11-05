// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package kbfsblock

import (
	"syscall"

	"bazil.org/fuse"
)

// TODO: Figure out how to avoid pulling in bazil.org/fuse.

var _ fuse.ErrorNumber = ServerErrorUnauthorized{}

// Errno implements the fuse.ErrorNumber interface for ServerErrorUnauthorized.
func (e ServerErrorUnauthorized) Errno() fuse.Errno {
	return fuse.Errno(syscall.EACCES)
}
