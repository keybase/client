package main

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
	fs.NodeRef

	parent *Dir
	name   string
}

var _ fs.Node = (*Symlink)(nil)

// Attr implements the fs.Node interface for Symlink
func (s *Symlink) Attr(ctx context.Context, a *fuse.Attr) error {
	s.parent.folder.mu.RLock()
	defer s.parent.folder.mu.RUnlock()

	node, de, err := s.parent.folder.fs.config.KBFSOps().Lookup(ctx, s.parent.node, s.name)
	if err != nil {
		return err
	}

	// TODO: There shouldn't be any node for a Symlink, so maybe return
	// an error here?
	if node != nil {
		defer node.Forget()
	}

	fillAttr(&de, a)
	a.Mode = os.ModeSymlink | 0777
	return nil
}

var _ fs.NodeReadlinker = (*Symlink)(nil)

// Readlink implements the fs.NodeReadlinker interface for Symlink
func (s *Symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	s.parent.folder.mu.RLock()
	defer s.parent.folder.mu.RUnlock()

	node, de, err := s.parent.folder.fs.config.KBFSOps().Lookup(ctx, s.parent.node, s.name)
	if err != nil {
		return "", err
	}

	// TODO: There shouldn't be any node for a Symlink, so maybe return
	// an error here?
	if node != nil {
		defer node.Forget()
	}

	if de.Type != libkbfs.Sym {
		return "", fuse.Errno(syscall.EINVAL)
	}
	return de.SymPath, nil
}
