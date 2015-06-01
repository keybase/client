package main

import (
	"time"

	"bazil.org/fuse"
	"github.com/keybase/kbfs/libkbfs"
)

// statPath gets the path from KBFSOps. The path must not refer to a
// top-level folder.
//
// This function assumes that the path referred to was once an
// existing path. Thus, it returns ESTALE if the path cannot be found
// anymore.
func statPath(ops libkbfs.KBFSOps, p libkbfs.Path) (*libkbfs.DirEntry, error) {
	pp := *p.ParentPath()
	dir, err := ops.GetDir(pp)
	if err != nil {
		return nil, err
	}
	de, ok := dir.Children[p.TailName()]
	if !ok {
		return nil, fuse.ESTALE
	}
	return &de, nil
}

// fillAttr sets attributes based on the dir entry. It only handles fields
// common to all direntry types.
func fillAttr(de *libkbfs.DirEntry, a *fuse.Attr) {
	a.Size = de.Size
	a.Mtime = time.Unix(0, de.Mtime)
	a.Ctime = time.Unix(0, de.Ctime)
}
