package main

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// Symlink represents KBFS symlinks.
type Symlink struct {
	fs.NodeRef

	parent   *Dir
	de       libkbfs.DirEntry
	pathNode libkbfs.PathNode
}

var _ fs.Node = (*Symlink)(nil)

// Attr implements the fs.Node interface for Symlink
func (*Symlink) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeSymlink | 0777
	return nil
}

var _ fs.NodeReadlinker = (*Symlink)(nil)

// Readlink implements the fs.NodeReadlinker interface for Symlink
func (s *Symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	return s.de.SymPath, nil
}
