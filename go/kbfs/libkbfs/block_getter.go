// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"golang.org/x/net/context"
)

// blockGetter provides the API for the block retrieval worker to obtain blocks.
type blockGetter interface {
	getBlock(
		context.Context, KeyMetadata, BlockPointer, Block,
		DiskBlockCacheType) error
	assembleBlock(context.Context, KeyMetadata, BlockPointer, Block, []byte,
		kbfscrypto.BlockCryptKeyServerHalf) error
}

// realBlockGetter obtains real blocks using the APIs available in Config.
type realBlockGetter struct {
	config blockOpsConfig
}

// getBlock implements the interface for realBlockGetter.
func (bg *realBlockGetter) getBlock(
	ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer,
	block Block, cacheType DiskBlockCacheType) error {
	bserv := bg.config.BlockServer()
	buf, blockServerHalf, err := bserv.Get(
		ctx, kmd.TlfID(), blockPtr.ID, blockPtr.Context, cacheType)
	if err != nil {
		// Temporary code to track down bad block
		// requests. Remove when not needed anymore.
		if _, ok := err.(kbfsblock.ServerErrorBadRequest); ok {
			panic(fmt.Sprintf("Bad BServer request detected: err=%s, blockPtr=%s",
				err, blockPtr))
		}

		return err
	}

	return assembleBlock(
		ctx, bg.config.keyGetter(), bg.config.Codec(), bg.config.cryptoPure(),
		kmd, blockPtr, block, buf, blockServerHalf)
}

func (bg *realBlockGetter) assembleBlock(ctx context.Context,
	kmd KeyMetadata, ptr BlockPointer, block Block, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	return assembleBlock(ctx, bg.config.keyGetter(), bg.config.Codec(),
		bg.config.cryptoPure(), kmd, ptr, block, buf, serverHalf)
}
