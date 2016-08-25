// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"io/ioutil"
	"os"
	"sync"

	"github.com/keybase/client/go/logger"

	"golang.org/x/net/context"
)

// JournalServerStatus represents the overall status of the
// JournalServer for display in diagnostics. It is suitable for
// encoding directly as JSON.
type JournalServerStatus struct {
	RootDir      string
	JournalCount int
}

// TODO: JournalServer isn't really a server, although it can create
// objects that act as servers. Rename to JournalManager.

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

	lock        sync.RWMutex
	tlfJournals map[TlfID]*tlfJournal
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
		tlfJournals:         make(map[TlfID]*tlfJournal),
	}
	return &jServer
}

func (j *JournalServer) getTLFJournal(tlfID TlfID) (*tlfJournal, bool) {
	j.lock.RLock()
	defer j.lock.RUnlock()
	tlfJournal, ok := j.tlfJournals[tlfID]
	return tlfJournal, ok
}

// EnableExistingJournals turns on the write journal for all TLFs with
// an existing journal. This must be the first thing done to a
// JournalServer. Any returned error is fatal, and means that the
// JournalServer must not be used.
func (j *JournalServer) EnableExistingJournals(
	ctx context.Context, bws TLFJournalBackgroundWorkStatus) (err error) {
	j.log.CDebugf(ctx, "Enabling existing journals (%s)", bws)
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

		err = j.Enable(ctx, tlfID, bws)
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
func (j *JournalServer) Enable(
	ctx context.Context, tlfID TlfID,
	bws TLFJournalBackgroundWorkStatus) (err error) {
	j.log.CDebugf(ctx, "Enabling journal for %s (%s)", tlfID, bws)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Error when enabling journal for %s: %v",
				tlfID, err)
		}
	}()

	j.lock.Lock()
	defer j.lock.Unlock()
	if _, ok := j.tlfJournals[tlfID]; ok {
		j.log.CDebugf(ctx, "Journal already enabled for %s", tlfID)
		return nil
	}

	tlfJournal, err := makeTLFJournal(ctx, j.dir, tlfID, j.config,
		j.delegateBlockServer, j.log, bws, nil)
	if err != nil {
		return err
	}

	j.tlfJournals[tlfID] = tlfJournal
	return nil
}

// PauseBackgroundWork pauses the background work goroutine, if it's
// not already paused.
func (j *JournalServer) PauseBackgroundWork(ctx context.Context, tlfID TlfID) {
	j.log.CDebugf(ctx, "Signaling pause for %s", tlfID)
	if tlfJournal, ok := j.getTLFJournal(tlfID); ok {
		tlfJournal.pauseBackgroundWork()
		return
	}

	j.log.CDebugf(ctx,
		"Could not find journal for %s; dropping pause signal",
		tlfID)
}

// ResumeBackgroundWork resumes the background work goroutine, if it's
// not already resumed.
func (j *JournalServer) ResumeBackgroundWork(ctx context.Context, tlfID TlfID) {
	j.log.CDebugf(ctx, "Signaling resume for %s", tlfID)
	if tlfJournal, ok := j.getTLFJournal(tlfID); ok {
		tlfJournal.resumeBackgroundWork()
		return
	}

	j.log.CDebugf(ctx,
		"Could not find journal for %s; dropping resume signal",
		tlfID)
}

// Flush flushes the write journal for the given TLF.
func (j *JournalServer) Flush(ctx context.Context, tlfID TlfID) (err error) {
	j.log.CDebugf(ctx, "Flushing journal for %s", tlfID)
	if tlfJournal, ok := j.getTLFJournal(tlfID); ok {
		return tlfJournal.flush(ctx)
	}

	j.log.CDebugf(ctx, "Journal not enabled for %s", tlfID)
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
	tlfJournal, ok := j.tlfJournals[tlfID]
	if !ok {
		j.log.CDebugf(ctx, "Journal already disabled for %s", tlfID)
		return nil
	}

	blockEntryCount, mdEntryCount, err := tlfJournal.getJournalEntryCounts()
	if err != nil {
		return err
	}

	if (blockEntryCount != 0) || (mdEntryCount != 0) {
		return fmt.Errorf(
			"Journal still has %d block entries and %d md entries",
			blockEntryCount, mdEntryCount)
	}

	tlfJournal.shutdown()

	j.log.CDebugf(ctx, "Disabled journal for %s", tlfID)

	delete(j.tlfJournals, tlfID)
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
		return len(j.tlfJournals)
	}()
	return JournalServerStatus{
		RootDir:      j.dir,
		JournalCount: journalCount,
	}
}

// JournalStatus returns a TLFServerStatus object for the given TLF
// suitable for diagnostics.
func (j *JournalServer) JournalStatus(tlfID TlfID) (TLFJournalStatus, error) {
	tlfJournal, ok := j.getTLFJournal(tlfID)
	if !ok {
		return TLFJournalStatus{},
			fmt.Errorf("Journal not enabled for %s", tlfID)
	}

	return tlfJournal.getJournalStatus()
}

func (j *JournalServer) shutdown() {
	j.log.CDebugf(context.Background(), "Shutting down journal")
	j.lock.Lock()
	defer j.lock.Unlock()
	for _, tlfJournal := range j.tlfJournals {
		tlfJournal.shutdown()
	}
}
