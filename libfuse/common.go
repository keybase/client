package libfuse

import (
	"time"

	"bazil.org/fuse"
	"github.com/keybase/kbfs/libkbfs"
)

const (
	// PublicName is the name of the parent of all public top-level folders.
	PublicName = "public"

	// PrivateName is the name of the parent of all private top-level folders.
	PrivateName = "private"

	// CtxAppIDKey is the context app id
	CtxAppIDKey = "kbfsfuse-app-id"

	// CtxOpID is a unique operation ID
	CtxOpID = "ID"
)

// fillAttr sets attributes based on the dir entry. It only handles fields
// common to all direntry types.
func fillAttr(de *libkbfs.DirEntry, a *fuse.Attr) {
	a.Valid = 1 * time.Minute

	a.Size = de.Size
	a.Mtime = time.Unix(0, de.Mtime)
	a.Ctime = time.Unix(0, de.Ctime)
}
