// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"strconv"
	"strings"

	"github.com/araddon/dateparse"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
)

// BranchNameFromArchiveRefDir returns a branch name and true if the
// given directory name is specifying an archived revision with a
// revision number.
func BranchNameFromArchiveRefDir(dir string) (libkbfs.BranchName, bool) {
	if !strings.HasPrefix(dir, ArchivedRevDirPrefix) {
		return "", false
	}

	rev, err := strconv.ParseInt(dir[len(ArchivedRevDirPrefix):], 10, 64)
	if err != nil {
		return "", false
	}

	return libkbfs.MakeRevBranchName(kbfsmd.Revision(rev)), true
}

// RevFromTimeString converts a time string (in any supported golang
// date format) to the earliest revision number with a server
// timestamp greater or equal to that time.  Ambiguous dates are
// parsed in MM/DD format.
func RevFromTimeString(
	ctx context.Context, config libkbfs.Config, h *libkbfs.TlfHandle,
	timeString string) (kbfsmd.Revision, error) {
	t, err := dateparse.ParseAny(timeString)
	if err != nil {
		return kbfsmd.RevisionUninitialized, err
	}

	return libkbfs.GetMDRevisionByTime(ctx, config, h, t)
}

// LinkTargetFromTimeString returns the name of a by-revision archive
// directory, and true, if the given link specifies a valid by-time
// link name.  Ambiguous dates are parsed in MM/DD format.
func LinkTargetFromTimeString(
	ctx context.Context, config libkbfs.Config, h *libkbfs.TlfHandle,
	link string) (string, bool, error) {
	if !strings.HasPrefix(link, ArchivedTimeLinkPrefix) {
		return "", false, nil
	}

	rev, err := RevFromTimeString(
		ctx, config, h, link[len(ArchivedTimeLinkPrefix):])
	if err != nil {
		return "", false, err
	}

	return ArchivedRevDirPrefix + strconv.FormatInt(int64(rev), 10), true, nil
}
