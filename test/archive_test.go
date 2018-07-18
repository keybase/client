// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"testing"
)

func TestArchiveByRevision(t *testing.T) {
	test(t,
		users("alice", "bob"),

		inPrivateTlf("alice,bob"),
		as(alice,
			mkdir("a"),
		),
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),

		inPrivateTlfAtRevision("alice,bob", 1),
		as(alice,
			lsdir("", m{}),
		),
		as(bob,
			lsdir("", m{}),
		),
	)
}
