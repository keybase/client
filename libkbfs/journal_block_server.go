// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type journalBlockServer struct {
	jServer *JournalServer
	BlockServer
	enableAddBlockReference bool
}

var _ BlockServer = journalBlockServer{}

func (j journalBlockServer) Get(
	ctx context.Context, tlfID tlf.ID, id BlockID, context BlockContext) (
	data []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	if tlfJournal, ok := j.jServer.getTLFJournal(tlfID); ok {
		defer func() {
			err = translateToBlockServerError(err)
		}()
		data, serverHalf, err := tlfJournal.getBlockDataWithContext(
			id, context)
		switch err.(type) {
		case nil:
			return data, serverHalf, nil
		case blockNonExistentError:
			break
		default:
			if err == errTLFJournalDisabled {
				break
			}
			return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
		}
	}

	return j.BlockServer.Get(ctx, tlfID, id, context)
}

func (j journalBlockServer) Put(
	ctx context.Context, tlfID tlf.ID, id BlockID, context BlockContext,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	if tlfJournal, ok := j.jServer.getTLFJournal(tlfID); ok {
		defer func() {
			err = translateToBlockServerError(err)
		}()
		err := tlfJournal.putBlockData(ctx, id, context, buf, serverHalf)
		if err != errTLFJournalDisabled {
			return err
		}
	}

	return j.BlockServer.Put(ctx, tlfID, id, context, buf, serverHalf)
}

func (j journalBlockServer) AddBlockReference(
	ctx context.Context, tlfID tlf.ID, id BlockID,
	context BlockContext) (err error) {
	if tlfJournal, ok := j.jServer.getTLFJournal(tlfID); ok {
		if !j.enableAddBlockReference {
			// TODO: Temporarily return an error until KBFS-1149 is
			// fixed. This is needed despite
			// journalBlockCache.CheckForBlockPtr, since
			// CheckForBlockPtr may be called before journaling is
			// turned on for a TLF.
			return BServerErrorBlockNonExistent{}
		}

		defer func() {
			err = translateToBlockServerError(err)
		}()
		err := tlfJournal.addBlockReference(ctx, id, context)
		if err != errTLFJournalDisabled {
			return err
		}
	}

	return j.BlockServer.AddBlockReference(ctx, tlfID, id, context)
}

func (j journalBlockServer) RemoveBlockReferences(
	ctx context.Context, tlfID tlf.ID,
	contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	// Deletes always go straight to the server, since they slow down
	// the journal and already only happen in the background anyway.
	// Note that this means delete operations must be issued after the
	// corresponding MD that unreferenced the block was flushed from
	// the journal.
	return j.BlockServer.RemoveBlockReferences(ctx, tlfID, contexts)
}

func (j journalBlockServer) ArchiveBlockReferences(
	ctx context.Context, tlfID tlf.ID,
	contexts map[BlockID][]BlockContext) (err error) {
	// Archives always go straight to the server, since they slow down
	// the journal and already only happen in the background anyway.
	// Note that this means delete operations must be issued after the
	// corresponding MD that unreferenced the block was flushed from
	// the journal.
	return j.BlockServer.ArchiveBlockReferences(ctx, tlfID, contexts)
}

func (j journalBlockServer) Shutdown() {
	j.jServer.shutdown()
	j.BlockServer.Shutdown()
}
