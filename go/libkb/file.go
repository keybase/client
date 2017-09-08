// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"io"
	"os"
)

// File defines a default SafeWriter implementation
type File struct {
	filename string
	data     []byte
	perm     os.FileMode
}

// NewFile returns a File
func NewFile(filename string, data []byte, perm os.FileMode) File {
	return File{filename, data, perm}
}

// Save file
func (f File) Save(g SafeWriteLogger) error {
	return SafeWriteToFile(g, f, f.perm)
}

// GetFilename is for SafeWriter
func (f File) GetFilename() string {
	return f.filename
}

func (f File) DataLen() int64 {
	return int64(len(f.data))
}

// WriteTo is for SafeWriter
func (f File) WriteTo(w io.Writer) (int64, error) {
	n, err := w.Write(f.data)
	if err == nil {
		if n != len(f.data) {
			// this shouldn't happen
			//
			//    Write must return a non-nil error if it returns n < len(p)
			//
			// but check just in case
			return int64(n), io.ErrShortWrite
		}
	}
	return int64(n), err
}
