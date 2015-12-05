package libkbfs

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/storage"
	"github.com/syndtr/goleveldb/leveldb/util"
	"golang.org/x/net/context"
)

// MDServerLocal just stores blocks in local leveldb instances.
type MDServerLocal struct {
	config   Config
	handleDb *leveldb.DB // folder handle                  -> folderId
	mdDb     *leveldb.DB // folderId+[branchId]+[revision] -> root metadata (signed)
	branchDb *leveldb.DB // folderId+deviceKID             -> branchId

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
	branchStorage storage.Storage) (*MDServerLocal, error) {
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
	mdserv := &MDServerLocal{config, handleDb, mdDb, branchDb, &sync.Mutex{},
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

	return newMDServerLocalWithStorage(config, handleStorage, mdStorage,
		branchStorage)
}

// NewMDServerMemory constructs a new MDServerLocal object that stores
// all data in-memory.
func NewMDServerMemory(config Config) (*MDServerLocal, error) {
	return newMDServerLocalWithStorage(config,
		storage.NewMemStorage(), storage.NewMemStorage(),
		storage.NewMemStorage())
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) checkPerms(ctx context.Context, id TlfID, checkWrite bool) (bool, error) {
	rmds, err := md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if rmds == nil {
		// TODO: the real mdserver will actually reverse lookup the folder handle
		// and check that the UID is listed.
		return true, nil
	}
	user, err := md.config.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		return false, err
	}
	isWriter := rmds.MD.GetTlfHandle().IsWriter(user)
	if checkWrite {
		return isWriter, nil
	}
	return isWriter || rmds.MD.GetTlfHandle().IsReader(user), nil
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) isReader(ctx context.Context, id TlfID) (bool, error) {
	return md.checkPerms(ctx, id, false)
}

// Helper to aid in enforcement that only specified public keys can access TLF metdata.
func (md *MDServerLocal) isWriter(ctx context.Context, id TlfID) (bool, error) {
	return md.checkPerms(ctx, id, true)
}

// GetForHandle implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetForHandle(ctx context.Context, handle *TlfHandle,
	mStatus MergeStatus) (TlfID, *RootMetadataSigned, error) {
	id := NullTlfID
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	if *md.shutdown {
		return id, nil, errors.New("MD server already shut down")
	}

	handleBytes, err := handle.ToBytes(md.config)
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
	uid, err := md.config.KBPKI().GetCurrentUID(ctx)
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
	rmds = new(RootMetadataSigned)
	err = md.config.Codec().Decode(buf, rmds)
	if err != nil {
		return nil, err
	}
	return rmds, nil
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
	return key.KID, nil
}

// GetRange implements the MDServer interface for MDServerLocal.
func (md *MDServerLocal) GetRange(ctx context.Context, id TlfID,
	bid BranchID, mStatus MergeStatus, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
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
		var rmds RootMetadataSigned
		err := md.config.Codec().Decode(buf, &rmds)
		if err != nil {
			return rmdses, MDServerError{err}
		}
		rmdses = append(rmdses, &rmds)
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
	ok, err := md.isWriter(ctx, id)
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
		if head.MD.Revision+1 != rmds.MD.Revision {
			return MDServerErrorConflictRevision{
				Expected: head.MD.Revision + 1,
				Actual:   rmds.MD.Revision,
			}
		}
		expectedHash, err := head.MD.MetadataID(md.config)
		if err != nil {
			return MDServerError{Err: err}
		}
		if rmds.MD.PrevRoot != expectedHash {
			return MDServerErrorConflictPrevRoot{
				Expected: expectedHash,
				Actual:   rmds.MD.PrevRoot,
			}
		}
		expectedUsage := head.MD.DiskUsage + rmds.MD.RefBytes - rmds.MD.UnrefBytes
		if rmds.MD.DiskUsage != expectedUsage {
			return MDServerErrorConflictDiskUsage{
				Expected: expectedUsage,
				Actual:   rmds.MD.DiskUsage,
			}
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

	buf, err := md.config.Codec().Encode(rmds)
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

	if mStatus == Merged {
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
}

// This should only be used for testing with an in-memory server.
func (md *MDServerLocal) copy(config Config) *MDServerLocal {
	// NOTE: observers and sessionHeads are copied shallowly on
	// purpose, so that the MD server that gets a Put will notify all
	// observers correctly no matter where they got on the list.
	return &MDServerLocal{config, md.handleDb, md.mdDb, md.branchDb, md.mutex,
		md.observers, md.sessionHeads, md.shutdown, md.shutdownLock}
}

// isShutdown returns whether the logical, shared MDServer instance
// has been shut down.
func (md *MDServerLocal) isShutdown() bool {
	md.shutdownLock.RLock()
	defer md.shutdownLock.RUnlock()
	return *md.shutdown
}
