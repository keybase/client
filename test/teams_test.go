// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"testing"
)

func TestTeamsTwoWriters(t *testing.T) {
	test(t,
		users("alice", "bob"),
		team("ab", "alice,bob", ""),
		inSingleTeamTlf("ab"),
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

func TestTeamsTwoWritersNonCanonical(t *testing.T) {
	test(t,
		users("alice", "bob"),
		team("ab", "alice,bob", ""),
		inSingleTeamNonCanonical("AB", "ab"),
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

func TestTeamsWriterReader(t *testing.T) {
	test(t,
		users("alice", "bob"),
		team("a_b", "alice", "bob"),
		inSingleTeamTlf("a_b"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(bob,
			read("a", "hello"),
			expectError(mkfile("b", "world"),
				"bob does not have write access to directory /keybase/team/a_b"),
		),
	)
}
