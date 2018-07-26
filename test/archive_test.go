// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"testing"
	"time"
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

func TestArchiveByTime(t *testing.T) {
	// The start time of the test is 1970-01-01 00:00:01 +0000 UTC.
	rev1checks := []optionOp{
		as(alice,
			lsdir("", m{}),
		),
		as(bob,
			lsdir("", m{}),
		),
	}

	rev2checks := []optionOp{
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
	}

	test(t,
		users("alice", "bob"),

		inPrivateTlf("alice,bob"),
		rev1checks[0], rev1checks[1],
		as(alice,
			addTime(365*24*time.Hour),
			mkdir("a"),
		),
		rev2checks[0], rev2checks[1],

		// Try various formats for the first revision.
		inPrivateTlfAtTime("alice,bob", "02 Jan 1970"),
		rev1checks[0], rev1checks[1],

		inPrivateTlfAtTime("alice,bob", "April 4, 1970"),
		rev1checks[0], rev1checks[1],

		inPrivateTlfAtTime("alice,bob", "1970.09"),
		rev1checks[0], rev1checks[1],

		// Now the second revision.
		inPrivateTlfAtTime("alice,bob", "02 Jan 1971"),
		rev2checks[0], rev2checks[1],

		inPrivateTlfAtTime("alice,bob", "April 4, 1980"),
		rev2checks[0], rev2checks[1],

		inPrivateTlfAtTime("alice,bob", "2018.09"),
		rev2checks[0], rev2checks[1],
	)
}

func TestArchiveByTimeWithColons(t *testing.T) {
	// The start time of the test is 1970-01-01 00:00:01 +0000 UTC.
	rev1checks := []optionOp{
		as(alice,
			lsdir("", m{}),
		),
		as(bob,
			lsdir("", m{}),
		),
	}

	rev2checks := []optionOp{
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
	}

	test(t,
		skip("dokan", "windows doesn't support colons in filenames"),
		users("alice", "bob"),

		inPrivateTlf("alice,bob"),
		rev1checks[0], rev1checks[1],
		as(alice,
			addTime(365*24*time.Hour),
			mkdir("a"),
		),
		rev2checks[0], rev2checks[1],

		// Try various formats for the first revision.
		inPrivateTlfAtTime("alice,bob", "1970-08-12T22:15:09Z"),
		rev1checks[0], rev1checks[1],

		inPrivateTlfAtTime("alice,bob", "Fri Jan  2 15:04:05 1970"),
		rev1checks[0], rev1checks[1],

		// Now the second revision.
		inPrivateTlfAtTime("alice,bob", "2001-08-12T22:15:09Z"),
		rev2checks[0], rev2checks[1],

		inPrivateTlfAtTime("alice,bob", "Tue Jan  2 15:04:05 2018"),
		rev2checks[0], rev2checks[1],
	)
}

func TestArchiveByRelativeTime(t *testing.T) {
	// The start time of the test is 1970-01-01 00:00:01 +0000 UTC.
	rev1checks := []optionOp{
		as(alice,
			lsdir("", m{}),
		),
		as(bob,
			lsdir("", m{}),
		),
	}

	rev2checks := []optionOp{
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
	}

	test(t,
		users("alice", "bob"),

		inPrivateTlf("alice,bob"),
		rev1checks[0], rev1checks[1],
		as(alice,
			addTime(365*24*time.Hour),
			mkdir("a"),
		),
		rev2checks[0], rev2checks[1],

		as(alice,
			addTime(30*time.Second),
		),

		// Try various formats for the first revision.
		inPrivateTlfAtRelativeTime("alice,bob", "1h"),
		rev1checks[0], rev1checks[1],

		inPrivateTlfAtRelativeTime("alice,bob", "3600s"),
		rev1checks[0], rev1checks[1],

		inPrivateTlfAtRelativeTime("alice,bob", "5h55m"),
		rev1checks[0], rev1checks[1],

		// Now the second revision.
		inPrivateTlfAtRelativeTime("alice,bob", "1s"),
		rev2checks[0], rev2checks[1],

		inPrivateTlfAtRelativeTime("alice,bob", "15s"),
		rev2checks[0], rev2checks[1],

		// Make sure the relative time adjusts with the clock.
		as(alice,
			addTime(1*time.Hour),
		),
		inPrivateTlfAtRelativeTime("alice,bob", "1h"),
		rev2checks[0], rev2checks[1],
	)
}
