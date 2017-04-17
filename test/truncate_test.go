// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These tests test truncation

package test

import "testing"

// Test out various truncate scenarios.
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
		bandwidth(1<<31-1), // hack to turn on background syncing
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

func testTruncateLargeThenWriteToSmallerOffset(t *testing.T, dataLen int) {
	data := make([]byte, dataLen)
	for i := 0; i < len(data); i++ {
		if i < 12 || (i >= 64 && i < 68) || (i >= dataLen-12) {
			data[i] = byte(i)
		}
	}
	test(t,
		blockSize(20), blockChangeSize(100*1024), users("alice", "bob"),
		as(alice,
			mkfile("file", ""),
			truncate("file", uint64(dataLen)),
			// Write first block and sync.
			writeBS("file", data[:12]),
			// Write last block, don't sync yet.
			pwriteBSSync("file", data[dataLen-12:], int64(dataLen-12), false),
			// Then write a block in the middle somewhere, and do the sync.
			pwriteBSSync("file", data[64:68], 64, true),
		),
		as(bob,
			read("file", string(data)),
		),
	)
}

func TestTruncateLargeThenWriteToSmallerOffset(t *testing.T) {
	testTruncateLargeThenWriteToSmallerOffset(
		t, 10*12 /* 10 min-sized blocks */)
}

// Regression for KBFS-2091.
func TestTruncateLargeThenWriteToSmallerOffsetWithHoles(t *testing.T) {
	testTruncateLargeThenWriteToSmallerOffset(
		t, 1024*1024 /* above the holes threshold */)
}
