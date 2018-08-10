// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/client/go/logger"
	"golang.org/x/net/context"
)

// dirBlockGetter is a function that gets a block suitable for
// reading or writing, and also returns whether the block was already
// dirty.  It may be called from new goroutines, and must handle any
// required locks accordingly.
type dirBlockGetter func(context.Context, KeyMetadata, BlockPointer,
	path, blockReqType) (dblock *DirBlock, wasDirty bool, err error)

// dirData is a helper struct for accessing and manipulating data
// within a directory.  It's meant for use within a single scope, not
// for long-term storage.  The caller must ensure goroutine-safety.
type dirData struct {
	dir    path
	kmd    KeyMetadata
	getter dirBlockGetter
	cacher dirtyBlockCacher
	log    logger.Logger
	tree   *blockTree
}

func newDirData(dir path, kmd KeyMetadata, getter dirBlockGetter,
	cacher dirtyBlockCacher, log logger.Logger) *dirData {
	dd := &dirData{
		dir:    dir,
		kmd:    kmd,
		getter: getter,
		cacher: cacher,
		log:    log,
	}
	dd.tree = &blockTree{
		file:   dir,
		kmd:    kmd,
		getter: dd.blockGetter,
	}
	return dd
}

func (dd *dirData) rootBlockPointer() BlockPointer {
	return dd.dir.tailPointer()
}

func (dd *dirData) blockGetter(
	ctx context.Context, kmd KeyMetadata, ptr BlockPointer,
	dir path, rtype blockReqType) (block Block, wasDirty bool, err error) {
	return dd.getter(ctx, kmd, ptr, dir, rtype)
}
