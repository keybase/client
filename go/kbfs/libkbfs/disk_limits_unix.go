// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import (
	"math"
	"syscall"

	"github.com/pkg/errors"
)

// getDiskLimits gets the disk limits for the logical disk containing
// the given path.
func getDiskLimits(path string) (
	availableBytes, totalBytes, availableFiles, totalFiles uint64, err error) {
	// Notably we are using syscall rather than golang.org/x/sys/unix here.
	// The latter is broken on iOS with go1.11.8 (and likely earlier versions)
	// and always gives us 0 as available storage space. go1.12.3 is known to
	// work fine with sys/unix.
	var stat syscall.Statfs_t
	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, 0, 0, 0, errors.WithStack(err)
	}

	// Bavail is the free block count for an unprivileged user.
	availableBytes = stat.Bavail * uint64(stat.Bsize)
	totalBytes = stat.Blocks * uint64(stat.Bsize)
	// Some filesystems, like btrfs, don't keep track of inodes.
	// (See https://github.com/keybase/client/issues/6206 .) Use
	// the total inode count to detect that case.
	if stat.Files > 0 {
		availableFiles = stat.Ffree
		totalFiles = stat.Files
	} else {
		availableFiles = math.MaxInt64
		totalFiles = math.MaxInt64
	}
	return availableBytes, totalBytes, availableFiles, totalFiles, nil
}
