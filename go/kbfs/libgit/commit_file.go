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
	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

const (
	commitFileDefaultMaxBufSize = 4 * 1024 * 1024 // 4 MB
)

type commitFile struct {
	hash       plumbing.Hash
	r          *strings.Reader
	maxBufSize int64
	mtime      time.Time
}

var _ billy.File = (*commitFile)(nil)

func newCommitFile(
	ctx context.Context, commit *object.Commit) (*commitFile, error) {
	s := commit.String()
	// We can't get the patch for the initial commit, go-git doesn't
	// seem to support it yet.
	if commit.NumParents() > 0 {
		parent, err := commit.Parent(0)
		if err != nil {
			return nil, err
		}
		patch, err := parent.PatchContext(ctx, commit)
		if err != nil {
			return nil, err
		}
		s += patch.String()
	}

	r := strings.NewReader(s)
	return &commitFile{
		hash:       commit.Hash,
		r:          r,
		maxBufSize: commitFileDefaultMaxBufSize,
		mtime:      commit.Author.When,
	}, nil
}

func (cf *commitFile) Len() int {
	return cf.r.Len()
}

func (cf *commitFile) Name() string {
	return AutogitCommitPrefix + cf.hash.String()
}

func (cf *commitFile) Write(_ []byte) (n int, err error) {
	return 0, errors.New("commit files can't be written")
}

func (cf *commitFile) Read(p []byte) (n int, err error) {
	return cf.r.Read(p)
}

func (cf *commitFile) ReadAt(p []byte, off int64) (n int, err error) {
	n, err = cf.r.ReadAt(p, off)
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

func (cf *commitFile) Seek(offset int64, whence int) (int64, error) {
	return cf.r.Seek(offset, whence)
}

func (cf *commitFile) Close() error {
	return nil
}

func (cf *commitFile) Lock() error {
	return errors.New("commit files can't be locked")
}

func (cf *commitFile) Unlock() error {
	return errors.New("commit files can't be unlocked")
}

func (cf *commitFile) Truncate(size int64) error {
	return errors.New("commit files can't be truncated")
}

func (cf *commitFile) GetInfo() *commitFileInfo {
	return &commitFileInfo{
		name:  cf.Name(),
		size:  int64(cf.Len()),
		mtime: cf.mtime,
	}
}
