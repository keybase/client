// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// An mdHandleKey is an encoded BareTlfHandle.
type mdHandleKey string

type mdBlockKey struct {
	tlfID    tlf.ID
	branchID BranchID
}

type mdBranchKey struct {
	tlfID     tlf.ID
	deviceKID keybase1.KID
}

type mdExtraWriterKey struct {
	tlfID          tlf.ID
	writerBundleID TLFWriterKeyBundleID
}

type mdExtraReaderKey struct {
	tlfID          tlf.ID
	readerBundleID TLFReaderKeyBundleID
}

type mdBlockMem struct {
	// An encoded RootMetdataSigned.
	encodedMd []byte
	timestamp time.Time
	version   MetadataVer
}

type mdBlockMemList struct {
	initialRevision MetadataRevision
	blocks          []mdBlockMem
}

type mdServerMemShared struct {
	// Protects all *db variables and truncateLockManager. After
	// Shutdown() is called, all *db variables and
	// truncateLockManager are nil.
	lock sync.RWMutex
	// Bare TLF handle -> TLF ID
	handleDb map[mdHandleKey]tlf.ID
	// TLF ID -> latest bare TLF handle
	latestHandleDb map[tlf.ID]BareTlfHandle
	// (TLF ID, branch ID) -> list of MDs
	mdDb map[mdBlockKey]mdBlockMemList
	// Writer key bundle ID -> writer key bundles
	writerKeyBundleDb map[mdExtraWriterKey]*TLFWriterKeyBundleV3
	// Reader key bundle ID -> reader key bundles
	readerKeyBundleDb map[mdExtraReaderKey]*TLFReaderKeyBundleV3
	// (TLF ID, device KID) -> branch ID
	branchDb            map[mdBranchKey]BranchID
	truncateLockManager *mdServerLocalTruncateLockManager

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
	latestHandleDb := make(map[tlf.ID]BareTlfHandle)
	mdDb := make(map[mdBlockKey]mdBlockMemList)
	branchDb := make(map[mdBranchKey]BranchID)
	writerKeyBundleDb := make(map[mdExtraWriterKey]*TLFWriterKeyBundleV3)
	readerKeyBundleDb := make(map[mdExtraReaderKey]*TLFReaderKeyBundleV3)
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
		updateManager:       newMDServerLocalUpdateManager(),
	}
	mdserv := &MDServerMemory{config, log, &shared}
	return mdserv, nil
}

var errMDServerMemoryShutdown = errors.New("MDServerMemory is shutdown")

func (md *MDServerMemory) getHandleID(ctx context.Context, handle BareTlfHandle,
	mStatus MergeStatus) (tlfID tlf.ID, created bool, err error) {
	handleBytes, err := md.config.Codec().Encode(handle)
	if err != nil {
		return tlf.NullID, false, MDServerError{err}
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	if md.handleDb == nil {
		return tlf.NullID, false, errMDServerDiskShutdown
	}

	id, ok := md.handleDb[mdHandleKey(handleBytes)]
	if ok {
		return id, false, nil
	}

	// Non-readers shouldn't be able to create the dir.
	_, uid, err := md.config.currentInfoGetter().GetCurrentUserInfo(ctx)
	if err != nil {
		return tlf.NullID, false, MDServerError{err}
	}
	if !handle.IsReader(uid) {
		return tlf.NullID, false, MDServerErrorUnauthorized{}
	}

	// Allocate a new random ID.
	id, err = md.config.cryptoPure().MakeRandomTlfID(handle.IsPublic())
	if err != nil {
		return tlf.NullID, false, MDServerError{err}
	}

	md.handleDb[mdHandleKey(handleBytes)] = id
	md.latestHandleDb[id] = handle
	return id, true, nil
}

// GetForHandle implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetForHandle(ctx context.Context, handle BareTlfHandle,
	mStatus MergeStatus) (tlf.ID, *RootMetadataSigned, error) {
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

func (md *MDServerMemory) checkGetParams(
	ctx context.Context, id tlf.ID, bid BranchID, mStatus MergeStatus) (
	newBid BranchID, err error) {
	if mStatus == Merged && bid != NullBranchID {
		return NullBranchID, MDServerErrorBadRequest{Reason: "Invalid branch ID"}
	}

	// Check permissions

	mergedMasterHead, err :=
		md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return NullBranchID, MDServerError{err}
	}

	_, currentUID, err := md.config.currentInfoGetter().GetCurrentUserInfo(ctx)
	if err != nil {
		return NullBranchID, MDServerError{err}
	}

	// TODO: Figure out nil case.
	if mergedMasterHead != nil {
		extra, err := md.getExtraMetadata(
			id, mergedMasterHead.MD.GetTLFWriterKeyBundleID(),
			mergedMasterHead.MD.GetTLFReaderKeyBundleID())
		if err != nil {
			return NullBranchID, MDServerError{err}
		}
		ok, err := isReader(currentUID, mergedMasterHead.MD, extra)
		if err != nil {
			return NullBranchID, MDServerError{err}
		}
		if !ok {
			return NullBranchID, MDServerErrorUnauthorized{}
		}
	}

	// Lookup the branch ID if not supplied
	if mStatus == Unmerged && bid == NullBranchID {
		return md.getBranchID(ctx, id)
	}

	return bid, nil
}

// GetForTLF implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetForTLF(ctx context.Context, id tlf.ID,
	bid BranchID, mStatus MergeStatus) (*RootMetadataSigned, error) {
	bid, err := md.checkGetParams(ctx, id, bid, mStatus)
	if err != nil {
		return nil, err
	}
	if mStatus == Unmerged && bid == NullBranchID {
		return nil, nil
	}

	rmds, err := md.getHeadForTLF(ctx, id, bid, mStatus)
	if err != nil {
		return nil, MDServerError{err}
	}
	return rmds, nil
}

func (md *MDServerMemory) getHeadForTLF(ctx context.Context, id tlf.ID,
	bid BranchID, mStatus MergeStatus) (*RootMetadataSigned, error) {
	key, err := md.getMDKey(id, bid, mStatus)
	if err != nil {
		return nil, err
	}
	md.lock.Lock()
	defer md.lock.Unlock()
	if md.mdDb == nil {
		return nil, errMDServerMemoryShutdown
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
	id tlf.ID, bid BranchID, mStatus MergeStatus) (mdBlockKey, error) {
	if (mStatus == Merged) != (bid == NullBranchID) {
		return mdBlockKey{},
			fmt.Errorf("mstatus=%v is inconsistent with bid=%v",
				mStatus, bid)
	}
	return mdBlockKey{id, bid}, nil
}

func (md *MDServerMemory) getBranchKey(ctx context.Context, id tlf.ID) (
	mdBranchKey, error) {
	// add device KID
	deviceKID, err := md.getCurrentDeviceKID(ctx)
	if err != nil {
		return mdBranchKey{}, err
	}
	return mdBranchKey{id, deviceKID}, nil
}

func (md *MDServerMemory) getCurrentDeviceKID(ctx context.Context) (keybase1.KID, error) {
	key, err := md.config.currentInfoGetter().GetCurrentCryptPublicKey(ctx)
	if err != nil {
		return keybase1.KID(""), err
	}
	return key.KID(), nil
}

// GetRange implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetRange(ctx context.Context, id tlf.ID,
	bid BranchID, mStatus MergeStatus, start, stop MetadataRevision) (
	[]*RootMetadataSigned, error) {
	md.log.CDebugf(ctx, "GetRange %d %d (%s)", start, stop, mStatus)
	bid, err := md.checkGetParams(ctx, id, bid, mStatus)
	if err != nil {
		return nil, err
	}
	if mStatus == Unmerged && bid == NullBranchID {
		return nil, nil
	}

	key, err := md.getMDKey(id, bid, mStatus)
	if err != nil {
		return nil, MDServerError{err}
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	if md.mdDb == nil {
		return nil, errMDServerMemoryShutdown
	}

	blockList, ok := md.mdDb[key]
	if !ok {
		return nil, nil
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

	var rmdses []*RootMetadataSigned
	for i := startI; i < endI; i++ {
		ver := blocks[i].version
		buf := blocks[i].encodedMd
		rmds, err := DecodeRootMetadataSigned(
			md.config.Codec(), id, ver, max, buf,
			blocks[i].timestamp)
		if err != nil {
			return nil, MDServerError{err}
		}
		expectedRevision := blockList.initialRevision + MetadataRevision(i)
		if expectedRevision != rmds.MD.RevisionNumber() {
			panic(fmt.Errorf("expected revision %v, got %v",
				expectedRevision, rmds.MD.RevisionNumber()))
		}
		rmdses = append(rmdses, rmds)
	}

	return rmdses, nil
}

// Put implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) Put(ctx context.Context, rmds *RootMetadataSigned,
	extra ExtraMetadata) error {

	currentUID, currentVerifyingKey, err :=
		getCurrentUIDAndVerifyingKey(ctx, md.config.currentInfoGetter())
	if err != nil {
		return MDServerError{err}
	}

	if extra == nil {
		var err error
		extra, err = md.getExtraMetadata(
			rmds.MD.TlfID(), rmds.MD.GetTLFWriterKeyBundleID(),
			rmds.MD.GetTLFReaderKeyBundleID())
		if err != nil {
			return MDServerError{err}
		}
	}

	err = rmds.IsValidAndSigned(md.config.Codec(), md.config.cryptoPure(), extra)
	if err != nil {
		return MDServerErrorBadRequest{Reason: err.Error()}
	}

	err = rmds.IsLastModifiedBy(currentUID, currentVerifyingKey)
	if err != nil {
		return MDServerErrorBadRequest{Reason: err.Error()}
	}

	id := rmds.MD.TlfID()

	// Check permissions

	mergedMasterHead, err :=
		md.getHeadForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return MDServerError{err}
	}

	// TODO: Figure out nil case.
	if mergedMasterHead != nil {
		prevExtra, err := md.getExtraMetadata(
			mergedMasterHead.MD.TlfID(),
			mergedMasterHead.MD.GetTLFWriterKeyBundleID(),
			mergedMasterHead.MD.GetTLFReaderKeyBundleID())
		if err != nil {
			return MDServerError{err}
		}
		ok, err := isWriterOrValidRekey(
			md.config.Codec(), currentUID,
			mergedMasterHead.MD, rmds.MD,
			prevExtra, extra)
		if err != nil {
			return MDServerError{err}
		}
		if !ok {
			return MDServerErrorUnauthorized{}
		}
	}

	bid := rmds.MD.BID()
	mStatus := rmds.MD.MergedStatus()

	head, err := md.getHeadForTLF(ctx, id, bid, mStatus)
	if err != nil {
		return MDServerError{err}
	}

	var recordBranchID bool

	if mStatus == Unmerged && head == nil {
		// currHead for unmerged history might be on the main branch
		prevRev := rmds.MD.RevisionNumber() - 1
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
		id, err := md.config.cryptoPure().MakeMdID(head.MD)
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
			return MDServerError{err}
		}
		err = func() error {
			md.lock.Lock()
			defer md.lock.Unlock()
			if md.branchDb == nil {
				return errMDServerMemoryShutdown
			}
			md.branchDb[branchKey] = bid
			return nil
		}()
		if err != nil {
			return err
		}
	}

	encodedMd, err := EncodeRootMetadataSigned(md.config.Codec(), rmds)
	if err != nil {
		return MDServerError{err}
	}

	block := mdBlockMem{encodedMd, md.config.Clock().Now(), rmds.MD.Version()}

	// Add an entry with the revision key.
	revKey, err := md.getMDKey(id, bid, mStatus)
	if err != nil {
		return MDServerError{err}
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	if md.mdDb == nil {
		return errMDServerMemoryShutdown
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

// PruneBranch implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) PruneBranch(ctx context.Context, id tlf.ID, bid BranchID) error {
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
	md.lock.Lock()
	defer md.lock.Unlock()
	if md.mdDb == nil {
		return errMDServerMemoryShutdown
	}

	delete(md.branchDb, branchKey)
	return nil
}

func (md *MDServerMemory) getBranchID(ctx context.Context, id tlf.ID) (BranchID, error) {
	branchKey, err := md.getBranchKey(ctx, id)
	if err != nil {
		return NullBranchID, MDServerError{err}
	}
	md.lock.Lock()
	defer md.lock.Unlock()
	if md.branchDb == nil {
		return NullBranchID, errMDServerMemoryShutdown
	}

	bid, ok := md.branchDb[branchKey]
	if !ok {
		return NullBranchID, nil
	}
	return bid, nil
}

// RegisterForUpdate implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) RegisterForUpdate(ctx context.Context, id tlf.ID,
	currHead MetadataRevision) (<-chan error, error) {
	// are we already past this revision?  If so, fire observer
	// immediately
	currMergedHeadRev, err := md.getCurrentMergedHeadRevision(ctx, id)
	if err != nil {
		return nil, err
	}

	c := md.updateManager.registerForUpdate(id, currHead, currMergedHeadRev, md)
	return c, nil
}

func (md *MDServerMemory) getCurrentDeviceKIDBytes(ctx context.Context) (
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

// TruncateLock implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) TruncateLock(ctx context.Context, id tlf.ID) (
	bool, error) {
	md.lock.Lock()
	defer md.lock.Unlock()
	if md.truncateLockManager == nil {
		return false, errMDServerMemoryShutdown
	}

	myKID, err := md.getCurrentDeviceKID(ctx)
	if err != nil {
		return false, err
	}

	return md.truncateLockManager.truncateLock(myKID, id)
}

// TruncateUnlock implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) TruncateUnlock(ctx context.Context, id tlf.ID) (
	bool, error) {
	md.lock.Lock()
	defer md.lock.Unlock()
	if md.truncateLockManager == nil {
		return false, errMDServerMemoryShutdown
	}

	myKID, err := md.getCurrentDeviceKID(ctx)
	if err != nil {
		return false, err
	}

	return md.truncateLockManager.truncateUnlock(myKID, id)
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
	return md.handleDb == nil
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
	if md.handleDb == nil {
		return errMDServerMemoryShutdown
	}

	// Iterate through all the handles, and add handles for ones
	// containing newAssertion to now include the uid.
	for hBytes, id := range md.handleDb {
		var h BareTlfHandle
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
	ctx context.Context, id tlf.ID) (rev MetadataRevision, err error) {
	head, err := md.GetForTLF(ctx, id, NullBranchID, Merged)
	if err != nil {
		return 0, err
	}
	if head != nil {
		rev = head.MD.RevisionNumber()
	}
	return
}

// GetLatestHandleForTLF implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetLatestHandleForTLF(_ context.Context, id tlf.ID) (
	BareTlfHandle, error) {
	md.lock.RLock()
	defer md.lock.RUnlock()
	if md.latestHandleDb == nil {
		return BareTlfHandle{}, errMDServerMemoryShutdown
	}

	return md.latestHandleDb[id], nil
}

// OffsetFromServerTime implements the MDServer interface for
// MDServerMemory.
func (md *MDServerMemory) OffsetFromServerTime() (time.Duration, bool) {
	return 0, true
}

func (md *MDServerMemory) getExtraMetadata(
	tlfID tlf.ID, wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID) (
	ExtraMetadata, error) {
	wkb, rkb, err := md.getKeyBundles(tlfID, wkbID, rkbID)
	if err != nil {
		return nil, err
	}
	if wkb == nil || rkb == nil {
		return nil, nil
	}
	return &ExtraMetadataV3{wkb: wkb, rkb: rkb}, nil
}

func (md *MDServerMemory) putExtraMetadataLocked(rmds *RootMetadataSigned,
	extra ExtraMetadata) error {
	if extra == nil {
		return nil
	}

	tlfID := rmds.MD.TlfID()
	wkbID := rmds.MD.GetTLFWriterKeyBundleID()
	if wkbID == (TLFWriterKeyBundleID{}) {
		panic("writer key bundle ID is empty")
	}

	rkbID := rmds.MD.GetTLFReaderKeyBundleID()
	if rkbID == (TLFReaderKeyBundleID{}) {
		panic("reader key bundle ID is empty")
	}

	extraV3, ok := extra.(*ExtraMetadataV3)
	if !ok {
		return errors.New("Invalid extra metadata")
	}

	err := checkKeyBundlesV3(md.config.cryptoPure(),
		wkbID, rkbID, extraV3.wkb, extraV3.rkb)
	if err != nil {
		return err
	}

	md.writerKeyBundleDb[mdExtraWriterKey{tlfID, wkbID}] = extraV3.wkb
	md.readerKeyBundleDb[mdExtraReaderKey{tlfID, rkbID}] = extraV3.rkb
	return nil
}

func (md *MDServerMemory) getKeyBundles(
	tlfID tlf.ID, wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error) {
	if (wkbID == TLFWriterKeyBundleID{}) !=
		(rkbID == TLFReaderKeyBundleID{}) {
		return nil, nil, fmt.Errorf(
			"wkbID is empty (%t) != rkbID is empty (%t)",
			wkbID == TLFWriterKeyBundleID{},
			rkbID == TLFReaderKeyBundleID{})
	}

	if wkbID == (TLFWriterKeyBundleID{}) {
		return nil, nil, nil
	}

	md.lock.Lock()
	defer md.lock.Unlock()
	wkb := md.writerKeyBundleDb[mdExtraWriterKey{tlfID, wkbID}]
	rkb := md.readerKeyBundleDb[mdExtraReaderKey{tlfID, rkbID}]

	err := checkKeyBundlesV3(md.config.cryptoPure(), wkbID, rkbID, wkb, rkb)
	if err != nil {
		return nil, nil, err
	}

	return wkb, rkb, nil
}

// GetKeyBundles implements the MDServer interface for MDServerMemory.
func (md *MDServerMemory) GetKeyBundles(_ context.Context,
	tlfID tlf.ID, wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error) {
	return md.getKeyBundles(tlfID, wkbID, rkbID)
}
