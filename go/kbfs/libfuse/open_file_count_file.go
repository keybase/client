// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"strconv"
	"time"

	"golang.org/x/net/context"
)

// NewOpenFileCountFile returns a special read file that contains the
// number of files and directories currently being held open by the OS.
func NewOpenFileCountFile(
	folder *Folder, entryValid *time.Duration) *SpecialReadFile {
	*entryValid = 0
	return &SpecialReadFile{
		read: func(_ context.Context) ([]byte, time.Time, error) {
			count := folder.fs.root.openFileCount()
			return []byte(strconv.FormatInt(count, 10)),
				folder.fs.config.Clock().Now(), nil
		},
	}
}
