// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
)

// RekeyFile represents a write-only file when any write of at least
// one byte triggers a rekey of the folder.
type RekeyFile struct {
	folder *Folder
	specialWriteFile
}

// WriteFile implements writes for dokan.
func (f *RekeyFile) WriteFile(fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	ctx, cancel := NewContextWithOpID(f.folder.fs, "RekeyFile Write")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err, cancel) }()
	if len(bs) == 0 {
		return 0, nil
	}
	err = f.folder.fs.config.KBFSOps().Rekey(ctx, f.folder.getFolderBranch().Tlf)
	if err != nil {
		return 0, err
	}
	f.folder.fs.NotificationGroupWait()
	return len(bs), nil
}
