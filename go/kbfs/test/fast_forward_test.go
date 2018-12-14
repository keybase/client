// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"fmt"
	"testing"
	"time"
)

// bob goes offline for a while, and alice makes a bunch of changes.
func TestFastForwardBasic(t *testing.T) {
	var busyWork []fileOp
	iters := 100
	for i := 0; i < iters; i++ {
		name := fmt.Sprintf("a%d", i)
		busyWork = append(busyWork, mkfile(name, "hello"), rm(name))
	}

	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob,
			read("a/b", "hello"),
			disableUpdates(),
			stallOnMDGetForTLF(),
		),
		as(alice, busyWork...),
		as(alice,
			write("a/b", "hello world"),
		),
		parallel(
			as(bob, noSync(),
				addTime(1*time.Hour),
				reenableUpdatesNoSync(),
			),
			as(bob, noSync(),
				// Wait for the background update to fetch the head.
				waitForStalledMDGetForTLF(),
				unstallOneMDGetForTLF(),
			),
		),
		as(bob, noSync(),
			// Disable updates as a hack to make sure we wait for
			// the fast forward to complete (the unpause channel
			// isn't buffered).
			disableUpdates(),
			undoStallOnMDGetForTLF(),
			reenableUpdatesNoSync(),
			// Make sure the next sync only calls GetRange once.
			stallOnMDGetRange(),
		),
		parallel(
			as(bob, noSync(),
				waitForStalledMDGetRange(),
				unstallOneMDGetRange(),
			),
			as(bob,
				read("a/b", "hello world"),
				// The sync in complete, so we know GetRange was only
				// called once.
				undoStallOnMDGetRange(),
			),
		),
	)
}
