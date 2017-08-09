// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsgit

import (
	_ "github.com/keybase/kbfs/libkbfs"
	billy "github.com/src-d/go-billy"
)

// File is a wrapper around a libkbfs.Node that implements the
// billy.File interface.
type File struct {
}

var _ billy.File = (*File)(nil)

// Name implements the billy.File interface for File.
func (f *File) Name() string {
	return ""
}

// Write implements the billy.File interface for File.
func (f *File) Write(p []byte) (n int, err error) {
	return 0, nil
}

// Read implements the billy.File interface for File.
func (f *File) Read(p []byte) (n int, err error) {
	return 0, nil
}

// ReadAt implements the billy.File interface for File.
func (f *File) ReadAt(p []byte, off int64) (n int, err error) {
	return 0, nil
}

// Seek implements the billy.File interface for File.
func (f *File) Seek(offset int64, whence int) (int64, error) {
	return 0, nil
}

// Close implements the billy.File interface for File.
func (f *File) Close() error {
	return nil
}
