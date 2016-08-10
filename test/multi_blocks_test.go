// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import "testing"

// alice writes a multi-block file, and bob reads it
func TestWriteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			read("a/b", ntimesString(15, "0123456789")),
		),
	)
}

func TestSwitchToMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			// Fill up the first block (a desired encrypted block size
			// of 20 ends up with a plaintext size of 12).
			write("a/b", ntimesString(3, "0123")),
			// Then append to the end of the file to force a split.
			pwriteBS("a/b", []byte(ntimesString(3, "0123")), 12),
		),
		as(bob,
			read("a/b", ntimesString(6, "0123")),
		),
	)
}

// alice writes a file, and bob overwrites it with a multi-block file
func TestOverwriteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b", "hello"),
		),
		as(bob,
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(alice,
			read("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			read("a/b", ntimesString(15, "0123456789")),
		),
	)
}

// bob removes a multiblock file written by alice (checks that state
// is cleaned up)
func TestRmMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			read("a/b", ntimesString(15, "0123456789")),
			rm("a/b"),
		),
		as(alice,
			lsdir("a/", m{}),
		),
	)
}

// bob renames something over a multiblock file written by alice
// (checks that state is cleaned up)
func TestRenameOverMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b", ntimesString(15, "0123456789")),
			write("a/c", "hello"),
		),
		as(bob,
			read("a/b", ntimesString(15, "0123456789")),
			read("a/c", "hello"),
			rename("a/c", "a/b"),
		),
		as(alice,
			read("a/b", "hello"),
			lsdir("a/", m{"b": "FILE"}),
		),
	)
}

// bob writes a second copy of a multiblock file written by alice
// (tests dedupping, but hard to verify that precisely here).
func TestCopyMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			read("a/b", ntimesString(15, "0123456789")),
			write("a/c", ntimesString(15, "0123456789")),
		),
		as(alice,
			read("a/b", ntimesString(15, "0123456789")),
			read("a/c", ntimesString(15, "0123456789")),
			rm("a/b"),
		),
		as(bob,
			read("a/c", ntimesString(15, "0123456789")),
		),
	)
}

// Test that we can make a big file, delete it, then make it
// again. Regression for KBFS-700.
func TestMakeDeleteAndMakeMultiBlockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			read("a/b", ntimesString(15, "0123456789")),
			rm("a/b"),
			write("a/b2", ntimesString(15, "0123456789")),
		),
		as(alice,
			read("a/b2", ntimesString(15, "0123456789")),
		),
	)
}

// When block changes are unembedded, make sure other users can read
// and apply them.
func TestReadUnembeddedBlockChanges(t *testing.T) {
	test(t,
		blockChangeSize(5), users("alice", "bob"),
		as(alice,
			write("a/b", "hello"),
		),
		as(bob,
			read("a/b", "hello"),
			write("a/c", "hello2"),
			write("a/d", "hello3"),
			write("a/e", "hello4"),
			write("a/f", "hello5"),
		),
		as(alice,
			lsdir("a", m{"b": "FILE", "c": "FILE", "d": "FILE", "e": "FILE", "f": "FILE"}),
			read("a/b", "hello"),
			read("a/c", "hello2"),
			read("a/d", "hello3"),
			read("a/e", "hello4"),
			read("a/f", "hello5"),
		),
	)
}
