// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

func handleSpecialFile(name string, fs *FS, resp *fuse.LookupResponse) fs.Node {
	switch name {
	case libkbfs.ErrorFile:
		return NewErrorFile(fs, resp)
	case libfs.MetricsFileName:
		return NewMetricsFile(fs, resp)
	case libfs.ProfileListDirName:
		return ProfileList{}
	case libfs.ResetCachesFileName:
		return &ResetCachesFile{fs}
	}

	return nil
}
