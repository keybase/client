// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
	"golang.org/x/net/context"
)

// NewTlfEditHistoryFile returns a special read file that contains a text
// representation of the file edit history for that TLF.
func NewTlfEditHistoryFile(folder *Folder) *SpecialReadFile {
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			return libfs.GetEncodedTlfEditHistory(
				ctx, folder.fs.config, folder.getFolderBranch())
		},
		fs: folder.fs,
	}
}
