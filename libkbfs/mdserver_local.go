// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

type mdBlockLocal struct {
	MD        *RootMetadataSigned
	Timestamp time.Time
}

// MDServerLocal just stores blocks in local leveldb instances.
type MDServerLocal struct {
	config   Config
	handleDb *leveldb.DB // folder handle                  -> folderId
	mdDb     *leveldb.DB // folderId+[branchId]+[revision] -> mdBlockLocal
	branchDb *leveldb.DB // folderId+deviceKID             -> branchId
	log      logger.Logger

	locksMutex *sync.Mutex
	locksDb    *leveldb.DB // folderId -> deviceKID

	// mutex protects observers and sessionHeads
	mutex *sync.Mutex
	// Multiple instances of MDServerLocal could share a reference to
	// this map and sessionHead, and we use that to ensure that all
	// observers are fired correctly no matter which MDServerLocal
	// instance gets the Put() call.
	observers    map[TlfID]map[*MDServerLocal]chan<- error
	sessionHeads map[TlfID]*MDServerLocal

	shutdown     *bool
	shutdownLock *sync.RWMutex
}

func newMDServerLocalWithStorage(config Config, handleStorage, mdStorage,
	branchStorage, lockStorage storage.Storage) (*MDServerLocal, error) {
	handleDb, err := leveldb.Open(handleStorage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	mdDb, err := leveldb.Open(mdStorage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	branchDb, err := leveldb.Open(branchStorage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	locksDb, err := leveldb.Open(lockStorage, leveldbOptions)
	if err != nil {
		return nil, err
	}
	log := config.MakeLogger("")
	mdserv := &MDServerLocal{config, handleDb, mdDb, branchDb, log,
		&sync.Mutex{}, locksDb, &sync.Mutex{},
		make(map[TlfID]map[*MDServerLocal]chan<- error),
		make(map[TlfID]*MDServerLocal), new(bool), &sync.RWMutex{}}
	return mdserv, nil
}

// NewMDServerLocal constructs a new MDServerLocal object that stores
// data in the directories specified as parameters to this function.
func NewMDServerLocal(config Config, handleDbfile string, mdDbfile string,
	branchDbfile string) (*MDServerLocal, error) {

	handleStorage, err := storage.OpenFile(handleDbfile)
	if err != nil {
		return nil, err
	}

	mdStorage, err := storage.OpenFile(mdDbfile)
	if err != nil {
		return nil, err
	}

	branchStorage, err := storage.OpenFile(branchDbfile)
	if err != nil {
		return nil, err
	}

	// Always use memory for the lock storage, so it gets wiped after
	// a restart.
	lockStorage := storage.NewMemStorage()

	return newMDServerLocalWithStorage(config, handleStorage, mdStorage,
		branchStorage, lockStorage)
}

// NewMDServerMemory constructs a new MDServerLocal object that stores
// all data in-memory.
func NewMDServerMemory(config Config) (*MDServerLocal, error) {
	return newMDServerLocalWithStorage(config,
		storage.NewMemStorage(), storage.NewMemStorage(),
		storage.NewMemStorage(), storage.NewMemStorage())
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) checkPerms(ctx context.Context, id TlfID,
	checkWrite bool, newMd *RootMetadataSigned) (bool, error) {
	rmds, err := md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if rmds == nil {
		// TODO: the real mdserver will actually reverse lookup the folder handle
		// and check that the UID is listed.
		return true, nil
	}
	_, user, err := md.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return false, err
	}
	h, err := rmds.MD.MakeBareTlfHandle()
	if err != nil {
		return false, err
	}
	isWriter := h.IsWriter(user)
	isReader := h.IsReader(user)
	if checkWrite {
		// if this is a reader, are they acting within their restrictions?
		if !isWriter && isReader && newMd != nil {
			return newMd.MD.IsValidRekeyRequest(md.config, &rmds.MD, user)
		}
		return isWriter, nil
	}
	return isWriter || isReader, nil
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) isReader(ctx context.Context, id TlfID) (bool, error) {
	return md.checkPerms(ctx, id, false, nil)
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) isWriter(ctx context.Context, id TlfID) (bool, error) {
	return md.checkPerms(ctx, id, true, nil)
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) isWriterOrValidRekey(ctx context.Context, id TlfID, newMd *RootMetadataSigned) (
	bool, error) {
	return md.checkPerms(ctx, id, true, newMd)
}

// GetForHandle implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetForHandle(ctx context.Context, handle BareTlfHandle,
	mStatus MergeStatus) (TlfID, *RootMetadataSigned, error) {
	id := NullTlfID
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return id, nil, errors.New("MD server already shut down")
	}

	handleBytes, err := md.config.Codec().Encode(handle)
	if err != nil {
		return id, nil, err
	}

	buf, err := md.handleDb.Get(handleBytes, nil)
	if err != nil && err != leveldb.ErrNotFound {
		return id, nil, MDServerError{err}
	}
	if err == nil {
		var id TlfID
		err := id.UnmarshalBinary(buf)
		if err != nil {
			return NullTlfID, nil, err
		}
		rmds, err := md.GetForTLF(ctx, id, NullBranchID, mStatus)
		return id, rmds, err
	}

	// Non-readers shouldn't be able to create the dir.
	_, uid, err := md.config.KBPKI().GetCurrentUserInfo(ctx)
	if err != nil {
		return id, nil, err
	}
	if !handle.IsReader(uid) {
		return id, nil, MDServerErrorUnauthorized{}
	}

	// Allocate a new random ID.
	id, err = md.config.Crypto().MakeRandomTlfID(handle.IsPublic())
	if err != nil {
		return id, nil, MDServerError{err}
	}

	err = md.handleDb.Put(handleBytes, id.Bytes(), nil)
	if err != nil {
		return id, nil, MDServerError{err}
	}
	return id, nil, nil
}

// GetForTLF implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetForTLF(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus) (*RootMetadataSigned, error) {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return nil, errors.New("MD server already shut down")
	}

	if mStatus == Merged && bid != NullBranchID {
		return nil, MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Check permissions
	ok, err := md.isReader(ctx, id)
	if err != nil {
		return nil, MDServerError{err}
	}
	if !ok {
		return nil, MDServerErrorUnauthorized{}
	}

	// Lookup the branch ID if not supplied
	if mStatus == Unmerged && bid == NullBranchID {
		bid, err = md.getBranchID(ctx, id)
		if err != nil {
			return nil, err
		}
		if bid == NullBranchID {
			return nil, nil
		}
	}

	rmds, err := md.getHeadForTLF(ctx, id, bid, mStatus)
	if err != nil {
		return nil, MDServerError{err}
	}
	return rmds, nil
}

func (md *MDServerLocal) rmdsFromBlockBytes(buf []byte) (
	*RootMetadataSigned, error) {
	block := new(mdBlockLocal)
	err := md.config.Codec().Decode(buf, block)
	if err != nil {
		return nil, err
	}
	block.MD.untrustedServerTimestamp = block.Timestamp
	return block.MD, nil
}

func (md *MDServerLocal) getHeadForTLF(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus) (rmds *RootMetadataSigned, err error) {
	key, err := md.getMDKey(id, 0, bid, mStatus)
	if err != nil {
		return
	}
	buf, err := md.mdDb.Get(key[:], nil)
	if err != nil {
		if err == leveldb.ErrNotFound {
			rmds, err = nil, nil
			return
		}
		return
	}
	return md.rmdsFromBlockBytes(buf)
}

func (md *MDServerLocal) getMDKey(id TlfID, revision MetadataRevision,
	bid BranchID, mStatus MergeStatus) ([]byte, error) {
	// short-cut
	if revision == MetadataRevisionUninitialized && mStatus == Merged {
		return id.Bytes(), nil
	}
	buf := &bytes.Buffer{}

	// add folder id
	_, err := buf.Write(id.Bytes())
	if err != nil {
		return []byte{}, err
	}

	// this order is signifcant for range fetches.
	// we want increments in revision number to only affect
	// the least significant bits of the key.
	if mStatus == Unmerged {
		// add branch ID
		_, err = buf.Write(bid.Bytes())
		if err != nil {
			return []byte{}, err
		}
	}

	if revision >= MetadataRevisionInitial {
		// add revision
		err = binary.Write(buf, binary.BigEndian, revision.Number())
		if err != nil {
			return []byte{}, err
		}
	}
	return buf.Bytes(), nil
}

func (md *MDServerLocal) getBranchKey(ctx context.Context, id TlfID) ([]byte, error) {
	buf := &bytes.Buffer{}
	// add folder id
	_, err := buf.Write(id.Bytes())
	if err != nil {
		return []byte{}, err
	}
	// add device KID
	deviceKID, err := md.getCurrentDeviceKID(ctx)
	if err != nil {
		return []byte{}, err
	}
	_, err = buf.Write(deviceKID.ToBytes())
	if err != nil {
		return []byte{}, err
	}
	return buf.Bytes(), nil
}

func (md *MDServerLocal) getCurrentDeviceKID(ctx context.Context) (keybase1.KID, error) {
	key, err := md.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return keybase1.KID(""), err
	}
	return key.kid, nil
}

// GetRange implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetRange(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
	md.log.CDebugf(ctx, "GetRange %d %d (%s)", start, stop, mStatus)
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return nil, errors.New("MD server already shut down")
	}

	if mStatus == Merged && bid != NullBranchID {
		return nil, MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Check permissions
	ok, err := md.isReader(ctx, id)
	if err != nil {
		return nil, MDServerError{err}
	}
	if !ok {
		return nil, MDServerErrorUnauthorized{}
	}

	// Lookup the branch ID if not supplied
	if mStatus == Unmerged && bid == NullBranchID {
		bid, err = md.getBranchID(ctx, id)
		if err != nil {
			return nil, err
		}
		if bid == NullBranchID {
			return nil, nil
		}
	}

	var rmdses []*RootMetadataSigned
	startKey, err := md.getMDKey(id, start, bid, mStatus)
	if err != nil {
		return rmdses, MDServerError{err}
	}
	stopKey, err := md.getMDKey(id, stop+1, bid, mStatus)
	if err != nil {
		return rmdses, MDServerError{err}
	}

	iter := md.mdDb.NewIterator(&util.Range{Start: startKey, Limit: stopKey}, nil)
	defer iter.Release()
	for iter.Next() {
		buf := iter.Value()
		rmds, err := md.rmdsFromBlockBytes(buf)
		if err != nil {
			return rmdses, MDServerError{err}
		}
		rmdses = append(rmdses, rmds)
	}
	if err := iter.Error(); err != nil {
		return rmdses, MDServerError{err}
	}

	return rmdses, nil
}

// Put implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) Put(ctx context.Context, rmds *RootMetadataSigned) error {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return errors.New("MD server already shut down")
	}

	mStatus := rmds.MD.MergedStatus()
	bid := rmds.MD.BID

	if mStatus == Merged {
		if bid != NullBranchID {
			return MDServerErrorBadRequest{Reason: "Invalid branch ID"}
		}
	} else {
		if bid == NullBranchID {
			return MDServerErrorBadRequest{Reason: "Invalid branch ID"}
		}
	}

	// Consistency checks and the actual write need to be synchronized.
	md.mutex.Lock()
	defer md.mutex.Unlock()

	id := rmds.MD.ID

	// Check permissions
	ok, err := md.isWriterOrValidRekey(ctx, id, rmds)
	if err != nil {
		return MDServerError{err}
	}
	if !ok {
		return MDServerErrorUnauthorized{}
	}

	head, err := md.getHeadForTLF(ctx, id, rmds.MD.BID, mStatus)
	if err != nil {
		return MDServerError{err}
	}

	var recordBranchID bool

	if mStatus == Unmerged && head == nil {
		// currHead for unmerged history might be on the main branch
		prevRev := rmds.MD.Revision - 1
		rmdses, err := md.GetRange(ctx, id, NullBranchID, Merged, prevRev, prevRev)
		if err != nil {
			return MDServerError{err}
		}
		if len(rmdses) != 1 {
			return MDServerError{
				Err: fmt.Errorf("Expected 1 MD block got %d", len(rmdses)),
			}
		}
		head = rmdses[0]
		recordBranchID = true
	}

	// Consistency checks
	if head != nil {
		err := head.MD.CheckValidSuccessor(md.config, &rmds.MD)
		switch err := err.(type) {
		case nil:
			break

		case MDRevisionMismatch:
			return MDServerErrorConflictRevision{
				Expected: err.curr + 1,
				Actual:   err.rev,
			}

		case MDPrevRootMismatch:
			return MDServerErrorConflictPrevRoot{
				Expected: err.currRoot,
				Actual:   err.prevRoot,
			}

		case MDDiskUsageMismatch:
			return MDServerErrorConflictDiskUsage{
				Expected: err.expectedDiskUsage,
				Actual:   err.actualDiskUsage,
			}

		default:
			return MDServerError{Err: err}
		}
	}

	// Record branch ID
	if recordBranchID {
		buf, err := md.config.Codec().Encode(bid)
		if err != nil {
			return MDServerError{err}
		}
		branchKey, err := md.getBranchKey(ctx, id)
		if err != nil {
			return MDServerError{err}
		}
		err = md.branchDb.Put(branchKey, buf, nil)
		if err != nil {
			return MDServerError{err}
		}
	}

	block := &mdBlockLocal{rmds, md.config.Clock().Now()}
	buf, err := md.config.Codec().Encode(block)
	if err != nil {
		return MDServerError{err}
	}

	// Wrap writes in a batch
	batch := new(leveldb.Batch)

	// Add an entry with the revision key.
	revKey, err := md.getMDKey(id, rmds.MD.Revision, rmds.MD.BID, mStatus)
	if err != nil {
		return MDServerError{err}
	}
	batch.Put(revKey, buf)

	// Add an entry with the head key.
	headKey, err := md.getMDKey(id, MetadataRevisionUninitialized,
		rmds.MD.BID, mStatus)
	if err != nil {
		return MDServerError{err}
	}
	batch.Put(headKey, buf)

	// Write the batch.
	err = md.mdDb.Write(batch, nil)
	if err != nil {
		return MDServerError{err}
	}

	if mStatus == Merged &&
		// Don't send notifies if it's just a rekey (the real mdserver
		// sends a "folder needs rekey" notification in this case).
		!(rmds.MD.IsRekeySet() && rmds.MD.IsWriterMetadataCopiedSet()) {
		md.sessionHeads[id] = md

		// now fire all the observers that aren't from this session
		for k, v := range md.observers[id] {
			if k != md {
				v <- nil
				close(v)
				delete(md.observers[id], k)
			}
		}
		if len(md.observers[id]) == 0 {
			delete(md.observers, id)
		}
	}

	return nil
}

// PruneBranch implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) PruneBranch(ctx context.Context, id TlfID, bid BranchID) error {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return errors.New("MD server already shut down")
	}
	if bid == NullBranchID {
		return MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	currBID, err := md.getBranchID(ctx, id)
	if err != nil {
		return err
	}
	if currBID == NullBranchID || bid != currBID {
		return MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Don't actually delete unmerged history. This is intentional to be consistent
	// with the mdserver behavior-- it garbage collects discarded branches in the
	// background.
	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return MDServerError{err}
	}
	err = md.branchDb.Delete(branchKey, nil)
	if err != nil {
		return MDServerError{err}
	}

	return nil
}

func (md *MDServerLocal) getBranchID(ctx context.Context, id TlfID) (BranchID, error) {
	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return NullBranchID, MDServerError{err}
	}
	buf, err := md.branchDb.Get(branchKey, nil)
	if err == leveldb.ErrNotFound {
		return NullBranchID, nil
	}
	if err != nil {
		return NullBranchID, MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}
	var bid BranchID
	err = md.config.Codec().Decode(buf, &bid)
	if err != nil {
		return NullBranchID, MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}
	return bid, nil
}

// RegisterForUpdate implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) RegisterForUpdate(ctx context.Context, id TlfID,
	currHead MetadataRevision) (<-chan error, error) {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return nil, errors.New("MD server already shut down")
	}

	md.mutex.Lock()
	defer md.mutex.Unlock()

	// are we already past this revision?  If so, fire observer
	// immediately
	head, err := md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return nil, err
	}
	var currMergedHeadRev MetadataRevision
	if head != nil {
		currMergedHeadRev = head.MD.Revision
	}

	c := make(chan error, 1)
	if currMergedHeadRev > currHead && md != md.sessionHeads[id] {
		c <- nil
		close(c)
		return c, nil
	}

	if _, ok := md.observers[id]; !ok {
		md.observers[id] = make(map[*MDServerLocal]chan<- error)
	}

	// Otherwise, this is a legit observer.  This assumes that each
	// client will be using a unique instance of MDServerLocal.
	if _, ok := md.observers[id][md]; ok {
		// If the local node registers something twice, it indicates a
		// fatal bug.  Note that in the real MDServer implementation,
		// we should allow this, in order to make the RPC properly
		// idempotent.
		panic(fmt.Sprintf("Attempted double-registration for MDServerLocal %p",
			md))
	}
	md.observers[id][md] = c
	return c, nil
}

func getTruncateLockKey(id TlfID) ([]byte, error) {
	buf := &bytes.Buffer{}
	// add folder id
	_, err := buf.Write(id.Bytes())
	if err != nil {
		return []byte{}, err
	}
	return buf.Bytes(), nil
}

func (md *MDServerLocal) getCurrentDeviceKIDBytes(ctx context.Context) (
	[]byte, error) {
	buf := &bytes.Buffer{}
	deviceKID, err := md.getCurrentDeviceKID(ctx)
	if err != nil {
		return []byte{}, err
	}
	_, err = buf.Write(deviceKID.ToBytes())
	if err != nil {
		return []byte{}, err
	}
	return buf.Bytes(), nil
}

// TruncateLock implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) TruncateLock(ctx context.Context, id TlfID) (
	bool, error) {
	md.locksMutex.Lock()
	defer md.locksMutex.Unlock()

	key, err := getTruncateLockKey(id)
	if err != nil {
		return false, err
	}

	myKID, err := md.getCurrentDeviceKIDBytes(ctx)
	if err != nil {
		return false, err
	}

	lockBytes, err := md.locksDb.Get(key, nil)
	if err == leveldb.ErrNotFound {
		if err := md.locksDb.Put(key, myKID, nil); err != nil {
			return false, err
		}
		return true, nil
	} else if err != nil {
		return false, err
	} else if bytes.Equal(lockBytes, myKID) {
		// idempotent
		return true, nil
	}

	// Locked by someone else.
	return false, MDServerErrorLocked{}
}

// TruncateUnlock implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) TruncateUnlock(ctx context.Context, id TlfID) (
	bool, error) {
	md.locksMutex.Lock()
	defer md.locksMutex.Unlock()

	key, err := getTruncateLockKey(id)
	if err != nil {
		return false, err
	}

	myKID, err := md.getCurrentDeviceKIDBytes(ctx)
	if err != nil {
		return false, err
	}

	lockBytes, err := md.locksDb.Get(key, nil)
	if err == leveldb.ErrNotFound {
		// Already unlocked
		return true, nil
	} else if err != nil {
		return false, err
	} else if bytes.Equal(lockBytes, myKID) {
		if err := md.locksDb.Delete(key, nil); err != nil {
			return false, err
		}
		return true, nil
	}

	// Locked by someone else.
	return false, MDServerErrorLocked{}
}

// Shutdown implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) Shutdown() {
	md.shutdownLock.Lock()
	defer md.shutdownLock.Unlock()
	if *md.shutdown {
		return
	}
	*md.shutdown = true

	if md.handleDb != nil {
		md.handleDb.Close()
	}
	if md.mdDb != nil {
		md.mdDb.Close()
	}
	if md.branchDb != nil {
		md.branchDb.Close()
	}
	if md.locksDb != nil {
		md.locksDb.Close()
	}
}

// IsConnected implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) IsConnected() bool {
	return !md.isShutdown()
}

// RefreshAuthToken implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) RefreshAuthToken(ctx context.Context) {}

// This should only be used for testing with an in-memory server.
func (md *MDServerLocal) copy(config Config) *MDServerLocal {
	// NOTE: observers and sessionHeads are copied shallowly on
	// purpose, so that the MD server that gets a Put will notify all
	// observers correctly no matter where they got on the list.
	log := config.MakeLogger("")
	return &MDServerLocal{config, md.handleDb, md.mdDb, md.branchDb, log,
		md.locksMutex, md.locksDb, md.mutex, md.observers, md.sessionHeads,
		md.shutdown, md.shutdownLock}
}

// isShutdown returns whether the logical, shared MDServer instance
// has been shut down.
func (md *MDServerLocal) isShutdown() bool {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	return *md.shutdown
}

// DisableRekeyUpdatesForTesting implements the MDServer interface.
func (md *MDServerLocal) DisableRekeyUpdatesForTesting() {
	// Nothing to do.
}

// CheckForRekeys implements the MDServer interface.
func (md *MDServerLocal) CheckForRekeys(ctx context.Context) <-chan error {
	// Nothing to do
	c := make(chan error, 1)
	c <- nil
	return c
}

func (md *MDServerLocal) addNewAssertionForTest(uid keybase1.UID,
	newAssertion keybase1.SocialAssertion) error {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return errors.New("MD server already shut down")
	}

	// Iterate through all the handles, and add handles for ones
	// containing newAssertion to now include the uid.
	iter := md.handleDb.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		handleBytes := iter.Key()
		var handle BareTlfHandle
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

// GetLatestHandleForTLF implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetLatestHandleForTLF(_ context.Context, id TlfID) (
	BareTlfHandle, error) {
	var handle BareTlfHandle
	iter := md.handleDb.NewIterator(nil, nil)
	defer iter.Release()
	for iter.Next() {
		var dbID TlfID
		idBytes := iter.Value()
		err := dbID.UnmarshalBinary(idBytes)
		if err != nil {
			return BareTlfHandle{}, err
		}
		if id != dbID {
			continue
		}
		handleBytes := iter.Key()
		handle = BareTlfHandle{}
		err = md.config.Codec().Decode(handleBytes, &handle)
		if err != nil {
			return BareTlfHandle{}, err
		}
	}
	return handle, nil
}
