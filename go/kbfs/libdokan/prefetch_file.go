// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// PrefetchFile represents a write-only file where any write of at least one
// byte triggers either disabling or enabling prefetching.  It is mainly useful
// for testing.
type PrefetchFile struct {
	fs     *FS
	enable bool
	specialWriteFile
}

// WriteFile performs writes for dokan.
func (f *PrefetchFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.fs.logEnter(ctx, "PrefetchFile WriteFile")
	defer func() { f.fs.reportErr(ctx, libkbfs.WriteMode, err) }()
	f.fs.log.CDebugf(ctx, "PrefetchFile (enable: %t) Write", f.enable)
	if len(bs) == 0 {
		return 0, nil
	}

	f.fs.config.BlockOps().TogglePrefetcher(f.enable)

	return len(bs), err
}
