// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"time"

	"github.com/keybase/kbfs/dokan"
	"golang.org/x/net/context"
)

// SpecialReadFile represents a file whose contents are determined by
// a function.
type SpecialReadFile struct {
	read func(context.Context) ([]byte, time.Time, error)
	fs   *FS
	emptyFile
}

// GetFileInformation does stats for dokan.
func (f *SpecialReadFile) GetFileInformation(*dokan.FileInfo) (*dokan.Stat, error) {
	ctx, cancel := NewContextWithOpID(f.fs, "SpecialReadFile GetFileInformation")
	defer cancel()
	data, t, err := f.read(ctx)
	if err != nil {
		return nil, err
	}

	// Some apps (e.g., Chrome) get confused if we use a 0 size
	// here, as is usual for pseudofiles. So return the actual
	// size, even though it may be racy.
	a, err := defaultFileInformation()
	a.FileAttributes |= fileAttributeReadonly
	a.FileSize = int64(len(data))
	a.LastWrite = t
	a.LastAccess = t
	a.Creation = t
	return a, nil
}

// ReadFile does reads for dokan.
func (f *SpecialReadFile) ReadFile(fi *dokan.FileInfo, bs []byte, offset int64) (int, error) {
	ctx, cancel := NewContextWithOpID(f.fs, "SpecialReadFile ReadFile")
	defer cancel()
	data, _, err := f.read(ctx)
	if err != nil {
		return 0, err
	}

	if offset >= int64(len(data)) {
		return 0, nil
	}

	data = data[int(offset):]

	return copy(bs, data), nil
}
