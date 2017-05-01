// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import "testing"

// TestTlfNameChangePrivate tests that a file written to a private TLF
// with an unresolved writer becomes readable to the resolved writer
// after resolution.
//
// This is the equivalent to the TestSBSSimple docker test.
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
			noSync(),
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
			noSync(),
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
			noSync(),
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
//
// This is the equivalent to the TestSBSSimplePublic docker test.
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
			noSync(),
		),
		as(charlie,
			read("alice.txt", "hello charlie"),
			expectError(mkfile("charlie.txt", "hello alice"),
				"charlie does not have write access to directory /keybase/public/alice,charlie@twitter"),
			noSync(),
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
		as(charlie, noSync()), // no-op to initialize the SBS folder
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
			noSync(),
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

// TODO: Write an equivalent to TestSBSFavorites from the docker
// tests.

// TestSBSExistingWriter tests that a TLF with an unresolved writer
// that resolves to an existing writer resolves to the TLF without the
// unresolved writer.
func TestSBSExistingWriter(t *testing.T) {
	test(t,
		users("alice", "bob"),
		inPrivateTlf("alice,bob,bob@twitter"),
		as(alice,
			mkfile("alice.txt", "hello bob"),
		),
		as(bob,
			mkfile("bob.txt", "hello alice"),
			read("alice.txt", "hello bob"),
		),
		as(alice,
			read("bob.txt", "hello alice"),
		),

		addNewAssertion("bob", "bob@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPrivateTlf("alice,bob"),
		as(alice,
			read("alice.txt", "hello bob"),
			read("bob.txt", "hello alice"),
		),
		as(bob,
			read("alice.txt", "hello bob"),
			read("bob.txt", "hello alice"),
		),

		inPrivateTlfNonCanonical("alice,bob,bob@twitter", "alice,bob"),
		as(alice,
			read("alice.txt", "hello bob"),
			read("bob.txt", "hello alice"),
		),
		as(bob,
			read("alice.txt", "hello bob"),
			read("bob.txt", "hello alice"),
		),
	)
}

// TestSBSPromoteReaderToWriter tests that a TLF with an unresolved
// writer that resolves to an existing reader resolves to the TLF with
// the reader promoted to a writer.
func TestSBSPromoteReaderToWriter(t *testing.T) {
	test(t,
		users("alice", "bob"),
		inPrivateTlf("alice,bob@twitter#bob"),
		as(alice,
			mkfile("alice.txt", "hello bob"),
		),
		as(bob,
			read("alice.txt", "hello bob"),
			expectError(mkfile("bob.txt", "hello alice"),
				"bob does not have write access to directory /keybase/private/alice,bob@twitter#bob"),
			noSync(),
		),

		addNewAssertion("bob", "bob@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPrivateTlf("alice,bob"),
		as(alice,
			read("alice.txt", "hello bob"),
		),
		as(bob,
			read("alice.txt", "hello bob"),
			mkfile("bob.txt", "hello alice"),
		),
		as(alice,
			read("bob.txt", "hello alice"),
		),

		inPrivateTlfNonCanonical("alice,bob@twitter#bob", "alice,bob"),
		as(alice,
			read("alice.txt", "hello bob"),
			read("bob.txt", "hello alice"),
		),
		as(bob,
			read("alice.txt", "hello bob"),
			read("bob.txt", "hello alice"),
		),
	)
}

// TestSBSOnlyUnresolvedWriter tests that a TLF with a single
// unresolved writer is only usable once that writer becomes resolved.
func TestSBSOnlyUnresolvedWriter(t *testing.T) {
	test(t,
		users("alice"),
		inPrivateTlf("alice@twitter"),
		as(alice,
			expectError(mkfile("foo.txt", "hello world"),
				"alice does not have read access to directory /keybase/private/alice@twitter"),
			noSync(),
		),

		addNewAssertion("alice", "alice@twitter"),

		inPrivateTlf("alice"),
		as(alice,
			mkfile("foo.txt", "hello world"),
		),

		inPrivateTlfNonCanonical("alice@twitter", "alice"),
		as(alice,
			read("foo.txt", "hello world"),
		),
	)
}

// TestSBSMultipleResolutions tests that a folder with multiple
// unresolved writers behaves as expected when each unresolved writer
// is resolved one at a time.
func TestSBSMultipleResolutions(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		inPrivateTlf("alice,bob@twitter,charlie@twitter"),
		as(alice,
			mkfile("alice.txt", "hello bob & charlie"),
		),
		as(bob,
			expectError(initRoot(), "bob does not have read access to directory /keybase/private/alice,bob@twitter,charlie@twitter"),
			noSync(),
		),
		as(charlie,
			expectError(initRoot(), "charlie does not have read access to directory /keybase/private/alice,bob@twitter,charlie@twitter"),
			noSync(),
		),

		addNewAssertion("bob", "bob@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPrivateTlfNonCanonical("alice,bob@twitter,charlie@twitter", "alice,bob,charlie@twitter"),
		as(bob,
			read("alice.txt", "hello bob & charlie"),
			mkfile("bob1.txt", "hello alice & charlie"),
		),
		as(alice,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
		),
		as(charlie,
			expectError(initRoot(), "charlie does not have read access to directory /keybase/private/alice,bob,charlie@twitter"),
			noSync(),
		),

		inPrivateTlf("alice,bob,charlie@twitter"),
		as(bob,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			mkfile("bob2.txt", "hello alice & charlie"),
		),
		as(alice,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
		),
		as(charlie,
			expectError(initRoot(), "charlie does not have read access to directory /keybase/private/alice,bob,charlie@twitter"),
			noSync(),
		),

		addNewAssertion("charlie", "charlie@twitter"),
		as(bob,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPrivateTlfNonCanonical("alice,bob@twitter,charlie@twitter", "alice,bob,charlie"),
		as(charlie,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
			mkfile("charlie1.txt", "hello alice & bob"),
		),
		as(alice,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
			read("charlie1.txt", "hello alice & bob"),
		),
		as(bob,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
			read("charlie1.txt", "hello alice & bob"),
		),

		inPrivateTlf("alice,bob,charlie"),
		as(charlie,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
			read("charlie1.txt", "hello alice & bob"),
			mkfile("charlie2.txt", "hello alice & bob"),
		),
		as(alice,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
			read("charlie1.txt", "hello alice & bob"),
			read("charlie2.txt", "hello alice & bob"),
		),
		as(bob,
			read("alice.txt", "hello bob & charlie"),
			read("bob1.txt", "hello alice & charlie"),
			read("bob2.txt", "hello alice & charlie"),
			read("charlie1.txt", "hello alice & bob"),
			read("charlie2.txt", "hello alice & bob"),
		),
	)
}

// TestSBSConflicts tests that different folders with unresolved users
// that get resolved to the same one don't get merged, but that one is
// chosen and the others pick up a conflict marker.
func TestSBSConflicts(t *testing.T) {
	test(t,
		users("alice", "bob", "charlie"),
		inPrivateTlf("alice,bob,charlie@twitter"),
		as(alice,
			mkfile("alice1.txt", "hello bob & charlie"),
		),
		as(bob,
			read("alice1.txt", "hello bob & charlie"),
		),
		as(charlie,
			expectError(initRoot(), "charlie does not have read access to directory /keybase/private/alice,bob,charlie@twitter"),
			noSync(),
		),

		inPrivateTlf("alice,bob@twitter,charlie@twitter"),
		as(alice,
			mkfile("alice2.txt", "hello bob & charlie"),
		),
		as(bob,
			expectError(initRoot(), "bob does not have read access to directory /keybase/private/alice,bob@twitter,charlie@twitter"),
			noSync(),
		),
		as(charlie,
			expectError(initRoot(), "charlie does not have read access to directory /keybase/private/alice,bob@twitter,charlie@twitter"),
			noSync(),
		),

		inPrivateTlf("alice,bob,charlie"),
		as(alice,
			mkfile("alice3.txt", "hello bob & charlie"),
		),
		as(bob,
			read("alice3.txt", "hello bob & charlie"),
		),
		as(charlie,
			read("alice3.txt", "hello bob & charlie"),
		),

		addNewAssertion("bob", "bob@twitter"),
		addNewAssertion("charlie", "charlie@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		// TODO: Test that alice's favorites are updated.

		// TODO: Test that the three folders are resolved with
		// conflict markers. This will require changes to
		// MDServerLocal.
	)
}

// TODO: When we implement automatic rekey for DSL tests, write
// equivalents of TestSBSOfflineDeviceComesOnline{Private,Public} from
// the docker tests.
