// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
//go:build !windows
// +build !windows

package libfuse

import (
	"time"

	"github.com/keybase/client/go/kbfs/libfs"
)

// NewErrorFile returns a special read file that contains a text
// representation of the last few KBFS errors.
func NewErrorFile(fs *FS, entryValid *time.Duration) *SpecialReadFile {
	*entryValid = 0
	return &SpecialReadFile{read: libfs.GetEncodedErrors(fs.config)}
}
