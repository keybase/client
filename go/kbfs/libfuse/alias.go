// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// Alias represents an alias. A use case for it is a top-level folder accessed
// through its non-canonical name.
type Alias struct {
	// The real path this alias points to. In case of TLF alias, this is the
	// canonical name for the folder.
	realPath string
	inode    uint64
}

var _ fs.Node = (*Alias)(nil)

// Attr implements the fs.Node interface for Alias.
func (*Alias) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeSymlink | 0777
	// Aliases can't be moved, so let bazil generate an inode.
	return nil
}

var _ fs.NodeReadlinker = (*Alias)(nil)

// Readlink implements the fs.NodeReadlinker interface for Alias.
func (a *Alias) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	return a.realPath, nil
}
