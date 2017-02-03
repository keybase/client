// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !windows

package libkbfs

import (
	"github.com/pkg/errors"
	"golang.org/x/sys/unix"
)

// getDiskLimits gets the disk limits for the logical disk containing
// the given path.
//
// TODO: Also return available files.
func getDiskLimits(path string) (availableBytes uint64, err error) {
	var stat unix.Statfs_t
	err = unix.Statfs(path, &stat)
	if err != nil {
		return 0, errors.WithStack(err)
	}

	// Bavail is the free block count for an unprivileged user.
	availableBytes = stat.Bavail * uint64(stat.Bsize)

	// TODO: Use stat.Ffree to return availableFiles.

	return availableBytes, nil
}
