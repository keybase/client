// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"golang.org/x/net/context"

	"github.com/keybase/kbfs/dokan"
)

// RekeyFileName is the name of the KBFS unstaging file -- it can be
// reached anywhere within a top-level folder.
const RekeyFileName = ".kbfs_rekey"

// RekeyFile represents a write-only file when any write of at least
// one byte triggers a rekey of the folder.
type RekeyFile struct {
	folder *Folder
	specialWriteFile
}

// WriteFile implements writes for dokan.
func (f *RekeyFile) WriteFile(fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	ctx := context.TODO()
	ctx = NewContextWithOpID(ctx, f.folder.fs.log)
	f.folder.fs.log.CDebugf(ctx, "RekeyFile Write")
	defer func() { f.folder.fs.reportErr(ctx, err) }()
	if len(bs) == 0 {
		return 0, nil
	}
	err = f.folder.fs.config.KBFSOps().
		RekeyForTesting(ctx, f.folder.folderBranch)
	return len(bs), err
}
