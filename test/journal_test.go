// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"testing"
	"time"
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
				"alice,bob/a",
				"alice,bob/a/b",
			}),
			// Check the data -- this should read from the journal if
			// it hasn't flushed yet.
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
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
				"alice,bob/a",
				"alice,bob/a/c",
			}),
			lsdir("a/", m{"b$": "FILE", "c$": "FILE"}),
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
				"alice,bob/a",
				"alice,bob/a/b",
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
				"alice,bob/a",
				"alice,bob/a/b",
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
				"alice,bob/a",
				"alice,bob/a/c",
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
	test(t, journal(), blockSize(20),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			disableUpdates(),
		),
		as(alice,
			write("a/b", "hello"),
		),
		as(bob, noSync(),
			pauseJournal(),
			write("a/b", ntimesString(15, "0123456789")),
			checkUnflushedPaths([]string{
				"alice,bob/a",
				"alice,bob/a/b",
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
				"alice",
				"alice/c",
				"alice/d",
			}),
			resumeJournal(),
			flushJournal(),
			checkUnflushedPaths(nil),
		),
	)
}
