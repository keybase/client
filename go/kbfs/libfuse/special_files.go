// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"time"

	"bazil.org/fuse/fs"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

// handleCommonSpecialFile handles special files that are present both
// within a TLF and outside a TLF.
func handleCommonSpecialFile(
	name string, fs *FS, entryValid *time.Duration) fs.Node {
	switch name {
	case libkbfs.ErrorFile:
		return NewErrorFile(fs, entryValid)
	case libfs.MetricsFileName:
		return NewMetricsFile(fs, entryValid)
	case libfs.ProfileListDirName:
		return ProfileList{}
	case libfs.ResetCachesFileName:
		return &ResetCachesFile{fs}
	}

	return nil
}

// handleNonTLFSpecialFile handles special files that are outside a TLF,
// i.e. /keybase, /keybase/private, and /keybase/public.
func handleNonTLFSpecialFile(
	name string, fs *FS, entryValid *time.Duration) fs.Node {
	specialNode := handleCommonSpecialFile(name, fs, entryValid)
	if specialNode != nil {
		return specialNode
	}

	switch name {
	case libfs.StatusFileName:
		return NewNonTLFStatusFile(fs, entryValid)
	case libfs.HumanErrorFileName, libfs.HumanNoLoginFileName:
		*entryValid = 0
		return &SpecialReadFile{fs.remoteStatus.NewSpecialReadFunc}
	case libfs.EnableAutoJournalsFileName:
		return &JournalControlFile{
			folder: &Folder{fs: fs}, // fake Folder for logging, etc.
			action: libfs.JournalEnableAuto,
		}
	case libfs.DisableAutoJournalsFileName:
		return &JournalControlFile{
			folder: &Folder{fs: fs}, // fake Folder for logging, etc.
			action: libfs.JournalDisableAuto,
		}
	case libfs.EnableBlockPrefetchingFileName:
		return &PrefetchFile{fs: fs, enable: true}
	case libfs.DisableBlockPrefetchingFileName:
		return &PrefetchFile{fs: fs, enable: false}

	case libfs.EnableDebugServerFileName:
		return &DebugServerFile{fs: fs, enable: true}
	case libfs.DisableDebugServerFileName:
		return &DebugServerFile{fs: fs, enable: false}

	case libfs.EditHistoryName:
		return NewUserEditHistoryFile(&Folder{fs: fs}, entryValid)
	}

	return nil
}

// handleTLFSpecialFile handles special files that are within a TLF.
func handleTLFSpecialFile(
	name string, folder *Folder, entryValid *time.Duration) fs.Node {
	specialNode := handleCommonSpecialFile(name, folder.fs, entryValid)
	if specialNode != nil {
		return specialNode
	}

	switch name {
	case libfs.UpdateHistoryFileName:
		return NewUpdateHistoryFile(folder, entryValid)

	case libfs.EditHistoryName:
		return NewTlfEditHistoryFile(folder, entryValid)

	case libfs.UnstageFileName:
		return &UnstageFile{
			folder: folder,
		}

	case libfs.DisableUpdatesFileName:
		return &UpdatesFile{
			folder: folder,
		}

	case libfs.EnableUpdatesFileName:
		return &UpdatesFile{
			folder: folder,
			enable: true,
		}

	case libfs.RekeyFileName:
		return &RekeyFile{
			folder: folder,
		}

	case libfs.ReclaimQuotaFileName:
		return &ReclaimQuotaFile{
			folder: folder,
		}

	case libfs.SyncFromServerFileName:
		// Don't cache the node so that the next lookup of
		// this file will force the dir to be re-checked
		// (i.e., loadDirHelper will be called again).
		*entryValid = 0
		return &SyncFromServerFile{
			folder: folder,
		}

	case libfs.EnableJournalFileName:
		return &JournalControlFile{
			folder: folder,
			action: libfs.JournalEnable,
		}

	case libfs.FlushJournalFileName:
		return &JournalControlFile{
			folder: folder,
			action: libfs.JournalFlush,
		}

	case libfs.PauseJournalBackgroundWorkFileName:
		return &JournalControlFile{
			folder: folder,
			action: libfs.JournalPauseBackgroundWork,
		}

	case libfs.ResumeJournalBackgroundWorkFileName:
		return &JournalControlFile{
			folder: folder,
			action: libfs.JournalResumeBackgroundWork,
		}

	case libfs.DisableJournalFileName:
		return &JournalControlFile{
			folder: folder,
			action: libfs.JournalDisable,
		}

	case libfs.EnableSyncFileName:
		return &SyncControlFile{
			folder: folder,
			action: libfs.SyncEnable,
		}

	case libfs.DisableSyncFileName:
		return &SyncControlFile{
			folder: folder,
			action: libfs.SyncDisable,
		}
	}

	return nil
}
