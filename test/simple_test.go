// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"testing"
	"time"
)

// Check that renaming over a file correctly cleans up state
func TestRenameFileOverFile(t *testing.T) {
	test(t,
		users("alice"),
		as(alice,
			mkfile("a/b", "hello"),
			mkfile("a/c", "world"),
			rename("a/c", "a/b"),
			lsdir("a/", m{"b": "FILE"}),
			read("a/b", "world"),
		),
	)
}

func TestRenameDirOverDir(t *testing.T) {
	test(t,
		users("alice"),
		as(alice,
			mkdir("a/b"),
			mkfile("a/c/d", "hello"),
			rename("a/c", "a/b"),
			lsdir("a/", m{"b": "DIR"}),
			lsdir("a/b", m{"d": "FILE"}),
			read("a/b/d", "hello"),

			// Rename over a non-empty dir should fail
			mkfile("a/c/e", "world"),
			expectError(rename("a/c", "a/b"),
				"Directory b is not empty and can't be removed"),
		),
	)
}

func TestSetMtime(t *testing.T) {
	targetMtime := time.Now().Add(1 * time.Minute)
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
			setmtime("a/b", targetMtime),
			mtime("a/b", targetMtime),
		),
		as(bob,
			mtime("a/b", targetMtime),
		),
	)
}

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
