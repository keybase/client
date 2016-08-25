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

// EditHistoryName is the name of the KBFS TLF edit history file --
// it can be reached anywhere within a top-level folder.
const EditHistoryName = ".kbfs_edit_history"
