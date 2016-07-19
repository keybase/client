// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import "testing"

// bob writes a multi-block file while unmerged, no conflicts
func TestCrUnmergedWriteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/foo", "hello"),
		),
		as(bob, noSync(),
			write("a/b", ntimesString(5, "0123456789")),
			write("a/b", ntimesString(10, "0123456789")),
			write("a/b", ntimesString(15, "0123456789")),
			reenableUpdates(),
			lsdir("a/", m{"b": "FILE", "foo": "FILE"}),
			read("a/b", ntimesString(15, "0123456789")),
			read("a/foo", "hello"),
		),
		as(alice,
			lsdir("a/", m{"b": "FILE", "foo": "FILE"}),
			read("a/b", ntimesString(15, "0123456789")),
			read("a/foo", "hello"),
		),
	)
}

// bob writes a multi-block file that conflicts with a file created by alice
func TestCrConflictUnmergedWriteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/b", "hello"),
		),
		as(bob, noSync(),
			write("a/b", ntimesString(15, "0123456789")),
			reenableUpdates(),
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), ntimesString(15, "0123456789")),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", crnameEsc("b", bob): "FILE"}),
			read("a/b", "hello"),
			read(crname("a/b", bob), ntimesString(15, "0123456789")),
		),
	)
}

// alice writes a multi-block file that conflicts with a directory
// created by alice
func TestCrConflictMergedWriteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob, noSync(),
			write("a/b/c", "hello"),
			reenableUpdates(),
			lsdir("a/", m{"b$": "DIR", crnameEsc("b", alice): "FILE"}),
			read("a/b/c", "hello"),
			read(crname("a/b", alice), ntimesString(15, "0123456789")),
		),
		as(alice,
			lsdir("a/", m{"b$": "DIR", crnameEsc("b", alice): "FILE"}),
			read("a/b/c", "hello"),
			read(crname("a/b", alice), ntimesString(15, "0123456789")),
		),
	)
}

// bob resurrects a file that was removed by alice
func TestCrConflictWriteToRemovedMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkdir("a"),
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			rm("a/b"),
		),
		as(bob, noSync(),
			write("a/b", ntimesString(15, "9876543210")),
			reenableUpdates(),
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", ntimesString(15, "9876543210")),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE"}),
			read("a/b", ntimesString(15, "9876543210")),
		),
	)
}

// bob makes a file that was removed by alice executable
func TestCrConflictSetexToRemovedMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkdir("a"),
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			rm("a/b"),
		),
		as(bob, noSync(),
			setex("a/b", true),
			reenableUpdates(),
			lsdir("a/", m{"b$": "EXEC"}),
			read("a/b", ntimesString(15, "0123456789")),
		),
		as(alice,
			lsdir("a/", m{"b$": "EXEC"}),
			read("a/b", ntimesString(15, "0123456789")),
		),
	)
}

// bob moves a file that was removed by alice
func TestCrConflictMoveRemovedMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkdir("a"),
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			rm("a/b"),
		),
		as(bob, noSync(),
			rename("a/b", "a/c"),
			reenableUpdates(),
			lsdir("a/", m{"c$": "FILE"}),
			read("a/c", ntimesString(15, "0123456789")),
		),
		as(alice,
			lsdir("a/", m{"c$": "FILE"}),
			read("a/c", ntimesString(15, "0123456789")),
		),
	)
}

// bob writes a multi-block file while unmerged and the block change
// size is small, no conflicts
func TestCrUnmergedWriteMultiblockFileWithSmallBlockChangeSize(t *testing.T) {
	test(t,
		blockSize(20), blockChangeSize(5), users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/foo", "hello"),
		),
		as(bob,
			write("a/b", ntimesString(15, "0123456789")),
			reenableUpdates(),
			lsdir("a/", m{"b": "FILE", "foo": "FILE"}),
			read("a/b", ntimesString(15, "0123456789")),
			read("a/foo", "hello"),
		),
		as(alice,
			lsdir("a/", m{"b": "FILE", "foo": "FILE"}),
			read("a/b", ntimesString(15, "0123456789")),
			read("a/foo", "hello"),
		),
	)
}
