// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/syndtr/goleveldb/leveldb"
	"golang.org/x/net/context"
)

type mdServerDiskShared struct {
	dirPath string

	// Protects handleDb, branchDb, tlfStorage, and
	// truncateLockManager. After Shutdown() is called, handleDb,
	// branchDb, tlfStorage, and truncateLockManager are nil.
	lock sync.RWMutex
	// Bare TLF handle -> TLF ID
	handleDb *leveldb.DB
	// (TLF ID, device crypt public key) -> branch ID
	branchDb   *leveldb.DB
	tlfStorage map[tlf.ID]*mdServerTlfStorage
	// Always use memory for the lock storage, so it gets wiped
	// after a restart.
	truncateLockManager *mdServerLocalTruncateLockManager

	updateManager *mdServerLocalUpdateManager

	shutdownFunc func(logger.Logger)
}

// MDServerDisk stores all info on disk, either in levelDBs, or disk
// journals and flat files for the actual MDs.
type MDServerDisk struct {
	config mdServerLocalConfig
	log    logger.Logger

	*mdServerDiskShared
}

var _ mdServerLocal = (*MDServerDisk)(nil)

func newMDServerDisk(config mdServerLocalConfig, dirPath string,
	shutdownFunc func(logger.Logger)) (*MDServerDisk, error) {
	handlePath := filepath.Join(dirPath, "handles")
	handleDb, err := leveldb.OpenFile(handlePath, leveldbOptions)
	if err != nil {
		return nil, err
	}

	branchPath := filepath.Join(dirPath, "branches")
	branchDb, err := leveldb.OpenFile(branchPath, leveldbOptions)
	if err != nil {
		return nil, err
	}
	log := config.MakeLogger("MDSD")
	truncateLockManager := newMDServerLocalTruncatedLockManager()
	shared := mdServerDiskShared{
		dirPath:             dirPath,
		handleDb:            handleDb,
		branchDb:            branchDb,
		tlfStorage:          make(map[tlf.ID]*mdServerTlfStorage),
		truncateLockManager: &truncateLockManager,
		updateManager:       newMDServerLocalUpdateManager(),
		shutdownFunc:        shutdownFunc,
	}
	mdserv := &MDServerDisk{config, log, &shared}
	return mdserv, nil
}

// NewMDServerDir constructs a new MDServerDisk that stores its data
// in the given directory.
func NewMDServerDir(
	config mdServerLocalConfig, dirPath string) (*MDServerDisk, error) {
	return newMDServerDisk(config, dirPath, nil)
}

// NewMDServerTempDir constructs a new MDServerDisk that stores its
// data in a temp directory which is cleaned up on shutdown.
func NewMDServerTempDir(config mdServerLocalConfig) (*MDServerDisk, error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_mdserver_tmp")
	if err != nil {
		return nil, err
	}
	return newMDServerDisk(config, tempdir, func(log logger.Logger) {
		err := ioutil.RemoveAll(tempdir)
		if err != nil {
			log.Warning("error removing %s: %s", tempdir, err)
		}
	})
}

type errMDServerDiskShutdown struct{}

func (e errMDServerDiskShutdown) Error() string {
	return "MDServerDisk is shutdown"
}

func (md *MDServerDisk) checkShutdownLocked() error {
	if md.tlfStorage == nil {
		return errors.WithStack(errMDServerDiskShutdown{})
	}
	return nil
}

func (md *MDServerDisk) getStorage(tlfID tlf.ID) (*mdServerTlfStorage, error) {
	storage, err := func() (*mdServerTlfStorage, error) {
		md.lock.RLock()
		defer md.lock.RUnlock()
		err := md.checkShutdownLocked()
		if err != nil {
			return nil, err
		}
		return md.tlfStorage[tlfID], nil
	}()

	if err != nil {
		return nil, err
	}

	if storage != nil {
		return storage, nil
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	if md.tlfStorage == nil {
		return nil, errors.WithStack(errMDServerDiskShutdown{})
	}

	storage = md.tlfStorage[tlfID]
	if storage != nil {
		return storage, nil
	}

	path := filepath.Join(md.dirPath, tlfID.String())
	storage = makeMDServerTlfStorage(
		tlfID, md.config.Codec(), md.config.cryptoPure(),
		md.config.Clock(), md.config.teamMemChecker(),
		md.config.MetadataVersion(), path)

	md.tlfStorage[tlfID] = storage
	return storage, nil
}

func (md *MDServerDisk) getHandleID(ctx context.Context, handle tlf.Handle,
	mStatus MergeStatus) (tlfID tlf.ID, created bool, err error) {
	handleBytes, err := md.config.Codec().Encode(handle)
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	err = md.checkShutdownLocked()
	if err != nil {
		return tlf.NullID, false, err
	}

	buf, err := md.handleDb.Get(handleBytes, nil)
	if err != nil && err != leveldb.ErrNotFound {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}
	if err == nil {
		var id tlf.ID
		err := id.UnmarshalBinary(buf)
		if err != nil {
			return tlf.NullID, false, kbfsmd.ServerError{Err: err}
		}
		return id, false, nil
	}

	// Non-readers shouldn't be able to create the dir.
	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}
	if !handle.IsReader(session.UID.AsUserOrTeam()) {
		return tlf.NullID, false, kbfsmd.ServerErrorUnauthorized{}
	}

	// Allocate a new random ID.
	id, err := md.config.cryptoPure().MakeRandomTlfID(handle.Type())
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}

	err = md.handleDb.Put(handleBytes, id.Bytes(), nil)
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}
	return id, true, nil
}

// GetForHandle implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetForHandle(ctx context.Context, handle tlf.Handle,
	mStatus MergeStatus) (tlf.ID, *RootMetadataSigned, error) {
	if err := checkContext(ctx); err != nil {
		return tlf.NullID, nil, err
	}

	id, created, err := md.getHandleID(ctx, handle, mStatus)
	if err != nil {
		return tlf.NullID, nil, err
	}

	if created {
		return id, nil, nil
	}

	rmds, err := md.GetForTLF(ctx, id, NullBranchID, mStatus)
	if err != nil {
		return tlf.NullID, nil, err
	}
	return id, rmds, nil
}

func (md *MDServerDisk) getBranchKey(ctx context.Context, id tlf.ID) ([]byte, error) {
	buf := &bytes.Buffer{}
	// add folder id
	_, err := buf.Write(id.Bytes())
	if err != nil {
		return nil, err
	}
	// add device key
	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return nil, err
	}
	_, err = buf.Write(session.CryptPublicKey.KID().ToBytes())
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (md *MDServerDisk) getBranchID(ctx context.Context, id tlf.ID) (BranchID, error) {
	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return NullBranchID, kbfsmd.ServerError{Err: err}
	}

	md.lock.RLock()
	defer md.lock.RUnlock()
	err = md.checkShutdownLocked()
	if err != nil {
		return NullBranchID, err
	}

	buf, err := md.branchDb.Get(branchKey, nil)
	if err == leveldb.ErrNotFound {
		return NullBranchID, nil
	}
	if err != nil {
		return NullBranchID, kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}
	var bid BranchID
	err = md.config.Codec().Decode(buf, &bid)
	if err != nil {
		return NullBranchID, kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}
	return bid, nil
}

func (md *MDServerDisk) putBranchID(
	ctx context.Context, id tlf.ID, bid BranchID) error {
	md.lock.Lock()
	defer md.lock.Unlock()
	err := md.checkShutdownLocked()
	if err != nil {
		return err
	}

	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}
	buf, err := md.config.Codec().Encode(bid)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}
	err = md.branchDb.Put(branchKey, buf, nil)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	return nil
}

func (md *MDServerDisk) deleteBranchID(ctx context.Context, id tlf.ID) error {
	md.lock.Lock()
	defer md.lock.Unlock()
	err := md.checkShutdownLocked()
	if err != nil {
		return err
	}

	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}
	err = md.branchDb.Delete(branchKey, nil)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}
	return nil
}

// GetForTLF implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetForTLF(ctx context.Context, id tlf.ID,
	bid BranchID, mStatus MergeStatus) (*RootMetadataSigned, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	// Lookup the branch ID if not supplied
	if mStatus == Unmerged && bid == NullBranchID {
		var err error
		bid, err = md.getBranchID(ctx, id)
		if err != nil {
			return nil, err
		}
		if bid == NullBranchID {
			return nil, nil
		}
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return nil, kbfsmd.ServerError{Err: err}
	}

	tlfStorage, err := md.getStorage(id)
	if err != nil {
		return nil, err
	}

	return tlfStorage.getForTLF(ctx, session.UID, bid)
}

// GetRange implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetRange(ctx context.Context, id tlf.ID,
	bid BranchID, mStatus MergeStatus, start, stop kbfsmd.Revision) (
	[]*RootMetadataSigned, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	md.log.CDebugf(ctx, "GetRange %d %d (%s)", start, stop, mStatus)

	// Lookup the branch ID if not supplied
	if mStatus == Unmerged && bid == NullBranchID {
		var err error
		bid, err = md.getBranchID(ctx, id)
		if err != nil {
			return nil, err
		}
		if bid == NullBranchID {
			return nil, nil
		}
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return nil, kbfsmd.ServerError{Err: err}
	}

	tlfStorage, err := md.getStorage(id)
	if err != nil {
		return nil, err
	}

	return tlfStorage.getRange(ctx, session.UID, bid, start, stop)
}

// Put implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) Put(ctx context.Context, rmds *RootMetadataSigned,
	extra ExtraMetadata) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	tlfStorage, err := md.getStorage(rmds.MD.TlfID())
	if err != nil {
		return err
	}

	recordBranchID, err := tlfStorage.put(
		ctx, session.UID, session.VerifyingKey, rmds, extra)
	if err != nil {
		return err
	}

	// Record branch ID
	if recordBranchID {
		err = md.putBranchID(ctx, rmds.MD.TlfID(), rmds.MD.BID())
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
	}

	mStatus := rmds.MD.MergedStatus()
	if mStatus == Merged &&
		// Don't send notifies if it's just a rekey (the real mdserver
		// sends a "folder needs rekey" notification in this case).
		!(rmds.MD.IsRekeySet() && rmds.MD.IsWriterMetadataCopiedSet()) {
		md.updateManager.setHead(rmds.MD.TlfID(), md)
	}

	return nil
}

// PruneBranch implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) PruneBranch(ctx context.Context, id tlf.ID, bid BranchID) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	if bid == NullBranchID {
		return kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	currBID, err := md.getBranchID(ctx, id)
	if err != nil {
		return err
	}
	if currBID == NullBranchID || bid != currBID {
		return kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Don't actually delete unmerged history. This is intentional
	// to be consistent with the mdserver behavior-- it garbage
	// collects discarded branches in the background.
	return md.deleteBranchID(ctx, id)
}

func (md *MDServerDisk) getCurrentMergedHeadRevision(
	ctx context.Context, id tlf.ID) (rev kbfsmd.Revision, err error) {
	head, err := md.GetForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return 0, err
	}
	if head != nil {
		rev = head.MD.RevisionNumber()
	}
	return
}

// RegisterForUpdate implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) RegisterForUpdate(ctx context.Context, id tlf.ID,
	currHead kbfsmd.Revision) (<-chan error, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	// are we already past this revision?  If so, fire observer
	// immediately
	currMergedHeadRev, err := md.getCurrentMergedHeadRevision(ctx, id)
	if err != nil {
		return nil, err
	}

	c := md.updateManager.registerForUpdate(id, currHead, currMergedHeadRev, md)
	return c, nil
}

// CancelRegistration implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) CancelRegistration(_ context.Context, id tlf.ID) {
	md.updateManager.cancel(id, md)
}

// TruncateLock implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) TruncateLock(ctx context.Context, id tlf.ID) (
	bool, error) {
	if err := checkContext(ctx); err != nil {
		return false, err
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	err = md.checkShutdownLocked()
	if err != nil {
		return false, err
	}

	return md.truncateLockManager.truncateLock(session.CryptPublicKey, id)
}

// TruncateUnlock implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) TruncateUnlock(ctx context.Context, id tlf.ID) (
	bool, error) {
	if err := checkContext(ctx); err != nil {
		return false, err
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return false, kbfsmd.ServerError{Err: err}
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	err = md.checkShutdownLocked()
	if err != nil {
		return false, err
	}

	return md.truncateLockManager.truncateUnlock(session.CryptPublicKey, id)
}

// Shutdown implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) Shutdown() {
	md.lock.Lock()
	defer md.lock.Unlock()
	if md.handleDb == nil {
		return
	}

	// Make further accesses error out.

	md.handleDb.Close()
	md.handleDb = nil

	md.branchDb.Close()
	md.branchDb = nil

	tlfStorage := md.tlfStorage
	md.tlfStorage = nil

	for _, s := range tlfStorage {
		s.shutdown()
	}

	if md.shutdownFunc != nil {
		md.shutdownFunc(md.log)
	}
}

// IsConnected implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) IsConnected() bool {
	return !md.isShutdown()
}

// RefreshAuthToken implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) RefreshAuthToken(ctx context.Context) {}

// This should only be used for testing with an in-memory server.
func (md *MDServerDisk) copy(config mdServerLocalConfig) mdServerLocal {
	// NOTE: observers and sessionHeads are copied shallowly on
	// purpose, so that the MD server that gets a Put will notify all
	// observers correctly no matter where they got on the list.
	log := config.MakeLogger("")
	return &MDServerDisk{config, log, md.mdServerDiskShared}
}

// isShutdown returns whether the logical, shared MDServer instance
// has been shut down.
func (md *MDServerDisk) isShutdown() bool {
	md.lock.RLock()
	defer md.lock.RUnlock()
	return md.checkShutdownLocked() != nil
}

// DisableRekeyUpdatesForTesting implements the MDServer interface.
func (md *MDServerDisk) DisableRekeyUpdatesForTesting() {
	// Nothing to do.
}

// CheckForRekeys implements the MDServer interface.
func (md *MDServerDisk) CheckForRekeys(ctx context.Context) <-chan error {
	// Nothing to do
	c := make(chan error, 1)
	c <- nil
	return c
}

func (md *MDServerDisk) addNewAssertionForTest(uid keybase1.UID,
	newAssertion keybase1.SocialAssertion) error {
	md.lock.Lock()
	defer md.lock.Unlock()
	err := md.checkShutdownLocked()
	if err != nil {
		return err
	}

	// Iterate through all the handles, and add handles for ones
	// containing newAssertion to now include the uid.
	iter := md.handleDb.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		handleBytes := iter.Key()
		var handle tlf.Handle
		err := md.config.Codec().Decode(handleBytes, &handle)
		if err != nil {
			return err
		}
		assertions := map[keybase1.SocialAssertion]keybase1.UID{
			newAssertion: uid,
		}
		newHandle := handle.ResolveAssertions(assertions)
		if reflect.DeepEqual(handle, newHandle) {
			continue
		}
		newHandleBytes, err := md.config.Codec().Encode(newHandle)
		if err != nil {
			return err
		}
		id := iter.Value()
		if err := md.handleDb.Put(newHandleBytes, id, nil); err != nil {
			return err
		}
	}
	return iter.Error()
}

// GetLatestHandleForTLF implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetLatestHandleForTLF(ctx context.Context, id tlf.ID) (
	tlf.Handle, error) {
	if err := checkContext(ctx); err != nil {
		return tlf.Handle{}, err
	}

	md.lock.RLock()
	defer md.lock.RUnlock()
	err := md.checkShutdownLocked()
	if err != nil {
		return tlf.Handle{}, err
	}

	var handle tlf.Handle
	iter := md.handleDb.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		var dbID tlf.ID
		idBytes := iter.Value()
		err := dbID.UnmarshalBinary(idBytes)
		if err != nil {
			return tlf.Handle{}, err
		}
		if id != dbID {
			continue
		}
		handleBytes := iter.Key()
		handle = tlf.Handle{}
		err = md.config.Codec().Decode(handleBytes, &handle)
		if err != nil {
			return tlf.Handle{}, err
		}
	}
	return handle, nil
}

// OffsetFromServerTime implements the MDServer interface for
// MDServerDisk.
func (md *MDServerDisk) OffsetFromServerTime() (time.Duration, bool) {
	return 0, true
}

// GetKeyBundles implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetKeyBundles(ctx context.Context,
	tlfID tlf.ID, wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error) {
	if err := checkContext(ctx); err != nil {
		return nil, nil, err
	}

	tlfStorage, err := md.getStorage(tlfID)
	if err != nil {
		return nil, nil, err
	}

	return tlfStorage.getKeyBundles(tlfID, wkbID, rkbID)
}

// CheckReachability implements the MDServer interface for MDServerMemory.
func (md *MDServerDisk) CheckReachability(ctx context.Context) {}

// FastForwardBackoff implements the MDServer interface for MDServerMemory.
func (md *MDServerDisk) FastForwardBackoff() {}
