// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package ioutil

import (
	"io"
	"os"

	"github.com/pkg/errors"
)

// WriteSerializedFile writes (or overwrites) `data` into `filename`.
// If `filename` doesn't exist, it's created with `perm` permissions.
// If `filename` does exist, the data is first overwritten to the
// file, and then the file is truncated to the length of the data.  If
// the data represents a serialized data structure where the length is
// explicitly stated in, or implicitly calculated from, the data
// itself on a read, then this is approximately an atomic write
// (without the performance overhead of writing to a temp file and
// renaming it).  NOTE: it's technically possible a partial OS write
// could lead to a corrupted file, though in practice this seems much
// more rare than ioutil.WriteFile() leaving behind an empty file.
func WriteSerializedFile(
	filename string, data []byte, perm os.FileMode) (err error) {
	// Don't use ioutil.WriteFile because it truncates the file first,
	// and if there's a crash it will leave the file in an unknown
	// state.
	f, err := OpenFile(filename, os.O_WRONLY|os.O_CREATE, 0600)
	if err != nil {
		return err
	}
	defer func() {
		closeErr := f.Close()
		if err == nil {
			err = errors.WithStack(closeErr)
		}
	}()
	// Overwrite whatever data is there and then truncate.
	n, err := f.Write(data)
	if err != nil {
		return errors.WithStack(err)
	} else if n < len(data) {
		return errors.WithStack(io.ErrShortWrite)
	}

	return f.Truncate(int64(len(data)))
}
