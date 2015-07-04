package main

import (
	"time"

	"bazil.org/fuse"
	"github.com/keybase/kbfs/libkbfs"
)

var ctxAppIDKey = "kbfsfuse-app-id"

// fillAttr sets attributes based on the dir entry. It only handles fields
// common to all direntry types.
func fillAttr(de *libkbfs.DirEntry, a *fuse.Attr) {
	a.Size = de.Size
	a.Mtime = time.Unix(0, de.Mtime)
	a.Ctime = time.Unix(0, de.Ctime)
}
