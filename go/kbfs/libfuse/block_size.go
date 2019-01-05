// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

// fuseBlockSize is the block size used for calculating number of blocks. This
// is to make du/df work, and does not reflect in any way the internal block
// size (which is variable). 512 is chosen because FUSE seems to assume this
// block size all the time, despite BlockSize is provided in Statfs or Attr
// response or not. Bazil FUSE's documentation verifies this:
// https://github.com/bazil/fuse/blob/371fbbdaa8987b715bdd21d6adc4c9b20155f748/fuse.go#L1320
const fuseBlockSize = 512

func getNumBlocksFromSize(size uint64) uint64 {
	if size == 0 {
		return 0
	}
	return (size-1)/fuseBlockSize + 1
}
