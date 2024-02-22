// Copyright 2024 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package simplefs

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

func loadArchiveStateFromJsonGz(ctx context.Context, simpleFS *SimpleFS, filePath string) (state *keybase1.SimpleFSArchiveState, err error) {
	f, err := os.Open(filePath)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "loadArchiveStateFromJsonGz: opening state file error: %v", err)
		return nil, err
	}
	defer f.Close()
	gzReader, err := gzip.NewReader(f)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "loadArchiveStateFromJsonGz: creating gzip reader error: %v", err)
		return nil, err
	}
	decoder := json.NewDecoder(gzReader)
	err = decoder.Decode(&state)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "loadArchiveStateFromJsonGz: decoding state file error: %v", err)
		return nil, err
	}
	return state, nil
}

func writeArchiveStateIntoJsonGz(ctx context.Context, simpleFS *SimpleFS, filePath string, s *keybase1.SimpleFSArchiveState) error {
	f, err := os.Create(filePath)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "writeArchiveStateIntoJsonGz: creating state file error: %v", err)
		return err
	}
	defer f.Close()

	gzWriter := gzip.NewWriter(f)
	defer gzWriter.Close()

	encoder := json.NewEncoder(gzWriter)
	err = encoder.Encode(s)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "writeArchiveStateIntoJsonGz: encoding state file error: %v", err)
		return err
	}

	return nil
}

type archiveManager struct {
	simpleFS *SimpleFS

	// Just use a regular mutex rather than a rw one so all writes to
	// persistent storage are synchronized.
	mu    sync.Mutex
	state *keybase1.SimpleFSArchiveState

	indexingWorkerSignal chan struct{}
	copyingWorkerSignal  chan struct{}
	zippingWorkerSignal  chan struct{}

	ctxCancel func()
}

func getStateFilePath(simpleFS *SimpleFS) string {
	uid := simpleFS.config.KbEnv().GetUsername()
	cacheDir := simpleFS.config.KbEnv().GetCacheDir()
	return filepath.Join(cacheDir, fmt.Sprintf("kbfs-archive-%s.json.gz", uid))
}

const archiveManagerCreationTimeout = 10 * time.Second

func (m *archiveManager) fluseStateFileLocked(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	err := writeArchiveStateIntoJsonGz(ctx, m.simpleFS, getStateFilePath(m.simpleFS), m.state)
	if err != nil {
		m.simpleFS.log.CErrorf(ctx,
			"archiveManager.fluseStateFileLocked: writing state file error: %v", err)
		return err
	}
	return nil
}

func (m *archiveManager) fluseStateFile(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.fluseStateFileLocked(ctx)
}

func (m *archiveManager) signal(ch chan struct{}) {
	select {
	case ch <- struct{}{}:
	default:
		// There's already a signal in the chan. Skipping this.
	}
}

func (m *archiveManager) shutdown(ctx context.Context) {
	// OK to cancel before fluseStateFileLocked because we'll pass in the
	// shutdown ctx ther.
	if m.ctxCancel != nil {
		m.ctxCancel()
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.fluseStateFileLocked(ctx)
}

func (m *archiveManager) startJob(ctx context.Context, job keybase1.SimpleFSArchiveJobDesc) error {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.startJob %#+v", job)
	defer m.simpleFS.log.CDebugf(ctx, "- archiveManager.startJob")

	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.state.Jobs[job.JobID]; ok {
		return errors.New("job ID already exists")
	}
	m.state.Jobs[job.JobID] = keybase1.SimpleFSArchiveJobState{
		Desc:  job,
		Phase: keybase1.SimpleFSArchiveJobPhase_Indexing,
	}
	m.state.LastUpdated = keybase1.ToTime(time.Now())
	m.signal(m.indexingWorkerSignal)
	return m.fluseStateFileLocked(ctx)
}

func (m *archiveManager) getCurrentState(ctx context.Context) keybase1.SimpleFSArchiveState {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.getCurrentState")
	defer m.simpleFS.log.CDebugf(ctx, "- archiveManager.getCurrentState")
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state.DeepCopy()
}

func (m *archiveManager) changeJobPhaseLocked(ctx context.Context,
	jobID string, newPhase keybase1.SimpleFSArchiveJobPhase) {
	copy := m.state.Jobs[jobID]
	copy.Phase = newPhase
	m.state.Jobs[jobID] = copy
}
func (m *archiveManager) changeJobPhase(ctx context.Context,
	jobID string, newPhase keybase1.SimpleFSArchiveJobPhase) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.changeJobPhaseLocked(ctx, jobID, newPhase)
}

func (m *archiveManager) startWorkerTask(ctx context.Context,
	eligiblePhase keybase1.SimpleFSArchiveJobPhase,
	newPhase keybase1.SimpleFSArchiveJobPhase) (jobID string, ok bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for jobID := range m.state.Jobs {
		if m.state.Jobs[jobID].Phase == eligiblePhase {
			m.changeJobPhaseLocked(ctx, jobID, newPhase)
			return jobID, true
		}
	}
	return "", false
}

func (m *archiveManager) doIndexing(ctx context.Context, jobID string) (err error) {
	m.simpleFS.log.CDebugf(ctx, "+ doIndexing %s", jobID)
	defer func() { m.simpleFS.log.CDebugf(ctx, "- doIndexing %s err: %v", jobID, err) }()

	jobDesc := func() keybase1.SimpleFSArchiveJobDesc {
		m.mu.Lock()
		defer m.mu.Unlock()
		return m.state.Jobs[jobID].Desc
	}()
	opid, err := m.simpleFS.SimpleFSMakeOpid(ctx)
	if err != nil {
		return err
	}
	defer m.simpleFS.SimpleFSClose(ctx, opid)
	filter := keybase1.ListFilter_NO_FILTER
	err = m.simpleFS.SimpleFSListRecursive(ctx, keybase1.SimpleFSListRecursiveArg{
		OpID:   opid,
		Path:   keybase1.NewPathWithKbfsArchived(jobDesc.KbfsPathWithRevision),
		Filter: filter,
	})
	err = m.simpleFS.SimpleFSWait(ctx, opid)
	if err != nil {
		return err
	}

	manifest := make(map[string]keybase1.SimpleFSArchiveFile)
	gotList := false
loopReadList:
	for {
		listResult, err := m.simpleFS.SimpleFSReadList(ctx, opid)
		if err != nil || len(listResult.Entries) == 0 {
			if gotList {
				break loopReadList
			}
		}
		gotList = true

		for _, e := range listResult.Entries {
			manifest[e.Name] = keybase1.SimpleFSArchiveFile{
				State: keybase1.SimpleFSFileArchiveState_ToDo,
			}
		}
	}

	func() {
		m.mu.Lock()
		defer m.mu.Unlock()

		jobCopy := m.state.Jobs[jobID]
		jobCopy.Manifest = manifest
		m.state.Jobs[jobID] = jobCopy
	}()
	return nil
}

func (m *archiveManager) indexingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.indexingWorkerSignal:
		}

		jobID, ok := m.startWorkerTask(ctx,
			keybase1.SimpleFSArchiveJobPhase_Queued,
			keybase1.SimpleFSArchiveJobPhase_Indexing)

		if !ok {
			continue
		}
		// We got a task. Put another token into the signal channel so we
		// check again on the next iteration.
		m.signal(m.indexingWorkerSignal)

		m.simpleFS.log.CDebugf(ctx, "indexing %s", jobID)

		err := m.doIndexing(ctx, jobID)
		switch err {
		case nil:
			m.simpleFS.log.CDebugf(ctx, "indexing done on job %s", jobID)
			m.changeJobPhase(ctx, jobID, keybase1.SimpleFSArchiveJobPhase_Indexed)
		default:
			m.simpleFS.log.CErrorf(ctx, "indexing error on job %s", jobID)
			m.changeJobPhase(ctx, jobID, keybase1.SimpleFSArchiveJobPhase_Queued)
		}

		m.fluseStateFile(ctx)
		m.signal(m.copyingWorkerSignal) // Done copying! Notify the copying worker.
	}
}

func (m *archiveManager) copyingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.copyingWorkerSignal:
		}

		jobID, ok := m.startWorkerTask(ctx,
			keybase1.SimpleFSArchiveJobPhase_Indexed,
			keybase1.SimpleFSArchiveJobPhase_Copying)

		if !ok {
			continue
		}
		// We got a task. Put another token into the signal channel so we
		// check again on the next iteration.
		m.signal(m.copyingWorkerSignal)

		_ = jobID
		// TODO do work

		m.fluseStateFile(ctx)
		m.signal(m.zippingWorkerSignal) // Done copying! Notify the zipping worker.
	}
}

func (m *archiveManager) zippingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.zippingWorkerSignal:
		}

		jobID, ok := m.startWorkerTask(ctx,
			keybase1.SimpleFSArchiveJobPhase_Copied,
			keybase1.SimpleFSArchiveJobPhase_Zipping)

		if !ok {
			continue
		}
		// We got a task. Put another token into the signal channel so we
		// check again on the next iteration.
		m.signal(m.zippingWorkerSignal)

		_ = jobID
		// TODO do work

		m.fluseStateFile(ctx)
	}
}

func (m *archiveManager) start() {
	ctx := context.Background()
	ctx, m.ctxCancel = context.WithCancel(ctx)
	go m.indexingWorker(m.simpleFS.makeContext(ctx))
	go m.copyingWorker(m.simpleFS.makeContext(ctx))
	go m.zippingWorker(m.simpleFS.makeContext(ctx))
	m.signal(m.indexingWorkerSignal)
	m.signal(m.copyingWorkerSignal)
	m.signal(m.zippingWorkerSignal)
}

func (m *archiveManager) resetInterruptedPhases(ctx context.Context) {
	// We don't resume indexing and zipping work, so just reset them here.
	// Copying is resumable but we have per file state tracking so reset the
	// phase here as well.
	for jobID := range m.state.Jobs {
		switch m.state.Jobs[jobID].Phase {
		case keybase1.SimpleFSArchiveJobPhase_Indexing:
			m.simpleFS.log.CDebugf(ctx, "resetting %s phase from %s to %s", jobID,
				keybase1.SimpleFSArchiveJobPhase_Indexing,
				keybase1.SimpleFSArchiveJobPhase_Queued)
			copy := m.state.Jobs[jobID]
			copy.Phase = keybase1.SimpleFSArchiveJobPhase_Queued
			m.state.Jobs[jobID] = copy
		case keybase1.SimpleFSArchiveJobPhase_Copying:
			m.simpleFS.log.CDebugf(ctx, "resetting %s phase from %s to %s", jobID,
				keybase1.SimpleFSArchiveJobPhase_Copying,
				keybase1.SimpleFSArchiveJobPhase_Indexed)
			copy := m.state.Jobs[jobID]
			copy.Phase = keybase1.SimpleFSArchiveJobPhase_Indexed
			m.state.Jobs[jobID] = copy
		case keybase1.SimpleFSArchiveJobPhase_Zipping:
			m.simpleFS.log.CDebugf(ctx, "resetting %s phase from %s to %s", jobID,
				keybase1.SimpleFSArchiveJobPhase_Zipping,
				keybase1.SimpleFSArchiveJobPhase_Copied)
			copy := m.state.Jobs[jobID]
			copy.Phase = keybase1.SimpleFSArchiveJobPhase_Copied
			m.state.Jobs[jobID] = copy
		}
	}
}

func newArchiveManager(simpleFS *SimpleFS) (m *archiveManager, err error) {
	ctx := context.Background()
	simpleFS.log.CDebugf(ctx, "+ newArchiveManager")
	defer simpleFS.log.CDebugf(ctx, "- newArchiveManager")
	m = &archiveManager{
		simpleFS:             simpleFS,
		indexingWorkerSignal: make(chan struct{}, 1),
		copyingWorkerSignal:  make(chan struct{}, 1),
		zippingWorkerSignal:  make(chan struct{}, 1),
	}
	stateFilePath := getStateFilePath(simpleFS)
	m.state, err = loadArchiveStateFromJsonGz(ctx, simpleFS, stateFilePath)
	switch err {
	case nil:
		if m.state.Jobs == nil {
			m.state.Jobs = make(map[string]keybase1.SimpleFSArchiveJobState)
		}
		m.resetInterruptedPhases(ctx)
	default:
		simpleFS.log.CErrorf(ctx, "loadArchiveStateFromJsonGz error ( %v ). Creating a new state.", err)
		m.state = &keybase1.SimpleFSArchiveState{
			Jobs: make(map[string]keybase1.SimpleFSArchiveJobState),
		}
		err = writeArchiveStateIntoJsonGz(ctx, simpleFS, stateFilePath, m.state)
		if err != nil {
			simpleFS.log.CErrorf(ctx, "newArchiveManager: creating state file error: %v", err)
			return nil, err
		}
	}
	m.start()
	return m, nil
}
