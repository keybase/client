package main

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type Symlink struct {
	fs.NodeRef

	parent   *Dir
	de       libkbfs.DirEntry
	pathNode libkbfs.PathNode
}

var _ fs.Node = (*Symlink)(nil)

func (*Symlink) Attr(a *fuse.Attr) {
	a.Mode = os.ModeSymlink | 0777
}

var _ fs.NodeReadlinker = (*Symlink)(nil)

func (a *Symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	return a.de.SymPath, nil
}
