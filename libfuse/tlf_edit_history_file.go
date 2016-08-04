// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"time"

	"bazil.org/fuse"
	"golang.org/x/net/context"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

// NewTlfEditHistoryFile returns a special read file that contains a text
// representation of the file edit history for that TLF.
func NewTlfEditHistoryFile(fs *FS, folderBranch libkbfs.FolderBranch,
	resp *fuse.LookupResponse) *SpecialReadFile {
	resp.EntryValid = 0
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			return libfs.GetEncodedTlfEditHistory(ctx, fs.config, folderBranch)
		},
	}
}
