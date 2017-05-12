// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type journalBlockServer struct {
	jServer *JournalServer
	BlockServer
	enableAddBlockReference bool
}

var _ BlockServer = journalBlockServer{}

func (j journalBlockServer) getBlockFromJournal(
	tlfID tlf.ID, id kbfsblock.ID) (
	data []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	found bool, err error) {
	tlfJournal, ok := j.jServer.getTLFJournal(tlfID)
	if !ok {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, false, nil
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
	data, serverHalf, err = tlfJournal.getBlockData(id)
	switch errors.Cause(err).(type) {
	case nil:
		return data, serverHalf, true, nil
	case blockNonExistentError:
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, false, nil
	case errTLFJournalDisabled:
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, false, nil
	default:
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, false, err
	}
}

func (j journalBlockServer) getBlockSizeFromJournal(
	tlfID tlf.ID, id kbfsblock.ID) (
	size uint32, found bool, err error) {
	tlfJournal, ok := j.jServer.getTLFJournal(tlfID)
	if !ok {
		return 0, false, nil
	}

	defer func() {
		err = translateToBlockServerError(err)
	}()
	size, err = tlfJournal.getBlockSize(id)
	switch errors.Cause(err).(type) {
	case nil:
		return size, true, nil
	case blockNonExistentError:
		return 0, false, nil
	case errTLFJournalDisabled:
		return 0, false, nil
	default:
		return 0, false, err
	}
}

func (j journalBlockServer) Get(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID, context kbfsblock.Context) (
	data []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	j.jServer.log.LazyTrace(ctx, "jBServer: Get %s", id)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jBServer: Get %s done (err=%v)", id, err)
	}()

	data, serverHalf, found, err := j.getBlockFromJournal(tlfID, id)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	if found {
		return data, serverHalf, nil
	}

	return j.BlockServer.Get(ctx, tlfID, id, context)
}

func (j journalBlockServer) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID, context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	// Don't trace this function, as it gets too verbose and is
	// called in parallel anyway. Rely on caller (usually
	// doBlockPuts) to do the tracing.

	if tlfJournal, ok := j.jServer.getTLFJournal(tlfID); ok {
		defer func() {
			err = translateToBlockServerError(err)
		}()
		err := tlfJournal.putBlockData(ctx, id, context, buf, serverHalf)
		switch e := errors.Cause(err).(type) {
		case nil:
			usedQuotaBytes, quotaBytes := tlfJournal.getQuotaInfo()
			return j.jServer.maybeReturnOverQuotaError(
				usedQuotaBytes, quotaBytes)
		case errTLFJournalDisabled:
			break
		case *ErrDiskLimitTimeout:
			return j.jServer.maybeMakeDiskLimitErrorReportable(e)
		default:
			return err
		}
	}

	return j.BlockServer.Put(ctx, tlfID, id, context, buf, serverHalf)
}

func (j journalBlockServer) AddBlockReference(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context) (err error) {
	j.jServer.log.LazyTrace(ctx, "jBServer: AddRef %s", id)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jBServer: AddRef %s done (err=%v)", id, err)
	}()

	if tlfJournal, ok := j.jServer.getTLFJournal(tlfID); ok {
		if !j.enableAddBlockReference {
			// TODO: Temporarily return an error until KBFS-1149 is
			// fixed. This is needed despite
			// journalBlockCache.CheckForBlockPtr, since
			// CheckForBlockPtr may be called before journaling is
			// turned on for a TLF.
			return kbfsblock.BServerErrorBlockNonExistent{}
		}

		defer func() {
			err = translateToBlockServerError(err)
		}()
		err := tlfJournal.addBlockReference(ctx, id, context)
		switch errors.Cause(err).(type) {
		case nil:
			return nil
		case errTLFJournalDisabled:
			break
		default:
			return err
		}
	}

	return j.BlockServer.AddBlockReference(ctx, tlfID, id, context)
}

func (j journalBlockServer) RemoveBlockReferences(
	ctx context.Context, tlfID tlf.ID,
	contexts kbfsblock.ContextMap) (
	liveCounts map[kbfsblock.ID]int, err error) {
	j.jServer.log.LazyTrace(ctx, "jBServer: RemRef %v", contexts)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jBServer: RemRef %v done (err=%v)", contexts, err)
	}()

	// Deletes always go straight to the server, since they slow down
	// the journal and already only happen in the background anyway.
	// Note that this means delete operations must be issued after the
	// corresponding MD that unreferenced the block was flushed from
	// the journal.
	return j.BlockServer.RemoveBlockReferences(ctx, tlfID, contexts)
}

func (j journalBlockServer) ArchiveBlockReferences(
	ctx context.Context, tlfID tlf.ID,
	contexts kbfsblock.ContextMap) (err error) {
	j.jServer.log.LazyTrace(ctx, "jBServer: ArchiveRef %v", contexts)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jBServer: ArchiveRef %v done (err=%v)", contexts, err)
	}()

	// Archives always go straight to the server, since they slow down
	// the journal and already only happen in the background anyway.
	// Note that this means delete operations must be issued after the
	// corresponding MD that unreferenced the block was flushed from
	// the journal.
	return j.BlockServer.ArchiveBlockReferences(ctx, tlfID, contexts)
}

func (j journalBlockServer) IsUnflushed(ctx context.Context, tlfID tlf.ID,
	id kbfsblock.ID) (isLocal bool, err error) {
	j.jServer.log.LazyTrace(ctx, "jBServer: IsUnflushed %s", id)
	defer func() {
		j.jServer.deferLog.LazyTrace(ctx, "jBServer: IsUnflushed %s done (err=%v)", id, err)
	}()

	if tlfJournal, ok := j.jServer.getTLFJournal(tlfID); ok {
		defer func() {
			err = translateToBlockServerError(err)
		}()
		return tlfJournal.isBlockUnflushed(id)
	}

	return j.BlockServer.IsUnflushed(ctx, tlfID, id)
}

func (j journalBlockServer) Shutdown(ctx context.Context) {
	j.jServer.shutdown(ctx)
	j.BlockServer.Shutdown(ctx)
}
