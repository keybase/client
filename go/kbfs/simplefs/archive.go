// Copyright 2024 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package simplefs

import (
	"compress/gzip"
	"encoding/json"
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

	mu    sync.RWMutex
	state *keybase1.SimpleFSArchiveState

	indexingWorkerSignal chan struct{}
	copyingWorkerSignal  chan struct{}
	zippingWorkerSignal  chan struct{}

	shutdown func()
}

func getStateFilePath(simpleFS *SimpleFS) string {
	cacheDir := simpleFS.config.KbEnv().GetCacheDir()
	return filepath.Join(cacheDir, "kbfs.archive.json.gz")
}

const archiveManagerCreationTimeout = 10 * time.Second

func (m *archiveManager) fluseStateFileLocked(ctx context.Context) error {
	err := writeArchiveStateIntoJsonGz(ctx, m.simpleFS, getStateFilePath(m.simpleFS), m.state)
	if err != nil {
		m.simpleFS.log.CErrorf(ctx,
			"archiveManager.fluseStateFileLocked: writing state file error: %v", err)
		return err
	}
	return nil
}

func (m *archiveManager) signal(ch chan struct{}) {
	select {
	case ch <- struct{}{}:
	default:
		// There's already a signal in the chan. Skipping this.
	}
}

func (m *archiveManager) startJob(ctx context.Context, job keybase1.SimpleFSArchiveJobDesc) error {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.startJob %#+v", job)
	m.simpleFS.log.CDebugf(ctx, "- archiveManager.startJob")

	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.state.Jobs[job.JobID]; ok {
		return errors.New("job ID already exists")
	}
	m.state.Jobs[job.JobID] = keybase1.SimpleFSArchiveJobState{
		Desc: job,
	}
	m.state.LastUpdated = keybase1.ToTime(time.Now())
	m.state.Phase = keybase1.SimpleFSArchivePhase_Indexing
	m.signal(m.indexingWorkerSignal)
	return m.fluseStateFileLocked(ctx)
}

func (m *archiveManager) getCurrentState(ctx context.Context) keybase1.SimpleFSArchiveState {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.getCurrentState")
	m.simpleFS.log.CDebugf(ctx, "- archiveManager.getCurrentState")
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state.DeepCopy()
}

func (m *archiveManager) indexingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.indexingWorkerSignal:
		}
	}
}

func (m *archiveManager) copyingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.copyingWorkerSignal:
		}
	}
}

func (m *archiveManager) zippingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.zippingWorkerSignal:
		}
	}
}

func (m *archiveManager) start() {
	ctx := context.Background()
	ctx, m.shutdown = context.WithCancel(ctx)
	go m.indexingWorker(m.simpleFS.makeContext(ctx))
	go m.copyingWorker(m.simpleFS.makeContext(ctx))
	go m.zippingWorker(m.simpleFS.makeContext(ctx))
}

func newArchiveManager(simpleFS *SimpleFS) (m *archiveManager, err error) {
	ctx := context.Background()
	m = &archiveManager{
		simpleFS:             simpleFS,
		indexingWorkerSignal: make(chan struct{}, 1),
		copyingWorkerSignal:  make(chan struct{}, 1),
		zippingWorkerSignal:  make(chan struct{}, 1),
	}
	stateFilePath := getStateFilePath(simpleFS)
	m.state, err = loadArchiveStateFromJsonGz(ctx, simpleFS, stateFilePath)
	if err == nil {
		if m.state.Jobs == nil {
			m.state.Jobs = make(map[string]keybase1.SimpleFSArchiveJobState)
		}
		return m, nil
	}
	simpleFS.log.CErrorf(ctx, "loadArchiveStateFromJsonGz error ( %v ). Creating a new state.", err)
	m.state = &keybase1.SimpleFSArchiveState{
		Jobs: make(map[string]keybase1.SimpleFSArchiveJobState),
	}
	err = writeArchiveStateIntoJsonGz(ctx, simpleFS, stateFilePath, m.state)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "newArchiveManager: creating state file error: %v", err)
		return nil, err
	}
	m.start()
	return m, nil
}
