// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"os"
	"syscall"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

// Symlink represents KBFS symlinks.
type Symlink struct {
	// The directory this symlink is in. This should be safe to store
	// here, without fear of Renames etc making it stale, because we
	// never persist a Symlink into Folder.nodes; it has no
	// libkbfs.Node, so that's impossible. This should make FUSE
	// Lookup etc always get new nodes, limiting the lifetime of a
	// single Symlink value.
	parent *Dir
	name   string
	inode  uint64
}

var _ fs.Node = (*Symlink)(nil)

// Attr implements the fs.Node interface for Symlink
func (s *Symlink) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	s.parent.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "Symlink Attr")
	defer func() { err = s.parent.folder.processError(ctx, libkbfs.ReadMode, err) }()

	_, de, err := s.parent.folder.fs.config.KBFSOps().Lookup(
		ctx, s.parent.node, s.parent.node.ChildName(s.name))
	if err != nil {
		if _, ok := err.(idutil.NoSuchNameError); ok {
			return fuse.ESTALE
		}
		return err
	}

	err = s.parent.folder.fillAttrWithUIDAndWritePerm(
		ctx, s.parent.node, &de, a)
	if err != nil {
		return err
	}
	a.Mode = os.ModeSymlink | a.Mode | 0500
	a.Inode = s.inode
	return nil
}

var _ fs.NodeReadlinker = (*Symlink)(nil)

// Readlink implements the fs.NodeReadlinker interface for Symlink
func (s *Symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (link string, err error) {
	s.parent.folder.fs.vlog.CLogf(ctx, libkb.VLog1, "Symlink Readlink")
	defer func() { err = s.parent.folder.processError(ctx, libkbfs.ReadMode, err) }()

	_, de, err := s.parent.folder.fs.config.KBFSOps().Lookup(
		ctx, s.parent.node, s.parent.node.ChildName(s.name))
	if err != nil {
		return "", err
	}

	if de.Type != data.Sym {
		return "", fuse.Errno(syscall.EINVAL)
	}
	return de.SymPath, nil
}
