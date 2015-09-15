package libfuse

import (
	"os"
	"syscall"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"github.com/keybase/kbfs/libkbfs"
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
}

var _ fs.Node = (*Symlink)(nil)

// Attr implements the fs.Node interface for Symlink
func (s *Symlink) Attr(ctx context.Context, a *fuse.Attr) (err error) {
	ctx = NewContextWithOpID(ctx, s.parent.folder.fs.log)
	s.parent.folder.fs.log.CDebugf(ctx, "Symlink Attr")
	defer func() { s.parent.folder.fs.reportErr(ctx, err) }()

	_, de, err := s.parent.folder.fs.config.KBFSOps().Lookup(ctx, s.parent.node, s.name)
	if err != nil {
		if _, ok := err.(libkbfs.NoSuchNameError); ok {
			return fuse.ESTALE
		}
		return err
	}

	fillAttr(&de, a)
	a.Mode = os.ModeSymlink | 0777
	return nil
}

var _ fs.NodeReadlinker = (*Symlink)(nil)

// Readlink implements the fs.NodeReadlinker interface for Symlink
func (s *Symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (link string, err error) {
	ctx = NewContextWithOpID(ctx, s.parent.folder.fs.log)
	s.parent.folder.fs.log.CDebugf(ctx, "Symlink Readlink")
	defer func() { s.parent.folder.fs.reportErr(ctx, err) }()

	_, de, err := s.parent.folder.fs.config.KBFSOps().Lookup(ctx, s.parent.node, s.name)
	if err != nil {
		return "", err
	}

	if de.Type != libkbfs.Sym {
		return "", fuse.Errno(syscall.EINVAL)
	}
	return de.SymPath, nil
}
