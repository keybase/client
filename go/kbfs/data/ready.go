// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"context"
	"fmt"
	"math"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/protocol/keybase1"
)

// ReadyBlock is a thin wrapper around ReadyProvider.Ready() that
// handles checking for duplicates.
func ReadyBlock(
	ctx context.Context, bcache BlockCache, rp ReadyProvider,
	kmd libkey.KeyMetadata, block Block, chargedTo keybase1.UserOrTeamID,
	bType keybase1.BlockType, hashBehavior BlockCacheHashBehavior) (
	info BlockInfo, plainSize int, readyBlockData ReadyBlockData, err error,
) {
	var ptr BlockPointer
	directType := DirectBlock
	if block.IsIndirect() {
		directType = IndirectBlock
	} else if fBlock, ok := block.(*FileBlock); ok {
		// first see if we are duplicating any known blocks in this folder
		ptr, err = bcache.CheckForKnownPtr(kmd.TlfID(), fBlock, hashBehavior)
		if err != nil {
			return BlockInfo{}, 0, ReadyBlockData{}, err
		}
	}

	// Ready the block, even in the case where we can reuse an
	// existing block, just so that we know what the size of the
	// encrypted data will be.
	bid, plainSize, readyBlockData, err := rp.Ready(ctx, kmd, block)
	if err != nil {
		return BlockInfo{}, 0, ReadyBlockData{}, err
	}

	if ptr.IsInitialized() {
		ptr.RefNonce, err = kbfsblock.MakeRefNonce()
		if err != nil {
			return BlockInfo{}, 0, ReadyBlockData{}, err
		}
		ptr.SetWriter(chargedTo)
		// In case we're deduping an old pointer with an unknown block type.
		ptr.DirectType = directType
	} else {
		ptr = BlockPointer{
			ID:         bid,
			KeyGen:     kmd.LatestKeyGeneration(),
			DataVer:    block.DataVersion(),
			DirectType: directType,
			Context:    kbfsblock.MakeFirstContext(chargedTo, bType),
		}
	}

	encodedSize := readyBlockData.GetEncodedSize()
	if encodedSize < 0 || uint64(encodedSize) > math.MaxUint32 {
		return BlockInfo{}, 0, ReadyBlockData{}, fmt.Errorf("encoded size %d out of range for uint32", encodedSize)
	}
	info = BlockInfo{
		BlockPointer: ptr,
		EncodedSize:  uint32(encodedSize), // #nosec G115 -- validated range check above
	}
	return info, plainSize, readyBlockData, nil
}
