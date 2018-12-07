// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// ResetCachesFile represents a write-only file where any write of at
// least one byte triggers the resetting of all data caches.  It can
// only be reached from the top-level FS mount.  Note that it does not
// clear the *node* cache, which means that the BlockPointers for
// existing nodes are still cached, such that directory listings can
// still be implicitly cached for nodes still being held by callers.
type ResetCachesFile struct {
	fs *FS
	specialWriteFile
}

// WriteFile implements writes for dokan.
func (f *ResetCachesFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.fs.logEnter(ctx, "ResetCachesFile Write")
	defer func() { f.fs.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(bs) == 0 {
		return 0, nil
	}
	f.fs.config.ResetCaches()
	return len(bs), nil
}
