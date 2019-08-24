// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"golang.org/x/net/context"
)

// NewArchiveRelTimeFile returns a special read file that contains a
// by-revision directory name that corresponds to the given relative
// time string for the given folder.
func NewArchiveRelTimeFile(
	fs *FS, handle *tlfhandle.Handle, filename string,
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
