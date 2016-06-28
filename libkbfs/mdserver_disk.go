// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
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

// TODO: Convert this to use flat files and a journal.

// MDServerDisk just stores blocks in local leveldb instances.
type MDServerDisk struct {
	config   Config
	handleDb *leveldb.DB // folder handle                  -> folderId
	mdDb     *leveldb.DB // folderId+[branchId]+[revision] -> mdBlockLocal
	branchDb *leveldb.DB // folderId+deviceKID             -> branchId
	log      logger.Logger

	locksMutex *sync.Mutex
	locksDb    *leveldb.DB // folderId -> deviceKID

	updateManager *mdServerLocalUpdateManager

	shutdownLock *sync.RWMutex
	shutdown     *bool
	shutdownFunc func(logger.Logger)
}

var _ mdServerLocal = (*MDServerDisk)(nil)

type mdBlockLocal struct {
	MD        *RootMetadataSigned
	Timestamp time.Time
}

func newMDServerDisk(config Config, dirPath string,
	shutdownFunc func(logger.Logger)) (*MDServerDisk, error) {
	handlePath := filepath.Join(dirPath, "handles")
	mdPath := filepath.Join(dirPath, "md")
	branchPath := filepath.Join(dirPath, "branches")

	handleStorage, err := storage.OpenFile(handlePath)
	if err != nil {
		return nil, err
	}

	mdStorage, err := storage.OpenFile(mdPath)
	if err != nil {
		return nil, err
	}

	branchStorage, err := storage.OpenFile(branchPath)
	if err != nil {
		return nil, err
	}

	// Always use memory for the lock storage, so it gets wiped after
	// a restart.
	lockStorage := storage.NewMemStorage()

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
	mdserv := &MDServerDisk{config, handleDb, mdDb, branchDb, log,
		&sync.Mutex{}, locksDb, newMDServerLocalUpdateManager(),
		&sync.RWMutex{}, new(bool), shutdownFunc}
	return mdserv, nil
}

// NewMDServerDir constructs a new MDServerDisk that stores its data
// in the given directory.
func NewMDServerDir(config Config, dirPath string) (*MDServerDisk, error) {
	return newMDServerDisk(config, dirPath, nil)
}

// NewMDServerTempDir constructs a new MDServerDisk that stores its
// data in a temp directory which is cleaned up on shutdown.
func NewMDServerTempDir(config Config) (*MDServerDisk, error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_mdserver_tmp")
	if err != nil {
		return nil, err
	}
	return newMDServerDisk(config, tempdir, func(log logger.Logger) {
		err := os.RemoveAll(tempdir)
		if err != nil {
			log.Warning("error removing %s: %s", tempdir, err)
		}
	})
}

// GetForHandle implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetForHandle(ctx context.Context, handle BareTlfHandle,
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

// GetForTLF implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetForTLF(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus) (*RootMetadataSigned, error) {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return nil, errors.New("MD server already shut down")
	}

	if mStatus == Merged && bid != NullBranchID {
		return nil, MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	mergedMasterHead, err :=
		md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return nil, MDServerError{err}
	}

	// Check permissions
	ok, err := isReader(
		ctx, md.config.Codec(), md.config.KBPKI(), mergedMasterHead)
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

func (md *MDServerDisk) rmdsFromBlockBytes(buf []byte) (
	*RootMetadataSigned, error) {
	block := new(mdBlockLocal)
	err := md.config.Codec().Decode(buf, block)
	if err != nil {
		return nil, err
	}
	block.MD.untrustedServerTimestamp = block.Timestamp
	return block.MD, nil
}

func (md *MDServerDisk) getHeadForTLF(ctx context.Context, id TlfID,
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

func (md *MDServerDisk) getMDKey(id TlfID, revision MetadataRevision,
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

func (md *MDServerDisk) getBranchKey(ctx context.Context, id TlfID) ([]byte, error) {
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

func (md *MDServerDisk) getCurrentDeviceKID(ctx context.Context) (keybase1.KID, error) {
	key, err := md.config.KBPKI().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return keybase1.KID(""), err
	}
	return key.kid, nil
}

// GetRange implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetRange(ctx context.Context, id TlfID,
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

	mergedMasterHead, err :=
		md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return nil, MDServerError{err}
	}

	// Check permissions
	ok, err := isReader(
		ctx, md.config.Codec(), md.config.KBPKI(), mergedMasterHead)
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

// Put implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) Put(ctx context.Context, rmds *RootMetadataSigned) error {
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
	} else if bid == NullBranchID {
		return MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	id := rmds.MD.ID

	mergedMasterHead, err :=
		md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return MDServerError{err}
	}

	// Check permissions
	ok, err := isWriterOrValidRekey(
		ctx, md.config.Codec(), md.config.KBPKI(),
		mergedMasterHead, rmds)
	if err != nil {
		return MDServerError{err}
	}
	if !ok {
		return MDServerErrorUnauthorized{}
	}

	head, err := md.getHeadForTLF(ctx, id, bid, mStatus)
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
		err := head.MD.CheckValidSuccessorForServer(md.config, &rmds.MD)
		if err != nil {
			return err
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
	revKey, err := md.getMDKey(id, rmds.MD.Revision, bid, mStatus)
	if err != nil {
		return MDServerError{err}
	}
	batch.Put(revKey, buf)

	// Add an entry with the head key.
	headKey, err := md.getMDKey(id, MetadataRevisionUninitialized,
		bid, mStatus)
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
		md.updateManager.setHead(id, md)
	}

	return nil
}

// PruneBranch implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) PruneBranch(ctx context.Context, id TlfID, bid BranchID) error {
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

func (md *MDServerDisk) getBranchID(ctx context.Context, id TlfID) (BranchID, error) {
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

func (md *MDServerDisk) getCurrentMergedHeadRevision(
	ctx context.Context, id TlfID) (rev MetadataRevision, err error) {
	head, err := md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return 0, err
	}
	if head != nil {
		rev = head.MD.Revision
	}
	return
}

// RegisterForUpdate implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) RegisterForUpdate(ctx context.Context, id TlfID,
	currHead MetadataRevision) (<-chan error, error) {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return nil, errors.New("MD server already shut down")
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

func (md *MDServerDisk) getCurrentDeviceKIDBytes(ctx context.Context) (
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

func getTruncateLockKey(id TlfID) ([]byte, error) {
	buf := &bytes.Buffer{}
	// add folder id
	_, err := buf.Write(id.Bytes())
	if err != nil {
		return []byte{}, err
	}
	return buf.Bytes(), nil
}

// TruncateLock implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) TruncateLock(ctx context.Context, id TlfID) (
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

// TruncateUnlock implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) TruncateUnlock(ctx context.Context, id TlfID) (
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

// Shutdown implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) Shutdown() {
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
func (md *MDServerDisk) copy(config Config) mdServerLocal {
	// NOTE: observers and sessionHeads are copied shallowly on
	// purpose, so that the MD server that gets a Put will notify all
	// observers correctly no matter where they got on the list.
	log := config.MakeLogger("")
	return &MDServerDisk{config, md.handleDb, md.mdDb, md.branchDb, log,
		md.locksMutex, md.locksDb, md.updateManager,
		md.shutdownLock, md.shutdown, md.shutdownFunc}
}

// isShutdown returns whether the logical, shared MDServer instance
// has been shut down.
func (md *MDServerDisk) isShutdown() bool {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	return *md.shutdown
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

// GetLatestHandleForTLF implements the MDServer interface for MDServerDisk.
func (md *MDServerDisk) GetLatestHandleForTLF(_ context.Context, id TlfID) (
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
