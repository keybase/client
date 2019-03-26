// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests exercise quota reclamation.

package test

import (
	"fmt"
	"testing"
	"time"
)

// Check that simple quota reclamation works
func TestQRSimple(t *testing.T) {
	test(t,
		users("alice"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", "hello"),
			rm("a"),
			addTime(2*time.Minute),
			forceQuotaReclamation(),
		),
	)
}

// Check that quota reclamation works, eventually, after enough iterations.
func TestQRLargePointerSet(t *testing.T) {
	var busyWork []fileOp
	iters := 100
	for i := 0; i < iters; i++ {
		name := fmt.Sprintf("a%d", i)
		busyWork = append(busyWork, mkfile(name, "hello"), rm(name))
	}
	// 5 unreferenced pointers per iteration -- 3 updates to the root
	// block, one empty file written to, and one non-empty file
	// deleted.
	ptrsPerIter := 5
	var qrOps []optionOp
	// Each reclamation needs a sync after it (e.g., a new "as"
	// clause) to ensure it completes before the next force
	// reclamation.
	for i := 0; i < ptrsPerIter*iters/100; i++ {
		qrOps = append(qrOps, as(alice,
			addTime(2*time.Minute),
			forceQuotaReclamation(),
		))
	}
	totalOps := []optionOp{users("alice"), as(alice, busyWork...)}
	totalOps = append(totalOps, qrOps...)
	test(t, totalOps...)
}

// Test that quota reclamation handles conflict resolution correctly.
func TestQRAfterCR(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/c", "world"),
		),
		as(bob, noSync(),
			rm("a/b"),
			reenableUpdates(),
		),
		as(alice,
			addTime(2*time.Minute),
			forceQuotaReclamation(),
		),
	)
}

// Check that quota reclamation after two syncOps CR leaves the TLF in
// a readable state.  Regression test for KBFS-1562.
func TestQRAfterCRWithTwoSyncOps(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/c", "hello2"),
		),
		as(bob, noSync(),
			write("a/b", "hello world"),
			write("a/b", "hello world etc"),
			reenableUpdates(),
		),
		as(alice,
			addTime(2*time.Minute),
			forceQuotaReclamation(),
			read("a/b", "hello world etc"),
			read("a/c", "hello2"),
		),
	)
}

// Check that quota reclamation works on multi-block files
func TestQRWithMultiBlockFiles(t *testing.T) {
	test(t,
		blockSize(20), users("alice"),
		as(alice,
			addTime(1*time.Minute),
			mkfile("a", ntimesString(15, "0123456789")),
			rm("a"),
			addTime(2*time.Minute),
			forceQuotaReclamation(),
		),
	)
}

// Test that conflict resolution works gracefully after quota
// reclamation deletes a modified+deleted directory from the merged
// branch.  Regression for KBFS-1202.
func TestCRAfterRmdirAndQR(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a/b"),
			mkfile("a/b/c", "world"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			mkfile("a/b/d", "world2"),
			rm("a/b/c"),
			rm("a/b/d"),
			rmdir("a/b"),
		),
		as(bob, noSync(),
			setmtime("a/b/c", time.Now().Add(1*time.Minute)),
			rm("a/b/c"),
			rmdir("a/b"),
		),
		as(alice,
			addTime(2*time.Minute),
			// Force rmd.data.Dir.MTime to something recent. TODO: remove me.
			mkfile("c", "test"),
			forceQuotaReclamation(),
		),
		as(bob, noSync(),
			reenableUpdates(),
			lsdir("a/", m{}),
		),
		as(alice,
			lsdir("a/", m{}),
		),
	)
}
