package main

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// Alias is a folder accessed through its non-canonical name.
type Alias struct {
	// canonical name for this folder
	canon string
}

var _ fs.Node = (*Alias)(nil)

func (*Alias) Attr(a *fuse.Attr) {
	a.Mode = os.ModeSymlink | 0777
}

var _ fs.NodeReadlinker = (*Alias)(nil)

func (a *Alias) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	return a.canon, nil
}
