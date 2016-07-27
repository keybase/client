// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/logger"

	"golang.org/x/net/context"
)

type tlfJournalBundle struct {
	lock sync.RWMutex

	// TODO: Fill in with a block journal.
	mdJournal mdJournal
}

// JournalServer is the server that handles write journals. It
// interposes itself in front of BlockServer and MDOps. It uses MDOps
// instead of MDServer because it has to potentially modify the
// RootMetadata passed in, and by the time it hits MDServer it's
// already too late. However, this assumes that all MD ops go through
// MDOps.
type JournalServer struct {
	config Config

	log      logger.Logger
	deferLog logger.Logger

	dir string

	delegateBlockServer BlockServer
	delegateMDOps       MDOps

	lock       sync.RWMutex
	tlfBundles map[TlfID]*tlfJournalBundle
}

func makeJournalServer(
	config Config, log logger.Logger, dir string,
	bserver BlockServer, mdOps MDOps) *JournalServer {
	jServer := JournalServer{
		config:              config,
		log:                 log,
		deferLog:            log.CloneWithAddedDepth(1),
		dir:                 dir,
		delegateBlockServer: bserver,
		delegateMDOps:       mdOps,
		tlfBundles:          make(map[TlfID]*tlfJournalBundle),
	}
	return &jServer
}

func (j *JournalServer) getBundle(tlfID TlfID) (*tlfJournalBundle, bool) {
	j.lock.RLock()
	defer j.lock.RUnlock()
	bundle, ok := j.tlfBundles[tlfID]
	return bundle, ok
}

// Enable turns on the write journal for the given TLF.
func (j *JournalServer) Enable(tlfID TlfID) (err error) {
	j.log.Debug("Enabling journal for %s", tlfID)
	defer func() {
		if err != nil {
			j.deferLog.Debug(
				"Error when enabling journal for %s: %v",
				tlfID, err)
		}
	}()

	j.lock.Lock()
	defer j.lock.Unlock()
	_, ok := j.tlfBundles[tlfID]
	if ok {
		j.log.Debug("Journal already enabled for %s", tlfID)
		return nil
	}

	tlfDir := filepath.Join(j.dir, tlfID.String())
	j.log.Debug("Enabled journal for %s with path %s", tlfID, tlfDir)

	log := j.config.MakeLogger("")
	mdJournal := makeMDJournal(
		j.config.Codec(), j.config.Crypto(), tlfDir, log)

	j.tlfBundles[tlfID] = &tlfJournalBundle{
		mdJournal: mdJournal,
	}
	return nil
}

// Flush flushes the write journal for the given TLF.
func (j *JournalServer) Flush(ctx context.Context, tlfID TlfID) (err error) {
	j.log.Debug("Flushing journal for %s", tlfID)
	flushedBlockEntries := 0
	flushedMDEntries := 0
	defer func() {
		if err != nil {
			j.deferLog.Debug(
				"Flushed %d block entries and %d MD entries "+
					"for %s, but got error %v",
				flushedBlockEntries, flushedMDEntries,
				tlfID, err)
		}
	}()
	bundle, ok := j.getBundle(tlfID)
	if !ok {
		j.log.Debug("Journal not enabled for %s", tlfID)
		return nil
	}

	// TODO: Flush block journal.

	_, uid, err := j.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return err
	}

	key, err := j.config.KBPKI().GetCurrentVerifyingKey(ctx)
	if err != nil {
		return err
	}

	for {
		flushed, err := func() (bool, error) {
			bundle.lock.Lock()
			defer bundle.lock.Unlock()
			return bundle.mdJournal.flushOne(
				ctx, j.config.Crypto(), uid, key,
				j.config.MDServer())
		}()
		if err != nil {
			return err
		}
		if !flushed {
			break
		}
		flushedMDEntries++
	}

	j.log.Debug("Flushed %d block entries and %d MD entries for %s",
		flushedBlockEntries, flushedMDEntries, tlfID)

	return nil
}

// Disable turns off the write journal for the given TLF.
func (j *JournalServer) Disable(tlfID TlfID) (err error) {
	j.log.Debug("Disabling journal for %s", tlfID)
	defer func() {
		if err != nil {
			j.deferLog.Debug(
				"Error when disabling journal for %s: %v",
				tlfID, err)
		}
	}()

	j.lock.Lock()
	defer j.lock.Unlock()
	bundle, ok := j.tlfBundles[tlfID]
	if !ok {
		j.log.Debug("Journal already disabled for %s", tlfID)
		return nil
	}

	bundle.lock.RLock()
	defer bundle.lock.RUnlock()
	length, err := bundle.mdJournal.length()
	if err != nil {
		return err
	}

	if length != 0 {
		return fmt.Errorf("Journal still has %d entries", length)
	}

	j.log.Debug("Disabled journal for %s", tlfID)

	delete(j.tlfBundles, tlfID)
	return nil
}

func (j *JournalServer) blockServer() journalBlockServer {
	return journalBlockServer{j, j.delegateBlockServer}
}

func (j *JournalServer) mdOps() journalMDOps {
	return journalMDOps{j.delegateMDOps, j}
}

type journalBlockServer struct {
	jServer *JournalServer
	BlockServer
}

var _ BlockServer = journalBlockServer{}

func (j journalBlockServer) Put(
	ctx context.Context, id BlockID, tlfID TlfID, context BlockContext,
	buf []byte, serverHalf BlockCryptKeyServerHalf) error {
	_, ok := j.jServer.getBundle(tlfID)
	if ok {
		// TODO: Delegate to bundle's block journal.
	}

	return j.BlockServer.Put(ctx, id, tlfID, context, buf, serverHalf)
}

func (j journalBlockServer) AddBlockReference(
	ctx context.Context, id BlockID, tlfID TlfID,
	context BlockContext) error {
	_, ok := j.jServer.getBundle(tlfID)
	if ok {
		// TODO: Delegate to bundle's block journal.
	}

	return j.BlockServer.AddBlockReference(ctx, id, tlfID, context)
}

func (j journalBlockServer) RemoveBlockReference(
	ctx context.Context, tlfID TlfID,
	contexts map[BlockID][]BlockContext) (
	liveCounts map[BlockID]int, err error) {
	_, ok := j.jServer.getBundle(tlfID)
	if ok {
		// TODO: Delegate to bundle's block journal.
	}

	return j.BlockServer.RemoveBlockReference(ctx, tlfID, contexts)
}

func (j journalBlockServer) ArchiveBlockReferences(
	ctx context.Context, tlfID TlfID,
	contexts map[BlockID][]BlockContext) error {
	_, ok := j.jServer.getBundle(tlfID)
	if ok {
		// TODO: Delegate to bundle's block journal.
	}

	return j.BlockServer.ArchiveBlockReferences(ctx, tlfID, contexts)
}
