// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"time"

	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// NewArchiveRelTimeFile returns a special read file that contains a
// text representation of the global KBFS status.
func NewArchiveRelTimeFile(
	fs *FS, handle *libkbfs.TlfHandle, filename string,
	entryValid *time.Duration) *SpecialReadFile {
	*entryValid = 0
	return &SpecialReadFile{
		read: func(ctx context.Context) ([]byte, time.Time, error) {
			data, isRel, err := libfs.FileDataFromRelativeTimeString(
				ctx, fs.config, handle, filename)
			if err != nil {
				return nil, time.Time{}, err
			}
			if !isRel {
				panic("ArchiveRelTimeFile should only be used with " +
					"reltime file names")
			}
			return data, time.Time{}, nil
		},
	}
}
