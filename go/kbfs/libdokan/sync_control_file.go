// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// SyncControlFile is a special file used to control sync
// settings.
type SyncControlFile struct {
	specialWriteFile
	folder *Folder
	action libfs.SyncAction
}

// WriteFile implements writes for dokan.
func (f *SyncControlFile) WriteFile(ctx context.Context,
	fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.folder.fs.logEnter(ctx,
		fmt.Sprintf("SyncControlFile (f.action=%s) Write", f.action))
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(bs) == 0 {
		return 0, nil
	}

	err = f.action.Execute(
		ctx, f.folder.fs.config, f.folder.getFolderBranch(), f.folder.h)
	if err != nil {
		return 0, err
	}

	return len(bs), nil
}
