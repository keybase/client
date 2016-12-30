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
	getBlock(context.Context, KeyMetadata, BlockPointer, Block) error
}

// realBlockGetter obtains real blocks using the APIs available in Config.
type realBlockGetter struct {
	config blockOpsConfig
}

// getBlock implements the interface for realBlockGetter.
func (bg *realBlockGetter) getBlock(ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer, block Block) error {
	bserv := bg.config.blockServer()
	buf, blockServerHalf, err := bserv.Get(
		ctx, kmd.TlfID(), blockPtr.ID, blockPtr.Context)
	if err != nil {
		// Temporary code to track down bad block
		// requests. Remove when not needed anymore.
		if _, ok := err.(kbfsblock.BServerErrorBadRequest); ok {
			panic(fmt.Sprintf("Bad BServer request detected: err=%s, blockPtr=%s",
				err, blockPtr))
		}

		return err
	}

	if err := kbfsblock.VerifyID(buf, blockPtr.ID); err != nil {
		return err
	}

	tlfCryptKey, err := bg.config.keyGetter().
		GetTLFCryptKeyForBlockDecryption(ctx, kmd, blockPtr)
	if err != nil {
		return err
	}

	// construct the block crypt key
	blockCryptKey := kbfscrypto.UnmaskBlockCryptKey(
		blockServerHalf, tlfCryptKey)

	var encryptedBlock EncryptedBlock
	err = bg.config.codec().Decode(buf, &encryptedBlock)
	if err != nil {
		return err
	}

	// decrypt the block
	err = bg.config.crypto().DecryptBlock(
		encryptedBlock, blockCryptKey, block)
	if err != nil {
		return err
	}

	block.SetEncodedSize(uint32(len(buf)))
	return nil
}
