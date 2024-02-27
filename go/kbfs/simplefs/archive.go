// Copyright 2024 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package simplefs

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
	"gopkg.in/src-d/go-billy.v4"
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
	mu               sync.Mutex
	state            *keybase1.SimpleFSArchiveState
	jobCtxCancellers map[string]func()

	indexingWorkerSignal chan struct{}
	copyingWorkerSignal  chan struct{}
	zippingWorkerSignal  chan struct{}

	ctxCancel func()
}

func getStateFilePath(simpleFS *SimpleFS) string {
	username := simpleFS.config.KbEnv().GetUsername()
	cacheDir := simpleFS.config.KbEnv().GetCacheDir()
	return filepath.Join(cacheDir, fmt.Sprintf("kbfs-archive-%s.json.gz", username))
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
		Phase: keybase1.SimpleFSArchiveJobPhase_Queued,
	}
	m.state.LastUpdated = keybase1.ToTime(time.Now())
	m.signal(m.indexingWorkerSignal)
	return m.fluseStateFileLocked(ctx)
}

func (m *archiveManager) cancelOrDismissJob(ctx context.Context,
	jobID string) (err error) {
	m.simpleFS.log.CDebugf(ctx, "+ archiveManager.cancelOrDismissJob")
	defer m.simpleFS.log.CDebugf(ctx, "- archiveManager.cancelOrDismissJob %s", jobID)
	m.mu.Lock()
	defer m.mu.Unlock()

	if cancel, ok := m.jobCtxCancellers[jobID]; ok {
		cancel()
		delete(m.jobCtxCancellers, jobID)
	}

	if _, ok := m.state.Jobs[jobID]; !ok {
		return errors.New("job not found")
	}
	delete(m.state.Jobs, jobID)

	return nil
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
	copy, ok := m.state.Jobs[jobID]
	if !ok {
		m.simpleFS.log.CWarningf(ctx, "job %s not found. it might have been canceled", jobID)
		return
	}
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
	newPhase keybase1.SimpleFSArchiveJobPhase) (jobID string, jobCtx context.Context, ok bool) {
	jobCtx, cancel := context.WithCancel(ctx)
	m.mu.Lock()
	defer m.mu.Unlock()
	for jobID := range m.state.Jobs {
		if m.state.Jobs[jobID].Phase == eligiblePhase {
			m.changeJobPhaseLocked(ctx, jobID, newPhase)
			m.jobCtxCancellers[jobID] = cancel
			return jobID, jobCtx, true
		}
	}
	return "", nil, false
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
				State:      keybase1.SimpleFSFileArchiveState_ToDo,
				DirentType: e.DirentType,
			}
		}
	}

	func() {
		m.mu.Lock()
		defer m.mu.Unlock()

		jobCopy, ok := m.state.Jobs[jobID]
		if !ok {
			m.simpleFS.log.CWarningf(ctx, "job %s not found. it might have been canceled", jobID)
			return
		}
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

		jobID, jobCtx, ok := m.startWorkerTask(ctx,
			keybase1.SimpleFSArchiveJobPhase_Queued,
			keybase1.SimpleFSArchiveJobPhase_Indexing)

		if !ok {
			continue
		}
		// We got a task. Put another token into the signal channel so we
		// check again on the next iteration.
		m.signal(m.indexingWorkerSignal)

		m.simpleFS.log.CDebugf(ctx, "indexing: %s", jobID)

		err := m.doIndexing(jobCtx, jobID)
		switch err {
		case nil:
			m.simpleFS.log.CDebugf(jobCtx, "indexing done on job %s", jobID)
			m.changeJobPhase(jobCtx, jobID, keybase1.SimpleFSArchiveJobPhase_Indexed)
		default:
			m.simpleFS.log.CErrorf(jobCtx, "indexing error on job %s: %v", jobID, err)
			m.changeJobPhase(jobCtx, jobID, keybase1.SimpleFSArchiveJobPhase_Queued)
		}

		m.fluseStateFile(ctx)
		m.signal(m.copyingWorkerSignal) // Done copying! Notify the copying worker.
	}
}

func (m *archiveManager) copyFile(ctx context.Context,
	srcDirFS billy.Filesystem, entryPathWithinJob string,
	localPath string, srcSeekOffset int64, mode os.FileMode) error {
	src, err := srcDirFS.Open(entryPathWithinJob)
	if err != nil {
		return fmt.Errorf("srcDirFS.Open(%s) error: %v", entryPathWithinJob, err)
	}
	defer src.Close()

	dst, err := os.OpenFile(localPath, os.O_APPEND|os.O_WRONLY|os.O_CREATE, mode)
	if err != nil {
		return fmt.Errorf("os.OpenFile(%s) error: %v", localPath, err)
	}
	defer src.Close()

	if srcSeekOffset != 0 {
		_, err := src.Seek(srcSeekOffset, io.SeekStart)
		if err != nil {
			return fmt.Errorf("[%s] src.Seek error: %v", entryPathWithinJob, err)
		}
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		_, err := io.CopyN(dst, src, 64*1024)
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return fmt.Errorf("[%s] io.Copy error: %v", entryPathWithinJob, err)
		}
	}
}

func (m *archiveManager) doCopying(ctx context.Context, jobID string) (err error) {
	m.simpleFS.log.CDebugf(ctx, "+ doCopying %s", jobID)
	defer func() { m.simpleFS.log.CDebugf(ctx, "- doCopying %s err: %v", jobID, err) }()

	desc, manifest := func() (keybase1.SimpleFSArchiveJobDesc, map[string]keybase1.SimpleFSArchiveFile) {
		m.mu.Lock()
		defer m.mu.Unlock()
		manifest := make(map[string]keybase1.SimpleFSArchiveFile)
		for k, v := range m.state.Jobs[jobID].Manifest {
			manifest[k] = v.DeepCopy()
		}
		return m.state.Jobs[jobID].Desc, manifest
	}()

	updateManifest := func(manifest map[string]keybase1.SimpleFSArchiveFile) {
		m.mu.Lock()
		defer m.mu.Unlock()
		// Can override directly since only one worker can work on a give job at a time.
		job := m.state.Jobs[jobID]
		for k, v := range manifest {
			job.Manifest[k] = v.DeepCopy()
		}
		m.state.Jobs[jobID] = job
	}

	srcContainingDirFS, finalElem, err := m.simpleFS.getFSIfExists(ctx,
		keybase1.NewPathWithKbfsArchived(desc.KbfsPathWithRevision))
	if err != nil {
		return fmt.Errorf("getFSIfExists error: %v", err)
	}
	srcDirFS, err := srcContainingDirFS.Chroot(finalElem)
	if err != nil {
		return fmt.Errorf("srcContainingDirFS.Chroot error: %v", err)
	}
	dstBase := filepath.Join(desc.StagingPath, desc.TargetName)

	entryPaths := make([]string, 0, len(manifest))
	for entryPathWithinJob := range manifest {
		entryPaths = append(entryPaths, entryPathWithinJob)
	}
	sort.Strings(entryPaths)

	for _, entryPathWithinJob := range entryPaths {
		entry := manifest[entryPathWithinJob]
		entry.State = keybase1.SimpleFSFileArchiveState_InProgress
		manifest[entryPathWithinJob] = entry
		updateManifest(manifest)

		localPath := filepath.Join(dstBase, entryPathWithinJob)
		srcFI, err := srcDirFS.Stat(entryPathWithinJob)
		if err != nil {
			return fmt.Errorf("srcDirFS.Stat(%s) error: %v", entryPathWithinJob, err)
		}
		switch {
		case srcFI.IsDir():
			os.MkdirAll(localPath, 0755)
			if err != nil {
				return fmt.Errorf("os.MkdirAll(%s) error: %v", localPath, err)
			}
			os.Chtimes(localPath, time.Time{}, srcFI.ModTime())
			if err != nil {
				return fmt.Errorf("os.Chtimes(%s) error: %v", localPath, err)
			}
			entry.State = keybase1.SimpleFSFileArchiveState_Complete
			manifest[entryPathWithinJob] = entry
		case srcFI.Mode()&os.ModeSymlink != 0: // symlink
			panic("todo")
		default:
			os.MkdirAll(filepath.Dir(localPath), 0755)
			if err != nil {
				return fmt.Errorf("os.MkdirAll(filepath.Dir(%s)) error: %v", localPath, err)
			}

			var mode os.FileMode = 0644
			if srcFI.Mode()&0100 != 0 {
				mode = 0755
			}

			seek := int64(0)

			dstFI, err := os.Stat(localPath)
			switch {
			case os.IsNotExist(err): // simple copy from the start of file
			case err == nil: // continue from a previously interrupted copy
				seek = dstFI.Size()
			default:
				return fmt.Errorf("os.Stat(%s) error: %v", localPath, err)
			}

			err = m.copyFile(ctx, srcDirFS, entryPathWithinJob, localPath, seek, mode)
			if err != nil {
				return err
			}
		}
		updateManifest(manifest)
	}

	return nil
}

func (m *archiveManager) copyingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.copyingWorkerSignal:
		}

		jobID, jobCtx, ok := m.startWorkerTask(ctx,
			keybase1.SimpleFSArchiveJobPhase_Indexed,
			keybase1.SimpleFSArchiveJobPhase_Copying)

		if !ok {
			continue
		}
		// We got a task. Put another token into the signal channel so we
		// check again on the next iteration.
		m.signal(m.copyingWorkerSignal)

		_, _ = jobID, jobCtx

		m.simpleFS.log.CDebugf(ctx, "copying: %s", jobID)

		err := m.doCopying(jobCtx, jobID)
		switch err {
		case nil:
			m.simpleFS.log.CDebugf(jobCtx, "copying done on job %s", jobID)
			m.changeJobPhase(jobCtx, jobID, keybase1.SimpleFSArchiveJobPhase_Copied)
		default:
			m.simpleFS.log.CErrorf(jobCtx, "copying error on job %s: %v", jobID, err)
			m.changeJobPhase(jobCtx, jobID, keybase1.SimpleFSArchiveJobPhase_Indexed)
		}

		m.fluseStateFile(ctx)
		m.signal(m.zippingWorkerSignal) // Done copying! Notify the zipping worker.
	}
}

func (m *archiveManager) doZipping(ctx context.Context, jobID string) (err error) {
	return errors.New("not implemented")
}

func (m *archiveManager) zippingWorker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-m.zippingWorkerSignal:
		}

		jobID, jobCtx, ok := m.startWorkerTask(ctx,
			keybase1.SimpleFSArchiveJobPhase_Copied,
			keybase1.SimpleFSArchiveJobPhase_Zipping)

		if !ok {
			continue
		}
		// We got a task. Put another token into the signal channel so we
		// check again on the next iteration.
		m.signal(m.zippingWorkerSignal)

		_, _ = jobID, jobCtx

		m.simpleFS.log.CDebugf(ctx, "zipping: %s", jobID)

		err := m.doZipping(jobCtx, jobID)
		switch err {
		case nil:
			m.simpleFS.log.CDebugf(jobCtx, "zipping done on job %s", jobID)
			m.changeJobPhase(jobCtx, jobID, keybase1.SimpleFSArchiveJobPhase_Done)
		default:
			m.simpleFS.log.CErrorf(jobCtx, "zipping error on job %s: %v", jobID, err)
			m.changeJobPhase(jobCtx, jobID, keybase1.SimpleFSArchiveJobPhase_Copied)
		}

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
		jobCtxCancellers:     make(map[string]func()),
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
