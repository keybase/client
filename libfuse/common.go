// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

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

	// CtxOpID is the display name for the unique operation FUSE ID tag.
	CtxOpID = "FID"
)

// CtxTagKey is the type used for unique context tags
type CtxTagKey int

const (
	// CtxIDKey is the type of the tag for unique operation IDs.
	CtxIDKey CtxTagKey = iota
)

// fillAttr sets attributes based on the entry info. It only handles fields
// common to all entryinfo types.
func fillAttr(ei *libkbfs.EntryInfo, a *fuse.Attr) {
	a.Valid = 1 * time.Minute

	a.Size = ei.Size
	a.Mtime = time.Unix(0, ei.Mtime)
	a.Ctime = time.Unix(0, ei.Ctime)
}
