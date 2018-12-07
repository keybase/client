// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// RekeyFile represents a write-only file when any write of at least
// one byte triggers a rekey of the folder.
type RekeyFile struct {
	folder *Folder
	specialWriteFile
}

// WriteFile implements writes for dokan.
func (f *RekeyFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.folder.fs.logEnter(ctx, "RekeyFile Write")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(bs) == 0 {
		return 0, nil
	}
	_, err = libkbfs.RequestRekeyAndWaitForOneFinishEvent(ctx,
		f.folder.fs.config.KBFSOps(), f.folder.getFolderBranch().Tlf)
	if err != nil {
		return 0, err
	}
	f.folder.fs.NotificationGroupWait()
	return len(bs), nil
}
