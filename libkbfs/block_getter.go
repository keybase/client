// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"

	"golang.org/x/net/context"
)

// blockGetter provides the API for the block retrieval worker to obtain blocks.
type blockGetter interface {
	getBlock(context.Context, KeyMetadata, BlockPointer, Block) error
}

// realBlockGetter obtains real blocks using the APIs available in Config.
type realBlockGetter struct {
	config Config
}

// getBlock implements the interface for realBlockGetter.
func (bg *realBlockGetter) getBlock(ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer, block Block) error {
	bserv := bg.config.BlockServer()
	buf, blockServerHalf, err := bserv.Get(
		ctx, kmd.TlfID(), blockPtr.ID, blockPtr.BlockContext)
	if err != nil {
		// Temporary code to track down bad block
		// requests. Remove when not needed anymore.
		if _, ok := err.(BServerErrorBadRequest); ok {
			panic(fmt.Sprintf("Bad BServer request detected: err=%s, blockPtr=%s",
				err, blockPtr))
		}

		return err
	}

	crypto := bg.config.Crypto()
	if err := crypto.VerifyBlockID(buf, blockPtr.ID); err != nil {
		return err
	}

	tlfCryptKey, err := bg.config.KeyManager().
		GetTLFCryptKeyForBlockDecryption(ctx, kmd, blockPtr)
	if err != nil {
		return err
	}

	// construct the block crypt key
	blockCryptKey, err := crypto.UnmaskBlockCryptKey(
		blockServerHalf, tlfCryptKey)
	if err != nil {
		return err
	}

	var encryptedBlock EncryptedBlock
	err = bg.config.Codec().Decode(buf, &encryptedBlock)
	if err != nil {
		return err
	}

	// decrypt the block
	err = crypto.DecryptBlock(encryptedBlock, blockCryptKey, block)
	if err != nil {
		return err
	}

	block.SetEncodedSize(uint32(len(buf)))
	return nil
}
