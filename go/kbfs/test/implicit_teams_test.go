// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"testing"
)

func TestImplicitTeamsTwoWritersPrivate(t *testing.T) {
	test(t,
		users("alice", "bob"),
		implicitTeam("alice,bob", ""),
		inPrivateTlf("alice,bob"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(bob,
			read("a", "hello"),
			mkfile("b", "world"),
		),
		as(alice,
			read("b", "world"),
		),
	)
}

func TestImplicitTeamsTwoWritersPublic(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		implicitTeam("alice,bob", "public"),
		inPublicTlf("alice,bob"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(bob,
			read("a", "hello"),
			mkfile("b", "world"),
		),
		as(alice,
			read("b", "world"),
		),
		as(charlie,
			read("b", "world"),
			expectError(mkfile("foo.txt", "hello world"),
				"charlie does not have write access to directory /keybase/public/alice,bob"),
		),
	)
}

func TestImplicitTeamsTwoWritersPrivateNonCanonical(t *testing.T) {
	test(t,
		users("alice", "bob"),
		implicitTeam("alice,bob", ""),
		inPrivateTlfNonCanonical("bob,alice", "alice,bob"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(bob,
			read("a", "hello"),
			mkfile("b", "world"),
		),
		as(alice,
			read("b", "world"),
		),
	)
}

func TestImplicitTeamsTwoWritersOneReaderPrivate(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		implicitTeam("alice,bob", "charlie"),
		inPrivateTlf("alice,bob#charlie"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(bob,
			read("a", "hello"),
			mkfile("b", "world"),
		),
		as(alice,
			read("b", "world"),
		),
		as(charlie,
			read("b", "world"),
			expectError(mkfile("foo.txt", "hello world"),
				"charlie does not have write access to directory /keybase/private/alice,bob#charlie"),
		),
	)
}

func TestImplicitTeamsTwoWritersJournal(t *testing.T) {
	test(t, journal(),
		users("alice", "bob"),
		implicitTeam("alice,bob", ""),
		inPrivateTlf("alice,bob"),
		as(alice,
			// The tests don't support enabling journaling on a
			// non-existent TLF, so force the TLF creation first.
			mkfile("foo", "bar"),
			rm("foo"),
		),
		as(alice,
			enableJournal(),
			mkfile("a", "hello"),
		),
		as(alice,
			// Wait for the flush, after doing a SyncAll().
			flushJournal(),
		),
		as(bob,
			enableJournal(),
			read("a", "hello"),
			mkfile("b", "world"),
		),
		as(bob,
			// Wait for the flush, after doing a SyncAll().
			flushJournal(),
		),
		as(alice,
			read("b", "world"),
		),
	)
}
