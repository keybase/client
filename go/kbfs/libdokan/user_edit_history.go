// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"context"
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
)

// NewUserEditHistoryFile returns a special read file that contains a text
// representation of the file edit history for the logged-in user.
func NewUserEditHistoryFile(folder *Folder) *SpecialReadFile {
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			return libfs.GetEncodedUserEditHistory(ctx, folder.fs.config)
		},
		fs: folder.fs,
	}
}
