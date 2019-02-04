// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
	"golang.org/x/net/context"
)

// NewUpdateHistoryFile returns a special read file that contains a text
// representation of the update history of the current TLF.
func NewUpdateHistoryFile(folder *Folder) *SpecialReadFile {
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			return libfs.GetEncodedUpdateHistory(
				ctx, folder.fs.config, folder.getFolderBranch())
		},
		fs: folder.fs,
	}
}
