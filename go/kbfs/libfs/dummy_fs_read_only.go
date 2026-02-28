// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"os"
	"path"

	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
)

// dummyFSReadOnly is a wrapper struct that extends a `libkbfs.NodeFSReadOnly`
// implementation into a full `billy.Filesystem` (which fails all
// write calls to it).
type dummyFSReadOnly struct {
	libkbfs.NodeFSReadOnly
}

var _ billy.Filesystem = dummyFSReadOnly{}

func (dfsro dummyFSReadOnly) Create(_ string) (billy.File, error) {
	return nil, errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Stat(_ string) (os.FileInfo, error) {
	return nil, errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Rename(_, _ string) error {
	return errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Remove(_ string) error {
	return errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Join(p ...string) string {
	return path.Join(p...)
}

func (dfsro dummyFSReadOnly) TempFile(_, _ string) (billy.File, error) {
	return nil, errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) MkdirAll(_ string, _ os.FileMode) error {
	return errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Symlink(_, _ string) error {
	return errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Chroot(_ string) (billy.Filesystem, error) {
	return nil, errors.New("read-only filesystem")
}

func (dfsro dummyFSReadOnly) Root() string {
	return ""
}
