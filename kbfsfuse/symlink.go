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

	parent   *Dir
	pathNode libkbfs.PathNode
}

var _ fs.Node = (*Symlink)(nil)

// Attr implements the fs.Node interface for Symlink
func (s *Symlink) Attr(ctx context.Context, a *fuse.Attr) error {
	s.parent.folder.mu.RLock()
	defer s.parent.folder.mu.RUnlock()

	p := s.getPathLocked()
	de, err := statPath(s.parent.folder.fs.config.KBFSOps(), p)
	if err != nil {
		return err
	}

	fillAttr(de, a)
	a.Mode = os.ModeSymlink | 0777
	return nil
}

func (s *Symlink) getPathLocked() libkbfs.Path {
	p := s.parent.getPathLocked()
	p.Path = append(p.Path, s.pathNode)
	return p
}

var _ fs.NodeReadlinker = (*Symlink)(nil)

// Readlink implements the fs.NodeReadlinker interface for Symlink
func (s *Symlink) Readlink(ctx context.Context, req *fuse.ReadlinkRequest) (string, error) {
	s.parent.folder.mu.RLock()
	defer s.parent.folder.mu.RUnlock()

	p := s.getPathLocked()
	de, err := statPath(s.parent.folder.fs.config.KBFSOps(), p)
	if err != nil {
		return "", err
	}
	if de.Type != libkbfs.Sym {
		return "", fuse.Errno(syscall.EINVAL)
	}
	return de.SymPath, nil
}
