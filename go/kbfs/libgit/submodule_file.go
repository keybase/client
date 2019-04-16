// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"io"
	"time"

	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-git.v4/plumbing"
)

type submoduleFile struct {
	name  string
	mtime time.Time
	data  []byte

	// TODO: proper locking for `nextRead` if we ever use it outside
	// of autogit (which always uses `ReadAt`).
	nextRead int
}

const (
	submodulePrefix = "git submodule at commit "
)

var _ billy.File = (*submoduleFile)(nil)

func newSubmoduleFile(
	h plumbing.Hash, name string, mtime time.Time) *submoduleFile {
	data := []byte(submodulePrefix + h.String() + "\n")
	return &submoduleFile{
		name:  name,
		mtime: mtime,
		data:  data,
	}
}

func (sf *submoduleFile) Len() int {
	return len(sf.data)
}

func (sf *submoduleFile) Name() string {
	return sf.name
}

func (sf *submoduleFile) Write(_ []byte) (n int, err error) {
	return 0, errors.New("diff files can't be written")
}

func (sf *submoduleFile) Read(p []byte) (n int, err error) {
	if sf.nextRead >= sf.Len() {
		return 0, io.EOF
	}
	n = copy(p, sf.data[sf.nextRead:])
	sf.nextRead += n
	return n, nil
}

func (sf *submoduleFile) ReadAt(p []byte, off int64) (n int, err error) {
	if off >= int64(sf.Len()) {
		return 0, io.EOF
	}

	n = copy(p, sf.data[off:])
	return n, nil
}

func (sf *submoduleFile) Seek(offset int64, whence int) (int64, error) {
	newOffset := offset
	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		newOffset = int64(sf.nextRead) + offset
	case io.SeekEnd:
		newOffset = int64(sf.Len()) + offset
	}
	if newOffset < 0 {
		return 0, errors.Errorf("Cannot seek to offset %d", newOffset)
	}

	sf.nextRead = int(newOffset)
	return newOffset, nil
}

func (sf *submoduleFile) Close() error {
	return nil
}

func (sf *submoduleFile) Lock() error {
	return errors.New("diff files can't be locked")
}

func (sf *submoduleFile) Unlock() error {
	return errors.New("diff files can't be unlocked")
}

func (sf *submoduleFile) Truncate(size int64) error {
	return errors.New("diff files can't be truncated")
}

func (sf *submoduleFile) GetInfo() *submoduleFileInfo {
	return &submoduleFileInfo{
		name:  sf.Name(),
		size:  int64(sf.Len()),
		mtime: sf.mtime,
		sf:    sf,
	}
}
