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
}

func getStateFilePath(simpleFS *SimpleFS) string {
	cacheDir := simpleFS.config.KbEnv().GetCacheDir()
	return filepath.Join(cacheDir, "kbfs.archive.json.gz")
}

const archiveManagerCreationTimeout = 10 * time.Second

func newArchiveManager(simpleFS *SimpleFS) (m *archiveManager, err error) {
	ctx := context.Background()
	m = &archiveManager{simpleFS: simpleFS}
	stateFilePath := getStateFilePath(simpleFS)
	m.state, err = loadArchiveStateFromJsonGz(ctx, simpleFS, stateFilePath)
	if err == nil {
		if m.state.Jobs == nil {
			m.state.Jobs = make(map[string]keybase1.SimpleFSArchiveJobState)
		}
		return m, nil
	}
	simpleFS.log.CErrorf(ctx, "loadArchiveStateFromJsonGz error ( %v ). Creating a new state.", err)
	m.state = &keybase1.SimpleFSArchiveState{Jobs: make(map[string]keybase1.SimpleFSArchiveJobState)}
	err = writeArchiveStateIntoJsonGz(ctx, simpleFS, stateFilePath, m.state)
	if err != nil {
		simpleFS.log.CErrorf(ctx, "newArchiveManager: creating state file error: %v", err)
		return nil, err
	}
	return m, nil

}

func (m *archiveManager) fluseStateFileLocked(ctx context.Context) error {
	err := writeArchiveStateIntoJsonGz(ctx, m.simpleFS, getStateFilePath(m.simpleFS), m.state)
	if err != nil {
		m.simpleFS.log.CErrorf(ctx, "archiveManager.start: writing state file error: %v", err)
		return err
	}
	return nil
}

func (m *archiveManager) start(ctx context.Context, job keybase1.SimpleFSArchiveJobDesc) error {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.start %#+v", job)
	m.simpleFS.log.CDebugf(ctx, "- archiveManager.start")

	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.state.Jobs[job.JobID]; ok {
		return errors.New("job ID already exists")
	}
	m.state.Jobs[job.JobID] = keybase1.SimpleFSArchiveJobState{
		Desc: job,
	}
	m.state.LastUpdated = keybase1.ToTime(time.Now())
	return m.fluseStateFileLocked(ctx)
}

func (m *archiveManager) getCurrentState(ctx context.Context) *keybase1.SimpleFSArchiveState {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.getCurrentState")
	m.simpleFS.log.CDebugf(ctx, "- archiveManager.getCurrentState")
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.state
}
