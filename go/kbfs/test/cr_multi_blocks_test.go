// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import "testing"

// bob writes a multi-block file while unmerged, no conflicts
func TestCrUnmergedWriteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), blockChangeSize(20*1024), users("alice", "bob"),
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

// bob writes a multi-block file with sequential writes while
// unmerged, no conflicts
func TestCrUnmergedWriteSequentialMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), blockChangeSize(20*1024), users("alice", "bob"),
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
			pwriteBS("a/b", []byte(ntimesString(5, "0123456789")), 50),
			pwriteBS("a/b", []byte(ntimesString(5, "0123456789")), 100),
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
		blockSize(20), blockChangeSize(20*1024), users("alice", "bob"),
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

// bob writes a multi-block file when there's a conflict on another
// file.  Regression test for KBFS-3770.
func TestCrConflictWriteMultiblockFileDuringOtherConflict(t *testing.T) {
	test(t,
		blockSize(20), blockChangeSize(100*1024), users("alice", "bob"),
		as(alice,
			mkdir("a"),
			write("a/b", ntimesString(15, "0123456789")),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/c", "foo"),
		),
		as(bob, noSync(),
			write("a/c", "foo"),
			pwriteBS("a/b", []byte(ntimesString(15, "9876543210")), 150),
			reenableUpdates(),
			lsdir("a/", m{"b$": "FILE", "c$": "FILE", crnameEsc("c", bob): "FILE"}),
			read("a/b", ntimesString(15, "0123456789")+ntimesString(15, "9876543210")),
			read("a/c", "foo"),
			read(crname("a/c", bob), "foo"),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", "c$": "FILE", crnameEsc("c", bob): "FILE"}),
			read("a/b", ntimesString(15, "0123456789")+ntimesString(15, "9876543210")),
			read("a/c", "foo"),
			read(crname("a/c", bob), "foo"),
		),
	)
}

// bob resurrects a file that was removed by alice
func TestCrConflictWriteToRemovedMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), blockChangeSize(100*1024), users("alice", "bob"),
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
		skip("dokan", "SetEx is a non-op on Dokan, thus no conflict."),
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
// size is small, no conflicts.
func TestCrUnmergedWriteMultiblockFileWithSmallBlockChangeSize(t *testing.T) {
	test(t,
		blockSize(100), blockChangeSize(5), users("alice", "bob"),
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

// bob moves a multi-block file, and then deletes its parents.
func TestCrUnmergedMoveAndDeleteMultiblockFile(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			write("a/b/c/d", ntimesString(15, "0123456789")),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("foo", "bar"),
		),
		as(bob, noSync(),
			rename("a/b/c/d", "a/b/c/e"),
			rm("a/b/c/e"),
			rmdir("a/b/c"),
			rmdir("a/b"),
			reenableUpdates(),
			lsdir("a/", m{}),
			read("foo", "bar"),
		),
		as(alice,
			lsdir("a/", m{}),
			read("foo", "bar"),
		),
	)
}

// alice writes a multi-block directory in separate batches, and bob reads it.
func TestCrWriteMultiblockDirMerge(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkfile("a/b", "b"),
			mkfile("a/c", "c"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			mkfile("a/d", "d"),
			mkfile("a/e", "e"),
		),
		as(bob, noSync(),
			mkfile("a/f", "f"),
			mkfile("a/g", "g"),
			reenableUpdates(),
			lsdir("a/", m{
				"b": "FILE",
				"c": "FILE",
				"d": "FILE",
				"e": "FILE",
				"f": "FILE",
				"g": "FILE",
			}),
			read("a/b", "b"),
			read("a/c", "c"),
			read("a/d", "d"),
			read("a/e", "e"),
			read("a/f", "f"),
			read("a/g", "g"),
		),
		as(alice,
			lsdir("a/", m{
				"b": "FILE",
				"c": "FILE",
				"d": "FILE",
				"e": "FILE",
				"f": "FILE",
				"g": "FILE",
			}),
			read("a/b", "b"),
			read("a/c", "c"),
			read("a/d", "d"),
			read("a/e", "e"),
			read("a/f", "f"),
			read("a/g", "g"),
		),
	)
}

// alice writes a multi-level, multi-block directory structure.
func TestCrRemoveMultilevelMultiblockDir(t *testing.T) {
	test(t,
		blockSize(20), users("alice", "bob"),
		as(alice,
			mkfile("a/b", "b"),
			mkfile("a/c", "c"),
			mkdir("a/d"),
			mkfile("a/d/e", "e"),
			mkfile("a/d/f", "f"),
			mkdir("a/g"),
			mkfile("a/g/h", "h"),
			mkfile("a/g/i", "i"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			mkdir("b"),
		),
		as(bob, noSync(),
			rm("a/g/i"),
			rm("a/g/h"),
			rmdir("a/g"),
			rm("a/d/f"),
			rm("a/d/e"),
			rmdir("a/d"),
			rm("a/c"),
			rm("a/b"),
			rmdir("a"),
			reenableUpdates(),
			lsdir("", m{"b": "DIR"}),
		),
		as(alice,
			lsdir("", m{"b": "DIR"}),
		),
	)
}

func TestCrDoubleResolutionMultiblock(t *testing.T) {
	testCrDoubleResolution(t, 20)
}
