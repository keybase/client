// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"sync"
	"time"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// An mdHandleKey is an encoded tlf.Handle.
type mdHandleKey string

type mdBlockKey struct {
	tlfID    tlf.ID
	branchID kbfsmd.BranchID
}

type mdBranchKey struct {
	tlfID     tlf.ID
	deviceKey kbfscrypto.CryptPublicKey
}

type mdExtraWriterKey struct {
	tlfID          tlf.ID
	writerBundleID kbfsmd.TLFWriterKeyBundleID
}

type mdExtraReaderKey struct {
	tlfID          tlf.ID
	readerBundleID kbfsmd.TLFReaderKeyBundleID
}

type mdBlockMem struct {
	// An encoded RootMetdataSigned.
	encodedMd []byte
	timestamp time.Time
	version   kbfsmd.MetadataVer
}

type mdBlockMemList struct {
	initialRevision kbfsmd.Revision
	blocks          []mdBlockMem
}

const mdLockTimeout = time.Minute

type mdLockMemKey struct {
	tlfID  tlf.ID
	lockID keybase1.LockID
}

type mdLockMemVal struct {
	etime    time.Time
	holder   mdServerLocal
	released chan struct{}
}

type mdServerMemShared struct {
	// Protects all *db variables and truncateLockManager. After
	// Shutdown() is called, all *db variables and
	// truncateLockManager are nil.
	lock sync.RWMutex // nolint
	// Bare TLF handle -> TLF ID
	handleDb map[mdHandleKey]tlf.ID
	// TLF ID -> latest bare TLF handle
	latestHandleDb map[tlf.ID]tlf.Handle
	// (TLF ID, branch ID) -> list of MDs
	mdDb map[mdBlockKey]mdBlockMemList
	// Writer key bundle ID -> writer key bundles
	writerKeyBundleDb map[mdExtraWriterKey]kbfsmd.TLFWriterKeyBundleV3
	// Reader key bundle ID -> reader key bundles
	readerKeyBundleDb map[mdExtraReaderKey]kbfsmd.TLFReaderKeyBundleV3
	// (TLF ID, crypt public key) -> branch ID
	branchDb            map[mdBranchKey]kbfsmd.BranchID
	truncateLockManager *mdServerLocalTruncateLockManager
	// tracks expire time and holder
	lockIDs              map[mdLockMemKey]mdLockMemVal
	implicitTeamsEnabled bool // nolint
	iTeamMigrationLocks  map[tlf.ID]bool
	merkleRoots          map[keybase1.MerkleTreeID]*kbfsmd.MerkleRoot

	updateManager *mdServerLocalUpdateManager
}

// MDServerMemory just stores metadata objects in memory.
type MDServerMemory struct {
	config mdServerLocalConfig
	log    logger.Logger

	*mdServerMemShared
}

var _ mdServerLocal = (*MDServerMemory)(nil)

// NewMDServerMemory constructs a new MDServerMemory object that stores
// all data in-memory.
func NewMDServerMemory(config mdServerLocalConfig) (*MDServerMemory, error) {
	handleDb := make(map[mdHandleKey]tlf.ID)
	latestHandleDb := make(map[tlf.ID]tlf.Handle)
	mdDb := make(map[mdBlockKey]mdBlockMemList)
	branchDb := make(map[mdBranchKey]kbfsmd.BranchID)
	writerKeyBundleDb := make(map[mdExtraWriterKey]kbfsmd.TLFWriterKeyBundleV3)
	readerKeyBundleDb := make(map[mdExtraReaderKey]kbfsmd.TLFReaderKeyBundleV3)
	log := config.MakeLogger("MDSM")
	truncateLockManager := newMDServerLocalTruncatedLockManager()
	shared := mdServerMemShared{
		handleDb:            handleDb,
		latestHandleDb:      latestHandleDb,
		mdDb:                mdDb,
		branchDb:            branchDb,
		writerKeyBundleDb:   writerKeyBundleDb,
		readerKeyBundleDb:   readerKeyBundleDb,
		truncateLockManager: &truncateLockManager,
		lockIDs:             make(map[mdLockMemKey]mdLockMemVal),
		iTeamMigrationLocks: make(map[tlf.ID]bool),
		updateManager:       newMDServerLocalUpdateManager(),
		merkleRoots:         make(map[keybase1.MerkleTreeID]*kbfsmd.MerkleRoot),
	}
	mdserv := &MDServerMemory{config, log, &shared}
	return mdserv, nil
}

type errMDServerMemoryShutdown struct{}

func (e errMDServerMemoryShutdown) Error() string {
	return "MDServerMemory is shutdown"
}

func (md *MDServerMemory) checkShutdownRLocked() error {
	if md.handleDb == nil {
		return errors.WithStack(errMDServerMemoryShutdown{})
	}
	return nil
}

func (md *MDServerMemory) enableImplicitTeams() {
	md.lock.Lock()
	defer md.lock.Unlock()
	md.implicitTeamsEnabled = true
}

func (md *MDServerMemory) setKbfsMerkleRoot(
	treeID keybase1.MerkleTreeID, root *kbfsmd.MerkleRoot) {
	md.lock.Lock()
	defer md.lock.Unlock()
	md.merkleRoots[treeID] = root
}

func (md *MDServerMemory) getHandleID(ctx context.Context, handle tlf.Handle,
	mStatus kbfsmd.MergeStatus) (tlfID tlf.ID, created bool, err error) {
	handleBytes, err := md.config.Codec().Encode(handle)
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}

	md.lock.RLock()
	defer md.lock.RUnlock()
	err = md.checkShutdownRLocked()
	if err != nil {
		return tlf.NullID, false, err
	}

	id, ok := md.handleDb[mdHandleKey(handleBytes)]
	if ok {
		return id, false, nil
	}

	// Non-readers shouldn't be able to create the dir.
	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}
	if handle.Type() == tlf.SingleTeam {
		isReader, err := md.config.teamMembershipChecker().IsTeamReader(
			ctx, handle.Writers[0].AsTeamOrBust(), session.UID,
			keybase1.OfflineAvailability_NONE)
		if err != nil {
			return tlf.NullID, false, kbfsmd.ServerError{Err: err}
		}
		if !isReader {
			return tlf.NullID, false, errors.WithStack(
				kbfsmd.ServerErrorUnauthorized{})
		}
	} else if !handle.IsReader(session.UID.AsUserOrTeam()) {
		return tlf.NullID, false, errors.WithStack(
			kbfsmd.ServerErrorUnauthorized{})
	}

	if md.implicitTeamsEnabled {
		return tlf.NullID, false, kbfsmd.ServerErrorClassicTLFDoesNotExist{}
	}

	// Allocate a new random ID.
	id, err = md.config.cryptoPure().MakeRandomTlfID(handle.Type())
	if err != nil {
		return tlf.NullID, false, kbfsmd.ServerError{Err: err}
	}

	md.handleDb[mdHandleKey(handleBytes)] = id
	md.latestHandleDb[id] = handle
	return id, true, nil
}

// GetForHandle implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetForHandle(ctx context.Context, handle tlf.Handle,
	mStatus kbfsmd.MergeStatus, _ *keybase1.LockID) (
	tlf.ID, *RootMetadataSigned, error) {
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

	rmds, err := md.GetForTLF(ctx, id, kbfsmd.NullBranchID, mStatus, nil)
	if err != nil {
		return tlf.NullID, nil, err
	}
	return id, rmds, nil
}

func (md *MDServerMemory) checkGetParamsRLocked(
	ctx context.Context, id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus) (
	newBid kbfsmd.BranchID, err error) {
	if mStatus == kbfsmd.Merged && bid != kbfsmd.NullBranchID {
		return kbfsmd.NullBranchID, kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Check permissions

	mergedMasterHead, err :=
		md.getHeadForTLFRLocked(ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged)
	if err != nil {
		return kbfsmd.NullBranchID, kbfsmd.ServerError{Err: err}
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return kbfsmd.NullBranchID, kbfsmd.ServerError{Err: err}
	}

	// TODO: Figure out nil case.
	if mergedMasterHead != nil {
		extra, err := getExtraMetadata(
			md.getKeyBundlesRLocked, mergedMasterHead.MD)
		if err != nil {
			return kbfsmd.NullBranchID, kbfsmd.ServerError{Err: err}
		}
		ok, err := isReader(ctx, md.config.teamMembershipChecker(), session.UID,
			mergedMasterHead.MD, extra)
		if err != nil {
			return kbfsmd.NullBranchID, kbfsmd.ServerError{Err: err}
		}
		if !ok {
			return kbfsmd.NullBranchID, errors.WithStack(
				kbfsmd.ServerErrorUnauthorized{})
		}
	}

	// Lookup the branch ID if not supplied
	if mStatus == kbfsmd.Unmerged && bid == kbfsmd.NullBranchID {
		return md.getBranchIDRLocked(ctx, id)
	}

	return bid, nil
}

// GetForTLF implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetForTLF(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, _ *keybase1.LockID) (
	*RootMetadataSigned, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	md.lock.RLock()
	defer md.lock.RUnlock()

	bid, err := md.checkGetParamsRLocked(ctx, id, bid, mStatus)
	if err != nil {
		return nil, err
	}
	if mStatus == kbfsmd.Unmerged && bid == kbfsmd.NullBranchID {
		return nil, nil
	}

	rmds, err := md.getHeadForTLFRLocked(ctx, id, bid, mStatus)
	if err != nil {
		return nil, kbfsmd.ServerError{Err: err}
	}
	return rmds, nil
}

// GetForTLFByTime implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetForTLFByTime(
	ctx context.Context, id tlf.ID, serverTime time.Time) (
	*RootMetadataSigned, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	md.lock.RLock()
	defer md.lock.RUnlock()

	key, err := md.getMDKey(id, kbfsmd.NullBranchID, kbfsmd.Merged)
	if err != nil {
		return nil, err
	}
	err = md.checkShutdownRLocked()
	if err != nil {
		return nil, err
	}

	blockList, ok := md.mdDb[key]
	if !ok {
		return nil, nil
	}
	blocks := blockList.blocks

	// Iterate backward until we find a timestamp less than `serverTime`.
	for i := len(blocks) - 1; i >= 0; i-- {
		t := blocks[i].timestamp
		if t.After(serverTime) {
			continue
		}

		max := md.config.MetadataVersion()
		ver := blocks[i].version
		buf := blocks[i].encodedMd
		rmds, err := DecodeRootMetadataSigned(
			md.config.Codec(), id, ver, max, buf, t)
		if err != nil {
			return nil, err
		}
		return rmds, nil
	}

	return nil, errors.Errorf(
		"No MD found for TLF %s and serverTime %s", id, serverTime)
}

func (md *MDServerMemory) getHeadForTLFRLocked(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus) (*RootMetadataSigned, error) {
	key, err := md.getMDKey(id, bid, mStatus)
	if err != nil {
		return nil, err
	}
	err = md.checkShutdownRLocked()
	if err != nil {
		return nil, err
	}

	blockList, ok := md.mdDb[key]
	if !ok {
		return nil, nil
	}
	blocks := blockList.blocks
	max := md.config.MetadataVersion()
	ver := blocks[len(blocks)-1].version
	buf := blocks[len(blocks)-1].encodedMd
	timestamp := blocks[len(blocks)-1].timestamp
	rmds, err := DecodeRootMetadataSigned(
		md.config.Codec(), id, ver, max, buf, timestamp)
	if err != nil {
		return nil, err
	}
	return rmds, nil
}

func (md *MDServerMemory) getMDKey(
	id tlf.ID, bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus) (mdBlockKey, error) {
	if (mStatus == kbfsmd.Merged) != (bid == kbfsmd.NullBranchID) {
		return mdBlockKey{},
			errors.Errorf("mstatus=%v is inconsistent with bid=%v",
				mStatus, bid)
	}
	return mdBlockKey{id, bid}, nil
}

func (md *MDServerMemory) getBranchKey(ctx context.Context, id tlf.ID) (
	mdBranchKey, error) {
	// add device key
	deviceKey, err := md.getCurrentDeviceKey(ctx)
	if err != nil {
		return mdBranchKey{}, err
	}
	return mdBranchKey{id, deviceKey}, nil
}

func (md *MDServerMemory) getCurrentDeviceKey(ctx context.Context) (
	kbfscrypto.CryptPublicKey, error) {
	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return kbfscrypto.CryptPublicKey{}, err
	}
	return session.CryptPublicKey, nil
}

// GetRange implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) getRangeLocked(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, start, stop kbfsmd.Revision,
	lockBeforeGet *keybase1.LockID) (
	rmdses []*RootMetadataSigned, lockWaitCh <-chan struct{}, err error) {
	md.log.CDebugf(ctx, "GetRange %d %d (%s)", start, stop, mStatus)
	bid, err = md.checkGetParamsRLocked(ctx, id, bid, mStatus)
	if err != nil {
		return nil, nil, err
	}

	if lockBeforeGet != nil {
		lockWaitCh = md.lockLocked(ctx, id, *lockBeforeGet)
		if lockWaitCh != nil {
			return nil, lockWaitCh, nil
		}
		defer func() {
			if err != nil {
				md.releaseLockLocked(ctx, id, *lockBeforeGet)
			}
		}()
	}

	if mStatus == kbfsmd.Unmerged && bid == kbfsmd.NullBranchID {
		return nil, nil, nil
	}

	key, err := md.getMDKey(id, bid, mStatus)
	if err != nil {
		return nil, nil, kbfsmd.ServerError{Err: err}
	}

	err = md.checkShutdownRLocked()
	if err != nil {
		return nil, nil, err
	}

	blockList, ok := md.mdDb[key]
	if !ok {
		return nil, nil, nil
	}

	startI := int(start - blockList.initialRevision)
	if startI < 0 {
		startI = 0
	}
	endI := int(stop - blockList.initialRevision + 1)
	blocks := blockList.blocks
	if endI > len(blocks) {
		endI = len(blocks)
	}

	max := md.config.MetadataVersion()

	for i := startI; i < endI; i++ {
		ver := blocks[i].version
		buf := blocks[i].encodedMd
		rmds, err := DecodeRootMetadataSigned(
			md.config.Codec(), id, ver, max, buf,
			blocks[i].timestamp)
		if err != nil {
			return nil, nil, kbfsmd.ServerError{Err: err}
		}
		expectedRevision := blockList.initialRevision + kbfsmd.Revision(i)
		if expectedRevision != rmds.MD.RevisionNumber() {
			panic(errors.Errorf("expected revision %v, got %v",
				expectedRevision, rmds.MD.RevisionNumber()))
		}
		rmdses = append(rmdses, rmds)
	}

	return rmdses, nil, nil
}

func (md *MDServerMemory) doGetRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, start, stop kbfsmd.Revision,
	lockBeforeGet *keybase1.LockID) (
	[]*RootMetadataSigned, <-chan struct{}, error) {
	md.lock.Lock()
	defer md.lock.Unlock()
	return md.getRangeLocked(ctx, id, bid, mStatus, start, stop, lockBeforeGet)
}

// GetRange implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetRange(ctx context.Context, id tlf.ID,
	bid kbfsmd.BranchID, mStatus kbfsmd.MergeStatus, start, stop kbfsmd.Revision,
	lockBeforeGet *keybase1.LockID) ([]*RootMetadataSigned, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	// An RPC-based client would receive a throttle message from the
	// server and retry with backoff, but here we need to implement
	// the retry logic explicitly.
	for {
		rmds, ch, err := md.doGetRange(
			ctx, id, bid, mStatus, start, stop, lockBeforeGet)
		if err != nil {
			return nil, err
		}
		if ch == nil {
			return rmds, err
		}
		select {
		// TODO: wait for the clock to pass the expired time.  We'd
		// need a new method in the `Clock` interface to support this.
		case <-ch:
			continue
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// Put implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) Put(ctx context.Context, rmds *RootMetadataSigned,
	extra kbfsmd.ExtraMetadata, lc *keybase1.LockContext, _ keybase1.MDPriority) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	session, err := md.config.currentSessionGetter().GetCurrentSession(ctx)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	err = rmds.IsValidAndSigned(
		ctx, md.config.Codec(), md.config.teamMembershipChecker(), extra,
		keybase1.OfflineAvailability_NONE)
	if err != nil {
		return kbfsmd.ServerErrorBadRequest{Reason: err.Error()}
	}

	err = rmds.IsLastModifiedBy(session.UID, session.VerifyingKey)
	if err != nil {
		return kbfsmd.ServerErrorBadRequest{Reason: err.Error()}
	}

	id := rmds.MD.TlfID()

	// Check permissions
	md.lock.Lock()
	defer md.lock.Unlock()

	if lc != nil && !md.isLockedLocked(ctx, id, lc.RequireLockID) {
		return kbfsmd.ServerErrorLockConflict{}
	}

	mergedMasterHead, err :=
		md.getHeadForTLFRLocked(ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	// TODO: Figure out nil case.
	if mergedMasterHead != nil {
		prevExtra, err := getExtraMetadata(
			md.getKeyBundlesRLocked, mergedMasterHead.MD)
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
		ok, err := isWriterOrValidRekey(
			ctx, md.config.teamMembershipChecker(), md.config.Codec(),
			session.UID, session.VerifyingKey, mergedMasterHead.MD,
			rmds.MD, prevExtra, extra)
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
		if !ok {
			return errors.WithStack(kbfsmd.ServerErrorUnauthorized{})
		}
	}

	bid := rmds.MD.BID()
	mStatus := rmds.MD.MergedStatus()

	head, err := md.getHeadForTLFRLocked(ctx, id, bid, mStatus)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	var recordBranchID bool

	if mStatus == kbfsmd.Unmerged && head == nil {
		// currHead for unmerged history might be on the main branch
		prevRev := rmds.MD.RevisionNumber() - 1
		rmdses, ch, err := md.getRangeLocked(
			ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, prevRev, prevRev, nil)
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
		if ch != nil {
			panic("Got non-nil lock channel with a nil lock context")
		}
		if len(rmdses) != 1 {
			return kbfsmd.ServerError{
				Err: errors.Errorf("Expected 1 MD block got %d", len(rmdses)),
			}
		}
		head = rmdses[0]
		recordBranchID = true
	}

	// Consistency checks
	if head != nil {
		id, err := kbfsmd.MakeID(md.config.Codec(), head.MD)
		if err != nil {
			return err
		}
		err = head.MD.CheckValidSuccessorForServer(id, rmds.MD)
		if err != nil {
			return err
		}
	}

	// Record branch ID
	if recordBranchID {
		branchKey, err := md.getBranchKey(ctx, id)
		if err != nil {
			return kbfsmd.ServerError{Err: err}
		}
		err = md.checkShutdownRLocked()
		if err != nil {
			return err
		}
		md.branchDb[branchKey] = bid
	}

	encodedMd, err := kbfsmd.EncodeRootMetadataSigned(md.config.Codec(), &rmds.RootMetadataSigned)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	// Pretend the timestamp went over RPC, so we get the same
	// resolution level as a real server.
	t := keybase1.FromTime(keybase1.ToTime(md.config.Clock().Now()))
	block := mdBlockMem{encodedMd, t, rmds.MD.Version()}

	// Add an entry with the revision key.
	revKey, err := md.getMDKey(id, bid, mStatus)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	err = md.checkShutdownRLocked()
	if err != nil {
		return err
	}

	blockList, ok := md.mdDb[revKey]
	if ok {
		blockList.blocks = append(blockList.blocks, block)
		md.mdDb[revKey] = blockList
	} else {
		md.mdDb[revKey] = mdBlockMemList{
			initialRevision: rmds.MD.RevisionNumber(),
			blocks:          []mdBlockMem{block},
		}
	}

	if err := md.putExtraMetadataLocked(rmds, extra); err != nil {
		return kbfsmd.ServerError{Err: err}
	}

	if lc != nil && lc.ReleaseAfterSuccess {
		md.releaseLockLocked(ctx, id, lc.RequireLockID)
	}

	if mStatus == kbfsmd.Merged &&
		// Don't send notifies if it's just a rekey (the real mdserver
		// sends a "folder needs rekey" notification in this case).
		!(rmds.MD.IsRekeySet() && rmds.MD.IsWriterMetadataCopiedSet()) {
		md.updateManager.setHead(id, md)
	}

	return nil
}

func (md *MDServerMemory) isLockedLocked(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) bool {
	val, ok := md.lockIDs[mdLockMemKey{
		tlfID:  tlfID,
		lockID: lockID,
	}]
	if !ok {
		return false
	}
	return val.etime.After(md.config.Clock().Now()) && md == val.holder
}

func (md *MDServerMemory) lockLocked(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) <-chan struct{} {
	lockKey := mdLockMemKey{
		tlfID:  tlfID,
		lockID: lockID,
	}
	val, ok := md.lockIDs[lockKey]
	if !ok || !val.etime.After(md.config.Clock().Now()) {
		// The lock doesn't exist or has expired.
		md.lockIDs[lockKey] = mdLockMemVal{
			etime:    md.config.Clock().Now().Add(mdLockTimeout),
			holder:   md,
			released: make(chan struct{}),
		}
		if ok {
			close(val.released)
		}
		return nil
	} else if val.holder == md {
		// The lock is already held by this instance; just return
		// without refreshing timestamp.
		return nil
	}
	// Someone else holds the lock; the caller needs to release
	// md.lock and wait for this channel to close.
	return val.released
}

func (md *MDServerMemory) releaseLockLocked(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) {
	lockKey := mdLockMemKey{
		tlfID:  tlfID,
		lockID: lockID,
	}
	val, ok := md.lockIDs[lockKey]
	if !ok || val.holder != md {
		return
	}
	delete(md.lockIDs, lockKey)
	close(val.released)
}

func (md *MDServerMemory) doLock(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) <-chan struct{} {
	md.lock.Lock()
	defer md.lock.Unlock()
	return md.lockLocked(ctx, tlfID, lockID)
}

// Lock implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) Lock(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) error {
	// An RPC-based client would receive a throttle message from the
	// server and retry with backoff, but here we need to implement
	// the retry logic explicitly.
	for {
		ch := md.doLock(ctx, tlfID, lockID)
		if ch == nil {
			return nil
		}
		select {
		// TODO: wait for the clock to pass the expired time.  We'd
		// need a new method in the `Clock` interface to support this.
		case <-ch:
			continue
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// ReleaseLock implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) ReleaseLock(ctx context.Context,
	tlfID tlf.ID, lockID keybase1.LockID) error {
	md.lock.Lock()
	defer md.lock.Unlock()
	md.releaseLockLocked(ctx, tlfID, lockID)
	return nil
}

// StartImplicitTeamMigration implements the MDServer interface.
func (md *MDServerMemory) StartImplicitTeamMigration(
	ctx context.Context, id tlf.ID) (err error) {
	md.lock.Lock()
	defer md.lock.Unlock()
	md.iTeamMigrationLocks[id] = true
	return nil
}

// PruneBranch implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) PruneBranch(ctx context.Context, id tlf.ID, bid kbfsmd.BranchID) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	if bid == kbfsmd.NullBranchID {
		return kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	md.lock.Lock()
	defer md.lock.Unlock()

	currBID, err := md.getBranchIDRLocked(ctx, id)
	if err != nil {
		return err
	}
	if currBID == kbfsmd.NullBranchID || bid != currBID {
		return kbfsmd.ServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Don't actually delete unmerged history. This is intentional to be consistent
	// with the mdserver behavior-- it garbage collects discarded branches in the
	// background.
	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return kbfsmd.ServerError{Err: err}
	}
	err = md.checkShutdownRLocked()
	if err != nil {
		return err
	}

	delete(md.branchDb, branchKey)
	return nil
}

func (md *MDServerMemory) getBranchIDRLocked(ctx context.Context, id tlf.ID) (kbfsmd.BranchID, error) {
	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return kbfsmd.NullBranchID, kbfsmd.ServerError{Err: err}
	}
	err = md.checkShutdownRLocked()
	if err != nil {
		return kbfsmd.NullBranchID, err
	}

	bid, ok := md.branchDb[branchKey]
	if !ok {
		return kbfsmd.NullBranchID, nil
	}
	return bid, nil
}

// RegisterForUpdate implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) RegisterForUpdate(ctx context.Context, id tlf.ID,
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

// CancelRegistration implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) CancelRegistration(_ context.Context, id tlf.ID) {
	md.updateManager.cancel(id, md)
}

// TruncateLock implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) TruncateLock(ctx context.Context, id tlf.ID) (
	bool, error) {
	if err := checkContext(ctx); err != nil {
		return false, err
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	err := md.checkShutdownRLocked()
	if err != nil {
		return false, err
	}

	myKey, err := md.getCurrentDeviceKey(ctx)
	if err != nil {
		return false, err
	}

	return md.truncateLockManager.truncateLock(myKey, id)
}

// TruncateUnlock implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) TruncateUnlock(ctx context.Context, id tlf.ID) (
	bool, error) {
	if err := checkContext(ctx); err != nil {
		return false, err
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	err := md.checkShutdownRLocked()
	if err != nil {
		return false, err
	}

	myKey, err := md.getCurrentDeviceKey(ctx)
	if err != nil {
		return false, err
	}

	return md.truncateLockManager.truncateUnlock(myKey, id)
}

// Shutdown implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) Shutdown() {
	md.lock.Lock()
	defer md.lock.Unlock()
	md.handleDb = nil
	md.latestHandleDb = nil
	md.branchDb = nil
	md.truncateLockManager = nil
}

// IsConnected implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) IsConnected() bool {
	return !md.isShutdown()
}

// RefreshAuthToken implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) RefreshAuthToken(ctx context.Context) {}

// This should only be used for testing with an in-memory server.
func (md *MDServerMemory) copy(config mdServerLocalConfig) mdServerLocal {
	// NOTE: observers and sessionHeads are copied shallowly on
	// purpose, so that the MD server that gets a Put will notify all
	// observers correctly no matter where they got on the list.
	log := config.MakeLogger("")
	return &MDServerMemory{config, log, md.mdServerMemShared}
}

// isShutdown returns whether the logical, shared MDServer instance
// has been shut down.
func (md *MDServerMemory) isShutdown() bool {
	md.lock.RLock()
	defer md.lock.RUnlock()
	return md.checkShutdownRLocked() != nil
}

// DisableRekeyUpdatesForTesting implements the MDServer interface.
func (md *MDServerMemory) DisableRekeyUpdatesForTesting() {
	// Nothing to do.
}

// CheckForRekeys implements the MDServer interface.
func (md *MDServerMemory) CheckForRekeys(ctx context.Context) <-chan error {
	// Nothing to do
	c := make(chan error, 1)
	c <- nil
	return c
}

func (md *MDServerMemory) addNewAssertionForTest(uid keybase1.UID,
	newAssertion keybase1.SocialAssertion) error {
	md.lock.Lock()
	defer md.lock.Unlock()
	err := md.checkShutdownRLocked()
	if err != nil {
		return err
	}

	// Iterate through all the handles, and add handles for ones
	// containing newAssertion to now include the uid.
	for hBytes, id := range md.handleDb {
		var h tlf.Handle
		err := md.config.Codec().Decode([]byte(hBytes), &h)
		if err != nil {
			return err
		}
		assertions := map[keybase1.SocialAssertion]keybase1.UID{
			newAssertion: uid,
		}
		newH := h.ResolveAssertions(assertions)
		if reflect.DeepEqual(h, newH) {
			continue
		}
		newHBytes, err := md.config.Codec().Encode(newH)
		if err != nil {
			return err
		}
		md.handleDb[mdHandleKey(newHBytes)] = id
	}
	return nil
}

func (md *MDServerMemory) getCurrentMergedHeadRevision(
	ctx context.Context, id tlf.ID) (rev kbfsmd.Revision, err error) {
	head, err := md.GetForTLF(ctx, id, kbfsmd.NullBranchID, kbfsmd.Merged, nil)
	if err != nil {
		return 0, err
	}
	if head != nil {
		rev = head.MD.RevisionNumber()
	}
	return
}

// GetLatestHandleForTLF implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetLatestHandleForTLF(ctx context.Context,
	id tlf.ID) (tlf.Handle, error) {
	if err := checkContext(ctx); err != nil {
		return tlf.Handle{}, err
	}

	md.lock.RLock()
	defer md.lock.RUnlock()
	err := md.checkShutdownRLocked()
	if err != nil {
		return tlf.Handle{}, err
	}

	return md.latestHandleDb[id], nil
}

// OffsetFromServerTime implements the MDServer interface for
// MDServerMemory.
func (md *MDServerMemory) OffsetFromServerTime() (time.Duration, bool) {
	return 0, true
}

func (md *MDServerMemory) putExtraMetadataLocked(rmds *RootMetadataSigned,
	extra kbfsmd.ExtraMetadata) error {
	if extra == nil {
		return nil
	}

	extraV3, ok := extra.(*kbfsmd.ExtraMetadataV3)
	if !ok {
		return errors.New("Invalid extra metadata")
	}

	tlfID := rmds.MD.TlfID()

	if extraV3.IsWriterKeyBundleNew() {
		wkbID := rmds.MD.GetTLFWriterKeyBundleID()
		if wkbID == (kbfsmd.TLFWriterKeyBundleID{}) {
			panic("writer key bundle ID is empty")
		}
		md.writerKeyBundleDb[mdExtraWriterKey{tlfID, wkbID}] =
			extraV3.GetWriterKeyBundle()
	}

	if extraV3.IsReaderKeyBundleNew() {
		rkbID := rmds.MD.GetTLFReaderKeyBundleID()
		if rkbID == (kbfsmd.TLFReaderKeyBundleID{}) {
			panic("reader key bundle ID is empty")
		}
		md.readerKeyBundleDb[mdExtraReaderKey{tlfID, rkbID}] =
			extraV3.GetReaderKeyBundle()
	}
	return nil
}

func (md *MDServerMemory) getKeyBundlesRLocked(tlfID tlf.ID,
	wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
	*kbfsmd.TLFWriterKeyBundleV3, *kbfsmd.TLFReaderKeyBundleV3, error) {
	err := md.checkShutdownRLocked()
	if err != nil {
		return nil, nil, err
	}

	var wkb *kbfsmd.TLFWriterKeyBundleV3
	if wkbID != (kbfsmd.TLFWriterKeyBundleID{}) {
		foundWKB, ok := md.writerKeyBundleDb[mdExtraWriterKey{tlfID, wkbID}]
		if !ok {
			return nil, nil, errors.Errorf(
				"Could not find WKB for ID %s", wkbID)
		}

		err := kbfsmd.CheckWKBID(md.config.Codec(), wkbID, foundWKB)
		if err != nil {
			return nil, nil, err
		}

		wkb = &foundWKB
	}

	var rkb *kbfsmd.TLFReaderKeyBundleV3
	if rkbID != (kbfsmd.TLFReaderKeyBundleID{}) {
		foundRKB, ok := md.readerKeyBundleDb[mdExtraReaderKey{tlfID, rkbID}]
		if !ok {
			return nil, nil, errors.Errorf(
				"Could not find RKB for ID %s", rkbID)
		}

		err := kbfsmd.CheckRKBID(md.config.Codec(), rkbID, foundRKB)
		if err != nil {
			return nil, nil, err
		}

		rkb = &foundRKB
	}

	return wkb, rkb, nil
}

// GetKeyBundles implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetKeyBundles(ctx context.Context,
	tlfID tlf.ID, wkbID kbfsmd.TLFWriterKeyBundleID, rkbID kbfsmd.TLFReaderKeyBundleID) (
	*kbfsmd.TLFWriterKeyBundleV3, *kbfsmd.TLFReaderKeyBundleV3, error) {
	if err := checkContext(ctx); err != nil {
		return nil, nil, err
	}

	md.lock.RLock()
	defer md.lock.RUnlock()

	wkb, rkb, err := md.getKeyBundlesRLocked(tlfID, wkbID, rkbID)
	if err != nil {
		return nil, nil, kbfsmd.ServerError{Err: err}
	}
	return wkb, rkb, nil
}

// CheckReachability implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) CheckReachability(ctx context.Context) {}

// FastForwardBackoff implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) FastForwardBackoff() {}

// FindNextMD implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) FindNextMD(
	ctx context.Context, tlfID tlf.ID, rootSeqno keybase1.Seqno) (
	nextKbfsRoot *kbfsmd.MerkleRoot, nextMerkleNodes [][]byte,
	nextRootSeqno keybase1.Seqno, err error) {
	return nil, nil, 0, nil
}

// GetMerkleRootLatest implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetMerkleRootLatest(
	ctx context.Context, treeID keybase1.MerkleTreeID) (
	root *kbfsmd.MerkleRoot, err error) {
	md.lock.RLock()
	defer md.lock.RUnlock()
	return md.merkleRoots[treeID], nil
}
