// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"golang.org/x/net/context"
)

type journalDirtyBlockCache struct {
	jServer      *JournalServer
	syncCache    DirtyBlockCache
	journalCache DirtyBlockCache
}

var _ DirtyBlockCache = journalDirtyBlockCache{}

func (j journalDirtyBlockCache) Get(tlfID TlfID, ptr BlockPointer,
	branch BranchName) (Block, error) {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		return j.journalCache.Get(tlfID, ptr, branch)
	}

	return j.syncCache.Get(tlfID, ptr, branch)
}

func (j journalDirtyBlockCache) Put(tlfID TlfID, ptr BlockPointer,
	branch BranchName, block Block) error {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		return j.journalCache.Put(tlfID, ptr, branch, block)
	}

	return j.syncCache.Put(tlfID, ptr, branch, block)
}

func (j journalDirtyBlockCache) Delete(tlfID TlfID, ptr BlockPointer,
	branch BranchName) error {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		return j.journalCache.Delete(tlfID, ptr, branch)
	}

	return j.syncCache.Delete(tlfID, ptr, branch)
}

func (j journalDirtyBlockCache) IsDirty(tlfID TlfID, ptr BlockPointer,
	branch BranchName) bool {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		return j.journalCache.IsDirty(tlfID, ptr, branch)
	}

	return j.syncCache.IsDirty(tlfID, ptr, branch)
}

func (j journalDirtyBlockCache) IsAnyDirty(tlfID TlfID) bool {
	return j.journalCache.IsAnyDirty(tlfID) || j.syncCache.IsAnyDirty(tlfID)
}

func (j journalDirtyBlockCache) RequestPermissionToDirty(ctx context.Context,
	tlfID TlfID, estimatedDirtyBytes int64) (DirtyPermChan, error) {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		return j.journalCache.RequestPermissionToDirty(ctx, tlfID,
			estimatedDirtyBytes)
	}

	return j.syncCache.RequestPermissionToDirty(ctx, tlfID, estimatedDirtyBytes)
}

func (j journalDirtyBlockCache) UpdateUnsyncedBytes(tlfID TlfID,
	newUnsyncedBytes int64, wasSyncing bool) {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		j.journalCache.UpdateUnsyncedBytes(tlfID, newUnsyncedBytes, wasSyncing)
	} else {
		j.syncCache.UpdateUnsyncedBytes(tlfID, newUnsyncedBytes, wasSyncing)
	}
}

func (j journalDirtyBlockCache) UpdateSyncingBytes(tlfID TlfID, size int64) {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		j.journalCache.UpdateSyncingBytes(tlfID, size)
	} else {
		j.syncCache.UpdateSyncingBytes(tlfID, size)
	}
}

func (j journalDirtyBlockCache) BlockSyncFinished(tlfID TlfID, size int64) {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		j.journalCache.BlockSyncFinished(tlfID, size)
	} else {
		j.syncCache.BlockSyncFinished(tlfID, size)
	}
}

func (j journalDirtyBlockCache) SyncFinished(tlfID TlfID, size int64) {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
		j.journalCache.SyncFinished(tlfID, size)
	} else {
		j.syncCache.SyncFinished(tlfID, size)
	}
}

func (j journalDirtyBlockCache) ShouldForceSync(tlfID TlfID) bool {
	if _, ok := j.jServer.getTLFJournal(tlfID); ok {
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
