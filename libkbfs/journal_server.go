// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/logger"

	"golang.org/x/net/context"
)

type tlfJournalBundle struct {
	// Protects all operations on blockJournal and mdJournal.
	//
	// TODO: Consider using https://github.com/pkg/singlefile
	// instead.
	lock sync.RWMutex

	blockJournal *blockJournal
	mdJournal    *mdJournal
}

// JournalServerStatus represents the overall status of the
// JournalServer for display in diagnostics. It is suitable for
// encoding directly as JSON.
type JournalServerStatus struct {
	RootDir      string
	JournalCount int
}

// TLFJournalStatus represents the status of a TLF's journal for
// display in diagnostics. It is suitable for encoding directly as
// JSON.
type TLFJournalStatus struct {
	RevisionStart MetadataRevision
	RevisionEnd   MetadataRevision
	BlockOpCount  uint64
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

	delegateBlockCache  BlockCache
	delegateBlockServer BlockServer
	delegateMDOps       MDOps

	lock       sync.RWMutex
	tlfBundles map[TlfID]*tlfJournalBundle
}

func makeJournalServer(
	config Config, log logger.Logger, dir string,
	bcache BlockCache, bserver BlockServer, mdOps MDOps) *JournalServer {
	jServer := JournalServer{
		config:              config,
		log:                 log,
		deferLog:            log.CloneWithAddedDepth(1),
		dir:                 dir,
		delegateBlockCache:  bcache,
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

// EnableExistingJournals turns on the write journal for all TLFs with
// an existing journal. This must be the first thing done to a
// JournalServer. Any returned error is fatal, and means that the
// JournalServer must not be used.
func (j *JournalServer) EnableExistingJournals(
	ctx context.Context) (err error) {
	j.log.CDebugf(ctx, "Enabling existing journals")
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Error when enabling existing journals: %v",
				err)
		}
	}()

	fileInfos, err := ioutil.ReadDir(j.dir)
	if os.IsNotExist(err) {
		return nil
	} else if err != nil {
		return err
	}

	for _, fi := range fileInfos {
		name := fi.Name()
		if !fi.IsDir() {
			j.log.CDebugf(ctx, "Skipping file %q", name)
			continue
		}
		tlfID, err := ParseTlfID(fi.Name())
		if err != nil {
			j.log.CDebugf(ctx, "Skipping non-TLF dir %q", name)
			continue
		}

		err = j.Enable(ctx, tlfID)
		if err != nil {
			// Don't treat per-TLF errors as fatal.
			j.log.CWarningf(
				ctx, "Error when enabling existing journal for %s: %v",
				tlfID, err)
			continue
		}
	}

	return nil
}

// Enable turns on the write journal for the given TLF.
func (j *JournalServer) Enable(ctx context.Context, tlfID TlfID) (err error) {
	j.log.CDebugf(ctx, "Enabling journal for %s", tlfID)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Error when enabling journal for %s: %v",
				tlfID, err)
		}
	}()

	j.lock.Lock()
	defer j.lock.Unlock()
	_, ok := j.tlfBundles[tlfID]
	if ok {
		j.log.CDebugf(ctx, "Journal already enabled for %s", tlfID)
		return nil
	}

	tlfDir := filepath.Join(j.dir, tlfID.String())
	j.log.CDebugf(ctx, "Enabled journal for %s with path %s", tlfID, tlfDir)

	log := j.config.MakeLogger("")
	bundle := &tlfJournalBundle{}
	blockJournal, err := makeBlockJournal(
		ctx, j.config.Codec(), j.config.Crypto(), tlfDir, log)
	if err != nil {
		return err
	}

	bundle.blockJournal = blockJournal
	mdJournal, err := makeMDJournal(
		j.config.Codec(), j.config.Crypto(), tlfDir, log)
	if err != nil {
		return err
	}

	bundle.mdJournal = mdJournal
	j.tlfBundles[tlfID] = bundle
	return nil
}

// Flush flushes the write journal for the given TLF.
func (j *JournalServer) Flush(ctx context.Context, tlfID TlfID) (err error) {
	j.log.CDebugf(ctx, "Flushing journal for %s", tlfID)
	flushedBlockEntries := 0
	flushedMDEntries := 0
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Flushed %d block entries and %d MD entries "+
					"for %s, but got error %v",
				flushedBlockEntries, flushedMDEntries,
				tlfID, err)
		}
	}()
	bundle, ok := j.getBundle(tlfID)
	if !ok {
		j.log.CDebugf(ctx, "Journal not enabled for %s", tlfID)
		return nil
	}

	// TODO: Interleave block flushes with their related MD
	// flushes.

	// TODO: Parallelize block puts.

	for {
		flushed, err := func() (bool, error) {
			bundle.lock.Lock()
			defer bundle.lock.Unlock()
			return bundle.blockJournal.flushOne(
				ctx, j.delegateBlockServer, tlfID)
		}()
		if err != nil {
			return err
		}
		if !flushed {
			break
		}
		flushedBlockEntries++
	}

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

	j.log.CDebugf(ctx, "Flushed %d block entries and %d MD entries for %s",
		flushedBlockEntries, flushedMDEntries, tlfID)

	return nil
}

// Disable turns off the write journal for the given TLF.
func (j *JournalServer) Disable(ctx context.Context, tlfID TlfID) (err error) {
	j.log.CDebugf(ctx, "Disabling journal for %s", tlfID)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Error when disabling journal for %s: %v",
				tlfID, err)
		}
	}()

	j.lock.Lock()
	defer j.lock.Unlock()
	bundle, ok := j.tlfBundles[tlfID]
	if !ok {
		j.log.CDebugf(ctx, "Journal already disabled for %s", tlfID)
		return nil
	}

	bundle.lock.RLock()
	defer bundle.lock.RUnlock()
	length, err := bundle.blockJournal.length()
	if err != nil {
		return err
	}

	if length != 0 {
		return fmt.Errorf("Journal still has %d block entries", length)
	}

	length, err = bundle.mdJournal.length()
	if err != nil {
		return err
	}

	if length != 0 {
		return fmt.Errorf("Journal still has %d MD entries", length)
	}

	j.log.CDebugf(ctx, "Disabled journal for %s", tlfID)

	delete(j.tlfBundles, tlfID)
	return nil
}

func (j *JournalServer) blockCache() journalBlockCache {
	return journalBlockCache{j, j.delegateBlockCache}
}

func (j *JournalServer) blockServer() journalBlockServer {
	return journalBlockServer{j, j.delegateBlockServer, false}
}

func (j *JournalServer) mdOps() journalMDOps {
	return journalMDOps{j.delegateMDOps, j}
}

// Status returns a JournalServerStatus object suitable for
// diagnostics.
func (j *JournalServer) Status() JournalServerStatus {
	journalCount := func() int {
		j.lock.RLock()
		defer j.lock.RUnlock()
		return len(j.tlfBundles)
	}()
	return JournalServerStatus{
		RootDir:      j.dir,
		JournalCount: journalCount,
	}
}

// JournalStatus returns a TLFServerStatus object for the given TLF
// suitable for diagnostics.
func (j *JournalServer) JournalStatus(tlfID TlfID) (TLFJournalStatus, error) {
	bundle, ok := j.getBundle(tlfID)
	if !ok {
		return TLFJournalStatus{}, fmt.Errorf("Journal not enabled for %s", tlfID)
	}

	bundle.lock.RLock()
	defer bundle.lock.RUnlock()
	earliestRevision, err := bundle.mdJournal.readEarliestRevision()
	if err != nil {
		return TLFJournalStatus{}, err
	}
	latestRevision, err := bundle.mdJournal.readLatestRevision()
	if err != nil {
		return TLFJournalStatus{}, err
	}
	blockOpCount, err := bundle.blockJournal.length()
	if err != nil {
		return TLFJournalStatus{}, err
	}
	return TLFJournalStatus{
		RevisionStart: earliestRevision,
		RevisionEnd:   latestRevision,
		BlockOpCount:  blockOpCount,
	}, nil
}
