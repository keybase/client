// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"fmt"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// JournalControlFile is a special file used to control journal
// settings.
type JournalControlFile struct {
	specialWriteFile
	folder *Folder
	action libfs.JournalAction
}

// WriteFile implements writes for dokan.
func (f *JournalControlFile) WriteFile(ctx context.Context,
	fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.folder.fs.logEnter(ctx,
		fmt.Sprintf("JournalQuotaFile (f.action=%s) Write", f.action))
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(bs) == 0 {
		return 0, nil
	}

	jServer, err := libkbfs.GetJournalServer(f.folder.fs.config)
	if err != nil {
		return 0, err
	}

	err = f.action.Execute(
		ctx, jServer, f.folder.getFolderBranch().Tlf, f.folder.h)
	if err != nil {
		return 0, err
	}

	return len(bs), nil
}
