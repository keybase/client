// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"io"
	"sync/atomic"

	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "github.com/src-d/go-billy"
)

// File is a wrapper around a libkbfs.Node that implements the
// billy.File interface.
type File struct {
	fs       *FS
	filename string
	node     libkbfs.Node
	readOnly bool
	offset   int64
}

var _ billy.File = (*File)(nil)

// Name implements the billy.File interface for File.
func (f *File) Name() string {
	return f.filename
}

func (f *File) updateOffset(origOffset, advanceBytes int64) {
	// If there are two concurrent Write calls at the same time, it's
	// not well-defined what the offset should be after.  Just set it
	// to what this call thinks it should be and let the application
	// sort things out.
	_ = atomic.SwapInt64(&f.offset, origOffset+advanceBytes)
}

// Write implements the billy.File interface for File.
func (f *File) Write(p []byte) (n int, err error) {
	if f.readOnly {
		return 0, errors.New("Trying to write a read-only file")
	}

	origOffset := atomic.LoadInt64(&f.offset)
	err = f.fs.config.KBFSOps().Write(f.fs.ctx, f.node, p, origOffset)
	if err != nil {
		return 0, err
	}

	f.updateOffset(origOffset, int64(len(p)))
	return len(p), nil
}

// Read implements the billy.File interface for File.
func (f *File) Read(p []byte) (n int, err error) {
	f.fs.log.CDebugf(f.fs.ctx, "Read %d bytes at current offset", len(p))

	origOffset := atomic.LoadInt64(&f.offset)
	readBytes, err := f.fs.config.KBFSOps().Read(
		f.fs.ctx, f.node, p, origOffset)
	if err != nil {
		return 0, err
	}

	f.updateOffset(origOffset, readBytes)
	return int(readBytes), nil
}

// ReadAt implements the billy.File interface for File.
func (f *File) ReadAt(p []byte, off int64) (n int, err error) {
	f.fs.log.CDebugf(f.fs.ctx, "Read %d bytes at offset %d", len(p), off)

	// ReadAt doesn't affect the underlying offset.
	readBytes, err := f.fs.config.KBFSOps().Read(f.fs.ctx, f.node, p, off)
	if err != nil {
		return 0, err
	}
	if int(readBytes) < n {
		// ReadAt is more strict than Read.
		return 0, errors.Errorf("Could only read %d bytes", readBytes)
	}

	return int(readBytes), nil
}

// Seek implements the billy.File interface for File.
func (f *File) Seek(offset int64, whence int) (n int64, err error) {
	f.fs.log.CDebugf(f.fs.ctx, "Seek %d bytes (whence=%d)", offset, whence)
	defer func() {
		f.fs.deferLog.CDebugf(f.fs.ctx, "Seek done: %+v", err)
	}()

	newOffset := offset
	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		origOffset := atomic.LoadInt64(&f.offset)
		newOffset = origOffset + offset
	case io.SeekEnd:
		ei, err := f.fs.config.KBFSOps().Stat(f.fs.ctx, f.node)
		if err != nil {
			return 0, err
		}
		newOffset = int64(ei.Size) + offset
	}
	if newOffset < 0 {
		return 0, errors.Errorf("Cannot seek to offset %d", newOffset)
	}

	_ = atomic.SwapInt64(&f.offset, offset)
	return newOffset, nil
}

// Close implements the billy.File interface for File.
func (f *File) Close() error {
	f.node = nil
	return nil
}
