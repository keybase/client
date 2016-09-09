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
			mkfile("a/b", "hello"),
			// Check the data -- this should read from the journal if
			// it hasn't flushed yet.
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
			flushJournal(),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
	)
}

// bob exclusively creates a file while running the journal.
func TestJournalExclWrite(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			mkfile("a/c", "hello"),
			mkfileexcl("a/b"),
			lsdir("a/", m{"b$": "FILE", "c$": "FILE"}),
		),
		as(alice,
			// Alice should be able to read this right away, without
			// waiting for bob's journal to sync, since excl writes
			// aren't journaled.
			lsdir("a/", m{"b$": "FILE", "c$": "FILE"}),
		),
	)
}

// bob exclusively creates a file while running the journal, which
// conflicts with one of alice's files.
func TestJournalExclWriteConflict(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			disableUpdates(),
		),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob, noSync(),
			expectError(mkfileexcl("a/b"), "b already exists"),
			reenableUpdates(),
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
	)
}

// bob creates a conflicting file while running the journal.
func TestJournalCRSimple(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			enableJournal(),
			pauseJournal(),
			mkfile("a/b", "uh oh"),
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
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), "uh oh"),
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
			resumeJournal(),
		),
	)
}
