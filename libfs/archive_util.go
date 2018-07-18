// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"strconv"
	"strings"

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
