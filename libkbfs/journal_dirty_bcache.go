// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

type journalDirtyBlockCache struct {
	jServer      *JournalServer
	syncCache    DirtyBlockCache
	journalCache DirtyBlockCache
}

var _ DirtyBlockCache = journalDirtyBlockCache{}

func (j journalDirtyBlockCache) Get(
	ctx context.Context, tlfID tlf.ID, ptr BlockPointer,
	branch BranchName) (Block, error) {
	if j.jServer.hasTLFJournal(tlfID) {
		return j.journalCache.Get(ctx, tlfID, ptr, branch)
	}

	return j.syncCache.Get(ctx, tlfID, ptr, branch)
}

func (j journalDirtyBlockCache) Put(
	ctx context.Context, tlfID tlf.ID, ptr BlockPointer,
	branch BranchName, block Block) error {
	if j.jServer.hasTLFJournal(tlfID) {
		return j.journalCache.Put(ctx, tlfID, ptr, branch, block)
	}

	return j.syncCache.Put(ctx, tlfID, ptr, branch, block)
}

func (j journalDirtyBlockCache) Delete(tlfID tlf.ID, ptr BlockPointer,
	branch BranchName) error {
	if j.jServer.hasTLFJournal(tlfID) {
		return j.journalCache.Delete(tlfID, ptr, branch)
	}

	return j.syncCache.Delete(tlfID, ptr, branch)
}

func (j journalDirtyBlockCache) IsDirty(tlfID tlf.ID, ptr BlockPointer,
	branch BranchName) bool {
	if j.jServer.hasTLFJournal(tlfID) {
		return j.journalCache.IsDirty(tlfID, ptr, branch)
	}

	return j.syncCache.IsDirty(tlfID, ptr, branch)
}

func (j journalDirtyBlockCache) IsAnyDirty(tlfID tlf.ID) bool {
	return j.journalCache.IsAnyDirty(tlfID) || j.syncCache.IsAnyDirty(tlfID)
}

func (j journalDirtyBlockCache) RequestPermissionToDirty(ctx context.Context,
	tlfID tlf.ID, estimatedDirtyBytes int64) (DirtyPermChan, error) {
	if j.jServer.hasTLFJournal(tlfID) {
		return j.journalCache.RequestPermissionToDirty(ctx, tlfID,
			estimatedDirtyBytes)
	}

	return j.syncCache.RequestPermissionToDirty(ctx, tlfID, estimatedDirtyBytes)
}

func (j journalDirtyBlockCache) UpdateUnsyncedBytes(tlfID tlf.ID,
	newUnsyncedBytes int64, wasSyncing bool) {
	if j.jServer.hasTLFJournal(tlfID) {
		j.journalCache.UpdateUnsyncedBytes(tlfID, newUnsyncedBytes, wasSyncing)
	} else {
		j.syncCache.UpdateUnsyncedBytes(tlfID, newUnsyncedBytes, wasSyncing)
	}
}

func (j journalDirtyBlockCache) UpdateSyncingBytes(tlfID tlf.ID, size int64) {
	if j.jServer.hasTLFJournal(tlfID) {
		j.journalCache.UpdateSyncingBytes(tlfID, size)
	} else {
		j.syncCache.UpdateSyncingBytes(tlfID, size)
	}
}

func (j journalDirtyBlockCache) BlockSyncFinished(tlfID tlf.ID, size int64) {
	if j.jServer.hasTLFJournal(tlfID) {
		j.journalCache.BlockSyncFinished(tlfID, size)
	} else {
		j.syncCache.BlockSyncFinished(tlfID, size)
	}
}

func (j journalDirtyBlockCache) SyncFinished(tlfID tlf.ID, size int64) {
	if j.jServer.hasTLFJournal(tlfID) {
		j.journalCache.SyncFinished(tlfID, size)
	} else {
		j.syncCache.SyncFinished(tlfID, size)
	}
}

func (j journalDirtyBlockCache) ShouldForceSync(tlfID tlf.ID) bool {
	if j.jServer.hasTLFJournal(tlfID) {
		return j.journalCache.ShouldForceSync(tlfID)
	}

	return j.syncCache.ShouldForceSync(tlfID)
}

func (j journalDirtyBlockCache) Shutdown() error {
	journalErr := j.journalCache.Shutdown()
	syncErr := j.syncCache.Shutdown()
	if journalErr == nil {
		return syncErr
	} else if syncErr == nil {
		return journalErr
	}
	return fmt.Errorf("Multiple errors on dirty bcache shutdown: %v",
		[]error{journalErr, syncErr})
}
