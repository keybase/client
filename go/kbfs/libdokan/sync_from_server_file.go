// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// SyncFromServerFile represents a write-only file when any write of
// at least one byte triggers a sync of the folder from the server.
// A sync:
//
// - Waits for any outstanding conflict resolution tasks to finish
//   (and it fails if the TLF is still in staged mode after waiting for
//   CR).
// - Checks with the server for what the latest revision is for the folder.
// - Fetches and applies any missing revisions.
// - Waits for all outstanding block archive tasks to complete.
// - Waits for all outstanding quota reclamation tasks to complete.
type SyncFromServerFile struct {
	folder *Folder
	specialWriteFile
}

// WriteFile implements writes for dokan.
func (f *SyncFromServerFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.folder.fs.logEnter(ctx, "SyncFromServerFile Write")
	defer func() { f.folder.reportErr(ctx, libkbfs.WriteMode, err) }()
	if len(bs) == 0 {
		return 0, nil
	}
	folderBranch := f.folder.getFolderBranch()
	if folderBranch == (data.FolderBranch{}) {
		// Nothing to do.
		return len(bs), nil
	}
	err = f.folder.fs.config.KBFSOps().SyncFromServer(
		ctx, folderBranch, nil)
	if err != nil {
		return 0, err
	}
	f.folder.fs.NotificationGroupWait()
	return len(bs), nil
}
