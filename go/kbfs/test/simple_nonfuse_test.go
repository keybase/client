// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !fuse

package test

import "testing"

// os.Rename doesn't support overriding empty dst dir, so skip this test if
// FUSE engine is used.
//
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
