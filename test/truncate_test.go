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
			read("file", string(mzero)),
			truncate("file", 0),
			read("file", ""),
			write("file", "world"),
			read("file", "world"),
			truncate("file", mb),
			read("file", string(mdata)),
			write("file", string(mdat2[:wlen])),
			read("file", string(mdat2)),
			truncate("file", 0),
			read("file", ""),
			// Write past an unaligned hole
			truncate("file", 777777),
			write("file", string(mdat3)),
			read("file", string(mdat3)),
		),
		as(bob,
			read("file", string(mdat3)),
		),
	)
}
