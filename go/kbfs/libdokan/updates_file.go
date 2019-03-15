// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"errors"

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// UpdatesFile represents a write-only file where any write of at
// least one byte triggers either disabling remote folder updates and
// conflict resolution, or re-enabling both.  It is mainly useful for
// testing.
type UpdatesFile struct {
	folder *Folder
	enable bool
	specialWriteFile
}

// WriteFile performs writes for dokan.
func (f *UpdatesFile) WriteFile(ctx context.Context, fi *dokan.FileInfo, bs []byte, offset int64) (n int, err error) {
	f.folder.fs.logEnter(ctx, "UpdatesFile WriteFile")
	defer func() { f.folder.fs.reportErr(ctx, libkbfs.WriteMode, err) }()
	f.folder.fs.log.CDebugf(ctx, "UpdatesFile (enable: %t) Write", f.enable)
	if len(bs) == 0 {
		return 0, nil
	}

	f.folder.updateMu.Lock()
	defer f.folder.updateMu.Unlock()
	if f.enable {
		if f.folder.updateChan == nil {
			return 0, errors.New("Updates are already enabled")
		}
		err = libkbfs.RestartCRForTesting(
			libcontext.BackgroundContextWithCancellationDelayer(),
			f.folder.fs.config, f.folder.getFolderBranch())
		if err != nil {
			return 0, err
		}
		f.folder.updateChan <- struct{}{}
		close(f.folder.updateChan)
		f.folder.updateChan = nil
	} else {
		if f.folder.updateChan != nil {
			return 0, errors.New("Updates are already disabled")
		}
		f.folder.updateChan, err =
			libkbfs.DisableUpdatesForTesting(f.folder.fs.config,
				f.folder.getFolderBranch())
		if err != nil {
			return 0, err
		}
		err = libkbfs.DisableCRForTesting(f.folder.fs.config,
			f.folder.getFolderBranch())
		if err != nil {
			return 0, err
		}
	}
	// Because we store state in the folder it must not be forgotten
	// even if it appears empty and unused.
	f.folder.noForget = true

	return len(bs), err
}
