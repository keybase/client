// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import "testing"

// TestTlfNameChangePrivate tests that a file written to a private TLF
// with an unresolved writer becomes readable to the resolved writer
// after resolution.
func TestTlfNameChangePrivate(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		inPrivateTlf("alice,bob,charlie@twitter"),
		as(alice,
			mkfile("foo.txt", "hello world"),
		),
		as(bob,
			read("foo.txt", "hello world"),
		),
		as(charlie,
			expectError(initRoot(), "charlie does not have read access to directory /keybase/private/alice,bob,charlie@twitter"),
		),

		addNewAssertion("charlie", "charlie@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPrivateTlfNonCanonical("alice,bob,charlie@twitter", "alice,bob,charlie"),
		as(alice,
			read("foo.txt", "hello world"),
		),
		as(bob,
			read("foo.txt", "hello world"),
		),
		as(charlie,
			read("foo.txt", "hello world"),
		),
	)
}

// TestTlfNameChangePrivateWithoutObservation tests that a file
// written to a private TLF with an unresolved writer after resolution
// is readable to the resolved writer.
func TestTlfNameChangePrivateWithoutObservation(t *testing.T) {
	test(t,
		users("alice", "bob"),
		inPrivateTlf("alice,bob@twitter"),
		as(bob,
			expectError(initRoot(), "bob does not have read access to directory /keybase/private/alice,bob@twitter"),
		),

		addNewAssertion("bob", "bob@twitter"),

		inPrivateTlfNonCanonical("alice,bob@twitter", "alice,bob"),
		as(alice,
			mkfile("foo.txt", "hello world"),
		),
		as(bob,
			read("foo.txt", "hello world"),
		),
	)
}

// TestSBSNewlyResolvedWritersPrivate tests that a resolved writer can
// be the first writer to a private TLF with an unresolved assertion.
func TestSBSNewlyResolvedWritersPrivate(t *testing.T) {
	test(t,
		users("alice", "bob"),
		inPrivateTlf("alice,bob@twitter"),
		as(bob,
			expectError(mkfile("foo.txt", "hello world"),
				"bob does not have read access to directory /keybase/private/alice,bob@twitter"),
		),

		addNewAssertion("bob", "bob@twitter"),

		inPrivateTlfNonCanonical("alice,bob@twitter", "alice,bob"),
		as(bob,
			mkfile("foo.txt", "hello world"),
		),
		as(alice,
			read("foo.txt", "hello world"),
		),
	)
}

// TestTlfNameChangePublic tests that a public TLF with an unresolved
// writer becomes writeable by the resolved writer after resolution.
func TestTlfNameChangePublic(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		inPublicTlf("alice,charlie@twitter"),
		as(alice,
			mkfile("alice.txt", "hello charlie"),
		),
		as(bob,
			read("alice.txt", "hello charlie"),
			expectError(mkfile("bob.txt", "hello alice & charlie"),
				"bob does not have write access to directory /keybase/public/alice,charlie@twitter"),
		),
		as(charlie,
			read("alice.txt", "hello charlie"),
			expectError(mkfile("charlie.txt", "hello alice"),
				"charlie does not have write access to directory /keybase/public/alice,charlie@twitter"),
			disableUpdates(),
		),

		addNewAssertion("charlie", "charlie@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPublicTlfNonCanonical(
			"alice,charlie@twitter", "alice,charlie"),
		as(charlie,
			mkfile("charlie1.txt", "hello alice1"),
		),

		inPublicTlf("alice,charlie"),
		as(charlie,
			mkfile("charlie2.txt", "hello alice2"),
		),

		inPublicTlfNonCanonical(
			"alice,charlie@twitter", "alice,charlie"),
		as(alice,
			read("charlie1.txt", "hello alice1"),
			read("charlie2.txt", "hello alice2"),
		),
		as(bob,
			read("charlie1.txt", "hello alice1"),
			read("charlie2.txt", "hello alice2"),
		),
		as(charlie,
			read("charlie1.txt", "hello alice1"),
			read("charlie2.txt", "hello alice2"),
		),

		inPublicTlf("alice,charlie"),
		as(alice,
			read("charlie1.txt", "hello alice1"),
			read("charlie2.txt", "hello alice2"),
		),
		as(bob,
			read("charlie1.txt", "hello alice1"),
			read("charlie2.txt", "hello alice2"),
		),
		as(charlie,
			read("charlie1.txt", "hello alice1"),
			read("charlie2.txt", "hello alice2"),
		),
	)
}

// TestTlfNameChangePublicWithoutObservation tests that a public TLF
// with an unresolved writer becomes writeable by the resolved writer
// after resolution.
func TestTlfNameChangePublicWithoutObservation(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		inPublicTlf("alice,charlie@twitter"),
		as(charlie), // no-op to initialize the SBS folder
		addNewAssertion("charlie", "charlie@twitter"),

		inPublicTlfNonCanonical(
			"alice,charlie@twitter", "alice,charlie"),
		as(alice,
			mkfile("alice.txt", "hello charlie"),
		),
		as(bob,
			read("alice.txt", "hello charlie"),
		),
		as(charlie,
			read("alice.txt", "hello charlie"),
		),
	)
}

// TestSBSNewlyResolvedWritersPublic tests that a resolved writer can
// be the first writer to a public TLF with an unresolved assertion.
func TestSBSNewlyResolvedWritersPublic(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		inPublicTlf("alice,charlie@twitter"),
		as(charlie,
			expectError(mkfile("foo.txt", "hello world"),
				"charlie does not have write access to directory /keybase/public/alice,charlie@twitter"),
		),

		addNewAssertion("charlie", "charlie@twitter"),

		inPublicTlfNonCanonical(
			"alice,charlie@twitter", "alice,charlie"),
		as(charlie,
			mkfile("charlie.txt", "hello alice"),
		),
		as(alice,
			read("charlie.txt", "hello alice"),
		),
		as(bob,
			read("charlie.txt", "hello alice"),
		),
	)
}
