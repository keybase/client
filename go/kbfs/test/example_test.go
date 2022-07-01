// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import "testing"

//
// 1) alice writes
// 2) bob reads
// 3) alice reads
// 4) eve reads & tries to write(w/o permission),
//
func TestWriteReadWriteFail(t *testing.T) {
	test(t,
		skip("dokan", "Does not work with Dokan."),
		users("alice", "bob", "eve"), inPrivateTlf("alice,bob#eve"),
		as(alice,
			mkfile("foo.txt", "hello world"),
		),
		as(bob,
			read("foo.txt", "hello world"),
		),
		as(alice,
			read("foo.txt", "hello world"),
		),
		as(eve,
			read("foo.txt", "hello world"),
			expectError(rm("foo.txt"), "eve does not have write access to directory /keybase/private/alice,bob#eve"),
		),
	)
}

//
// 1) alice creates a directory, creates a file, writes more to the file w/o sync
// 2) bob writes to the same file and syncs
// 3) alice syncs
//
func TestConflict(t *testing.T) {
	test(t,
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello"),
		),
		as(bob,
			disableUpdates(),
		),
		as(alice,
			write("a/b", "world"),
		),
		as(bob, noSync(),
			write("a/b", "uh oh"),
			reenableUpdates(),
			lsdir("a/", m{"b$": "FILE", "b.conflict.*": "FILE"}),
			read("a/b", "world"),
		),
		as(alice,
			lsdir("a/", m{"b$": "FILE", "b.conflict.*": "FILE"}),
			read("a/b", "world"),
		),
	)
}

// create a file, create a dir, link(to the file, rename a file, remove it, remove its parent directory),
// and create an executable file.
func TestLinkLsRenameRmRmdirSetex(t *testing.T) {
	test(t,
		skip("dokan", "Does not work with Dokan."),
		users("alice", "bob"),
		as(alice,
			mkfile("a/b", "hello world"),
			mkdir("a/e"),
			link("a/e/b.link", "../b"),
			link("a/f", "e"),
			lsdir("a/", m{"b": "FILE", "e": "DIR", "f": "SYM"}),
			expectError(lsdir("a/", m{"b": "DIR", "e": "DIR", "f": "SYM"}), "b of type DIR not found"),
			// lsdir(looks for files in the directory that match regexs from left to right in this hash.),
			// if it finds a match for the regex and the expected type it considers the file expected.
			// if it doesn't find a match it throws an error. also, if any files remain that weren't
			// matched an error is also thrown.
			lsdir("a/", m{".": "FILE", "[a-z]{1}": "DIR", "[a-f]{1}": "SYM"}),
			expectError(lsdir("a/", m{"b": "FILE", "e": "DIR"}), "unexpected f of type SYM found in a/"),
			lsdir("a/e", m{"b.link": "SYM"}),
			lsdir("a/f", m{"b.link": "SYM"}),
		),
		as(bob,
			read("a/e/b.link", "hello world"),
			rename("a/b", "c/d"),
			expectError(read("a/e/b.link", "hello world"), "b doesn't exist"),
			rm("a/e/b.link"),
			exists("c/d"),
		),
		as(alice,
			notExists("a/b"),
			notExists("a/e/b.link"),
			expectError(read("a/b", "hello world"), "b doesn't exist"),
			read("c/d", "hello world"),
			rm("c/d"),
			notExists("c/d"),
			rmdir("c"),
		),
		as(bob,
			notExists("c"),
			mkfile("a/foo.exe", "bits and bytes etc"),
			setex("a/foo.exe", true),
		),
		as(alice,
			rmdir("a/e"),
			rm("a/f"),
			lsdir("a", m{"foo.exe": "EXEC"}),
			rm("a/foo.exe"),
		),
	)
}
