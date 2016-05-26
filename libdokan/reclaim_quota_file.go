// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libkbfs"
)

// ReclaimQuotaFile represents a write-only file when any write of at
// least one byte triggers a quota reclamation of the folder.
type ReclaimQuotaFile struct {
	folder *Folder
	specialWriteFile
}

// WriteFile implements writes for dokan. Note a write triggers quota
// reclamation, but does not wait for it to finish. If you want to
// wait, write to SyncFromServerFileName.
func (f *ReclaimQuotaFile) WriteFile(fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	ctx, cancel := NewContextWithOpID(f.folder.fs, "ReclaimQuotaFile Write")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err, cancel) }()
	if len(bs) == 0 {
		return 0, nil
	}
	err = libkbfs.ForceQuotaReclamationForTesting(
		f.folder.fs.config, f.folder.getFolderBranch())
	return len(bs), err
}
