// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"fmt"

	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

// JournalControlFile is a special file used to control journal
// settings.
type JournalControlFile struct {
	specialWriteFile
	folder *Folder
	action libfs.JournalAction
}

// Write implements writes for dokan.
func (f *JournalControlFile) WriteFile(
	fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	ctx, cancel := NewContextWithOpID(
		f.folder.fs,
		fmt.Sprintf("JournalQuotaFile (f.action=%s) Write", f.action))
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err, cancel) }()
	if len(bs) == 0 {
		return 0, nil
	}

	jServer, err := libkbfs.GetJournalServer(f.folder.fs.config)
	if err != nil {
		return 0, err
	}

	err = f.action.Execute(jServer, f.folder.getFolderBranch().Tlf)
	if err != nil {
		return 0, err
	}

	return len(bs), nil
}
