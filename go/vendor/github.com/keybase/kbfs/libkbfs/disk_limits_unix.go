// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import (
	"math"

	"github.com/pkg/errors"
	"golang.org/x/sys/unix"
)

// getDiskLimits gets the disk limits for the logical disk containing
// the given path.
func getDiskLimits(path string) (
	availableBytes, availableFiles uint64, err error) {
	var stat unix.Statfs_t
	err = unix.Statfs(path, &stat)
	if err != nil {
		return 0, 0, errors.WithStack(err)
	}

	// Bavail is the free block count for an unprivileged user.
	availableBytes = uint64(stat.Bavail) * uint64(stat.Bsize)
	// Some filesystems, like btrfs, don't keep track of inodes.
	// (See https://github.com/keybase/client/issues/6206 .) Use
	// the total inode count to detect that case.
	if stat.Files > 0 {
		availableFiles = uint64(stat.Ffree)
	} else {
		availableFiles = math.MaxInt64
	}
	return availableBytes, availableFiles, nil
}
