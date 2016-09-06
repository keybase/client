// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"testing"
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
