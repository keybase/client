// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/kbfs/libfs"
)

// NewUserEditHistoryFile returns a special read file that contains a text
// representation of the file edit history for the logged-in user.
func NewUserEditHistoryFile(
	folder *Folder, entryValid *time.Duration) *SpecialReadFile {
	*entryValid = 0
	return &SpecialReadFile{
		read: func(_ context.Context) ([]byte, time.Time, error) {
			return libfs.GetEncodedUserEditHistory(folder.fs.config)
		},
	}
}
