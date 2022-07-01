// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"testing"
	"time"
)

func TestFavoritesBasic(t *testing.T) {
	test(t,
		users("alice", "bob"),

		inPrivateTlf("alice,bob"),
		as(alice,
			lspublicfavorites([]string{"alice"}),
			lsprivatefavorites([]string{"alice", "alice,bob"}),
		),

		inPublicTlf("alice,bob"),
		as(alice,
			lspublicfavorites([]string{"alice", "alice,bob"}),
			lsprivatefavorites([]string{"alice", "alice,bob"}),
		),
	)
}

func TestCreateDirInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			addTime(1*time.Minute),
			mkdir("a"),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
		),
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
			mtime("a", time.Time{}),
			// Make sure root directory's mtime was updated.
			mtime("", time.Time{}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{}),
			mtime("a", time.Time{}),
			mtime("", time.Time{}),
		),
	)
}

func TestCreateDirInSubdir(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(alice,
			addTime(1*time.Minute),
			mkdir("a/b"),
			// Initial check before SyncAll is called.
			lsdir("a", m{"b$": "DIR"}),
		),
		as(alice,
			lsdir("a", m{"b$": "DIR"}),
			mtime("a/b", time.Time{}),
			// Make sure parent directory's mtime was updated.
			mtime("a", time.Time{}),
		),
		as(bob,
			lsdir("a", m{"b$": "DIR"}),
			mtime("a/b", time.Time{}),
			mtime("a", time.Time{}),
		),
	)
}

func TestCreateFileInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
			checkPrevRevisions("a", []uint8{1}),
		),
		as(bob,
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
			checkPrevRevisions("a", []uint8{1}),
		),
	)
}

func TestCreateExecInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			setex("a", true),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "EXEC"}),
			read("a", "hello"),
		),
		as(alice,
			lsdir("", m{"a$": "EXEC"}),
			read("a", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "EXEC"}),
			read("a", "hello"),
		),
	)
}

func TestCreateLinkInRoot(t *testing.T) {
	test(t,
		skip("dokan", "Does not work with Dokan."),
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			link("b", "a"),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "FILE", "b$": "SYM"}),
			read("b", "hello"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE", "b$": "SYM"}),
			read("b", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "FILE", "b$": "SYM"}),
			read("b", "hello"),
		),
	)
}

func TestRemoveFileFromRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(alice,
			addTime(1*time.Minute),
			rm("a"),
			// Initial check before SyncAll is called.
			lsdir("", m{}),
		),
		as(alice,
			lsdir("", m{}),
			// Make sure root directory's mtime was updated.
			mtime("", time.Time{}),
		),
		as(bob,
			lsdir("", m{}),
			mtime("", time.Time{}),
		),
	)
}

func TestRemoveFileFromSubdir(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(alice,
			addTime(1*time.Minute),
			rm("a/b"),
			// Initial check before SyncAll is called.
			lsdir("a", m{}),
		),
		as(alice,
			lsdir("a", m{}),
			// Make sure root directory's mtime was updated.
			mtime("a", time.Time{}),
		),
		as(bob,
			lsdir("a", m{}),
			mtime("a", time.Time{}),
		),
	)
}

func TestRemoveExecFromRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			setex("a", true),
		),
		as(alice,
			rm("a"),
			// Initial check before SyncAll is called.
			lsdir("", m{}),
		),
		as(alice,
			lsdir("", m{}),
		),
		as(bob,
			lsdir("", m{}),
		),
	)
}

func TestRemoveDirFromRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(alice,
			rmdir("a"),
			// Initial check before SyncAll is called.
			lsdir("", m{}),
		),
		as(alice,
			lsdir("", m{}),
		),
		as(bob,
			lsdir("", m{}),
		),
	)
}

func TestRemoveLinkFromRoot(t *testing.T) {
	test(t,
		skip("dokan", "Does not work with Dokan."),
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			link("b", "a"),
		),
		as(alice,
			rm("b"),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "FILE"}),
		),
		as(alice,
			lsdir("", m{"a$": "FILE"}),
		),
		as(bob,
			lsdir("", m{"a$": "FILE"}),
		),
	)
}

func TestRenameInDir(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(alice,
			rename("a/b", "a/c"),
			// Initial check before SyncAll is called.
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
		),
		as(alice,
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
			// The directory underwent two revisions.
			checkPrevRevisions("a", []uint8{1, 2}),
		),
		as(bob,
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
			checkPrevRevisions("a", []uint8{1, 2}),
		),
	)
}

func TestRenameInDirOverFile(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
			mkfile("a/c", "goodbye"),
		),
		as(alice,
			rename("a/b", "a/c"),
			// Initial check before SyncAll is called.
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
		),
		as(alice,
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
		),
		as(bob,
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
		),
	)
}

func TestRenameInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(alice,
			rename("a", "b"),
			// Initial check before SyncAll is called.
			lsdir("", m{"b$": "FILE"}),
			read("b", "hello"),
		),
		as(alice,
			lsdir("", m{"b$": "FILE"}),
			read("b", "hello"),
		),
		as(bob,
			lsdir("", m{"b$": "FILE"}),
			read("b", "hello"),
		),
	)
}

func TestRenameAcrossDirs(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
			mkdir("c"),
		),
		as(alice,
			rename("a/b", "c/d"),
			// Initial check before SyncAll is called.
			lsdir("a", m{}),
			lsdir("c", m{"d$": "FILE"}),
			read("c/d", "hello"),
		),
		as(alice,
			lsdir("a", m{}),
			lsdir("c", m{"d$": "FILE"}),
			read("c/d", "hello"),
		),
		as(bob,
			lsdir("a", m{}),
			lsdir("c", m{"d$": "FILE"}),
			read("c/d", "hello"),
		),
	)
}

func TestRenameAcrossPrefix(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
			mkdir("a/c/d/e"),
		),
		as(alice,
			rename("a/b", "a/c/d/e/f"),
			// Initial check before SyncAll is called.
			lsdir("a", m{"c$": "DIR"}),
			lsdir("a/c/d/e", m{"f$": "FILE"}),
			read("a/c/d/e/f", "hello"),
		),
		as(alice,
			lsdir("a", m{"c$": "DIR"}),
			lsdir("a/c/d/e", m{"f$": "FILE"}),
			read("a/c/d/e/f", "hello"),
		),
		as(bob,
			lsdir("a", m{"c$": "DIR"}),
			lsdir("a/c/d/e", m{"f$": "FILE"}),
			read("a/c/d/e/f", "hello"),
		),
	)
}

func TestRenameAcrossOtherPrefix(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b/c/d/e", "hello"),
		),
		as(alice,
			rename("a/b/c/d/e", "a/f"),
			// Initial check before SyncAll is called.
			lsdir("a", m{"b$": "DIR", "f": "FILE"}),
			lsdir("a/b/c/d", m{}),
			read("a/f", "hello"),
		),
		as(alice,
			lsdir("a", m{"b$": "DIR", "f": "FILE"}),
			lsdir("a/b/c/d", m{}),
			read("a/f", "hello"),
		),
		as(bob,
			lsdir("a", m{"b$": "DIR", "f": "FILE"}),
			lsdir("a/b/c/d", m{}),
			read("a/f", "hello"),
		),
	)
}

func TestUnsetExecInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			setex("a", true),
		),
		as(alice,
			setex("a", false),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
	)
}

func TestExtraSetExecInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			setex("a", true),
		),
		as(alice,
			setex("a", true),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "EXEC"}),
			read("a", "hello"),
		),
		as(alice,
			lsdir("", m{"a$": "EXEC"}),
			read("a", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "EXEC"}),
			read("a", "hello"),
		),
	)
}

func TestExtraUnsetExecInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
		),
		as(alice,
			setex("a", false),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "FILE"}),
			read("a", "hello"),
		),
	)
}

func TestSetExecOnDir(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
		),
		as(alice,
			setex("a", true),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "DIR"}),
		),
		as(alice,
			lsdir("", m{"a$": "DIR"}),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
		),
	)
}

func TestSetMtime(t *testing.T) {
	targetMtime := time.Now().Add(1 * time.Minute)
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(alice,
			setmtime("a/b", targetMtime),
			// Initial check before SyncAll is called.
			mtime("a/b", targetMtime),
		),
		as(alice,
			mtime("a/b", targetMtime),
		),
		as(bob,
			mtime("a/b", targetMtime),
		),
	)
}

func TestSyncTwoFilesInRoot(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a", "hello"),
			mkfile("b", "hello2"),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "FILE", "b$": "FILE"}),
			read("a", "hello"),
			read("b", "hello2"),
		),
		as(alice,
			lsdir("", m{"a$": "FILE", "b$": "FILE"}),
			read("a", "hello"),
			read("b", "hello2"),
		),
		as(bob,
			lsdir("", m{"a$": "FILE", "b$": "FILE"}),
			read("a", "hello"),
			read("b", "hello2"),
		),
	)
}

// Regression for KBFS-2243.
func TestCreateAndRemoveDirTreeWithinBatch(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkdir("a/b"),
			pwriteBSSync("a/b/c", []byte("hello"), 0, false),
			rm("a/b/c"),
			mkdir("b"),
			rmdir("a/b"),
			rmdir("a"),
			// Initial check before SyncAll is called.
			lsdir("", m{"b$": "DIR"}),
			lsdir("b", m{}),
			checkDirtyPaths([]string{
				"alice,bob",
				"alice,bob/a/b/c",
			}),
		),
		as(alice,
			checkDirtyPaths(nil),
			lsdir("", m{"b$": "DIR"}),
			lsdir("b", m{}),
		),
		as(bob,
			lsdir("", m{"b$": "DIR"}),
			lsdir("b", m{}),
		),
	)
}

func TestRenameFromRemovedDirWithinBatch(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkdir("a/b"),
			rename("a/b", "b"),
			rmdir("a"),
			// Initial check before SyncAll is called.
			lsdir("", m{"b$": "DIR"}),
			lsdir("b", m{}),
		),
		as(alice,
			lsdir("", m{"b$": "DIR"}),
			lsdir("b", m{}),
		),
		as(bob,
			lsdir("", m{"b$": "DIR"}),
			lsdir("b", m{}),
		),
	)
}

// Regression test for KBFS-2286.
func TestSetattrThenRenameWithinBatch(t *testing.T) {
	targetMtime := time.Now().Add(1 * time.Minute)
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkfile("a/b", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{"b$": "FILE"}),
			read("a/b", "hello"),
		),
		as(alice,
			setmtime("a/b", targetMtime),
			rename("a/b", "a/c"),
			// Initial check before SyncAll is called.
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
			mtime("a/c", targetMtime),
		),
		as(alice,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
			mtime("a/c", targetMtime),
		),
		as(bob,
			lsdir("", m{"a$": "DIR"}),
			lsdir("a", m{"c$": "FILE"}),
			read("a/c", "hello"),
			mtime("a/c", targetMtime),
		),
	)
}

// Regression test for KBFS-3351.
func TestRenameRenameRm(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkdir("a"),
			mkdir("b"),
			mkfile("a/c", "hello"),
			mkfile("b/d", "hello2"),
			mkdir("e"),
		),
		as(bob,
			lsdir("", m{"a$": "DIR", "b$": "DIR", "e$": "DIR"}),
			lsdir("a", m{"c$": "FILE"}),
			lsdir("b", m{"d$": "FILE"}),
			read("a/c", "hello"),
			read("b/d", "hello2"),
			lsdir("e", m{}),
		),
		as(alice,
			rename("a/c", "e/f"),
			rename("b/d", "a/c"),
			rm("a/c"),
		),
		as(alice,
			lsdir("", m{"a$": "DIR", "b$": "DIR", "e$": "DIR"}),
			lsdir("a", m{}),
			lsdir("b", m{}),
			lsdir("e", m{"f$": "FILE"}),
			read("e/f", "hello"),
		),
		as(bob,
			lsdir("", m{"a$": "DIR", "b$": "DIR", "e$": "DIR"}),
			lsdir("a", m{}),
			lsdir("b", m{}),
			lsdir("e", m{"f$": "FILE"}),
			read("e/f", "hello"),
		),
	)
}
