package test

import "testing"

func TestTlfNameChange(t *testing.T) {
	test(t,
		users("alice", "bob"),
		inPrivateTlf("alice,bob@twitter"),
		as(alice,
			enableSharingBeforeSignup(),
			mkfile("foo.txt", "hello world"),
		),
		as(bob,
			enableSharingBeforeSignup(),
			expectError(initRoot(), "bob does not have read access to directory /keybase/private/alice,bob@twitter"),
		),

		addNewAssertion("bob", "bob@twitter"),
		as(alice,
			// TODO: Ideally, we wouldn't have to do this,
			// and we'd just wait for a rekey.
			rekey(),
		),

		inPrivateTlfNonCanonical("alice,bob@twitter", "alice,bob"),
		as(alice,
			read("foo.txt", "hello world"),
		),
		as(bob,
			read("foo.txt", "hello world"),
		),
	)
}

func TestTlfNameChangeWithoutObservation(t *testing.T) {
	test(t,
		users("alice", "bob"),
		inPrivateTlf("alice,bob@twitter"),
		as(alice,
			enableSharingBeforeSignup(),
		),
		as(bob,
			enableSharingBeforeSignup(),
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
