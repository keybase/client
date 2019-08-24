// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import (
	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/libfs"
)

// handleTLFSpecialFile handles special files that are within a TLF.
func handleTLFSpecialFile(name string, folder *Folder) dokan.File {
	// Common files (the equivalent of handleCommonSpecialFile
	// from libfuse) are handled in fs.go.
	switch name {
	case libfs.UpdateHistoryFileName:
		return NewUpdateHistoryFile(folder)

	case libfs.EditHistoryName:
		return NewTlfEditHistoryFile(folder)

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
