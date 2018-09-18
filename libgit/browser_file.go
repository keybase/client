// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io"

	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

type browserFile struct {
	f *object.File
	r io.ReadCloser
}

var _ billy.File = (*browserFile)(nil)

func newBrowserFile(f *object.File) (*browserFile, error) {
	r, err := f.Reader()
	if err != nil {
		return nil, err
	}
	return &browserFile{
		f: f,
		r: r,
	}, nil
}

func (bf *browserFile) Name() string {
	return bf.Name()
}

func (bf *browserFile) Write(_ []byte) (n int, err error) {
	return 0, errors.New("Browser files can't be written")
}

func (bf *browserFile) Read(p []byte) (n int, err error) {
	return bf.r.Read(p)
}

func (bf *browserFile) ReadAt(p []byte, off int64) (n int, err error) {
	// Sadly go-git doesn't expose a `ReadAt` interface for this, but
	// we can probably implement it if needed.  Instead, use a new
	// Reader object and just scan starting from the beginning.
	fullData := make([]byte, int64(len(p))+off)
	r, err := bf.f.Reader()
	if err != nil {
		return 0, err
	}
	defer func() {
		_ = r.Close()
	}()
	n, err = r.Read(fullData)
	if err != nil {
		if int64(n) > off {
			copy(p, fullData[off:int64(n)-off])
			return n, err
		}
		return 0, err
	}
	copy(p, fullData[off:])
	return n - int(off), nil
}

func (bf *browserFile) Seek(offset int64, whence int) (int64, error) {
	// TODO if needed: we'd have to track the offset of `bf.r`
	// manually, the same way we do in `libfs.File`.
	return 0, errors.New("Browser files can't seek")
}

func (bf *browserFile) Close() error {
	return bf.r.Close()
}

func (bf *browserFile) Lock() error {
	return errors.New("Browser files can't be locked")
}

func (bf *browserFile) Unlock() error {
	return errors.New("Browser files can't be unlocked")
}

func (bf *browserFile) Truncate(size int64) error {
	return errors.New("Browser files can't be truncated")
}
