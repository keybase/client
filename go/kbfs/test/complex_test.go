// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests all do multiple operations while a user is unstaged.

package test

import (
	"testing"
)

// Regression test for KBFS-2501
func TestRenameAfterRenameThatWouldHaveBeenAnOverwrite(t *testing.T) {
	test(t,
		users("alice"),
		as(alice,
			mkfile("a/foo", "foo"),
			mkfile("a/b/foo2", "foo2"),
			mkfile("bar", "bar"),
		),
		as(alice,
			rename("a", "b"),
		),
		as(alice,
			rename("b/b", "a"),
		),
		as(alice,
			write("b/foo", "foo after rename"),
			write("bar", "bar after rename"),
		),
	)
}
