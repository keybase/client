// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"

	"golang.org/x/net/context"
)

type journalServerConfig struct {
	EnableAuto bool
}

// JournalServerStatus represents the overall status of the
// JournalServer for display in diagnostics. It is suitable for
// encoding directly as JSON.
type JournalServerStatus struct {
	RootDir             string
	Version             int
	CurrentUID          keybase1.UID
	CurrentVerifyingKey kbfscrypto.VerifyingKey
	EnableAuto          bool
	JournalCount        int
	UnflushedBytes      int64 // (signed because os.FileInfo.Size() is signed)
	UnflushedPaths      []string
}

// branchChangeListener describes a caller that will get updates via
// the onTLFBranchChange method call when the journal branch changes
// for the given TlfID.  If a new branch has been created, the given
// BranchID will be something other than NullBranchID.  If the current
// branch was pruned, it will be NullBranchID.  If the implementer
// will be accessing the journal, it must do so from another goroutine
// to avoid deadlocks.
type branchChangeListener interface {
	onTLFBranchChange(tlf.ID, BranchID)
}

// mdFlushListener describes a caller that will ge updates via the
// onMDFlush metod when an MD is flushed.  If the implementer will be
// accessing the journal, it must do so from another goroutine to
// avoid deadlocks.
type mdFlushListener interface {
	onMDFlush(tlf.ID, BranchID, MetadataRevision)
}

// TODO: JournalServer isn't really a server, although it can create
// objects that act as servers. Rename to JournalManager.

// JournalServer is the server that handles write journals. It
// interposes itself in front of BlockServer and MDOps. It uses MDOps
// instead of MDServer because it has to potentially modify the
// RootMetadata passed in, and by the time it hits MDServer it's
// already too late. However, this assumes that all MD ops go through
// MDOps.
//
// The maximum number of characters added to the root dir by a journal
// server journal is 116: 59 for the TLF journal, and 57 for
// everything else.
//
//   /v1/de...-...(53 characters total)...ff(/tlf journal)
type JournalServer struct {
	config Config

	log      logger.Logger
	deferLog logger.Logger

	dir string

	delegateBlockCache      BlockCache
	delegateDirtyBlockCache DirtyBlockCache
	delegateBlockServer     BlockServer
	delegateMDOps           MDOps
	onBranchChange          branchChangeListener
	onMDFlush               mdFlushListener

	// Protects all fields below.
	lock                sync.RWMutex
	currentUID          keybase1.UID
	currentVerifyingKey kbfscrypto.VerifyingKey
	tlfJournals         map[tlf.ID]*tlfJournal
	dirtyOps            uint
	dirtyOpsDone        *sync.Cond
	serverConfig        journalServerConfig
}

func makeJournalServer(
	config Config, log logger.Logger, dir string,
	bcache BlockCache, dirtyBcache DirtyBlockCache, bserver BlockServer,
	mdOps MDOps, onBranchChange branchChangeListener,
	onMDFlush mdFlushListener) *JournalServer {
	jServer := JournalServer{
		config:                  config,
		log:                     log,
		deferLog:                log.CloneWithAddedDepth(1),
		dir:                     dir,
		delegateBlockCache:      bcache,
		delegateDirtyBlockCache: dirtyBcache,
		delegateBlockServer:     bserver,
		delegateMDOps:           mdOps,
		onBranchChange:          onBranchChange,
		onMDFlush:               onMDFlush,
		tlfJournals:             make(map[tlf.ID]*tlfJournal),
	}
	jServer.dirtyOpsDone = sync.NewCond(&jServer.lock)
	return &jServer
}

func (j *JournalServer) rootPath() string {
	return filepath.Join(j.dir, "v1")
}

func (j *JournalServer) configPath() string {
	return filepath.Join(j.rootPath(), "config.json")
}

func (j *JournalServer) readConfig() error {
	configJSON, err := ioutil.ReadFile(j.configPath())
	if err != nil {
		return err
	}

	err = json.Unmarshal(configJSON, &j.serverConfig)
	if err != nil {
		return err
	}
	return nil
}

func (j *JournalServer) writeConfig() error {
	configJSON, err := json.Marshal(j.serverConfig)
	if err != nil {
		return err
	}

	err = os.MkdirAll(j.rootPath(), 0700)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(j.configPath(), configJSON, 0600)
}

func (j *JournalServer) tlfJournalPathLocked(tlfID tlf.ID) string {
	if j.currentVerifyingKey == (kbfscrypto.VerifyingKey{}) {
		panic("currentVerifyingKey is zero")
	}

	// We need to generate a unique path for each (UID, device,
	// TLF) tuple. Verifying keys (which are unique to a device)
	// are globally unique, so no need to have the uid in the
	// path. Furthermore, everything after the first two bytes
	// (four characters) is randomly generated, so taking the
	// first 36 characters of the verifying key gives us 16 random
	// bytes (since the first two bytes encode version/type) or
	// 128 random bits, which means that the expected number of
	// devices generated before getting a collision in the first
	// part of the path is 2^64 (see
	// https://en.wikipedia.org/wiki/Birthday_problem#Cast_as_a_collision_problem
	// ).
	//
	// By similar reasoning, for a single device, taking the first
	// 16 characters of the TLF ID gives us 64 random bits, which
	// means that the expected number of TLFs associated to that
	// device before getting a collision in the second part of the
	// path is 2^32.
	shortDeviceIDStr := j.currentVerifyingKey.String()[:36]
	shortTlfIDStr := tlfID.String()[:16]
	dir := fmt.Sprintf("%s-%s", shortDeviceIDStr, shortTlfIDStr)
	return filepath.Join(j.rootPath(), dir)
}

func (j *JournalServer) getTLFJournal(tlfID tlf.ID) (*tlfJournal, bool) {
	getJournalFn := func() (*tlfJournal, bool, bool) {
		j.lock.RLock()
		defer j.lock.RUnlock()
		tlfJournal, ok := j.tlfJournals[tlfID]
		return tlfJournal, j.serverConfig.EnableAuto, ok
	}
	tlfJournal, enableAuto, ok := getJournalFn()
	if !ok && enableAuto {
		ctx := context.TODO() // plumb through from callers
		j.log.CDebugf(ctx, "Enabling a new journal for %s", tlfID)
		err := j.Enable(ctx, tlfID, TLFJournalBackgroundWorkEnabled)
		if err != nil {
			j.log.CWarningf(ctx, "Couldn't enable journal for %s", tlfID)
			return nil, false
		}
		tlfJournal, _, ok = getJournalFn()
	}
	return tlfJournal, ok
}

func (j *JournalServer) hasTLFJournal(tlfID tlf.ID) bool {
	j.lock.RLock()
	defer j.lock.RUnlock()
	_, ok := j.tlfJournals[tlfID]
	return ok
}

// EnableExistingJournals turns on the write journal for all TLFs for
// the given (UID, device) tuple (with the device identified by its
// verifying key) with an existing journal. Any returned error means
// that the JournalServer remains in the same state as it was before.
//
// Once this is called, this must not be called again until
// shutdownExistingJournals is called.
func (j *JournalServer) EnableExistingJournals(
	ctx context.Context, currentUID keybase1.UID,
	currentVerifyingKey kbfscrypto.VerifyingKey,
	bws TLFJournalBackgroundWorkStatus) (err error) {
	j.log.CDebugf(ctx, "Enabling existing journals (%s)", bws)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Error when enabling existing journals: %v",
				err)
		}
	}()

	j.lock.Lock()
	defer j.lock.Unlock()

	err = j.readConfig()
	switch {
	case os.IsNotExist(err):
		// Config file doesn't exist, so write it.
		err := j.writeConfig()
		if err != nil {
			return err
		}
	case err != nil:
		return err
	}

	if j.currentUID != keybase1.UID("") {
		return fmt.Errorf("Trying to set current UID from %s to %s",
			j.currentUID, currentUID)
	}
	if j.currentVerifyingKey != (kbfscrypto.VerifyingKey{}) {
		return fmt.Errorf(
			"Trying to set current verifying key from %s to %s",
			j.currentVerifyingKey, currentVerifyingKey)
	}

	if currentUID == keybase1.UID("") {
		return errors.New("Current UID is empty")
	}
	if currentVerifyingKey == (kbfscrypto.VerifyingKey{}) {
		return errors.New("Current verifying key is empty")
	}

	// Need to set it here since tlfJournalPathLocked and
	// enableLocked depend on it.
	j.currentUID = currentUID
	j.currentVerifyingKey = currentVerifyingKey

	enableSucceeded := false
	defer func() {
		// Revert to a clean state if the enable doesn't
		// succeed, either due to a panic or error.
		if !enableSucceeded {
			j.shutdownExistingJournalsLocked(ctx)
		}
	}()

	fileInfos, err := ioutil.ReadDir(j.rootPath())
	if os.IsNotExist(err) {
		enableSucceeded = true
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

		dir := filepath.Join(j.rootPath(), name)
		uid, key, tlfID, err := readTLFJournalInfoFile(dir)
		if err != nil {
			j.log.CDebugf(
				ctx, "Skipping non-TLF dir %q: %v", name, err)
			continue
		}

		if uid != currentUID {
			j.log.CDebugf(
				ctx, "Skipping dir %q due to mismatched UID %s",
				name, uid)
			continue
		}

		if key != currentVerifyingKey {
			j.log.CDebugf(
				ctx, "Skipping dir %q due to mismatched key %s",
				name, uid)
			continue
		}

		expectedDir := j.tlfJournalPathLocked(tlfID)
		if dir != expectedDir {
			j.log.CDebugf(
				ctx, "Skipping misnamed dir %q; expected %q",
				dir, expectedDir)
			continue
		}

		// Allow enable even if dirty, since any dirty writes
		// in flight are most likely for another user.
		err = j.enableLocked(ctx, tlfID, bws, true)
		if err != nil {
			// Don't treat per-TLF errors as fatal.
			j.log.CWarningf(
				ctx, "Error when enabling existing journal for %s: %v",
				tlfID, err)
			continue
		}
	}

	enableSucceeded = true
	return nil
}

func (j *JournalServer) enableLocked(
	ctx context.Context, tlfID tlf.ID, bws TLFJournalBackgroundWorkStatus,
	allowEnableIfDirty bool) (err error) {
	j.log.CDebugf(ctx, "Enabling journal for %s (%s)", tlfID, bws)
	defer func() {
		if err != nil {
			j.deferLog.CDebugf(ctx,
				"Error when enabling journal for %s: %v",
				tlfID, err)
		}
	}()

	if j.currentUID == keybase1.UID("") {
		return errors.New("Current UID is empty")
	}
	if j.currentVerifyingKey == (kbfscrypto.VerifyingKey{}) {
		return errors.New("Current verifying key is empty")
	}

	if tlfJournal, ok := j.tlfJournals[tlfID]; ok {
		return tlfJournal.enable()
	}

	err = func() error {
		if j.dirtyOps > 0 {
			return fmt.Errorf("Can't enable journal for %s while there "+
				"are outstanding dirty ops", tlfID)
		}
		if j.delegateDirtyBlockCache.IsAnyDirty(tlfID) {
			return fmt.Errorf("Can't enable journal for %s while there "+
				"are any dirty blocks outstanding", tlfID)
		}
		return nil
	}()
	if err != nil {
		if !allowEnableIfDirty {
			return err
		}

		j.log.CWarningf(ctx,
			"Got ignorable error on journal enable, and proceeding anyway: %v", err)
	}

	tlfDir := j.tlfJournalPathLocked(tlfID)
	tlfJournal, err := makeTLFJournal(
		ctx, j.currentUID, j.currentVerifyingKey, tlfDir,
		tlfID, tlfJournalConfigAdapter{j.config}, j.delegateBlockServer,
		bws, nil, j.onBranchChange, j.onMDFlush)
	if err != nil {
		return err
	}

	j.tlfJournals[tlfID] = tlfJournal
	return nil
}

// Enable turns on the write journal for the given TLF.
func (j *JournalServer) Enable(ctx context.Context, tlfID tlf.ID,
	bws TLFJournalBackgroundWorkStatus) error {
	j.lock.Lock()
	defer j.lock.Unlock()
	return j.enableLocked(ctx, tlfID, bws, false)
}

// EnableAuto turns on the write journal for all TLFs, even new ones,
// persistently.
func (j *JournalServer) EnableAuto(ctx context.Context) error {
	j.lock.Lock()
	defer j.lock.Unlock()
	if j.serverConfig.EnableAuto {
		// Nothing to do.
		return nil
	}

	j.log.CDebugf(ctx, "Enabling auto-journaling")
	j.serverConfig.EnableAuto = true
	return j.writeConfig()
}

// DisableAuto turns off automatic write journal for any
// newly-accessed TLFs.  Existing journaled TLFs need to be disabled
// manually.
func (j *JournalServer) DisableAuto(ctx context.Context) error {
	j.lock.Lock()
	defer j.lock.Unlock()
	if !j.serverConfig.EnableAuto {
		// Nothing to do.
		return nil
	}

	j.log.CDebugf(ctx, "Disabling auto-journaling")
	j.serverConfig.EnableAuto = false
	return j.writeConfig()
}

func (j *JournalServer) dirtyOpStart(tlfID tlf.ID) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.dirtyOps++
}

func (j *JournalServer) dirtyOpEnd(tlfID tlf.ID) {
	j.lock.Lock()
	defer j.lock.Unlock()
	if j.dirtyOps == 0 {
		panic("Trying to end a dirty op when count is 0")
	}
	j.dirtyOps--
	if j.dirtyOps == 0 {
		j.dirtyOpsDone.Broadcast()
	}
}

// PauseBackgroundWork pauses the background work goroutine, if it's
// not already paused.
func (j *JournalServer) PauseBackgroundWork(ctx context.Context, tlfID tlf.ID) {
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
func (j *JournalServer) ResumeBackgroundWork(ctx context.Context, tlfID tlf.ID) {
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
func (j *JournalServer) Flush(ctx context.Context, tlfID tlf.ID) (err error) {
	j.log.CDebugf(ctx, "Flushing journal for %s", tlfID)
	if tlfJournal, ok := j.getTLFJournal(tlfID); ok {
		return tlfJournal.flush(ctx)
	}

	j.log.CDebugf(ctx, "Journal not enabled for %s", tlfID)
	return nil
}

// Wait blocks until the write journal has finished flushing
// everything.  It is essentially the same as Flush() when the journal
// is enabled and unpaused, except that it is safe to cancel the
// context without leaving the journal in a partially-flushed state.
func (j *JournalServer) Wait(ctx context.Context, tlfID tlf.ID) (err error) {
	j.log.CDebugf(ctx, "Waiting on journal for %s", tlfID)
	if tlfJournal, ok := j.getTLFJournal(tlfID); ok {
		return tlfJournal.wait(ctx)
	}

	j.log.CDebugf(ctx, "Journal not enabled for %s", tlfID)
	return nil
}

// Disable turns off the write journal for the given TLF.
func (j *JournalServer) Disable(ctx context.Context, tlfID tlf.ID) (
	wasEnabled bool, err error) {
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
		j.log.CDebugf(ctx, "Journal already existed for %s", tlfID)
		return false, nil
	}

	if j.dirtyOps > 0 {
		return false, fmt.Errorf("Can't disable journal for %s while there "+
			"are outstanding dirty ops", tlfID)
	}
	if j.delegateDirtyBlockCache.IsAnyDirty(tlfID) {
		return false, fmt.Errorf("Can't disable journal for %s while there "+
			"are any dirty blocks outstanding", tlfID)
	}

	// Disable the journal.  Note that we don't bother deleting the
	// journal from j.tlfJournals, to avoid cases where something
	// keeps it around doing background work or re-enables it, at the
	// same time JournalServer creates a new journal for the same TLF.
	wasEnabled, err = tlfJournal.disable()
	if err != nil {
		return false, err
	}

	if wasEnabled {
		j.log.CDebugf(ctx, "Disabled journal for %s", tlfID)
	}
	return wasEnabled, nil
}

func (j *JournalServer) blockCache() journalBlockCache {
	return journalBlockCache{j, j.delegateBlockCache}
}

func (j *JournalServer) dirtyBlockCache(
	journalCache DirtyBlockCache) journalDirtyBlockCache {
	return journalDirtyBlockCache{j, j.delegateDirtyBlockCache, journalCache}
}

func (j *JournalServer) blockServer() journalBlockServer {
	return journalBlockServer{j, j.delegateBlockServer, false}
}

func (j *JournalServer) mdOps() journalMDOps {
	return journalMDOps{j.delegateMDOps, j}
}

// Status returns a JournalServerStatus object suitable for
// diagnostics.  It also returns a list of TLF IDs which have journals
// enabled.
func (j *JournalServer) Status() (JournalServerStatus, []tlf.ID) {
	j.lock.RLock()
	defer j.lock.RUnlock()
	var unflushedBytes int64
	tlfIDs := make([]tlf.ID, 0, len(j.tlfJournals))
	for _, tlfJournal := range j.tlfJournals {
		unflushedBytes += tlfJournal.getUnflushedBytes()
		tlfIDs = append(tlfIDs, tlfJournal.tlfID)
	}
	return JournalServerStatus{
		RootDir:             j.rootPath(),
		Version:             1,
		CurrentUID:          j.currentUID,
		CurrentVerifyingKey: j.currentVerifyingKey,
		EnableAuto:          j.serverConfig.EnableAuto,
		JournalCount:        len(tlfIDs),
		UnflushedBytes:      unflushedBytes,
	}, tlfIDs
}

// JournalStatus returns a TLFServerStatus object for the given TLF
// suitable for diagnostics.
func (j *JournalServer) JournalStatus(tlfID tlf.ID) (
	TLFJournalStatus, error) {
	tlfJournal, ok := j.getTLFJournal(tlfID)
	if !ok {
		return TLFJournalStatus{},
			fmt.Errorf("Journal not enabled for %s", tlfID)
	}

	return tlfJournal.getJournalStatus()
}

var errJournalStatusRetry = errors.New("Retry journal status")

// JournalStatusWithPaths returns a TLFServerStatus object for the
// given TLF suitable for diagnostics, including paths for all the
// unflushed entries.
func (j *JournalServer) JournalStatusWithPaths(ctx context.Context,
	tlfID tlf.ID, cpp chainsPathPopulator) (TLFJournalStatus, error) {
	tlfJournal, ok := j.getTLFJournal(tlfID)
	if !ok {
		return TLFJournalStatus{},
			fmt.Errorf("Journal not enabled for %s", tlfID)
	}

	return tlfJournal.getJournalStatusWithPaths(ctx, cpp)
}

// shutdownExistingJournalsLocked shuts down all write journals, sets
// the current UID and verifying key to zero, and returns once all
// shutdowns are complete. It is safe to call multiple times in a row,
// and once this is called, EnableExistingJournals may be called
// again.
func (j *JournalServer) shutdownExistingJournalsLocked(ctx context.Context) {
	for j.dirtyOps > 0 {
		j.log.CDebugf(ctx,
			"Waiting for %d dirty ops before shutting down existing journals...", j.dirtyOps)
		j.dirtyOpsDone.Wait()
	}

	j.log.CDebugf(ctx, "Shutting down existing journals")

	for _, tlfJournal := range j.tlfJournals {
		tlfJournal.shutdown()
	}

	j.tlfJournals = make(map[tlf.ID]*tlfJournal)
	j.currentUID = keybase1.UID("")
	j.currentVerifyingKey = kbfscrypto.VerifyingKey{}
}

// shutdownExistingJournals shuts down all write journals, sets the
// current UID and verifying key to zero, and returns once all
// shutdowns are complete. It is safe to call multiple times in a row,
// and once this is called, EnableExistingJournals may be called
// again.
func (j *JournalServer) shutdownExistingJournals(ctx context.Context) {
	j.lock.Lock()
	defer j.lock.Unlock()
	j.shutdownExistingJournalsLocked(ctx)
}

func (j *JournalServer) shutdown() {
	j.log.CDebugf(context.Background(), "Shutting down journal")
	j.lock.Lock()
	defer j.lock.Unlock()
	for _, tlfJournal := range j.tlfJournals {
		tlfJournal.shutdown()
	}

	// Leave all the tlfJournals in j.tlfJournals, so that any
	// access to them errors out instead of mutating the journal.
}
