// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// SpecialReadFile represents a file whose contents are determined by
// a function.
type SpecialReadFile struct {
	read func(context.Context) ([]byte, time.Time, error)
}

var _ fs.Node = (*SpecialReadFile)(nil)

// Attr implements the fs.Node interface for SpecialReadFile.
func (f *SpecialReadFile) Attr(ctx context.Context, a *fuse.Attr) error {
	data, t, err := f.read(ctx)
	if err != nil {
		return err
	}

	// Have a low non-zero value for Valid to avoid being swamped
	// with requests, while still keeping the size up to date.
	a.Valid = 1 * time.Second
	// Some apps (e.g., Chrome) get confused if we use a 0 size
	// here, as is usual for pseudofiles. So return the actual
	// size, even though it may be racy.
	a.Size = uint64(len(data))
	a.Mtime = t
	a.Ctime = t
	a.Mode = 0444
	return nil
}

var _ fs.NodeOpener = (*SpecialReadFile)(nil)

// Open implements the fs.NodeOpener interface for SpecialReadFile.
func (f *SpecialReadFile) Open(ctx context.Context, req *fuse.OpenRequest,
	resp *fuse.OpenResponse) (fs.Handle, error) {
	data, _, err := f.read(ctx)
	if err != nil {
		return nil, err
	}

	resp.Flags |= fuse.OpenDirectIO
	return fs.DataHandle(data), nil
}
