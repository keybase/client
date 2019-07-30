// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/libkbfs"
)

// bob creates a file while running the journal.
func TestJournalSimple(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/b", "hello"),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
			}),
			// Check the data -- this should read from the journal if
			// it hasn't flushed yet.
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
		// Force a SyncAll to the journal.
		as(bob,
			resumeJournal(),
			flushJournal(),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
	)
}

// bob exclusively creates a file while running the journal.  For now
// this is treated like a normal file create.
func TestJournalExclWrite(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/c", "hello"),
			mkfileexcl("a/b"),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/c",
			}),
			lsdir("a/", m{"b$": "FILE", "c$": "FILE"}),
		),
		// Force a SyncAll to the journal.
		as(bob,
			resumeJournal(),
			flushJournal(),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", "c$": "FILE"}),
		),
	)
}

// bob creates a conflicting file while running the journal.
func TestJournalCrSimple(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/b", "uh oh"),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
			}),
			// Don't flush yet.
		),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob, noSync(),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
		),
	)
}

func makeBusyWork(filename string, iters int) (busyWork []fileOp) {
	busyWork = append(busyWork, mkfile(filename, "hello"))
	for i := 0; i < iters; i++ {
		content := fmt.Sprintf("a%d", i)
		busyWork = append(busyWork, write(filename, content))
	}
	busyWork = append(busyWork, rm(filename))
	return busyWork
}

// bob creates many conflicting files while running the journal.
func TestJournalCrManyFiles(t *testing.T) {
	busyWork := makeBusyWork("hi", 20)

	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			checkUnflushedPaths(nil),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob,
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob",
				"/keybase/private/alice,bob/hi",
			}),
			// Don't flush yet.
		),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob, noSync(),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
	)
}

// bob creates a conflicting file while running the journal.
func TestJournalDoubleCrSimple(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/b", "uh oh"),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
			}),
			// Don't flush yet.
		),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob, noSync(),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
		),
		as(bob,
			pauseJournal(),
			mkfile("a/c", "uh oh"),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/c",
			}),
			// Don't flush yet.
		),
		as(alice,
			mkfile("a/c", "hello"),
		),
		as(bob, noSync(),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE", "c$": "FILE", crnameEsc("c", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
			read("a/c", "hello"),
			read(crname("a/c", bob), "uh oh"),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE", "c$": "FILE", crnameEsc("c", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
			read("a/c", "hello"),
			read(crname("a/c", bob), "uh oh"),
		),
	)
}

// bob writes a multi-block file that conflicts with a file created by
// alice when journaling is on.
func TestJournalCrConflictUnmergedWriteMultiblockFile(t *testing.T) {
	test(t, journal(), blockSize(100), blockChangeSize(5),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			disableUpdates(),
			checkUnflushedPaths(nil),
		),
		as(alice,
			write("a/b", "hello"),
		),
		as(bob, noSync(),
			pauseJournal(),
			write("a/b", ntimesString(15, "0123456789")),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
			}),
			resumeJournal(),
			flushJournal(),
			reenableUpdates(),
		),
		as(bob,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), ntimesString(15, "0123456789")),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), ntimesString(15, "0123456789")),
		),
	)
}

// bob creates a conflicting file while running the journal, but then
// its resolution also conflicts.
func testJournalCrResolutionHitsConflict(t *testing.T, options []optionOp) {
	test(t, append(options,
		journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/b", "uh oh"),
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
			}),
			// Don't flush yet.
		),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob, noSync(),
			stallOnMDResolveBranch(),
			resumeJournal(),
			// Wait for CR to finish before introducing new commit
			// from alice.
			waitForStalledMDResolveBranch(),
		),
		as(alice,
			mkfile("a/c", "new file"),
		),
		as(bob, noSync(),
			// Wait for one more, and cause another conflict, just to
			// be sadistic.
			unstallOneMDResolveBranch(),
			waitForStalledMDResolveBranch(),
		),
		as(alice,
			mkfile("a/d", "new file2"),
		),
		as(bob, noSync(),
			// Let bob's CR proceed, which should trigger CR again on
			// top of the resolution.
			unstallOneMDResolveBranch(),
			waitForStalledMDResolveBranch(),
			undoStallOnMDResolveBranch(),
			flushJournal(),
		),
		as(bob,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE", "c$": "FILE", "d$": "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
			read("a/c", "new file"),
			read("a/d", "new file2"),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE", "c$": "FILE", "d$": "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
			read("a/c", "new file"),
			read("a/d", "new file2"),
		),
	)...)
}

func TestJournalCrResolutionHitsConflict(t *testing.T) {
	testJournalCrResolutionHitsConflict(t, nil)
}

func TestJournalCrResolutionHitsConflictWithIndirectBlocks(t *testing.T) {
	testJournalCrResolutionHitsConflict(t,
		[]optionOp{blockChangeSize(100), blockChangeSize(5)})
}

// Check that simple quota reclamation works when journaling is enabled.
func TestJournalQRSimple(t *testing.T) {
	test(t, journal(),
		users("alice"),
		as(alice,
			mkfile("a", "hello"),
			addTime(1*time.Minute),
			enableJournal(),
			mkfile("b", "hello2"),
			rm("b"),
			addTime(2*time.Minute),
			flushJournal(),
			pauseJournal(),
			addTime(2*time.Minute),
			mkfile("c", "hello3"),
			mkfile("d", "hello4"),
			addTime(2*time.Minute),
			forceQuotaReclamation(),
			checkUnflushedPaths([]string{
				"/keybase/private/alice",
				"/keybase/private/alice/c",
				"/keybase/private/alice/d",
			}),
			resumeJournal(),
			flushJournal(),
			checkUnflushedPaths(nil),
		),
	)
}

// bob creates a bunch of files in a journal and the operations get
// coalesced together.
func TestJournalCoalescingBasicCreates(t *testing.T) {
	var busyWork []fileOp
	var reads []fileOp
	listing := m{"^a$": "DIR"}
	iters := libkbfs.ForcedBranchSquashRevThreshold + 1
	unflushedPaths := []string{"/keybase/private/alice,bob"}
	for i := 0; i < iters; i++ {
		name := fmt.Sprintf("a%d", i)
		contents := fmt.Sprintf("hello%d", i)
		busyWork = append(busyWork, mkfile(name, contents))
		reads = append(reads, read(name, contents))
		listing["^"+name+"$"] = "FILE"
		unflushedPaths = append(
			unflushedPaths, "/keybase/private/alice,bob/"+name)
	}

	test(t, journal(), batchSize(1),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			checkUnflushedPaths(nil),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob,
			checkUnflushedPaths(unflushedPaths),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("", listing),
			checkUnflushedPaths(nil),
		),
		as(bob, reads...),
		as(alice,
			lsdir("", listing),
		),
		as(alice, reads...),
	)
}

// bob creates a bunch of files in a journal and the operations get
// coalesced together, multiple times.  Then alice writes something
// non-conflicting, forcing CR to happen on top of the unmerged local
// squashes.  This is a regression for KBFS-1838.
func TestJournalCoalescingCreatesPlusCR(t *testing.T) {
	var busyWork []fileOp
	var reads []fileOp
	listing := m{"^a$": "DIR", "^b$": "DIR"}
	iters := libkbfs.ForcedBranchSquashRevThreshold + 1
	unflushedPaths := []string{"/keybase/private/alice,bob"}
	for i := 0; i < iters; i++ {
		name := fmt.Sprintf("a%d", i)
		contents := fmt.Sprintf("hello%d", i)
		busyWork = append(busyWork, mkfile(name, contents))
		listing["^"+name+"$"] = "FILE"
		unflushedPaths = append(
			unflushedPaths, "/keybase/private/alice,bob/"+name)
	}

	busyWork2 := []fileOp{}
	for i := 0; i < iters; i++ {
		name := fmt.Sprintf("a%d", i)
		contents := fmt.Sprintf("hello%d", i+iters)
		busyWork2 = append(busyWork2, write(name, contents))
		reads = append(reads, read(name, contents))
	}

	test(t, journal(), batchSize(1),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			checkUnflushedPaths(nil),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob,
			checkUnflushedPaths(unflushedPaths),
			// Coalescing, round 1.
			flushJournal(),
		),
		as(bob, busyWork2...),
		as(bob,
			checkUnflushedPaths(unflushedPaths),
			// Coalescing, round 2.
			flushJournal(),
		),
		as(alice,
			// Non-conflict write to force CR on top of the local
			// squashes.
			mkdir("b"),
		),
		as(bob,
			// This should try to flush the coalescing, but will hit a
			// conflict.  It will get resolved at the next sync.
			resumeJournal(),
		),
		as(bob,
			lsdir("", listing),
			checkUnflushedPaths(nil),
		),
		as(bob, reads...),
		as(alice,
			lsdir("", listing),
		),
		as(alice, reads...),
	)
}

// bob creates a bunch of files in a subdirectory and the operations
// get coalesced together.  Then alice writes something
// non-conflicting, forcing CR to happen on top of the unmerged local
// squashes -- this happens multiple times before bob's flush is able
// to succeed.  This is a regression for KBFS-1979.
func TestJournalCoalescingCreatesPlusMultiCR(t *testing.T) {
	busyWork := []fileOp{noSyncEnd()}
	busyWork2 := []fileOp{noSyncEnd()}
	listing := m{}
	iters := libkbfs.ForcedBranchSquashRevThreshold + 1
	targetMtime := time.Now().Add(1 * time.Minute)
	for i := 0; i < iters; i++ {
		name := fmt.Sprintf("%d", i)
		contents := fmt.Sprintf("hello%d", i)
		busyWork = append(busyWork, mkfile("a/"+name+".tmp", contents))
		busyWork = append(busyWork, setmtime("a/"+name+".tmp", targetMtime))
		busyWork2 = append(busyWork2, rename("a/"+name+".tmp", "a/"+name))

		listing["^"+name+"$"] = "FILE"
	}
	busyWork = append(busyWork, setmtime("a", targetMtime))

	test(t, journal(), batchSize(1),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob, noSyncEnd(),
			// Coalescing, round 1.
			flushJournal(),
		),
		// Second sync to wait for the CR caused by `flushJournal`.
		as(bob, noSyncEnd(),
			flushJournal(),
		),
		as(bob, busyWork2...),
		as(bob, noSyncEnd(),
			// Coalescing, round 2.
			flushJournal(),
		),
		// Second sync to wait for the CR caused by `flushJournal`.
		as(bob, noSyncEnd(),
			flushJournal(),
		),
		as(alice,
			// Non-conflict write to force CR on top of the local
			// squashes.
			mkdir("b"),
		),
		as(bob, noSyncEnd(),
			flushJournal(),
		),
		// Second sync to wait for the CR caused by `flushJournal`.
		as(bob, noSyncEnd(),
			flushJournal(),
			// Disable updates to make sure we don't get notified of
			// alice's next write until we attempt a journal flush, so
			// that we have two subsequent CRs that run to completion.
			disableUpdates(),
		),
		as(alice,
			// Non-conflict write to force CR on top of the local
			// squashes.
			mkdir("c"),
		),
		as(bob,
			reenableUpdates(),
			resumeJournal(),
			flushJournal(),
		),
		as(bob,
			// Force CR to finish before the flush call with another
			// disable/reenable.
			disableUpdates(),
			reenableUpdates(),
			flushJournal(),
		),
		as(bob,
			checkUnflushedPaths(nil),
			lsdir("", m{"^a$": "DIR", "^b$": "DIR", "^c$": "DIR"}),
			lsdir("a", listing),
		),
		as(alice,
			lsdir("", m{"^a$": "DIR", "^b$": "DIR", "^c$": "DIR"}),
			lsdir("a", listing),
		),
	)
}

// bob creates and appends to a file in a journal and the operations
// get coalesced together.
func TestJournalCoalescingWrites(t *testing.T) {
	var busyWork []fileOp
	iters := libkbfs.ForcedBranchSquashRevThreshold + 1
	var contents string
	for i := 0; i < iters; i++ {
		contents += fmt.Sprintf("hello%d", i)
		busyWork = append(busyWork, write("a/b", contents))
	}

	test(t, journal(), blockSize(100), blockChangeSize(5), batchSize(1),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			checkUnflushedPaths(nil),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob,
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
			}),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("", m{"a": "DIR"}),
			lsdir("a", m{"b": "FILE"}),
			read("a/b", contents),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("", m{"a": "DIR"}),
			lsdir("a", m{"b": "FILE"}),
			read("a/b", contents),
		),
	)
}

// bob does a bunch of operations in a journal and the operations get
// coalesced together.
func TestJournalCoalescingMixedOperations(t *testing.T) {
	busyWork := makeBusyWork("hi", libkbfs.ForcedBranchSquashRevThreshold+1)

	targetMtime := time.Now().Add(1 * time.Minute)
	test(t, journal(), blockSize(100), blockChangeSize(5), batchSize(1),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkfile("a/b", "hello"),
			mkfile("a/c", "hello2"),
			mkfile("a/d", "hello3"),
			mkfile("a/e", "hello4"),
		),
		as(bob,
			enableJournal(),
			checkUnflushedPaths(nil),
			pauseJournal(),
			// bob does a bunch of stuff:
			//  * writes to an existing file a/b
			//  * creates a new directory f
			//  * creates and writes to a new file f/g
			//  * creates and writes to a new file h
			//  * removes an existing file a/c
			//  * renames an existing file a/d -> a/i
			//  * sets the mtime on a/e
			//  * does a bunch of busy work to ensure we hit the squash limit
			write("a/b", "world"),
			mkdir("f"),
			mkfile("f/g", "hello5"),
			mkfile("h", "hello6"),
			rm("a/c"),
			rename("a/d", "a/i"),
			setmtime("a/e", targetMtime),
		),
		as(bob, busyWork...),
		as(bob,
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob",
				"/keybase/private/alice,bob/a",
				"/keybase/private/alice,bob/a/b",
				"/keybase/private/alice,bob/a/e",
				"/keybase/private/alice,bob/f",
				"/keybase/private/alice,bob/f/g",
				"/keybase/private/alice,bob/h",
				"/keybase/private/alice,bob/hi",
			}),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("", m{"a": "DIR", "f": "DIR", "h": "FILE"}),
			lsdir("a", m{"b": "FILE", "e": "FILE", "i": "FILE"}),
			read("a/b", "world"),
			read("a/e", "hello4"),
			mtime("a/e", targetMtime),
			read("a/i", "hello3"),
			lsdir("f", m{"g": "FILE"}),
			read("f/g", "hello5"),
			read("h", "hello6"),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("", m{"a": "DIR", "f": "DIR", "h": "FILE"}),
			lsdir("a", m{"b": "FILE", "e": "FILE", "i": "FILE"}),
			read("a/b", "world"),
			read("a/e", "hello4"),
			mtime("a/e", targetMtime),
			read("a/i", "hello3"),
			lsdir("f", m{"g": "FILE"}),
			read("f/g", "hello5"),
			read("h", "hello6"),
		),
	)
}

// bob makes a bunch of changes that cancel each other out, and get
// coalesced together.
func TestJournalCoalescingNoChanges(t *testing.T) {
	busyWork := makeBusyWork("hi", libkbfs.ForcedBranchSquashRevThreshold+1)

	test(t, journal(), batchSize(1),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			checkUnflushedPaths(nil),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob,
			checkUnflushedPaths([]string{
				"/keybase/private/alice,bob",
				"/keybase/private/alice,bob/hi",
			}),
			resumeJournal(),
			// This should kick off conflict resolution.
			flushJournal(),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
			checkUnflushedPaths(nil),
		),
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
	)
}

// bob creates a conflicting file while running the journal.
func TestJournalDoubleCrRemovalAfterQR(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkdir("b"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/c", "uh oh"),
			// Don't flush yet.
		),
		as(bob,
			rm("a/c"),
			rmdir("a"),
		),
		as(alice,
			mkfile("a/c", "hello"),
		),
		as(alice,
			rm("a/c"),
			rmdir("a"),
			rmdir("b"),
		),
		as(bob, noSync(),
			stallOnMDResolveBranch(),
			resumeJournal(),
			// Wait for CR to finish before alice does QR.
			waitForStalledMDResolveBranch(),
		),
		as(alice,
			// Quota reclamation.
			addTime(2*time.Minute),
			forceQuotaReclamation(),
		),
		as(bob, noSync(),
			// Now resolve that conflict over the QR.
			undoStallOnMDResolveBranch(),
			flushJournal(),
		),
		as(bob,
			lsdir("", m{}),
		),
		as(alice,
			lsdir("", m{}),
		),
	)
}

// Regression test for KBFS-2825.  alice and bob both make a bunch of
// identical creates, within an identical, deep directory structure.
// There's lots of squashing, CR, and journaling going on.  In the
// end, all of bob's files should be conflicted.
func testJournalCoalescingConflictingCreates(t *testing.T, bSize int64) {
	var busyWork []fileOp
	iters := libkbfs.ForcedBranchSquashRevThreshold + 1
	listing := m{}
	for i := 0; i < iters; i++ {
		filename := fmt.Sprintf("%d", i)
		fullname := fmt.Sprintf("a/b/c/d/%s", filename)
		contents := fmt.Sprintf("hello%d", i)
		busyWork = append(busyWork, mkfile(fullname, contents))
		listing["^"+filename+"$"] = "FILE"
		listing["^"+crnameEsc(filename, bob)+"$"] = "FILE"
	}

	test(t, journal(), batchSize(1), blockSize(bSize),
		users("alice", "bob"),
		as(alice,
			mkdir("a/b/c/d"),
			enableJournal(),
			flushJournal(),
		),
		as(bob,
			lsdir("a/b/c/d", m{}),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
		),
		as(bob, busyWork...),
		as(bob,
			flushJournal(),
		),
		as(alice, busyWork...),
		as(alice,
			flushJournal(),
		),
		as(bob,
			flushJournal(),
		),
		as(bob,
			flushJournal(),
			disableUpdates(),
		),
		as(alice,
			mkdir("g"),
			flushJournal(),
		),
		as(bob,
			reenableUpdates(),
			resumeJournal(),
			flushJournal(),
		),
		as(bob,
			disableUpdates(),
			reenableUpdates(),
			flushJournal(),
		),
		as(alice,
			lsdir("a/b/c/d", listing),
		),
		as(bob,
			lsdir("a/b/c/d", listing),
		),
	)
}

func TestJournalCoalescingConflictingCreates(t *testing.T) {
	testJournalCoalescingConflictingCreates(t, 0)
}

func TestJournalCoalescingConflictingCreatesMultiblock(t *testing.T) {
	testJournalCoalescingConflictingCreates(t, 1024)
}

func testJournalConflictClearing(
	t *testing.T, tlfBaseName string, switchTlf func(string) optionOp,
	lsfavs func([]string) fileOp, isBackedByTeam, expectSelfFav bool) {
	iteamSuffix := ""
	if isBackedByTeam {
		iteamSuffix = " #1"
	}
	conflict1 := fmt.Sprintf(
		"%s (local conflicted copy 2004-12-23%s)", tlfBaseName, iteamSuffix)
	conflict2 := fmt.Sprintf(
		"%s (local conflicted copy 2004-12-23 #2)", tlfBaseName)
	var expectedFavs []string
	if expectSelfFav {
		expectedFavs = []string{"bob"}
	}
	expectedFavs = append(expectedFavs, tlfBaseName, conflict1, conflict2)
	iteamOp := func(*opt) {}
	if isBackedByTeam {
		iteamOp = implicitTeam("alice,bob", "")
	}
	test(t, journal(),
		users("alice", "bob"),
		iteamOp,
		team("ab", "alice,bob", ""),
		switchTlf(tlfBaseName),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob,
			enableJournal(),
			addTime(35*365*24*time.Hour),
			lsdir("", m{"a$": "DIR"}),
			lsdir("a/", m{"b$": "FILE"}),
			forceConflict(),
			mkfile("a/c", "foo"),
			clearConflicts(),
			lsdir("", m{"a$": "DIR"}),
			lsdir("a/", m{"b$": "FILE"}),
		),
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a/", m{"b$": "FILE"}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a/", m{"b$": "FILE"}),
		),
		switchTlf(conflict1),
		as(bob, noSync(),
			lsdir("a/", m{"b$": "FILE", "c$": "FILE"}),
			read("a/c", "foo"),
		),
		// Add a second conflict for the same date.
		switchTlf(tlfBaseName),
		as(bob,
			addTime(1*time.Minute),
			lsdir("", m{"a$": "DIR"}),
			lsdir("a/", m{"b$": "FILE"}),
			forceConflict(),
			mkfile("a/d", "foo"),
			clearConflicts(),
		),
		switchTlf(conflict2),
		as(bob, noSync(),
			lsdir("a/", m{"b$": "FILE", "d$": "FILE"}),
			read("a/d", "foo"),
			lsfavs(expectedFavs),
		),
	)
}

func TestJournalConflictClearingPrivate(t *testing.T) {
	testJournalConflictClearing(
		t, "alice,bob", inPrivateTlf, lsprivatefavorites, false, true)
}

func TestJournalConflictClearingPrivateImplicit(t *testing.T) {
	testJournalConflictClearing(
		t, "alice,bob", inPrivateTlf, lsprivatefavorites, true, true)
}

func TestJournalConflictClearingPublic(t *testing.T) {
	testJournalConflictClearing(
		t, "alice,bob", inPublicTlf, lspublicfavorites, false, true)
}

func TestJournalConflictClearingPublicImplicit(t *testing.T) {
	testJournalConflictClearing(
		t, "alice,bob", inPublicTlf, lspublicfavorites, true, true)
}

func TestJournalConflictClearingTeam(t *testing.T) {
	testJournalConflictClearing(
		t, "ab", inSingleTeamTlf, lsteamfavorites, true, false)
}
