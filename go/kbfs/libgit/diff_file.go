// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libgit

import (
	"context"
	"io"
	"strings"
	"time"

	"github.com/pkg/errors"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

const (
	diffFileDefaultMaxBufSize = 4 * 1024 * 1024 // 4 MB
)

type diffFile struct {
	name       string
	r          *strings.Reader
	maxBufSize int64
	mtime      time.Time
}

var _ billy.File = (*diffFile)(nil)

func newDiffFile(
	ctx context.Context, from, to *object.Commit, header, name string) (
	*diffFile, error) {
	s := header
	patch, err := from.PatchContext(ctx, to)
	if err != nil {
		return nil, err
	}
	s += patch.String()

	r := strings.NewReader(s)
	return &diffFile{
		name:       name,
		r:          r,
		maxBufSize: diffFileDefaultMaxBufSize,
		mtime:      to.Author.When,
	}, nil
}

func (df *diffFile) Len() int {
	return df.r.Len()
}

func (df *diffFile) Name() string {
	return df.name
}

func (df *diffFile) Write(_ []byte) (n int, err error) {
	return 0, errors.New("diff files can't be written")
}

func (df *diffFile) Read(p []byte) (n int, err error) {
	return df.r.Read(p)
}

func (df *diffFile) ReadAt(p []byte, off int64) (n int, err error) {
	n, err = df.r.ReadAt(p, off)
	if err == io.EOF {
		if n == 0 {
			// The billy interface only likes EOFs when no data was read.
			return 0, err
		}
	} else if err != nil {
		return 0, err
	}
	return n, nil
}

func (df *diffFile) Seek(offset int64, whence int) (int64, error) {
	return df.r.Seek(offset, whence)
}

func (df *diffFile) Close() error {
	return nil
}

func (df *diffFile) Lock() error {
	return errors.New("diff files can't be locked")
}

func (df *diffFile) Unlock() error {
	return errors.New("diff files can't be unlocked")
}

func (df *diffFile) Truncate(size int64) error {
	return errors.New("diff files can't be truncated")
}

func (df *diffFile) GetInfo() *diffFileInfo {
	return &diffFileInfo{
		name:  df.Name(),
		size:  int64(df.Len()),
		mtime: df.mtime,
	}
}

func newCommitFile(
	ctx context.Context, commit *object.Commit) (*diffFile, error) {
	header := commit.String()
	name := AutogitCommitPrefix + commit.Hash.String()
	// We can't get the patch for the initial commit, go-git doesn't
	// seem to support it yet.
	parent := commit
	if commit.NumParents() > 0 {
		var err error
		parent, err = commit.Parent(0)
		if err != nil {
			return nil, err
		}
	}
	return newDiffFile(ctx, parent, commit, header, name)
}
