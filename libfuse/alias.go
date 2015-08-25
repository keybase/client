package libfuse

import (
	"os"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"golang.org/x/net/context"
)

// Alias is a top-level folder accessed through its non-canonical name.
type Alias struct {
	// canonical name for this folder
	canon string
}

var _ fs.Node = (*Alias)(nil)

// Attr implements the fs.Node interface for Alias.
func (*Alias) Attr(ctx context.Context, a *fuse.Attr) error {
	a.Mode = os.ModeSymlink | 0777
	return nil
}

var _ fs.NodeReadlinker = (*Alias)(nil)

// Readlink implements the fs.NodeReadlinker interface for Alias.
func (a *Alias) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	return a.canon, nil
}
