// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

// MetricsFileName is the name of the KBFS metrics file -- it can be
// reached from any KBFS directory.
const MetricsFileName = ".kbfs_metrics"

// ReclaimQuotaFileName is the name of the KBFS quota-reclaiming file
// -- it can be reached anywhere within a top-level folder.
const ReclaimQuotaFileName = ".kbfs_reclaim_quota"

// RekeyFileName is the name of the KBFS rekeying file -- it can be
// reached anywhere within a top-level folder.
const RekeyFileName = ".kbfs_rekey"

// StatusFileName is the name of the KBFS status file -- it can be reached
// anywhere within a top-level folder or inside the Keybase root
const StatusFileName = ".kbfs_status"

// SyncFromServerFileName is the name of the KBFS sync-from-server
// file -- it can be reached anywhere within a top-level folder.
const SyncFromServerFileName = ".kbfs_sync_from_server"

// UnstageFileName is the name of the KBFS unstaging file -- it can be
// reached anywhere within a top-level folder.
const UnstageFileName = ".kbfs_unstage"

// DisableUpdatesFileName is the name of the KBFS update-disabling
// file -- it can be reached anywhere within a top-level folder.
const DisableUpdatesFileName = ".kbfs_disable_updates"

// EnableUpdatesFileName is the name of the KBFS update-enabling
// file -- it can be reached anywhere within a top-level folder.
const EnableUpdatesFileName = ".kbfs_enable_updates"

// ResetCachesFileName is the name of the KBFS unstaging file.
const ResetCachesFileName = ".kbfs_reset_caches"

// EnableJournalFileName is the name of the journal-enabling file. It
// can be reached anywhere within a top-level folder.
const EnableJournalFileName = ".kbfs_enable_journal"

// FlushJournalFileName is the name of the journal-flushing file. It
// can be reached anywhere within a top-level folder.
const FlushJournalFileName = ".kbfs_flush_journal"

// PauseJournalBackgroundWorkFileName is the name of the file that
// pauses the background work of a journal. It can be reached anywhere
// within a top-level folder.
const PauseJournalBackgroundWorkFileName = ".kbfs_pause_journal_background_work"

// ResumeJournalBackgroundWorkFileName is the name of the file that
// resumes the background work of a journal. It can be reached
// anywhere within a top-level folder.
const ResumeJournalBackgroundWorkFileName = ".kbfs_resume_journal_background_work"

// DisableJournalFileName is the name of the journal-disabling
// file. It can be reached anywhere within a top-level folder.
const DisableJournalFileName = ".kbfs_disable_journal"

// EnableAutoJournalsFileName is the name of the KBFS-wide
// auto-journal-enabling file.  It's accessible anywhere outside a TLF.
const EnableAutoJournalsFileName = ".kbfs_enable_auto_journals"

// DisableAutoJournalsFileName is the name of the KBFS-wide
// auto-journal-disabling file.  It's accessible anywhere outside a
// TLF.
const DisableAutoJournalsFileName = ".kbfs_disable_auto_journals"

// EnableBlockPrefetchingFileName is the name of the KBFS-wide
// prefetching-enabling file.  It's accessible anywhere outside a TLF.
const EnableBlockPrefetchingFileName = ".kbfs_enable_block_prefetching"

// DisableBlockPrefetchingFileName is the name of the KBFS-wide
// prefetching-disabling file.  It's accessible anywhere outside a TLF.
const DisableBlockPrefetchingFileName = ".kbfs_disable_block_prefetching"

// EnableDebugServerFileName is the name of the file to turn on the
// debug HTTP server. It's accessible anywhere outside a TLF.
const EnableDebugServerFileName = ".kbfs_enable_debug_server"

// DisableDebugServerFileName is the name of the file to turn on the
// debug HTTP server. It's accessible anywhere outside a TLF.
const DisableDebugServerFileName = ".kbfs_disable_debug_server"

// EditHistoryName is the name of the KBFS TLF edit history file --
// it can be reached anywhere within a top-level folder.
const EditHistoryName = ".kbfs_edit_history"

// UpdateHistoryFileName is the name of the KBFS update history -- it
// can be reached anywhere within a top-level folder.
const UpdateHistoryFileName = ".kbfs_update_history"

// FileInfoPrefix is the prefix of the per-file metadata files.
const FileInfoPrefix = ".kbfs_fileinfo_"

// EnableSyncFileName is the name of the file to enable the sync cache for a
// TLF. It can be reached anywhere within a TLF.
const EnableSyncFileName = ".kbfs_enable_sync"

// DisableSyncFileName is the name of the file to disable the sync cache for a
// TLF. It can be reached anywhere within a TLF.
const DisableSyncFileName = ".kbfs_disable_sync"

// ArchivedRevDirPrefix is the prefix to the directory at the root of a
// TLF that exposes a version of that TLF at the specified revision.
const ArchivedRevDirPrefix = ".kbfs_archived_rev="

// ArchivedTimeLinkPrefix is the prefix to the symlink at the root of a
// TLF that links to a version of that TLF at the specified time.
const ArchivedTimeLinkPrefix = ".kbfs_archived_time="

// ArchivedRelTimeFilePrefix is the prefix to the file at the root of
// a TLF that contains the directory name of an archived revision
// described by the given relative time.
const ArchivedRelTimeFilePrefix = ".kbfs_archived_reltime="
