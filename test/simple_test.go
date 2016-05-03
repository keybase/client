// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do one conflict-free operation while a user is unstaged.

package test

import (
	"testing"
)

// Check that renaming over a file correctly cleans up state
func TestRenameFileOverFile(t *testing.T) {
	test(t,
		writers("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
			mkfile("a/c", "world"),
			rename("a/c", "a/b"),
			lsdir("a/", m{"b": "FILE"}),
			read("a/b", "world"),
		),
	)
}

// Check that renaming a directory over a file correctly cleans up state
func TestRenameDirOverFile(t *testing.T) {
	test(t,
		skip("fuse", "Renaming directories over files not supported on linux fuse (ENOTDIR)"),
		writers("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
			mkfile("a/c/d", "world"),
			rename("a/c", "a/b"),
			lsdir("a/", m{"b": "DIR"}),
			read("a/b/d", "world"),
		),
	)
}
