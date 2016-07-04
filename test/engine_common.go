// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"testing"

	"github.com/keybase/kbfs/libkbfs"
)

func setBlockSizes(t testing.TB, config libkbfs.Config, blockSize, blockChangeSize int64) {
	// Set the block sizes, if any
	if blockSize > 0 || blockChangeSize > 0 {
		if blockSize == 0 {
			blockSize = 512 * 1024
		}
		if blockChangeSize < 0 {
			t.Fatal("Can't handle negative blockChangeSize")
		}
		if blockChangeSize == 0 {
			blockChangeSize = 8 * 1024
		}
		bsplit, err := libkbfs.NewBlockSplitterSimple(blockSize,
			uint64(blockChangeSize), config.Codec())
		if err != nil {
			t.Fatalf("Couldn't make block splitter for block size %d,"+
				" blockChangeSize %d: %v", blockSize, blockChangeSize, err)
		}
		config.SetBlockSplitter(bsplit)
	}
}

func maybeSetBw(t testing.TB, config libkbfs.Config, bwKBps int) {
	if bwKBps > 0 {
		if _, ok := config.BlockOps().(*libkbfs.BlockOpsStandard); ok {
			config.SetBlockOps(libkbfs.NewBlockOpsStandard(config, bwKBps))
			// Looks like we're testing big transfers, so let's do
			// background flushes.
			config.SetDoBackgroundFlushes(true)
		} else {
			t.Logf("Ignore bandwitdh setting of %d for a non-standard block ops",
				bwKBps)
		}
	}
}
