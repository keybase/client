// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests test truncation

package test

import "testing"

// bob writes a non-conflicting file while unstaged
func TestSimpleTruncate(t *testing.T) {
	const mb = 1024 * 1024
	mzero := make([]byte, mb)
	mdata := make([]byte, mb)
	copy(mdata, []byte(`world`))
	mdat2 := make([]byte, mb)
	const wlen = 200 * 1024
	for i := 0; i*100 < wlen; i++ {
		mdat2[i*100] = byte(i)
	}
	mdat3 := make([]byte, mb)
	for i := 0; i*100 < len(mdat3); i++ {
		mdat3[i*100] = byte(i)
	}
	test(t,
		// Fuse writes get split up into smaller pieces, and the new
		// small starting sync buffer size means that some of those
		// pieces get delayed.  By default tests have no background
		// flushing, so the delayed writes always block.  However,
		// turning on background flushes leads to retriable sync
		// errors, which runs smack into KBFS-1261.
		skip("fuse", "Does not work on FUSE pending KBFS-1261."),
		users("alice", "bob"),
		as(alice,
			mkfile("file", ""),
			truncate("file", 0),
			read("file", ""),
			truncate("file", 10),
			read("file", ntimesString(10, "\000")),
			truncate("file", 0),
			read("file", ""),
			truncate("file", mb),
			preadBS("file", mzero, 0),
			truncate("file", 0),
			read("file", ""),
			write("file", "world"),
			read("file", "world"),
			truncate("file", mb),
			preadBS("file", mdata, 0),
			writeBS("file", mdat2[:wlen]),
			preadBS("file", mdat2, 0),
			truncate("file", 0),
			read("file", ""),
			// Write past an unaligned hole
			truncate("file", 777777),
			writeBS("file", mdat3),
			preadBS("file", mdat3, 0),
		),
		as(bob,
			preadBS("file", mdat3, 0),
		),
	)
}
