// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "golang.org/x/net/context"

type journalBlockServer struct {
	jServer *JournalServer
	BlockServer
}

var _ BlockServer = journalBlockServer{}

func (j journalBlockServer) Get(
	ctx context.Context, tlfID TlfID, id BlockID, context BlockContext) (
	[]byte, BlockCryptKeyServerHalf, error) {
	bundle, ok := j.jServer.getBundle(tlfID)
	if !ok {
		return j.BlockServer.Get(ctx, tlfID, id, context)
	}

	data, serverHalf, err := func() (
		[]byte, BlockCryptKeyServerHalf, error) {
		bundle.lock.RLock()
		defer bundle.lock.RUnlock()
		return bundle.blockJournal.getDataWithContext(id, context)
	}()
	if _, ok := err.(BServerErrorBlockNonExistent); ok {
		return j.BlockServer.Get(ctx, tlfID, id, context)
	} else if err != nil {
		return nil, BlockCryptKeyServerHalf{}, err
	}

	return data, serverHalf, nil
}

func (j journalBlockServer) Put(
	ctx context.Context, tlfID TlfID, id BlockID, context BlockContext,
	buf []byte, serverHalf BlockCryptKeyServerHalf) error {
	bundle, ok := j.jServer.getBundle(tlfID)
	if ok {
		bundle.lock.Lock()
		defer bundle.lock.Unlock()
		return bundle.blockJournal.putData(
			ctx, id, context, buf, serverHalf)
	}

	return j.BlockServer.Put(ctx, tlfID, id, context, buf, serverHalf)
}

func (j journalBlockServer) AddBlockReference(
	ctx context.Context, tlfID TlfID, id BlockID,
	context BlockContext) error {
	_, ok := j.jServer.getBundle(tlfID)
	bundle, ok := j.jServer.getBundle(tlfID)
	if ok {
		bundle.lock.Lock()
		defer bundle.lock.Unlock()
		return bundle.blockJournal.addReference(ctx, id, context)
	}

	return j.BlockServer.AddBlockReference(ctx, tlfID, id, context)
}

func (j journalBlockServer) RemoveBlockReferences(
	ctx context.Context, tlfID TlfID,
	contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	_, ok := j.jServer.getBundle(tlfID)
	bundle, ok := j.jServer.getBundle(tlfID)
	if ok {
		liveCounts, err := func() (map[BlockID]int, error) {
			bundle.lock.Lock()
			defer bundle.lock.Unlock()
			// Don't remove the block data if we remove
			// the last reference; we still need it to
			// flush the initial put operation.
			//
			// TODO: It would be nice if we could detect
			// that case and avoid having to flush the
			// put.
			return bundle.blockJournal.removeReferences(
				ctx, contexts, false)
		}()
		if err != nil {
			return nil, err
		}

		// TODO: Get server counts without making a
		// RemoveBlockReferences call and merge it.

		return liveCounts, nil
	}

	return j.BlockServer.RemoveBlockReferences(ctx, tlfID, contexts)
}

func (j journalBlockServer) ArchiveBlockReferences(
	ctx context.Context, tlfID TlfID,
	contexts map[BlockID][]BlockContext) error {
	_, ok := j.jServer.getBundle(tlfID)
	bundle, ok := j.jServer.getBundle(tlfID)
	if ok {
		bundle.lock.Lock()
		defer bundle.lock.Unlock()
		return bundle.blockJournal.archiveReferences(ctx, contexts)
	}

	return j.BlockServer.ArchiveBlockReferences(ctx, tlfID, contexts)
}
