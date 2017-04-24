// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type CheckBlockOps struct {
	BlockOps
	tr gomock.TestReporter
}

var _ BlockOps = (*CheckBlockOps)(nil)

func (cbo *CheckBlockOps) Ready(ctx context.Context, kmd KeyMetadata,
	block Block) (id kbfsblock.ID, plainSize int, readyBlockData ReadyBlockData,
	err error) {
	id, plainSize, readyBlockData, err = cbo.BlockOps.Ready(ctx, kmd, block)
	encodedSize := readyBlockData.GetEncodedSize()
	if plainSize > encodedSize {
		cbo.tr.Errorf("expected plainSize <= encodedSize, got plainSize = %d, "+
			"encodedSize = %d", plainSize, encodedSize)
	}
	return
}

type tCtxIDType int

const (
	tCtxID tCtxIDType = iota
)

// Time out individual tests after 10 seconds.
var individualTestTimeout = 10 * time.Second

func kbfsOpsInit(t *testing.T, changeMd bool) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context, cancel context.CancelFunc) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.SetCodec(kbfscodec.NewMsgpack())
	blockops := &CheckBlockOps{config.mockBops, ctr}
	config.SetBlockOps(blockops)
	kbfsops := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsops)
	config.SetNotifier(kbfsops)

	// Use real caches, to avoid the overhead of tracking cache calls.
	// Each test is expected to check the cache for correctness at the
	// end of the test.
	config.SetBlockCache(NewBlockCacheStandard(100, 1<<30))
	config.SetDirtyBlockCache(NewDirtyBlockCacheStandard(wallClock{},
		config.MakeLogger(""), 5<<20, 10<<20, 5<<20))
	config.mockBcache = nil
	config.mockDirtyBcache = nil

	if changeMd {
		// Give different values for the MD Id so we can test that it
		// is properly cached
		config.mockCrypto.EXPECT().MakeMdID(gomock.Any()).AnyTimes().
			Return(fakeMdID(2), nil)
	} else {
		config.mockCrypto.EXPECT().MakeMdID(gomock.Any()).AnyTimes().
			Return(fakeMdID(1), nil)
	}

	// These tests don't rely on external notifications at all, so ignore any
	// goroutine attempting to register:
	c := make(chan error, 1)
	config.mockMdserv.EXPECT().RegisterForUpdate(gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(c, nil)
	config.mockMdserv.EXPECT().OffsetFromServerTime().
		Return(time.Duration(0), true).AnyTimes()

	// None of these tests depend on time
	config.mockClock.EXPECT().Now().AnyTimes().Return(time.Now())

	// Ignore Notify calls for now
	config.mockRep.EXPECT().Notify(gomock.Any(), gomock.Any()).AnyTimes()

	// Max out MaxPtrsPerBlock
	config.mockBsplit.EXPECT().MaxPtrsPerBlock().
		Return(int((^uint(0)) >> 1)).AnyTimes()

	// Ignore Archive calls for now
	config.mockBops.EXPECT().Archive(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)
	// Ignore Archive calls for now
	config.mockBops.EXPECT().Archive(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)
	// Ignore Prefetcher calls
	brc := &testBlockRetrievalConfig{nil, newTestLogMaker(t),
		config.BlockCache(), nil, newTestDiskBlockCacheGetter(t, nil)}
	pre := newBlockPrefetcher(nil, brc)
	config.mockBops.EXPECT().Prefetcher().AnyTimes().Return(pre)
	// Ignore BlockRetriever calls
	brq := newBlockRetrievalQueue(0, brc)
	config.mockBops.EXPECT().BlockRetriever().AnyTimes().Return(brq)

	// Ignore key bundle ID creation calls for now
	config.mockCrypto.EXPECT().MakeTLFWriterKeyBundleID(gomock.Any()).
		AnyTimes().Return(TLFWriterKeyBundleID{}, nil)
	config.mockCrypto.EXPECT().MakeTLFReaderKeyBundleID(gomock.Any()).
		AnyTimes().Return(TLFReaderKeyBundleID{}, nil)

	// Ignore favorites
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).AnyTimes().
		Return(nil, nil)
	config.mockKbpki.EXPECT().FavoriteAdd(gomock.Any(), gomock.Any()).
		AnyTimes().Return(nil)

	interposeDaemonKBPKI(config, "alice", "bob", "charlie")

	timeoutCtx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	initSuccess := false
	defer func() {
		if !initSuccess {
			cancel()
		}
	}()

	// make the context identifiable, to verify that it is passed
	// correctly to the observer
	id := rand.Int()
	ctx, err := NewContextWithCancellationDelayer(NewContextReplayable(
		timeoutCtx, func(ctx context.Context) context.Context {
			return context.WithValue(ctx, tCtxID, id)
		}))
	if err != nil {
		t.Fatal(err)
	}

	initSuccess = true
	return mockCtrl, config, ctx, cancel
}

func kbfsTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock,
	ctx context.Context, cancel context.CancelFunc) {
	config.ctr.CheckForFailures()
	config.KBFSOps().(*KBFSOpsStandard).Shutdown(ctx)
	if config.mockDirtyBcache == nil {
		if err := config.DirtyBlockCache().Shutdown(); err != nil {
			// Ignore error; some tests intentionally leave around dirty data.
		}
	}
	cancel()
	if err := CleanupCancellationDelayer(ctx); err != nil {
		panic(err)
	}
	mockCtrl.Finish()
}

// kbfsOpsInitNoMocks returns a config that doesn't use any mocks. The
// shutdown call is kbfsTestShutdownNoMocks.
func kbfsOpsInitNoMocks(t *testing.T, users ...libkb.NormalizedUsername) (
	*ConfigLocal, keybase1.UID, context.Context, context.CancelFunc) {
	config := MakeTestConfigOrBust(t, users...)
	config.SetRekeyWithPromptWaitTime(individualTestTimeout)

	timeoutCtx, cancel := context.WithTimeout(
		context.Background(), individualTestTimeout)
	initSuccess := false
	defer func() {
		if !initSuccess {
			cancel()
		}
	}()

	ctx, err := NewContextWithCancellationDelayer(NewContextReplayable(
		timeoutCtx, func(c context.Context) context.Context {
			return c
		}))
	if err != nil {
		t.Fatal(err)
	}

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}

	initSuccess = true
	return config, session.UID, ctx, cancel
}

func kbfsTestShutdownNoMocks(t *testing.T, config *ConfigLocal,
	ctx context.Context, cancel context.CancelFunc) {
	CheckConfigAndShutdown(ctx, t, config)
	cancel()
	CleanupCancellationDelayer(ctx)
}

// TODO: Get rid of all users of this.
func kbfsTestShutdownNoMocksNoCheck(t *testing.T, config *ConfigLocal,
	ctx context.Context, cancel context.CancelFunc) {
	config.Shutdown(ctx)
	cancel()
	CleanupCancellationDelayer(ctx)
}

func checkBlockCache(t *testing.T, config *ConfigMock, id tlf.ID,
	expectedCleanBlocks []kbfsblock.ID,
	expectedDirtyBlocks map[BlockPointer]BranchName) {
	bcache := config.BlockCache().(*BlockCacheStandard)
	// make sure the LRU consists of exactly the right set of clean blocks
	for _, id := range expectedCleanBlocks {
		_, ok := bcache.cleanTransient.Get(id)
		if !ok {
			t.Errorf("BlockCache missing clean block %v at the end of the test",
				id)
		}
	}
	if bcache.cleanTransient.Len() != len(expectedCleanBlocks) {
		t.Errorf("BlockCache has extra clean blocks at end of test")
	}

	// make sure the dirty cache consists of exactly the right set of
	// dirty blocks
	dirtyBcache := config.DirtyBlockCache().(*DirtyBlockCacheStandard)
	for ptr, branch := range expectedDirtyBlocks {
		_, err := dirtyBcache.Get(id, ptr, branch)
		if err != nil {
			t.Errorf("BlockCache missing dirty block %v, branch %s at "+
				"the end of the test: err %+v", ptr, branch, err)
		}
		if !dirtyBcache.IsDirty(id, ptr, branch) {
			t.Errorf("BlockCache has incorrectly clean block %v, branch %s at "+
				"the end of the test: err %+v", ptr, branch, err)
		}
	}
	if len(dirtyBcache.cache) != len(expectedDirtyBlocks) {
		t.Errorf("BlockCache has extra dirty blocks at end of test")
	}
}

func TestKBFSOpsGetFavoritesSuccess(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	handle1 := parseTlfHandleOrBust(t, config, "alice", false)
	handle2 := parseTlfHandleOrBust(t, config, "alice,bob", false)

	// dup for testing
	handles := []*TlfHandle{handle1, handle2, handle2}
	for _, h := range handles {
		config.KeybaseService().FavoriteAdd(
			context.Background(), h.ToFavorite().toKBFolder(false))
	}

	// The favorites list contains our own public dir by default, even
	// if KBPKI doesn't return it.

	handle3 := parseTlfHandleOrBust(t, config, "alice", true)
	handles = append(handles, handle3)

	handles2, err := config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		t.Errorf("Got error on favorites: %+v", err)
	}
	if len(handles2) != len(handles)-1 {
		t.Errorf("Got bad handles back: %v", handles2)
	}
}

func TestKBFSOpsGetFavoritesFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	err := errors.New("Fake fail")

	// Replace the old one (added in init function)
	config.mockKbpki = NewMockKBPKI(mockCtrl)
	config.SetKBPKI(config.mockKbpki)

	// expect one call to favorites, and fail it
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).Return(nil, err)

	if _, err2 := config.KBFSOps().GetFavorites(ctx); err2 != err {
		t.Errorf("Got bad error on favorites: %+v", err2)
	}
}

func getOps(config Config, id tlf.ID) *folderBranchOps {
	return config.KBFSOps().(*KBFSOpsStandard).
		getOpsNoAdd(FolderBranch{id, MasterBranch})
}

// createNewRMD creates a new RMD for the given name. Returns its ID
// and handle also.
func createNewRMD(t *testing.T, config Config, name string, public bool) (
	tlf.ID, *TlfHandle, *RootMetadata) {
	id := tlf.FakeID(1, public)
	h := parseTlfHandleOrBust(t, config, name, public)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	return id, h, rmd
}

func makeImmutableRMDForTest(t *testing.T, config Config, rmd *RootMetadata,
	mdID MdID) ImmutableRootMetadata {
	session, err := config.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	// We have to fake out the signature here because most tests
	// in this file modify the returned value, invalidating any
	// real signatures. TODO: Fix all the tests in this file to
	// not do so, and then just use MakeImmutableRootMetadata.
	if brmdv2, ok := rmd.bareMd.(*BareRootMetadataV2); ok {
		vk := brmdv2.WriterMetadataSigInfo.VerifyingKey
		require.True(t, vk == (kbfscrypto.VerifyingKey{}) || vk == session.VerifyingKey,
			"Writer signature %s with unexpected non-nil verifying key != %s",
			brmdv2.WriterMetadataSigInfo, session.VerifyingKey)
		brmdv2.WriterMetadataSigInfo = kbfscrypto.SignatureInfo{
			VerifyingKey: session.VerifyingKey,
		}
	}
	return MakeImmutableRootMetadata(rmd, session.VerifyingKey, mdID, time.Now())
}

// injectNewRMD creates a new RMD and makes sure the existing ops for
// its ID has as its head that RMD.
func injectNewRMD(t *testing.T, config *ConfigMock) (
	keybase1.UID, tlf.ID, *RootMetadata) {
	id, h, rmd := createNewRMD(t, config, "alice", false)
	var keyGen KeyGen
	if id.IsPublic() {
		keyGen = PublicKeyGen
	} else {
		keyGen = 1
	}
	rmd.data.Dir = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: BlockPointer{
				KeyGen:  keyGen,
				DataVer: 1,
			},
			EncodedSize: 1,
		},
	}
	rmd.fakeInitialRekey()

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(
		t, config, rmd, fakeMdID(tlf.FakeIDByte(id)))
	ops.headStatus = headTrusted
	rmd.SetSerializedPrivateMetadata(make([]byte, 1))
	config.Notifier().RegisterForChanges(
		[]FolderBranch{{id, MasterBranch}}, config.observer)
	uid := h.FirstResolvedWriter()
	rmd.data.Dir.Creator = uid
	return uid, id, rmd
}

func TestKBFSOpsGetRootNodeCacheSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	_, id, rmd := injectNewRMD(t, config)
	rmd.data.Dir.BlockPointer.ID = kbfsblock.FakeID(1)
	rmd.data.Dir.Type = Dir

	ops := getOps(config, id)
	assert.False(t, fboIdentityDone(ops))

	n, ei, h, err := ops.getRootNode(ctx)
	require.NoError(t, err)
	assert.False(t, fboIdentityDone(ops))

	p := ops.nodeCache.PathFromNode(n)
	assert.Equal(t, id, p.Tlf)
	require.Equal(t, 1, len(p.path))
	assert.Equal(t, rmd.data.Dir.ID, p.path[0].ID)
	assert.Equal(t, rmd.data.Dir.EntryInfo, ei)
	assert.Equal(t, rmd.GetTlfHandle(), h)

	// Trigger identify.
	lState := makeFBOLockState()
	_, err = ops.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err)
	assert.True(t, fboIdentityDone(ops))
}

func TestKBFSOpsGetRootNodeReIdentify(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	_, id, rmd := injectNewRMD(t, config)
	rmd.data.Dir.BlockPointer.ID = kbfsblock.FakeID(1)
	rmd.data.Dir.Type = Dir

	ops := getOps(config, id)
	assert.False(t, fboIdentityDone(ops))

	n, ei, h, err := ops.getRootNode(ctx)
	require.NoError(t, err)
	assert.False(t, fboIdentityDone(ops))

	p := ops.nodeCache.PathFromNode(n)
	assert.Equal(t, id, p.Tlf)
	require.Equal(t, 1, len(p.path))
	assert.Equal(t, rmd.data.Dir.ID, p.path[0].ID)
	assert.Equal(t, rmd.data.Dir.EntryInfo, ei)
	assert.Equal(t, rmd.GetTlfHandle(), h)

	// Trigger identify.
	lState := makeFBOLockState()
	_, err = ops.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err)
	assert.True(t, fboIdentityDone(ops))

	// Mark everything for reidentifying, and wait for it to finish
	// before checking.
	kop := config.KBFSOps().(*KBFSOpsStandard)
	returnCh := make(chan struct{})
	kop.reIdentifyControlChan <- returnCh
	<-returnCh
	assert.False(t, fboIdentityDone(ops))

	// Trigger new identify.
	lState = makeFBOLockState()
	_, err = ops.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err)
	assert.True(t, fboIdentityDone(ops))
}

// fboIdentityDone is needed to avoid data races.
func fboIdentityDone(fbo *folderBranchOps) bool {
	fbo.identifyLock.Lock()
	defer fbo.identifyLock.Unlock()
	return fbo.identifyDone
}

type failIdentifyKBPKI struct {
	KBPKI
	identifyErr error
}

func (kbpki failIdentifyKBPKI) Identify(ctx context.Context, assertion, reason string) (UserInfo, error) {
	return UserInfo{}, kbpki.identifyErr
}

func TestKBFSOpsGetRootNodeCacheIdentifyFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	_, id, rmd := injectNewRMD(t, config)

	rmd.data.Dir.BlockPointer.ID = kbfsblock.FakeID(1)
	rmd.data.Dir.Type = Dir

	ops := getOps(config, id)

	expectedErr := errors.New("Identify failure")
	config.SetKBPKI(failIdentifyKBPKI{config.KBPKI(), expectedErr})

	// Trigger identify.
	lState := makeFBOLockState()
	_, err := ops.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
	assert.Equal(t, expectedErr, err)
	assert.False(t, fboIdentityDone(ops))
}

func expectBlock(config *ConfigMock, kmd KeyMetadata, blockPtr BlockPointer, block Block, err error) {
	config.mockBops.EXPECT().Get(gomock.Any(), kmdMatcher{kmd},
		ptrMatcher{blockPtr}, gomock.Any(), gomock.Any()).
		Do(func(ctx context.Context, kmd KeyMetadata,
			blockPtr BlockPointer, getBlock Block, lifetime BlockCacheLifetime) {
			getBlock.Set(block)
			config.BlockCache().Put(blockPtr, kmd.TlfID(), getBlock, lifetime)
		}).Return(err)
}

// ptrMatcher implements the gomock.Matcher interface to compare
// BlockPointer objects. We don't care about some of the fields in a
// pointer for the purposes of these tests.
type ptrMatcher struct {
	ptr BlockPointer
}

// Matches implements the Matcher interface for ptrMatcher.
func (p ptrMatcher) Matches(x interface{}) bool {
	xPtr, ok := x.(BlockPointer)
	if !ok {
		return false
	}
	return (xPtr.ID == p.ptr.ID && xPtr.RefNonce == p.ptr.RefNonce)
}

// String implements the Matcher interface for ptrMatcher.
func (p ptrMatcher) String() string {
	return fmt.Sprintf("Matches BlockPointer %v", p.ptr)
}

func fillInNewMD(t *testing.T, config *ConfigMock, rmd *RootMetadata) {
	if !rmd.TlfID().IsPublic() {
		rmd.fakeInitialRekey()
	}
	rootPtr := BlockPointer{
		ID:      kbfsblock.FakeID(42),
		KeyGen:  1,
		DataVer: 1,
	}

	rmd.data.Dir = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: rootPtr,
			EncodedSize:  5,
		},
		EntryInfo: EntryInfo{
			Type: Dir,
			Size: 3,
		},
	}
	return
}

func testKBFSOpsGetRootNodeCreateNewSuccess(t *testing.T, public bool) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", public)
	fillInNewMD(t, config, rmd)

	// create a new MD
	config.mockMdops.EXPECT().GetUnmergedForTLF(
		gomock.Any(), id, gomock.Any()).Return(ImmutableRootMetadata{}, nil)
	irmd := makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	config.mockMdops.EXPECT().GetForTLF(gomock.Any(), id).Return(irmd, nil)
	config.mockMdcache.EXPECT().Put(irmd).Return(nil)

	ops := getOps(config, id)
	assert.False(t, fboIdentityDone(ops))
	n, ei, h, err := ops.getRootNode(ctx)
	require.NoError(t, err)
	assert.True(t, fboIdentityDone(ops))

	p := ops.nodeCache.PathFromNode(n)
	require.Equal(t, id, p.Tlf)
	require.Equal(t, 1, len(p.path))
	require.Equal(t, rmd.data.Dir.ID, p.path[0].ID)
	require.Equal(t, rmd.data.Dir.EntryInfo, ei)
	require.Equal(t, rmd.GetTlfHandle(), h)
}

func TestKBFSOpsGetRootNodeCreateNewSuccessPublic(t *testing.T) {
	testKBFSOpsGetRootNodeCreateNewSuccess(t, true)
}

func TestKBFSOpsGetRootNodeCreateNewSuccessPrivate(t *testing.T) {
	testKBFSOpsGetRootNodeCreateNewSuccess(t, false)
}

func TestKBFSOpsGetRootMDForHandleExisting(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)
	rmd.data.Dir = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: BlockPointer{
				ID: kbfsblock.FakeID(1),
			},
			EncodedSize: 15,
		},
		EntryInfo: EntryInfo{
			Type:  Dir,
			Size:  10,
			Mtime: 1,
			Ctime: 2,
		},
	}

	config.mockMdops.EXPECT().GetForHandle(gomock.Any(), h, Unmerged).Return(
		tlf.ID{}, ImmutableRootMetadata{}, nil)
	config.mockMdops.EXPECT().GetForHandle(gomock.Any(), h, Merged).Return(
		tlf.ID{}, makeImmutableRMDForTest(t, config, rmd, fakeMdID(1)), nil)
	ops := getOps(config, id)
	assert.False(t, fboIdentityDone(ops))

	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(2))
	ops.headStatus = headTrusted
	n, ei, err :=
		config.KBFSOps().GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	assert.True(t, fboIdentityDone(ops))

	p := ops.nodeCache.PathFromNode(n)
	if p.Tlf != id {
		t.Errorf("Got bad dir id back: %v", p.Tlf)
	} else if len(p.path) != 1 {
		t.Errorf("Got bad MD back: path size %d", len(p.path))
	} else if p.path[0].ID != rmd.data.Dir.ID {
		t.Errorf("Got bad MD back: root ID %v", p.path[0].ID)
	} else if ei.Type != Dir {
		t.Error("Got bad MD non-dir rootID back")
	} else if ei.Size != 10 {
		t.Errorf("Got bad MD Size back: %d", ei.Size)
	} else if ei.Mtime != 1 {
		t.Errorf("Got bad MD MTime back: %d", ei.Mtime)
	} else if ei.Ctime != 2 {
		t.Errorf("Got bad MD CTime back: %d", ei.Ctime)
	}
}

// rmd should really be a ReadOnlyRootMetadata or *BareRootMetadata in
// the helper functions below, but all the callers would have to go
// md.ReadOnly(), which doesn't buy us much in tests.

func makeBP(id kbfsblock.ID, kmd KeyMetadata, config Config,
	u keybase1.UID) BlockPointer {
	return BlockPointer{
		ID:      id,
		KeyGen:  kmd.LatestKeyGeneration(),
		DataVer: DefaultNewBlockDataVersion(false),
		Context: kbfsblock.Context{
			Creator: u,
			// Refnonces not needed; explicit refnonce
			// testing happens elsewhere.
		},
	}
}

func makeBI(id kbfsblock.ID, kmd KeyMetadata, config Config,
	u keybase1.UID, encodedSize uint32) BlockInfo {
	return BlockInfo{
		BlockPointer: makeBP(id, kmd, config, u),
		EncodedSize:  encodedSize,
	}
}

func makeIFP(id kbfsblock.ID, kmd KeyMetadata, config Config,
	u keybase1.UID, encodedSize uint32, off int64) IndirectFilePtr {
	return IndirectFilePtr{
		BlockInfo{
			BlockPointer: makeBP(id, kmd, config, u),
			EncodedSize:  encodedSize,
		},
		off,
		false,
		codec.UnknownFieldSetHandler{},
	}
}

func makeBIFromID(id kbfsblock.ID, user keybase1.UID) BlockInfo {
	return BlockInfo{
		BlockPointer: BlockPointer{
			ID: id, KeyGen: 1, DataVer: 1,
			Context: kbfsblock.Context{
				Creator: user,
			},
		},
		EncodedSize: 1,
	}
}

func nodeFromPath(t *testing.T, ops *folderBranchOps, p path) Node {
	var prevNode Node
	// populate the node cache with all the nodes we'll need
	for _, pathNode := range p.path {
		n, err := ops.nodeCache.GetOrCreate(pathNode.BlockPointer,
			pathNode.Name, prevNode)
		if err != nil {
			t.Fatal(err)
		}
		prevNode = n
	}
	return prevNode
}

func testPutBlockInCache(
	t *testing.T, config *ConfigMock, ptr BlockPointer, id tlf.ID,
	block Block) {
	err := config.BlockCache().Put(ptr, id, block, TransientEntry)
	require.NoError(t, err)
	if config.mockBcache != nil {
		config.mockBcache.EXPECT().Get(ptr).AnyTimes().Return(block, nil)
	}
}

func TestKBFSOpsGetBaseDirChildrenCacheSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["a"] = DirEntry{EntryInfo: EntryInfo{Type: File}}
	dirBlock.Children["b"] = DirEntry{EntryInfo: EntryInfo{Type: Dir}}
	blockPtr := makeBP(rootID, rmd, config, u)
	rmd.data.Dir.BlockPointer = blockPtr
	node := pathNode{blockPtr, "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	testPutBlockInCache(t, config, node.BlockPointer, id, dirBlock)
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	children, err := config.KBFSOps().GetDirChildren(ctx, n)
	if err != nil {
		t.Errorf("Got error on getdir: %+v", err)
	} else if len(children) != 2 {
		t.Errorf("Got bad children back: %v", children)
	}
	for c, ei := range children {
		if de, ok := dirBlock.Children[c]; !ok {
			t.Errorf("No such child: %s", c)
		} else if de.EntryInfo != ei {
			t.Errorf("Wrong EntryInfo for child %s: %v", c, ei)
		}
	}
}

func TestKBFSOpsGetBaseDirChildrenUncachedSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	dirBlock := NewDirBlock().(*DirBlock)
	blockPtr := makeBP(rootID, rmd, config, u)
	rmd.data.Dir.BlockPointer = blockPtr
	node := pathNode{blockPtr, "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// cache miss means fetching metadata and getting read key
	expectBlock(config, rmd, blockPtr, dirBlock, nil)

	if _, err := config.KBFSOps().GetDirChildren(ctx, n); err != nil {
		t.Errorf("Got error on getdir: %+v", err)
	}
}

func TestKBFSOpsGetBaseDirChildrenUncachedFailNonReader(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id := tlf.FakeID(1, false)

	h := parseTlfHandleOrBust(t, config, "bob#alice", false)
	// Hack around access check in ParseTlfHandle.
	h.resolvedReaders = nil

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}

	rootID := kbfsblock.FakeID(42)
	node := pathNode{makeBP(rootID, rmd, config, session.UID), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}

	// won't even try getting the block if the user isn't a reader

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted
	expectedErr := NewReadAccessError(h, "alice", "/keybase/private/bob#alice")
	if _, err := config.KBFSOps().GetDirChildren(ctx, n); err == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on root MD: %+v", err)
	}
}

func TestKBFSOpsGetBaseDirChildrenUncachedFailMissingBlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	dirBlock := NewDirBlock().(*DirBlock)
	blockPtr := makeBP(rootID, rmd, config, u)
	rmd.data.Dir.BlockPointer = blockPtr
	node := pathNode{blockPtr, "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// cache miss means fetching metadata and getting read key, then
	// fail block fetch
	err := NoSuchBlockError{rootID}
	expectBlock(config, rmd, blockPtr, dirBlock, err)

	if _, err2 := config.KBFSOps().GetDirChildren(ctx, n); err2 == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err2 != err {
		t.Errorf("Got unexpected error on root MD: %+v", err)
	}
}

func TestKBFSOpsGetNestedDirChildrenCacheSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()

	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	bID := kbfsblock.FakeID(44)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["a"] = DirEntry{EntryInfo: EntryInfo{Type: Exec}}
	dirBlock.Children["b"] = DirEntry{EntryInfo: EntryInfo{Type: Sym}}
	blockPtr := makeBP(rootID, rmd, config, u)
	rmd.data.Dir.BlockPointer = blockPtr
	node := pathNode{blockPtr, "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	bNode := pathNode{makeBP(bID, rmd, config, u), "b"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode, bNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, bNode.BlockPointer, id, dirBlock)

	children, err := config.KBFSOps().GetDirChildren(ctx, n)
	if err != nil {
		t.Errorf("Got error on getdir: %+v", err)
	} else if len(children) != 2 {
		t.Errorf("Got bad children back: %v", children)
	}

	for c, ei := range children {
		if de, ok := dirBlock.Children[c]; !ok {
			t.Errorf("No such child: %s", c)
		} else if de.EntryInfo != ei {
			t.Errorf("Wrong EntryInfo for child %s: %v", c, ei)
		}
	}
}

func TestKBFSOpsLookupSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()

	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	bID := kbfsblock.FakeID(44)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, u),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, aNode.BlockPointer, id, dirBlock)

	bn, ei, err := config.KBFSOps().Lookup(ctx, n, "b")
	if err != nil {
		t.Errorf("Error on Lookup: %+v", err)
	}
	bPath := ops.nodeCache.PathFromNode(bn)
	expectedBNode := pathNode{makeBP(bID, rmd, config, u), "b"}
	expectedBNode.KeyGen = 1
	if ei != dirBlock.Children["b"].EntryInfo {
		t.Errorf("Lookup returned a bad entry info: %v vs %v",
			ei, dirBlock.Children["b"].EntryInfo)
	} else if bPath.path[2] != expectedBNode {
		t.Errorf("Bad path node after lookup: %v vs %v",
			bPath.path[2], expectedBNode)
	}
}

func TestKBFSOpsLookupSymlinkSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()
	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	bID := kbfsblock.FakeID(44)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, u),
		EntryInfo: EntryInfo{
			Type: Sym,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, aNode.BlockPointer, id, dirBlock)

	bn, ei, err := config.KBFSOps().Lookup(ctx, n, "b")
	if err != nil {
		t.Errorf("Error on Lookup: %+v", err)
	}
	if ei != dirBlock.Children["b"].EntryInfo {
		t.Errorf("Lookup returned a bad directory entry: %v vs %v",
			ei, dirBlock.Children["b"].EntryInfo)
	} else if bn != nil {
		t.Errorf("Node for symlink is not nil: %v", bn)
	}
}

func TestKBFSOpsLookupNoSuchNameFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()
	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	bID := kbfsblock.FakeID(44)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, u),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, aNode.BlockPointer, id, dirBlock)

	expectedErr := NoSuchNameError{"c"}
	_, _, err := config.KBFSOps().Lookup(ctx, n, "c")
	if err == nil {
		t.Error("No error as expected on Lookup")
	} else if err != expectedErr {
		t.Errorf("Unexpected error after bad Lookup: %+v", err)
	}
}

func TestKBFSOpsLookupNewDataVersionFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()
	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	bID := kbfsblock.FakeID(44)
	dirBlock := NewDirBlock().(*DirBlock)
	bInfo := makeBIFromID(bID, u)
	bInfo.DataVer = 10
	dirBlock.Children["b"] = DirEntry{
		BlockInfo: bInfo,
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	bNode := pathNode{makeBP(bID, rmd, config, u), "b"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, aNode.BlockPointer, id, dirBlock)
	expectedErr := &NewDataVersionError{
		path{FolderBranch{Tlf: id}, []pathNode{node, aNode, bNode}},
		bInfo.DataVer,
	}

	_, _, err := config.KBFSOps().Lookup(ctx, n, "b")
	if err == nil {
		t.Error("No expected error found on lookup")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Unexpected error after bad lookup: %+v", err)
	}
}

func TestKBFSOpsStatSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()
	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	bID := kbfsblock.FakeID(44)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, u),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	bNode := pathNode{makeBP(bID, rmd, config, u), "b"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode, bNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, aNode.BlockPointer, id, dirBlock)

	ei, err := config.KBFSOps().Stat(ctx, n)
	if err != nil {
		t.Errorf("Error on Stat: %+v", err)
	}
	if ei != dirBlock.Children["b"].EntryInfo {
		t.Errorf("Stat returned a bad entry info: %v vs %v",
			ei, dirBlock.Children["b"].EntryInfo)
	}
}

type shimMDOps struct {
	isUnmerged bool
	codec      kbfscodec.Codec
	crypto     cryptoPure
	kbpki      KBPKI
	MDOps
}

func (s shimMDOps) Put(ctx context.Context, rmd *RootMetadata) (MdID, error) {
	if s.isUnmerged {
		return MdID{}, MDServerErrorConflictRevision{}
	}
	rmd.SetSerializedPrivateMetadata([]byte{0x1})
	session, err := s.kbpki.GetCurrentSession(ctx)
	if err != nil {
		return MdID{}, err
	}
	signingKey := MakeLocalUserSigningKeyOrBust(session.Name)
	err = rmd.bareMd.SignWriterMetadataInternally(
		ctx, s.codec, kbfscrypto.SigningKeySigner{Key: signingKey})
	if err != nil {
		return MdID{}, err
	}
	return s.crypto.MakeMdID(rmd.bareMd)
}

func (s shimMDOps) PutUnmerged(ctx context.Context, rmd *RootMetadata) (MdID, error) {
	if !s.isUnmerged {
		panic("Unexpected PutUnmerged call")
	}
	rmd.SetSerializedPrivateMetadata([]byte{0x2})
	session, err := s.kbpki.GetCurrentSession(ctx)
	if err != nil {
		return MdID{}, err
	}
	signingKey := MakeLocalUserSigningKeyOrBust(session.Name)
	err = rmd.bareMd.SignWriterMetadataInternally(
		ctx, s.codec, kbfscrypto.SigningKeySigner{Key: signingKey})
	if err != nil {
		return MdID{}, err
	}
	return s.crypto.MakeMdID(rmd.bareMd)
}

func expectSyncBlockHelper(
	t *testing.T, config *ConfigMock, lastCall *gomock.Call,
	uid keybase1.UID, id tlf.ID, name string, p path, kmd KeyMetadata,
	newEntry bool, skipSync int, refBytes uint64, unrefBytes uint64,
	newRmd *ImmutableRootMetadata, newBlockIDs []kbfsblock.ID, isUnmerged bool) (
	path, *gomock.Call) {
	// construct new path
	newPath := path{
		FolderBranch{Tlf: id},
		make([]pathNode, 0, len(p.path)+1),
	}
	for _, node := range p.path {
		newPath.path = append(newPath.path, pathNode{Name: node.Name})
	}
	if newEntry {
		// one for the new entry
		newPath.path = append(newPath.path, pathNode{Name: name})
	}

	// all MD is embedded for now
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		AnyTimes().Return(true)

	// By convention for these tests, the old blocks along the path
	// all have EncodedSize == 1.
	unrefBytes += uint64(len(p.path) * 1)

	config.mockBops.EXPECT().GetEncodedSize(gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes().Return(uint32(1), nil)

	lastID := p.tailPointer().ID
	for i := len(newPath.path) - 1; i >= skipSync; i-- {
		newID := kbfsblock.FakeIDMul(lastID, 2)
		newBuf := []byte{byte(i)}
		refBytes += uint64(len(newBuf))
		lastID = newID
		readyBlockData := ReadyBlockData{
			buf: newBuf,
		}
		call := config.mockBops.EXPECT().Ready(gomock.Any(), kmdMatcher{kmd},
			gomock.Any()).Return(newID, len(newBuf), readyBlockData, nil)
		if lastCall != nil {
			call = call.After(lastCall)
		}
		lastCall = call
		newPath.path[i].ID = newID
		newBlockIDs[i] = newID
		config.mockBserv.EXPECT().Put(gomock.Any(), kmd.TlfID(), newID,
			gomock.Any(), readyBlockData.buf, readyBlockData.serverHalf).
			Return(nil)
	}
	if skipSync == 0 {
		// sign the MD and put it
		oldMDOps := config.MDOps()
		if oldShim, ok := oldMDOps.(shimMDOps); ok {
			if oldShim.isUnmerged != isUnmerged {
				t.Fatal("old shim with different isUnmerged")
			}
		} else {
			mdOps := shimMDOps{
				isUnmerged,
				config.Codec(),
				config.Crypto(),
				config.KBPKI(),
				oldMDOps,
			}
			config.SetMDOps(mdOps)
		}
		config.mockMdcache.EXPECT().Put(gomock.Any()).
			Do(func(rmd ImmutableRootMetadata) {
				*newRmd = rmd
				// Check that the ref bytes are correct.
				if rmd.RefBytes() != refBytes {
					t.Errorf("Unexpected refbytes: %d vs %d",
						rmd.RefBytes(), refBytes)
				}
				if rmd.UnrefBytes() != unrefBytes {
					t.Errorf("Unexpected unrefbytes: %d vs %d",
						rmd.UnrefBytes(), unrefBytes)
				}
			}).Return(nil)
	}
	return newPath, lastCall
}

func expectSyncBlock(
	t *testing.T, config *ConfigMock, lastCall *gomock.Call,
	uid keybase1.UID, id tlf.ID, name string, p path, kmd KeyMetadata,
	newEntry bool, skipSync int, refBytes uint64, unrefBytes uint64,
	newRmd *ImmutableRootMetadata, newBlockIDs []kbfsblock.ID) (path, *gomock.Call) {
	return expectSyncBlockHelper(t, config, lastCall, uid, id, name, p, kmd,
		newEntry, skipSync, refBytes, unrefBytes, newRmd, newBlockIDs, false)
}

func expectSyncBlockUnmerged(
	t *testing.T, config *ConfigMock, lastCall *gomock.Call,
	uid keybase1.UID, id tlf.ID, name string, p path, kmd KeyMetadata,
	newEntry bool, skipSync int, refBytes uint64, unrefBytes uint64,
	newRmd *ImmutableRootMetadata, newBlockIDs []kbfsblock.ID) (path, *gomock.Call) {
	return expectSyncBlockHelper(t, config, lastCall, uid, id, name, p, kmd,
		newEntry, skipSync, refBytes, unrefBytes, newRmd, newBlockIDs, true)
}

func getBlockFromCache(t *testing.T, config Config, id tlf.ID, ptr BlockPointer,
	branch BranchName) Block {
	if block, err := config.DirtyBlockCache().Get(id, ptr, branch); err == nil {
		return block
	}
	block, err := config.BlockCache().Get(ptr)
	if err != nil {
		t.Errorf("Couldn't find block %v, branch %s in the cache after test: "+
			"%+v", ptr, branch, err)
		return nil
	}
	return block
}

func getDirBlockFromCache(t *testing.T, config Config, id tlf.ID,
	ptr BlockPointer, branch BranchName) *DirBlock {
	block := getBlockFromCache(t, config, id, ptr, branch)
	dblock, ok := block.(*DirBlock)
	if !ok {
		t.Errorf("Cached block %v, branch %s was not a DirBlock", ptr, branch)
	}
	return dblock
}

func getFileBlockFromCache(t *testing.T, config Config, id tlf.ID,
	ptr BlockPointer, branch BranchName) *FileBlock {
	block := getBlockFromCache(t, config, id, ptr, branch)
	fblock, ok := block.(*FileBlock)
	if !ok {
		t.Errorf("Cached block %v, branch %s was not a FileBlock", ptr, branch)
	}
	return fblock
}

func checkNewPath(t *testing.T, ctx context.Context, config Config,
	newPath path, expectedPath path, rmd ReadOnlyRootMetadata, blocks []kbfsblock.ID,
	entryType EntryType, newName string, rename bool) {
	// TODO: check that the observer updates match the expectedPath as
	// well (but need to handle the rename case where there can be
	// multiple updates).  For now, just check that there's at least
	// one update.
	if len(config.(*ConfigMock).observer.batchChanges) < 1 {
		t.Errorf("No batch notifications sent, at least one expected")
	}
	if ctx.Value(tCtxID) != config.(*ConfigMock).observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in batch notify: %v",
			config.(*ConfigMock).observer.ctx.Value(tCtxID))
	}

	if len(newPath.path) != len(expectedPath.path) {
		t.Errorf("Unexpected new path length: %d", len(newPath.path))
		return
	}
	if newPath.Tlf != expectedPath.Tlf {
		t.Errorf("Unexpected topdir in new path: %s",
			newPath.Tlf)
	}
	// check all names and IDs
	for i, node := range newPath.path {
		eNode := expectedPath.path[i]
		if node.ID != eNode.ID {
			t.Errorf("Wrong id on new path[%d]: %v vs. %v", i, node, eNode)
		}
		if node.Name != eNode.Name {
			t.Errorf("Wrong name on new path[%d]: %v vs. %v", i, node, eNode)
		}
	}

	// all the entries should point correctly and have the right times set
	currDe := rmd.data.Dir
	for i, id := range blocks {
		var timeSet bool
		if newName != "" {
			// only the last 2 nodes should have their times changed
			timeSet = i > len(blocks)-3
		} else {
			// only the last node should have its times changed
			timeSet = i > len(blocks)-2
		}
		// for a rename, the last entry only changes ctime
		if (!rename || i != len(blocks)-1) && (currDe.Mtime != 0) != timeSet {
			t.Errorf("mtime was wrong (%d): %d", i, currDe.Mtime)
		}
		if (currDe.Ctime != 0) != timeSet {
			t.Errorf("ctime was wrong (%d): %d", i, currDe.Ctime)
		}

		if i < len(expectedPath.path) {
			eID := expectedPath.path[i].ID
			if currDe.ID != eID {
				t.Errorf("Entry does not point to %v, but to %v",
					eID, currDe.ID)
			}
		}

		if i < len(blocks)-1 {
			var nextName string
			if i+1 >= len(expectedPath.path) {
				// new symlinks don't have an entry in the path
				nextName = newName
			} else {
				nextName = expectedPath.path[i+1].Name
			}
			// TODO: update BlockPointer for refnonces when we start deduping
			dblock := getDirBlockFromCache(t, config, newPath.Tlf,
				makeBP(id, rmd.RootMetadata, config, rmd.data.Dir.Creator), newPath.Branch)
			nextDe, ok := dblock.Children[nextName]
			if !ok {
				t.Errorf("No entry (%d) for %s", i, nextName)
			}
			currDe = nextDe
		} else if newName != "" {
			if currDe.Type != entryType {
				t.Errorf("New entry has wrong type %s, expected %s",
					currDe.Type, entryType)
			}
		}

		if (currDe.Type != File && currDe.Type != Exec) && currDe.Size == 0 {
			t.Errorf("Type %s unexpectedly has 0 size (%d)", currDe.Type, i)
		}
	}
}

func checkBPs(t *testing.T, bps []BlockPointer, expectedBPs []BlockPointer,
	kind string) {
	if len(expectedBPs) != len(bps) {
		t.Errorf("Unexpected %s size: %d vs %d",
			kind, len(bps), len(expectedBPs))
	}
	for _, ptr := range expectedBPs {
		found := false
		for _, ptr2 := range bps {
			if ptr == ptr2 {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Missing expected %s block: %v", kind, ptr)
		}
	}
}

func checkOp(t *testing.T, op OpCommon, refs []BlockPointer,
	unrefs []BlockPointer, updates []blockUpdate) {
	checkBPs(t, op.RefBlocks, refs, "Refs")
	checkBPs(t, op.UnrefBlocks, unrefs, "Unrefs")
	if len(updates) != len(op.Updates) {
		t.Errorf("Unexpected updates size: %d vs %d",
			len(op.Updates), len(updates))
	}
	for _, up := range updates {
		found := false
		for _, up2 := range op.Updates {
			if up == up2 {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Missing expected block update: %v", up)
		}
	}

}

func testCreateEntrySuccess(t *testing.T, entryType EntryType) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	t.Log("Setup RootMetadata")
	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.ID = rootID
	rmd.data.Dir.Type = Dir
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	aBlock := NewDirBlock().(*DirBlock)
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	t.Log("Create a/b")
	testPutBlockInCache(t, config, aNode.BlockPointer, id, aBlock)
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)

	t.Log("Sync block")
	var newRmd ImmutableRootMetadata
	blocks := make([]kbfsblock.ID, 3)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, uid, id, "b", p, rmd,
			entryType != Sym, 0, 0, 0, &newRmd, blocks)

	var newN Node
	var err error
	switch entryType {
	case File:
		id := kbfsblock.FakeID(100)
		config.mockCrypto.EXPECT().MakeTemporaryBlockID().Return(id, nil)
		newN, _, err = config.KBFSOps().CreateFile(ctx, n, "b", false, NoExcl)
	case Exec:
		id := kbfsblock.FakeID(100)
		config.mockCrypto.EXPECT().MakeTemporaryBlockID().Return(id, nil)
		newN, _, err = config.KBFSOps().CreateFile(ctx, n, "b", true, NoExcl)
	case Dir:
		id := kbfsblock.FakeID(100)
		config.mockCrypto.EXPECT().MakeTemporaryBlockID().Return(id, nil)
		newN, _, err = config.KBFSOps().CreateDir(ctx, n, "b")
	case Sym:
		_, err = config.KBFSOps().CreateLink(ctx, n, "b", "c")
		newN = n
	}
	newP := ops.nodeCache.PathFromNode(newN)

	if err != nil {
		t.Errorf("Got error on create: %+v", err)
	}
	require.NotNil(t, newRmd)
	checkNewPath(t, ctx, config, newP, expectedPath, newRmd.ReadOnly(), blocks,
		entryType, "b", false)
	b1 := getDirBlockFromCache(t, config, id, newP.path[1].BlockPointer,
		newP.Branch)
	if entryType == Sym {
		de := b1.Children["b"]
		if de.Type != Sym {
			t.Error("Entry is not a symbolic link")
		}
		if de.SymPath != "c" {
			t.Errorf("Symbolic path points to the wrong thing: %s", de.SymPath)
		}
		blocks = blocks[:len(blocks)-1] // discard fake block for symlink
	} else if entryType != Dir {
		de := b1.Children["b"]
		if de.Size != 0 {
			t.Errorf("New file has non-zero size: %d", de.Size)
		}
	}
	t.Log("Check block cache")
	checkBlockCache(t, config, id, append(blocks, rootID, aID), nil)

	// make sure the createOp is correct
	co, ok := newRmd.data.Changes.Ops[0].(*createOp)
	if !ok {
		t.Errorf("Couldn't find the createOp")
	}
	var refBlocks []BlockPointer
	if entryType != Sym {
		refBlocks = append(refBlocks, newP.path[2].BlockPointer)
	}
	updates := []blockUpdate{
		{rmd.data.Dir.BlockPointer, newP.path[0].BlockPointer},
	}
	t.Log("Check op")
	checkOp(t, co.OpCommon, refBlocks, nil, updates)
	dirUpdate := blockUpdate{rootBlock.Children["a"].BlockPointer,
		newP.path[1].BlockPointer}
	if co.Dir != dirUpdate {
		t.Errorf("Incorrect dir update in op: %v vs. %v", co.Dir, dirUpdate)
	} else if co.NewName != "b" {
		t.Errorf("Incorrect name in op: %v", co.NewName)
	} else if co.Type != entryType {
		t.Errorf("Incorrect entry type in op: %v", co.Type)
	}
}

func TestKBFSOpsCreateDirSuccess(t *testing.T) {
	testCreateEntrySuccess(t, Dir)
}

func TestKBFSOpsCreateFileSuccess(t *testing.T) {
	testCreateEntrySuccess(t, File)
}

func TestKBFSOpsCreateExecFileSuccess(t *testing.T) {
	testCreateEntrySuccess(t, Exec)
}

func TestKBFSOpsCreateLinkSuccess(t *testing.T) {
	testCreateEntrySuccess(t, Sym)
}

func testCreateEntryFailDupName(t *testing.T, isDir bool) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, u),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// creating "a", which already exists in the root block
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	expectedErr := NameExistsError{"a"}

	var err error
	// dir and link have different checks for dup name
	if isDir {
		_, _, err = config.KBFSOps().CreateDir(ctx, n, "a")
	} else {
		_, err = config.KBFSOps().CreateLink(ctx, n, "a", "b")
	}
	if err == nil {
		t.Errorf("Got no expected error on create")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on create: %+v", err)
	}
}

func TestCreateDirFailDupName(t *testing.T) {
	testCreateEntryFailDupName(t, true)
}

func TestCreateLinkFailDupName(t *testing.T) {
	testCreateEntryFailDupName(t, false)
}

func testCreateEntryFailNameTooLong(t *testing.T, isDir bool) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rootBlock := NewDirBlock().(*DirBlock)
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	config.maxNameBytes = 2
	name := "aaa"

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	expectedErr := NameTooLongError{name, config.maxNameBytes}

	var err error
	// dir and link have different checks for dup name
	if isDir {
		_, _, err = config.KBFSOps().CreateDir(ctx, n, name)
	} else {
		_, err = config.KBFSOps().CreateLink(ctx, n, name, "b")
	}
	if err == nil {
		t.Errorf("Got no expected error on create")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on create: %+v", err)
	}
}

func TestCreateDirFailNameTooLong(t *testing.T) {
	testCreateEntryFailNameTooLong(t, true)
}

func TestCreateLinkFailNameTooLong(t *testing.T) {
	testCreateEntryFailNameTooLong(t, false)
}

func testCreateEntryFailDirTooBig(t *testing.T, isDir bool) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rootBlock := NewDirBlock().(*DirBlock)
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	rmd.data.Dir.Size = 10

	config.maxDirBytes = 12
	name := "aaa"

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)

	var err error
	// dir and link have different checks for dup name
	if isDir {
		_, _, err = config.KBFSOps().CreateDir(ctx, n, name)
	} else {
		_, err = config.KBFSOps().CreateLink(ctx, n, name, "b")
	}
	if err == nil {
		t.Errorf("Got no expected error on create")
	} else if _, ok := err.(DirTooBigError); !ok {
		t.Errorf("Got unexpected error on create: %+v", err)
	}
}

func TestCreateDirFailDirTooBig(t *testing.T) {
	testCreateEntryFailDirTooBig(t, true)
}

func TestCreateLinkFailDirTooBig(t *testing.T) {
	testCreateEntryFailDirTooBig(t, false)
}

func testCreateEntryFailKBFSPrefix(t *testing.T, et EntryType) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, u),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	name := ".kbfs_status"
	expectedErr := DisallowedPrefixError{name, ".kbfs"}

	var err error
	// dir and link have different checks for dup name
	switch et {
	case Dir:
		_, _, err = config.KBFSOps().CreateDir(ctx, n, name)
	case Sym:
		_, err = config.KBFSOps().CreateLink(ctx, n, name, "a")
	case Exec:
		_, _, err = config.KBFSOps().CreateFile(ctx, n, name, true, NoExcl)
	case File:
		_, _, err = config.KBFSOps().CreateFile(ctx, n, name, false, NoExcl)
	}
	if err == nil {
		t.Errorf("Got no expected error on create")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on create: %+v", err)
	}
}

func TestCreateDirFailKBFSPrefix(t *testing.T) {
	testCreateEntryFailKBFSPrefix(t, Dir)
}

func TestCreateFileFailKBFSPrefix(t *testing.T) {
	testCreateEntryFailKBFSPrefix(t, File)
}

func TestCreateExecFailKBFSPrefix(t *testing.T) {
	testCreateEntryFailKBFSPrefix(t, Exec)
}

func TestCreateLinkFailKBFSPrefix(t *testing.T) {
	testCreateEntryFailKBFSPrefix(t, Sym)
}

// TODO: Currently only the remove tests use makeDirTree(),
// makeFile(), et al. Make the other tests use these functions, too.

// makeDirTree creates a block tree for the given path components and
// returns the DirEntry for the root block, a path, and the
// corresponding list of blocks. If n components are given, then the
// path will have n+1 nodes (one extra for the root node), and there
// will be n+1 corresponding blocks.
func makeDirTree(id tlf.ID, uid keybase1.UID, components ...string) (
	DirEntry, path, []*DirBlock) {
	var idCounter byte = 0x10
	makeBlockID := func() kbfsblock.ID {
		id := kbfsblock.FakeID(idCounter)
		idCounter++
		return id
	}

	// Handle the first (root) block.

	bid := makeBlockID()
	bi := makeBIFromID(bid, uid)
	rootEntry := DirEntry{
		BlockInfo: bi,
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	nodes := []pathNode{{bi.BlockPointer, "{root}"}}
	rootBlock := NewDirBlock().(*DirBlock)
	blocks := []*DirBlock{rootBlock}

	// Handle the rest.

	parentDirBlock := rootBlock
	for _, component := range components {
		bid := makeBlockID()
		bi := makeBIFromID(bid, uid)
		parentDirBlock.Children[component] = DirEntry{
			BlockInfo: bi,
			EntryInfo: EntryInfo{
				Type: Dir,
			},
		}
		nodes = append(nodes, pathNode{bi.BlockPointer, component})
		dirBlock := NewDirBlock().(*DirBlock)
		blocks = append(blocks, dirBlock)

		parentDirBlock = dirBlock
	}

	return rootEntry, path{FolderBranch{Tlf: id}, nodes}, blocks
}

func makeFile(dir path, parentDirBlock *DirBlock, name string, et EntryType,
	directType BlockDirectType) (
	path, *FileBlock) {
	if et != File && et != Exec {
		panic(fmt.Sprintf("Unexpected type %s", et))
	}
	bid := kbfsblock.FakeIDAdd(dir.tailPointer().ID, 1)
	bi := makeBIFromID(bid, dir.tailPointer().Creator)
	bi.DirectType = directType

	parentDirBlock.Children[name] = DirEntry{
		BlockInfo: bi,
		EntryInfo: EntryInfo{
			Type: et,
		},
	}

	p := dir.ChildPath(name, bi.BlockPointer)
	return p, NewFileBlock().(*FileBlock)
}

func makeDir(dir path, parentDirBlock *DirBlock, name string) (
	path, *DirBlock) {
	bid := kbfsblock.FakeIDAdd(dir.tailPointer().ID, 1)
	bi := makeBIFromID(bid, dir.tailPointer().Creator)

	parentDirBlock.Children[name] = DirEntry{
		BlockInfo: bi,
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}

	p := dir.ChildPath(name, bi.BlockPointer)
	return p, NewDirBlock().(*DirBlock)
}

func makeSym(dir path, parentDirBlock *DirBlock, name string) {
	parentDirBlock.Children[name] = DirEntry{
		EntryInfo: EntryInfo{
			Type: Sym,
		},
	}
}

func checkRmOp(t *testing.T, entryName string, newRmd ReadOnlyRootMetadata,
	dirPath, newDirPath path, unrefBlocks []BlockPointer) {
	// make sure the rmOp is correct
	ro, ok := newRmd.data.Changes.Ops[0].(*rmOp)
	require.True(t, ok)
	var updates []blockUpdate
	for i := 0; i < len(dirPath.path)-1; i++ {
		updates = append(updates, blockUpdate{
			dirPath.path[i].BlockPointer,
			newDirPath.path[i].BlockPointer,
		})
	}
	checkOp(t, ro.OpCommon, nil, unrefBlocks, updates)
	dirUpdate := blockUpdate{
		dirPath.tailPointer(), newDirPath.tailPointer(),
	}
	require.Equal(t, dirUpdate, ro.Dir)
	require.Equal(t, entryName, ro.OldName)
}

func testKBFSOpsRemoveFileSuccess(t *testing.T, et EntryType) {
	if et != File && et != Exec {
		t.Fatalf("Unexpected type %s", et)
	}

	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, dirPath, dirBlocks :=
		makeDirTree(id, uid, "a", "b", "c", "d")
	rmd.data.Dir = rootEntry

	// Prime cache with all dir blocks.
	for i, dirBlock := range dirBlocks {
		testPutBlockInCache(
			t, config, dirPath.path[i].BlockPointer, id, dirBlock)
	}

	parentDirBlock := dirBlocks[len(dirBlocks)-1]

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, dirPath)

	entryName := "file"
	if et == Exec {
		entryName += ".exe"
	}
	p, _ := makeFile(dirPath, parentDirBlock, entryName, et, DirectBlock)

	// sync block
	var newRmd ImmutableRootMetadata
	blockIDs := make([]kbfsblock.ID, len(dirPath.path))
	// a block of size 1 is being unreferenced
	var unrefBytes uint64 = 1
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		dirPath, rmd, false, 0, 0, unrefBytes, &newRmd, blockIDs)

	err := config.KBFSOps().RemoveEntry(ctx, n, entryName)
	require.NoError(t, err)

	newDirPath := ops.nodeCache.PathFromNode(n)
	checkNewPath(t, ctx, config, newDirPath, expectedPath, newRmd.ReadOnly(),
		blockIDs, et, "", false)
	newParentDirBlock := getDirBlockFromCache(
		t, config, id, newDirPath.tailPointer(), newDirPath.Branch)
	_, ok := newParentDirBlock.Children[entryName]
	require.False(t, ok)

	for i := 0; i < len(p.path)-1; i++ {
		n := p.path[i]
		blockIDs = append(blockIDs, n.ID)
	}
	checkBlockCache(t, config, id, blockIDs, nil)

	unrefBlocks := []BlockPointer{p.tailPointer()}
	checkRmOp(t, entryName, newRmd.ReadOnly(), dirPath, newDirPath, unrefBlocks)
}

func TestKBFSOpsRemoveFileSuccess(t *testing.T) {
	testKBFSOpsRemoveFileSuccess(t, File)
}

func TestKBFSOpsRemoveExecSuccess(t *testing.T) {
	testKBFSOpsRemoveFileSuccess(t, Exec)
}

func TestKBFSOpsRemoveDirSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	entryName := "dir"
	rootEntry, p, blocks := makeDirTree(
		id, uid, "a", "b", "c", "d", entryName)
	rmd.data.Dir = rootEntry

	// Prime cache with all blocks.
	for i, block := range blocks {
		testPutBlockInCache(
			t, config, p.path[i].BlockPointer, id, block)
	}

	dirPath := *p.parentPath()

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, dirPath)

	// sync block
	var newRmd ImmutableRootMetadata
	blockIDs := make([]kbfsblock.ID, len(dirPath.path))
	// a block of size 1 is being unreferenced
	var unrefBytes uint64 = 1
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		dirPath, rmd, false, 0, 0, unrefBytes, &newRmd, blockIDs)

	err := config.KBFSOps().RemoveDir(ctx, n, entryName)
	require.NoError(t, err)

	newDirPath := ops.nodeCache.PathFromNode(n)
	checkNewPath(t, ctx, config, newDirPath, expectedPath, newRmd.ReadOnly(),
		blockIDs, Dir, "", false)
	newParentBlock := getDirBlockFromCache(
		t, config, id, newDirPath.tailPointer(), newDirPath.Branch)
	_, ok := newParentBlock.Children[entryName]
	require.False(t, ok)

	for _, n := range p.path {
		blockIDs = append(blockIDs, n.ID)
	}
	checkBlockCache(t, config, id, blockIDs, nil)

	unrefBlocks := []BlockPointer{p.tailPointer()}
	checkRmOp(t, entryName, newRmd.ReadOnly(), dirPath, newDirPath, unrefBlocks)
}

func TestKBFSOpsRemoveSymSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, dirPath, dirBlocks :=
		makeDirTree(id, uid, "a", "b", "c", "d")
	rmd.data.Dir = rootEntry

	// Prime cache with all dir blocks.
	for i, dirBlock := range dirBlocks {
		testPutBlockInCache(
			t, config, dirPath.path[i].BlockPointer, id, dirBlock)
	}

	parentDirBlock := dirBlocks[len(dirBlocks)-1]

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, dirPath)

	entryName := "sym"
	makeSym(dirPath, parentDirBlock, entryName)

	// sync block
	var newRmd ImmutableRootMetadata
	blockIDs := make([]kbfsblock.ID, len(dirPath.path))
	// No block is being referenced.
	var unrefBytes uint64
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		dirPath, rmd, false, 0, 0, unrefBytes, &newRmd, blockIDs)

	err := config.KBFSOps().RemoveEntry(ctx, n, entryName)
	require.NoError(t, err)

	newDirPath := ops.nodeCache.PathFromNode(n)
	checkNewPath(t, ctx, config, newDirPath, expectedPath, newRmd.ReadOnly(),
		blockIDs, Sym, "", false)
	newParentDirBlock := getDirBlockFromCache(
		t, config, id, newDirPath.tailPointer(), newDirPath.Branch)
	_, ok := newParentDirBlock.Children[entryName]
	require.False(t, ok)

	for _, n := range dirPath.path {
		blockIDs = append(blockIDs, n.ID)
	}
	checkBlockCache(t, config, id, blockIDs, nil)

	checkRmOp(t, entryName, newRmd.ReadOnly(), dirPath, newDirPath, nil)
}

func TestKBFSOpRemoveMultiBlockFileSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, dirPath, dirBlocks :=
		makeDirTree(id, uid, "a", "b", "c", "d")
	rmd.data.Dir = rootEntry

	// Prime cache with all dir blocks.
	for i, dirBlock := range dirBlocks {
		testPutBlockInCache(
			t, config, dirPath.path[i].BlockPointer, id, dirBlock)
	}

	parentDirBlock := dirBlocks[len(dirBlocks)-1]

	entryName := "multiBlockFile"
	lastBID := dirPath.tailPointer().ID
	fileBID := kbfsblock.FakeIDAdd(lastBID, 1)
	fileBI := makeBIFromID(fileBID, dirPath.tailPointer().Creator)

	parentDirBlock.Children[entryName] = DirEntry{
		BlockInfo: fileBI,
		EntryInfo: EntryInfo{
			Type: File,
		},
	}

	// TODO: Write a helper function for making a file with
	// indirect blocks and use it in other tests.
	bid1 := kbfsblock.FakeIDAdd(lastBID, 2)
	bid2 := kbfsblock.FakeIDAdd(lastBID, 3)
	bid3 := kbfsblock.FakeIDAdd(lastBID, 4)
	bid4 := kbfsblock.FakeIDAdd(lastBID, 5)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		makeIFP(bid1, rmd, config, uid, 5, 0),
		makeIFP(bid2, rmd, config, uid, 5, 5),
		makeIFP(bid3, rmd, config, uid, 5, 10),
		makeIFP(bid4, rmd, config, uid, 5, 15),
	}
	fileBlock.IPtrs[0].DirectType = DirectBlock
	fileBlock.IPtrs[1].DirectType = DirectBlock
	fileBlock.IPtrs[2].DirectType = DirectBlock
	fileBlock.IPtrs[3].DirectType = DirectBlock
	fileBP := makeBP(fileBID, rmd, config, uid)
	p := dirPath.ChildPath(entryName, fileBP)
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, dirPath)

	// Let the top block be uncached, so we have to fetch it from
	// BlockOps.  Don't cache any of the file direct blocks, to make
	// sure we don't try to fetch them.
	expectBlock(config, rmd, fileBP, fileBlock, nil)

	// sync block
	blockIDs := make([]kbfsblock.ID, len(dirPath.path))
	unrefBytes := uint64(1 + 4*5) // fileBlock + 4 indirect blocks
	var newRmd ImmutableRootMetadata
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		dirPath, rmd, false, 0, 0, unrefBytes, &newRmd, blockIDs)

	err := config.KBFSOps().RemoveEntry(ctx, n, entryName)
	require.NoError(t, err)

	newDirPath := ops.nodeCache.PathFromNode(n)
	checkNewPath(t, ctx, config, newDirPath, expectedPath, newRmd.ReadOnly(), blockIDs,
		File, "", false)
	newParentDirBlock := getDirBlockFromCache(
		t, config, id, newDirPath.tailPointer(), newDirPath.Branch)
	_, ok := newParentDirBlock.Children[entryName]
	require.False(t, ok)

	for _, n := range p.path {
		blockIDs = append(blockIDs, n.ID)
	}
	checkBlockCache(t, config, id, blockIDs, nil)

	unrefBlocks := []BlockPointer{
		fileBP,
		fileBlock.IPtrs[0].BlockPointer,
		fileBlock.IPtrs[1].BlockPointer,
		fileBlock.IPtrs[2].BlockPointer,
		fileBlock.IPtrs[3].BlockPointer,
	}
	checkRmOp(t, entryName, newRmd.ReadOnly(), dirPath, newDirPath, unrefBlocks)
}

func TestRemoveDirFailNonEmpty(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, p, blocks := makeDirTree(id, uid, "a", "b", "c", "d", "e")
	rmd.data.Dir = rootEntry

	// Prime cache with all blocks.
	for i, block := range blocks {
		testPutBlockInCache(
			t, config, p.path[i].BlockPointer, id, block)
	}

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, *p.parentPath().parentPath())

	expectedErr := DirNotEmptyError{p.parentPath().tailName()}
	err := config.KBFSOps().RemoveDir(ctx, n, "d")
	require.Equal(t, expectedErr, err)
}

func testKBFSOpsRemoveFileMissingBlockSuccess(t *testing.T, et EntryType) {
	if et != File && et != Exec {
		t.Fatalf("Unexpected type %s", et)
	}

	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, dirPath, dirBlocks :=
		makeDirTree(id, uid, "a", "b", "c", "d")
	rmd.data.Dir = rootEntry

	// Prime cache with all dir blocks.
	for i, dirBlock := range dirBlocks {
		testPutBlockInCache(
			t, config, dirPath.path[i].BlockPointer, id, dirBlock)
	}

	parentDirBlock := dirBlocks[len(dirBlocks)-1]

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, dirPath)

	entryName := "file"
	if et == Exec {
		entryName += ".exe"
	}
	p, _ := makeFile(dirPath, parentDirBlock, entryName, et, IndirectBlock)
	// The operation might be retried several times.
	config.mockBops.EXPECT().Get(
		gomock.Any(), gomock.Any(), p.tailPointer(),
		gomock.Any(), gomock.Any()).Return(kbfsblock.BServerErrorBlockNonExistent{}).MinTimes(1)

	// sync block
	var newRmd ImmutableRootMetadata
	blockIDs := make([]kbfsblock.ID, len(dirPath.path))
	// a block of size 1 is being unreferenced
	var unrefBytes uint64 = 1
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		dirPath, rmd, false, 0, 0, unrefBytes, &newRmd, blockIDs)

	err := config.KBFSOps().RemoveEntry(ctx, n, entryName)
	require.NoError(t, err)

	newDirPath := ops.nodeCache.PathFromNode(n)
	checkNewPath(t, ctx, config, newDirPath, expectedPath, newRmd.ReadOnly(),
		blockIDs, File, "", false)
	newParentDirBlock := getDirBlockFromCache(
		t, config, id, newDirPath.tailPointer(), newDirPath.Branch)
	_, ok := newParentDirBlock.Children[entryName]
	require.False(t, ok)

	for _, n := range dirPath.path {
		blockIDs = append(blockIDs, n.ID)
	}
	checkBlockCache(t, config, id, blockIDs, nil)

	unrefBlocks := []BlockPointer{p.tailPointer()}
	checkRmOp(t, entryName, newRmd.ReadOnly(), dirPath, newDirPath, unrefBlocks)
}

func TestKBFSOpsRemoveFileMissingBlockSuccess(t *testing.T) {
	testKBFSOpsRemoveFileMissingBlockSuccess(t, File)
}

func TestKBFSOpsRemoveExecMissingBlockSuccess(t *testing.T) {
	testKBFSOpsRemoveFileMissingBlockSuccess(t, Exec)
}

func TestKBFSOpsRemoveDirMissingBlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	entryName := "dir"
	rootEntry, p, blocks := makeDirTree(id, uid, "a", "b", "c", "d", entryName)
	rmd.data.Dir = rootEntry

	// Prime cache with all directory blocks.
	for i := 0; i < len(blocks)-1; i++ {
		testPutBlockInCache(
			t, config, p.path[i].BlockPointer, id, blocks[i])
	}

	dirPath := *p.parentPath()
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, dirPath)

	// The operation might be retried several times.
	config.mockBops.EXPECT().Get(
		gomock.Any(), gomock.Any(), p.tailPointer(),
		gomock.Any(), gomock.Any()).Return(kbfsblock.BServerErrorBlockNonExistent{}).MinTimes(1)

	// sync block
	var newRmd ImmutableRootMetadata
	blockIDs := make([]kbfsblock.ID, len(dirPath.path))
	// a block of size 1 is being unreferenced
	var unrefBytes uint64 = 1
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		dirPath, rmd, false, 0, 0, unrefBytes, &newRmd, blockIDs)

	err := config.KBFSOps().RemoveDir(ctx, n, entryName)
	require.NoError(t, err)

	newDirPath := ops.nodeCache.PathFromNode(n)
	checkNewPath(t, ctx, config, newDirPath, expectedPath, newRmd.ReadOnly(),
		blockIDs, Dir, "", false)
	newParentDirBlock := getDirBlockFromCache(
		t, config, id, newDirPath.tailPointer(), newDirPath.Branch)
	_, ok := newParentDirBlock.Children[entryName]
	require.False(t, ok)

	for _, n := range dirPath.path {
		blockIDs = append(blockIDs, n.ID)
	}
	checkBlockCache(t, config, id, blockIDs, nil)

	unrefBlocks := []BlockPointer{p.tailPointer()}
	checkRmOp(t, entryName, newRmd.ReadOnly(), dirPath, newDirPath, unrefBlocks)
}

func TestRemoveDirFailNoSuchName(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, p, blocks := makeDirTree(id, uid, "a", "b", "c", "d", "e")
	rmd.data.Dir = rootEntry

	// Prime cache with all blocks.
	for i, block := range blocks {
		testPutBlockInCache(
			t, config, p.path[i].BlockPointer, id, block)
	}

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	expectedErr := NoSuchNameError{"nonexistent"}
	err := config.KBFSOps().RemoveDir(ctx, n, "nonexistent")
	require.Equal(t, expectedErr, err)
}

func TestRenameInDirSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(41)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(42)
	bID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// renaming "a/b" to "a/c"
	testPutBlockInCache(t, config, aNode.BlockPointer, id, aBlock)
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	// sync block
	var newRmd ImmutableRootMetadata
	blocks := make([]kbfsblock.ID, 3)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, uid, id, "", p, rmd, false,
			0, 0, 0, &newRmd, blocks)

	err := config.KBFSOps().Rename(ctx, n, "b", n, "c")
	if err != nil {
		t.Errorf("Got error on rename: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)

	checkNewPath(t, ctx, config, newP, expectedPath, newRmd.ReadOnly(), blocks,
		File, "c", true)
	b1 := getDirBlockFromCache(
		t, config, id, newP.path[1].BlockPointer, newP.Branch)
	if _, ok := b1.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchChanges) != 1 {
		t.Errorf("Expected 1 batch notification, got %d",
			len(config.observer.batchChanges))
	}
	blocks = blocks[:len(blocks)-1] // the last block is never in the cache
	checkBlockCache(t, config, id, append(blocks, rootID, aID), nil)

	// make sure the renameOp is correct
	ro, ok := newRmd.data.Changes.Ops[0].(*renameOp)
	if !ok {
		t.Errorf("Couldn't find the renameOp")
	}
	updates := []blockUpdate{
		{rmd.data.Dir.BlockPointer, newP.path[0].BlockPointer},
	}
	checkOp(t, ro.OpCommon, nil, nil, updates)
	oldDirUpdate := blockUpdate{aNode.BlockPointer, newP.path[1].BlockPointer}
	newDirUpdate := blockUpdate{}
	if ro.OldDir != oldDirUpdate {
		t.Errorf("Incorrect old dir update in op: %v vs. %v", ro.OldDir,
			oldDirUpdate)
	} else if ro.OldName != "b" {
		t.Errorf("Incorrect old name in op: %v", ro.OldName)
	} else if ro.NewDir != newDirUpdate {
		t.Errorf("Incorrect new dir update in op: %v (expected empty)",
			ro.NewDir)
	} else if ro.NewName != "c" {
		t.Errorf("Incorrect name in op: %v", ro.NewName)
	}
}

func TestRenameInDirOverEntrySuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(41)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(42)
	bID := kbfsblock.FakeID(43)
	cID := kbfsblock.FakeID(44)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	aBlock.Children["c"] = DirEntry{
		BlockInfo: makeBIFromID(cID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	cBlock := NewFileBlock().(*FileBlock)
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	cNode := pathNode{makeBP(cID, rmd, config, uid), "c"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// renaming "a/b" to "a/c"
	testPutBlockInCache(t, config, aNode.BlockPointer, id, aBlock)
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, cNode.BlockPointer, id, cBlock)
	// sync block
	var newRmd ImmutableRootMetadata
	blocks := make([]kbfsblock.ID, 3)
	unrefBytes := uint64(1)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, uid, id, "", p, rmd, false,
			0, 0, unrefBytes, &newRmd, blocks)

	err := config.KBFSOps().Rename(ctx, n, "b", n, "c")
	if err != nil {
		t.Errorf("Got error on rename: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)

	checkNewPath(t, ctx, config, newP, expectedPath, newRmd.ReadOnly(), blocks,
		File, "c", true)
	b1 := getDirBlockFromCache(
		t, config, id, newP.path[1].BlockPointer, newP.Branch)
	if _, ok := b1.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchChanges) != 1 {
		t.Errorf("Expected 1 batch notification, got %d",
			len(config.observer.batchChanges))
	}
	blocks = blocks[:len(blocks)-1] // the last block is never in the cache
	checkBlockCache(t, config, id, append(blocks, rootID, aID, cID), nil)

	// make sure the renameOp is correct
	ro, ok := newRmd.data.Changes.Ops[0].(*renameOp)
	if !ok {
		t.Errorf("Couldn't find the renameOp")
	}
	updates := []blockUpdate{
		{rmd.data.Dir.BlockPointer, newP.path[0].BlockPointer},
	}
	checkOp(t, ro.OpCommon, nil, []BlockPointer{cNode.BlockPointer}, updates)
	oldDirUpdate := blockUpdate{aNode.BlockPointer, newP.path[1].BlockPointer}
	newDirUpdate := blockUpdate{}
	if ro.OldDir != oldDirUpdate {
		t.Errorf("Incorrect old dir update in op: %v vs. %v", ro.OldDir,
			oldDirUpdate)
	} else if ro.OldName != "b" {
		t.Errorf("Incorrect old name in op: %v", ro.OldName)
	} else if ro.NewDir != newDirUpdate {
		t.Errorf("Incorrect new dir update in op: %v (expected empty)",
			ro.NewDir)
	} else if ro.NewName != "c" {
		t.Errorf("Incorrect name in op: %v", ro.NewName)
	}
}

func TestRenameInRootSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(41)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(42)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// renaming "a" to "b"
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	// sync block
	var newRmd ImmutableRootMetadata
	blocks := make([]kbfsblock.ID, 2)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, uid, id, "", p, rmd, false,
			0, 0, 0, &newRmd, blocks)

	err := config.KBFSOps().Rename(ctx, n, "a", n, "b")
	if err != nil {
		t.Errorf("Got error on rename: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)

	checkNewPath(t, ctx, config, newP, expectedPath, newRmd.ReadOnly(), blocks,
		File, "b", true)
	b0 := getDirBlockFromCache(
		t, config, id, newP.path[0].BlockPointer, newP.Branch)
	if _, ok := b0.Children["a"]; ok {
		t.Errorf("entry for a is still around after rename")
	} else if len(config.observer.batchChanges) != 1 {
		t.Errorf("Expected 1 batch notification, got %d",
			len(config.observer.batchChanges))
	}
	blocks = blocks[:len(blocks)-1] // the last block is never in the cache
	checkBlockCache(t, config, id, append(blocks, rootID), nil)

	// make sure the renameOp is correct
	ro, ok := newRmd.data.Changes.Ops[0].(*renameOp)
	if !ok {
		t.Errorf("Couldn't find the renameOp")
	}
	checkOp(t, ro.OpCommon, nil, nil, nil)
	oldDirUpdate := blockUpdate{rmd.data.Dir.BlockPointer,
		newP.path[0].BlockPointer}
	newDirUpdate := blockUpdate{}
	if ro.OldDir != oldDirUpdate {
		t.Errorf("Incorrect old dir update in op: %v vs. %v", ro.OldDir,
			oldDirUpdate)
	} else if ro.OldName != "a" {
		t.Errorf("Incorrect old name in op: %v", ro.OldName)
	} else if ro.NewDir != newDirUpdate {
		t.Errorf("Incorrect new dir update in op: %v (expected empty)",
			ro.NewDir)
	} else if ro.NewName != "b" {
		t.Errorf("Incorrect name in op: %v", ro.NewName)
	}
}

func TestRenameAcrossDirsSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(41)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(42)
	bID := kbfsblock.FakeID(43)
	rmd.data.Dir.ID = rootID
	rmd.data.Dir.Type = Dir
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	p1 := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n1 := nodeFromPath(t, ops, p1)

	dID := kbfsblock.FakeID(40)
	rootBlock.Children["d"] = DirEntry{
		BlockInfo: makeBIFromID(dID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	dBlock := NewDirBlock().(*DirBlock)
	dNode := pathNode{makeBP(dID, rmd, config, uid), "d"}
	p2 := path{FolderBranch{Tlf: id}, []pathNode{node, dNode}}
	n2 := nodeFromPath(t, ops, p2)

	// renaming "a/b" to "d/c"
	testPutBlockInCache(t, config, aNode.BlockPointer, id, aBlock)
	testPutBlockInCache(t, config, dNode.BlockPointer, id, dBlock)
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)

	// sync block
	var newRmd ImmutableRootMetadata
	blocks1 := make([]kbfsblock.ID, 2)
	expectedPath1, lastCall :=
		expectSyncBlock(t, config, nil, uid, id, "", p1, rmd, false,
			1, 0, 0, nil, blocks1)
	blocks2 := make([]kbfsblock.ID, 3)
	refBytes := uint64(1)   // need to include directory "a"
	unrefBytes := uint64(1) // need to include directory "a"
	expectedPath2, _ :=
		expectSyncBlock(t, config, lastCall, uid, id, "", p2, rmd, false, 0,
			refBytes, unrefBytes, &newRmd, blocks2)
	// fix up old expected path's common ancestor
	expectedPath1.path[0].ID = expectedPath2.path[0].ID

	err := config.KBFSOps().Rename(ctx, n1, "b", n2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %+v", err)
	}
	newP1 := ops.nodeCache.PathFromNode(n1)
	newP2 := ops.nodeCache.PathFromNode(n2)

	// fix up blocks1 -- the first partial sync stops at aBlock, and
	// checkNewPath expects {rootBlock, aBlock}
	blocks1 = []kbfsblock.ID{blocks2[0], blocks1[0]}
	checkNewPath(t, ctx, config, newP1, expectedPath1, newRmd.ReadOnly(), blocks1,
		File, "", true)
	checkNewPath(t, ctx, config, newP2, expectedPath2, newRmd.ReadOnly(), blocks2,
		File, "c", true)
	b0 := getDirBlockFromCache(
		t, config, id, newP1.path[0].BlockPointer, newP1.Branch)
	if _, ok := b0.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchChanges) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchChanges))
	}
	blocks2 = blocks2[:len(blocks2)-1] // the last block is never in the cache
	checkBlockCache(t, config, id,
		append(blocks2, rootID, aID, dID, blocks1[0]), nil)

	// make sure the renameOp is correct
	ro, ok := newRmd.data.Changes.Ops[0].(*renameOp)
	if !ok {
		t.Errorf("Couldn't find the renameOp")
	}
	updates := []blockUpdate{
		{rmd.data.Dir.BlockPointer, newP1.path[0].BlockPointer},
	}
	checkOp(t, ro.OpCommon, nil, nil, updates)
	oldDirUpdate := blockUpdate{aNode.BlockPointer, newP1.path[1].BlockPointer}
	newDirUpdate := blockUpdate{dNode.BlockPointer, newP2.path[1].BlockPointer}
	if ro.OldDir != oldDirUpdate {
		t.Errorf("Incorrect old dir update in op: %v vs. %v", ro.OldDir,
			oldDirUpdate)
	} else if ro.OldName != "b" {
		t.Errorf("Incorrect old name in op: %v", ro.OldName)
	} else if ro.NewDir != newDirUpdate {
		t.Errorf("Incorrect new dir update in op: %v vs. %v",
			ro.NewDir, newDirUpdate)
	} else if ro.NewName != "c" {
		t.Errorf("Incorrect name in op: %v", ro.NewName)
	}
}

func TestRenameAcrossPrefixSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(41)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(42)
	bID := kbfsblock.FakeID(43)
	dID := kbfsblock.FakeID(40)
	rmd.data.Dir.ID = rootID
	rmd.data.Dir.Type = Dir
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	aBlock.Children["d"] = DirEntry{
		BlockInfo: makeBIFromID(dID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	dBlock := NewDirBlock().(*DirBlock)
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	dNode := pathNode{makeBP(dID, rmd, config, uid), "d"}
	p1 := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	p2 := path{FolderBranch{Tlf: id}, []pathNode{node, aNode, dNode}}
	ops := getOps(config, id)
	n1 := nodeFromPath(t, ops, p1)
	n2 := nodeFromPath(t, ops, p2)

	// renaming "a/b" to "a/d/c"
	// the common ancestor and its parent will be changed once and then re-read
	testPutBlockInCache(t, config, aNode.BlockPointer, id, aBlock)
	testPutBlockInCache(t, config, dNode.BlockPointer, id, dBlock)
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)

	// sync block
	var newRmd ImmutableRootMetadata
	blocks := make([]kbfsblock.ID, 4)
	expectedPath2, _ :=
		expectSyncBlock(t, config, nil, uid, id, "", p2, rmd, false,
			0, 0, 0, &newRmd, blocks)

	err := config.KBFSOps().Rename(ctx, n1, "b", n2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %+v", err)
	}
	newP1 := ops.nodeCache.PathFromNode(n1)
	newP2 := ops.nodeCache.PathFromNode(n2)

	if newP1.path[0].ID != newP2.path[0].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	if newP1.path[1].ID != newP2.path[1].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	b0 := getDirBlockFromCache(
		t, config, id, newP1.path[0].BlockPointer, newP1.Branch)

	if b0.Children["a"].Mtime == 0 {
		t.Errorf("a's mtime didn't change")
	}
	if b0.Children["a"].Ctime == 0 {
		t.Errorf("a's ctime didn't change")
	}
	// now change the times back so checkNewPath below works without hacking
	aDe := b0.Children["a"]
	aDe.Mtime = 0
	aDe.Ctime = 0
	b0.Children["a"] = aDe

	checkNewPath(t, ctx, config, newP2, expectedPath2, newRmd.ReadOnly(), blocks,
		File, "c", true)
	b1 := getDirBlockFromCache(
		t, config, id, newP1.path[1].BlockPointer, newP1.Branch)
	if _, ok := b1.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchChanges) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchChanges))
	}
	blocks = blocks[:len(blocks)-1] // the last block is never in the cache
	checkBlockCache(t, config, id,
		append(blocks, rootID, aID, dID), nil)
}

func TestRenameAcrossOtherPrefixSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(41)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(42)
	bID := kbfsblock.FakeID(43)
	dID := kbfsblock.FakeID(40)
	rmd.data.Dir.ID = rootID
	rmd.data.Dir.Type = Dir
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: Dir,
		},
	}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["d"] = DirEntry{
		BlockInfo: makeBIFromID(dID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	dBlock := NewDirBlock().(*DirBlock)
	dBlock.Children["b"] = DirEntry{
		BlockInfo: makeBIFromID(bID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	dNode := pathNode{makeBP(dID, rmd, config, uid), "d"}
	p1 := path{FolderBranch{Tlf: id}, []pathNode{node, aNode, dNode}}
	p2 := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n1 := nodeFromPath(t, ops, p1)
	n2 := nodeFromPath(t, ops, p2)

	// renaming "a/d/b" to "a/c"
	testPutBlockInCache(t, config, aNode.BlockPointer, id, aBlock)
	testPutBlockInCache(t, config, dNode.BlockPointer, id, dBlock)
	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)

	// sync block
	var newRmd ImmutableRootMetadata
	blocks1 := make([]kbfsblock.ID, 3)
	expectedPath1, lastCall :=
		expectSyncBlock(t, config, nil, uid, id, "", p1, rmd, false,
			2, 0, 0, &newRmd, blocks1)
	blocks2 := make([]kbfsblock.ID, 3)
	refBytes := uint64(1)   // need to include directory "d"
	unrefBytes := uint64(1) // need to include directory "d"
	expectedPath2, _ :=
		expectSyncBlock(t, config, lastCall, uid, id, "", p2, rmd, false, 0,
			refBytes, unrefBytes, &newRmd, blocks2)
	// the new path is a prefix of the old path
	expectedPath1.path[0].ID = expectedPath2.path[0].ID
	expectedPath1.path[1].ID = expectedPath2.path[1].ID

	err := config.KBFSOps().Rename(ctx, n1, "b", n2, "c")
	if err != nil {
		t.Errorf("Got error on removal: %+v", err)
	}
	newP1 := ops.nodeCache.PathFromNode(n1)
	newP2 := ops.nodeCache.PathFromNode(n2)

	if newP2.path[0].ID != newP1.path[0].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	if newP2.path[1].ID != newP1.path[1].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	b1 := getDirBlockFromCache(
		t, config, id, newP1.path[1].BlockPointer, newP1.Branch)
	if b1.Children["d"].Mtime == 0 {
		t.Errorf("d's mtime didn't change")
	}
	if b1.Children["d"].Ctime == 0 {
		t.Errorf("d's ctime didn't change")
	}
	b0 := getDirBlockFromCache(
		t, config, id, newP1.path[0].BlockPointer, newP1.Branch)
	if b0.Children["a"].Mtime == 0 {
		t.Errorf("d's mtime didn't change")
	}
	if b0.Children["a"].Ctime == 0 {
		t.Errorf("d's ctime didn't change")
	}

	checkNewPath(t, ctx, config, newP1, expectedPath1, newRmd.ReadOnly(), blocks2,
		File, "c", true)
	b2 := getDirBlockFromCache(
		t, config, id, newP1.path[2].BlockPointer, newP1.Branch)
	if _, ok := b2.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchChanges) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchChanges))
	}
	blocks2 = blocks2[:len(blocks2)-1] // the last block is never in the cache
	checkBlockCache(t, config, id,
		append(blocks2, rootID, aID, dID, blocks1[2]), nil)
}

func TestRenameFailAcrossTopLevelFolders(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id1 := tlf.FakeID(1, false)
	h1 := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd1, err := makeInitialRootMetadata(config.MetadataVersion(), id1, h1)
	require.NoError(t, err)

	id2 := tlf.FakeID(2, false)
	h2 := parseTlfHandleOrBust(t, config, "alice,bob,charlie", false)
	rmd2, err := makeInitialRootMetadata(config.MetadataVersion(), id2, h2)
	require.NoError(t, err)

	uid1 := h2.ResolvedWriters()[0]
	uid2 := h2.ResolvedWriters()[2]

	rootID1 := kbfsblock.FakeID(41)
	aID1 := kbfsblock.FakeID(42)
	node1 := pathNode{makeBP(rootID1, rmd1, config, uid1), "p"}
	aNode1 := pathNode{makeBP(aID1, rmd1, config, uid1), "a"}
	p1 := path{FolderBranch{Tlf: id1}, []pathNode{node1, aNode1}}
	ops1 := getOps(config, id1)
	n1 := nodeFromPath(t, ops1, p1)

	rootID2 := kbfsblock.FakeID(38)
	aID2 := kbfsblock.FakeID(39)
	node2 := pathNode{makeBP(rootID2, rmd2, config, uid2), "p"}
	aNode2 := pathNode{makeBP(aID2, rmd2, config, uid2), "a"}
	p2 := path{FolderBranch{Tlf: id2}, []pathNode{node2, aNode2}}
	ops2 := getOps(config, id2)
	n2 := nodeFromPath(t, ops2, p2)

	expectedErr := RenameAcrossDirsError{}

	if err := config.KBFSOps().Rename(ctx, n1, "b", n2, "c"); err == nil {
		t.Errorf("Got no expected error on rename")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on rename: %+v", err)
	}
}

func TestRenameFailAcrossBranches(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id1 := tlf.FakeID(1, false)
	h1 := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd1, err := makeInitialRootMetadata(config.MetadataVersion(), id1, h1)
	require.NoError(t, err)

	uid1 := h1.FirstResolvedWriter()
	rootID1 := kbfsblock.FakeID(41)
	aID1 := kbfsblock.FakeID(42)
	node1 := pathNode{makeBP(rootID1, rmd1, config, uid1), "p"}
	aNode1 := pathNode{makeBP(aID1, rmd1, config, uid1), "a"}
	p1 := path{FolderBranch{Tlf: id1}, []pathNode{node1, aNode1}}
	p2 := path{FolderBranch{id1, "test"}, []pathNode{node1, aNode1}}
	ops1 := getOps(config, id1)
	n1 := nodeFromPath(t, ops1, p1)
	ops2 := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(
		FolderBranch{id1, "test"})
	n2 := nodeFromPath(t, ops2, p2)

	expectedErr := RenameAcrossDirsError{}
	if err := config.KBFSOps().Rename(ctx, n1, "b", n2, "c"); err == nil {
		t.Errorf("Got no expected error on rename")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on rename: %+v", err)
	}
}

func TestKBFSOpsCacheReadFullSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, u), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if n2, err := config.KBFSOps().Read(ctx, pNode, dest, 0); err != nil {
		t.Errorf("Got error on read: %+v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytes.Equal(dest, fileBlock.Contents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadPartialSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, u), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	dest := make([]byte, 4, 4)
	if n, err := config.KBFSOps().Read(ctx, pNode, dest, 2); err != nil {
		t.Errorf("Got error on read: %+v", err)
	} else if n != 4 {
		t.Errorf("Read the wrong number of bytes: %d", n)
	} else if !bytes.Equal(dest, fileBlock.Contents[2:6]) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadFullMultiBlockSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	id3 := kbfsblock.FakeID(46)
	id4 := kbfsblock.FakeID(47)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		makeIFP(id1, rmd, config, u, 0, 0),
		makeIFP(id2, rmd, config, u, 6, 5),
		makeIFP(id3, rmd, config, u, 7, 10),
		makeIFP(id4, rmd, config, u, 8, 15),
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	testPutBlockInCache(t, config, fileBlock.IPtrs[0].BlockPointer, id, block1)
	testPutBlockInCache(t, config, fileBlock.IPtrs[1].BlockPointer, id, block2)
	testPutBlockInCache(t, config, fileBlock.IPtrs[2].BlockPointer, id, block3)
	testPutBlockInCache(t, config, fileBlock.IPtrs[3].BlockPointer, id, block4)

	n := 20
	dest := make([]byte, n, n)
	fullContents := append(block1.Contents, block2.Contents...)
	fullContents = append(fullContents, block3.Contents...)
	fullContents = append(fullContents, block4.Contents...)
	if n2, err := config.KBFSOps().Read(ctx, pNode, dest, 0); err != nil {
		t.Errorf("Got error on read: %+v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytes.Equal(dest, fullContents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadPartialMultiBlockSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	id3 := kbfsblock.FakeID(46)
	id4 := kbfsblock.FakeID(47)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		makeIFP(id1, rmd, config, u, 0, 0),
		makeIFP(id2, rmd, config, u, 6, 5),
		makeIFP(id3, rmd, config, u, 7, 10),
		makeIFP(id4, rmd, config, u, 8, 15),
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	testPutBlockInCache(t, config, fileBlock.IPtrs[0].BlockPointer, id, block1)
	testPutBlockInCache(t, config, fileBlock.IPtrs[1].BlockPointer, id, block2)
	testPutBlockInCache(t, config, fileBlock.IPtrs[2].BlockPointer, id, block3)

	n := 10
	dest := make([]byte, n, n)
	contents := append(block1.Contents[3:], block2.Contents...)
	contents = append(contents, block3.Contents[:3]...)
	if n2, err := config.KBFSOps().Read(ctx, pNode, dest, 3); err != nil {
		t.Errorf("Got error on read: %+v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytes.Equal(dest, contents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadFailPastEnd(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, u), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	dest := make([]byte, 4, 4)
	if n, err := config.KBFSOps().Read(ctx, pNode, dest, 10); err != nil {
		t.Errorf("Got error on read: %+v", err)
	} else if n != 0 {
		t.Errorf("Read the wrong number of bytes: %d", n)
	}
}

func TestKBFSOpsServerReadFullSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileBlockPtr := makeBP(fileID, rmd, config, u)
	fileNode := pathNode{fileBlockPtr, "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	// cache miss means fetching metadata and getting read key
	expectBlock(config, rmd, fileBlockPtr, fileBlock, nil)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if n2, err := config.KBFSOps().Read(ctx, pNode, dest, 0); err != nil {
		t.Errorf("Got error on read: %+v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytes.Equal(dest, fileBlock.Contents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsServerReadFailNoSuchBlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileBlockPtr := makeBP(fileID, rmd, config, u)
	fileNode := pathNode{fileBlockPtr, "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	pNode := nodeFromPath(t, ops, p)

	// cache miss means fetching metadata and getting read key
	err := NoSuchBlockError{rootID}
	expectBlock(config, rmd, fileBlockPtr, fileBlock, err)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if _, err2 := config.KBFSOps().Read(ctx, pNode, dest, 0); err2 == nil {
		t.Errorf("Got no expected error")
	} else if err2 != err {
		t.Errorf("Got unexpected error: %+v", err2)
	}
}

func checkSyncOp(t *testing.T, codec kbfscodec.Codec,
	so *syncOp, filePtr BlockPointer, writes []WriteRange) {
	if so == nil {
		t.Error("No sync info for written file!")
	}
	if so.File.Unref != filePtr {
		t.Errorf("Unexpected unref file in sync op: %v vs %v",
			so.File.Unref, filePtr)
	}
	if len(so.Writes) != len(writes) {
		t.Errorf("Unexpected number of writes: %v (expected %v)",
			len(so.Writes), len(writes))
	}
	for i, w := range writes {
		writeEqual, err := kbfscodec.Equal(codec, so.Writes[i], w)
		if err != nil {
			t.Fatal(err)
		}
		if !writeEqual {
			t.Errorf("Unexpected write: %v vs %v", so.Writes[i], w)
		}
	}
}

func checkSyncOpInCache(t *testing.T, codec kbfscodec.Codec,
	ops *folderBranchOps, filePtr BlockPointer, writes []WriteRange) {
	// check the in-progress syncOp
	si, ok := ops.blocks.unrefCache[filePtr.Ref()]
	if !ok {
		t.Error("No sync info for written file!")
	}
	checkSyncOp(t, codec, si.op, filePtr, writes)
}

func updateWithDirtyEntries(ctx context.Context, ops *folderBranchOps,
	lState *lockState, dir path, block *DirBlock) (*DirBlock, error) {
	ops.blocks.blockLock.RLock(lState)
	defer ops.blocks.blockLock.RUnlock(lState)
	return ops.blocks.updateWithDirtyEntriesLocked(ctx, lState, dir, block)
}

func TestKBFSOpsWriteNewBlockSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = data
		}).Return(int64(len(data)))

	if err := config.KBFSOps().Write(ctx, n, data, 0); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}

	newFileBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)
	newRootBlock := getDirBlockFromCache(
		t, config, id, node.BlockPointer, p.Branch)
	lState := makeFBOLockState()
	newRootBlock, err := updateWithDirtyEntries(
		ctx, ops, lState, *p.parentPath(), newRootBlock)
	require.NoError(t, err)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during write: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	} else if newRootBlock.Children["f"].GetWriter() != uid {
		t.Errorf("Wrong last writer: %v",
			newRootBlock.Children["f"].GetWriter())
	} else if newRootBlock.Children["f"].Size != uint64(len(data)) {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 0, Len: uint64(len(data))}})
}

func TestKBFSOpsWriteExtendSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	data := []byte{6, 7, 8, 9, 10}
	expectedFullData := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = expectedFullData
		}).Return(int64(len(data)))

	if err := config.KBFSOps().Write(ctx, n, data, 5); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}

	newFileBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during write: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(expectedFullData, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 5, Len: uint64(len(data))}})
}

func TestKBFSOpsWritePastEndSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	data := []byte{6, 7, 8, 9, 10}
	expectedFullData := []byte{1, 2, 3, 4, 5, 0, 0, 6, 7, 8, 9, 10}

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(7)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = expectedFullData
		}).Return(int64(len(data)))

	if err := config.KBFSOps().Write(ctx, n, data, 7); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}

	newFileBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during write: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(expectedFullData, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 7, Len: uint64(len(data))}})
}

func TestKBFSOpsWriteCauseSplit(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	newData := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	expectedFullData := append([]byte{0}, newData...)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	// only copy the first half first
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), newData, int64(1)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = append([]byte{0}, data[0:5]...)
		}).Return(int64(5))

	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	// new left block
	config.mockCrypto.EXPECT().MakeTemporaryBlockID().Return(id1, nil)
	// new right block
	config.mockCrypto.EXPECT().MakeTemporaryBlockID().Return(id2, nil)

	// next we'll get the right block again
	// then the second half
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), newData[5:10], int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = data
		}).Return(int64(5))

	if err := config.KBFSOps().Write(ctx, n, newData, 1); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}
	b, _ := config.BlockCache().Get(node.BlockPointer)
	newRootBlock := b.(*DirBlock)
	lState := makeFBOLockState()
	newRootBlock, err := updateWithDirtyEntries(
		ctx, ops, lState, *p.parentPath(), newRootBlock)
	require.NoError(t, err)

	b, _ = config.DirtyBlockCache().Get(id, fileNode.BlockPointer, p.Branch)
	pblock := b.(*FileBlock)
	b, _ = config.DirtyBlockCache().Get(id, makeBP(id1, rmd, config, uid),
		p.Branch)
	block1 := b.(*FileBlock)
	b, _ = config.DirtyBlockCache().Get(id, makeBP(id2, rmd, config, uid),
		p.Branch)
	block2 := b.(*FileBlock)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during write: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(expectedFullData[0:6], block1.Contents) {
		t.Errorf("Wrote bad contents to block 1: %v", block1.Contents)
	} else if !bytes.Equal(expectedFullData[6:11], block2.Contents) {
		t.Errorf("Wrote bad contents to block 2: %v", block2.Contents)
	} else if !pblock.IsInd {
		t.Errorf("Parent block is not indirect!")
	} else if len(pblock.IPtrs) != 2 {
		t.Errorf("Wrong number of pointers in pblock: %v", pblock.IPtrs)
	} else if pblock.IPtrs[0].ID != id1 {
		t.Errorf("Parent block has wrong id for block 1: %v (vs. %v)",
			pblock.IPtrs[0].ID, id1)
	} else if pblock.IPtrs[1].ID != id2 {
		t.Errorf("Parent block has wrong id for block 2: %v",
			pblock.IPtrs[1].ID)
	} else if pblock.IPtrs[0].Off != 0 {
		t.Errorf("Parent block has wrong offset for block 1: %d",
			pblock.IPtrs[0].Off)
	} else if pblock.IPtrs[1].Off != 6 {
		t.Errorf("Parent block has wrong offset for block 5: %d",
			pblock.IPtrs[1].Off)
	} else if newRootBlock.Children["f"].Size != uint64(11) {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}

	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer:        p.Branch,
			pblock.IPtrs[0].BlockPointer: p.Branch,
			pblock.IPtrs[1].BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 1, Len: uint64(len(newData))}})
}

func mergeUnrefCache(
	ops *folderBranchOps, lState *lockState, file path, md *RootMetadata) {
	ops.blocks.blockLock.RLock(lState)
	defer ops.blocks.blockLock.RUnlock(lState)
	ops.blocks.unrefCache[file.tailPointer().Ref()].mergeUnrefCache(md)
}

func TestKBFSOpsWriteOverMultipleBlocks(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)
	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	rootBlock := NewDirBlock().(*DirBlock)
	filePtr := BlockPointer{
		ID: fileID, KeyGen: 1, DataVer: 1,
		Context: kbfsblock.Context{
			Creator: uid,
		},
	}
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: filePtr,
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Size: 10,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		makeIFP(id1, rmd, config, uid, 5, 0),
		makeIFP(id2, rmd, config, uid, 6, 5),
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	data := []byte{1, 2, 3, 4, 5}
	expectedFullData := []byte{5, 4, 1, 2, 3, 4, 5, 8, 7, 6}
	so, err := newSyncOp(filePtr)
	require.NoError(t, err)
	rmd.AddOp(so)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	testPutBlockInCache(t, config, fileBlock.IPtrs[0].BlockPointer, id, block1)
	testPutBlockInCache(t, config, fileBlock.IPtrs[1].BlockPointer, id, block2)

	// only copy the first half first
	config.mockBsplit.EXPECT().CopyUntilSplit(
		//		gomock.Any(), gomock.Any(), data, int64(2)).
		gomock.Any(), gomock.Any(), []byte{1, 2, 3}, int64(2)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = append(block1.Contents[0:2], data[0:3]...)
		}).Return(int64(3))

	// update block 2
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data[3:], int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = append(data, block2.Contents[2:]...)
		}).Return(int64(2))

	if err := config.KBFSOps().Write(ctx, n, data, 2); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}

	newBlock1 := getFileBlockFromCache(t, config, id,
		fileBlock.IPtrs[0].BlockPointer, p.Branch)
	newBlock2 := getFileBlockFromCache(t, config, id,
		fileBlock.IPtrs[1].BlockPointer, p.Branch)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during write: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(expectedFullData[0:5], newBlock1.Contents) {
		t.Errorf("Wrote bad contents to block 1: %v", block1.Contents)
	} else if !bytes.Equal(expectedFullData[5:10], newBlock2.Contents) {
		t.Errorf("Wrote bad contents to block 2: %v", block2.Contents)
	}

	lState := makeFBOLockState()

	// merge the unref cache to make it easy to check for changes
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 2, Len: uint64(len(data))}})
	mergeUnrefCache(ops, lState, p, rmd)
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID, id1, id2},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer:           p.Branch,
			fileBlock.IPtrs[0].BlockPointer: p.Branch,
			fileBlock.IPtrs[1].BlockPointer: p.Branch,
		})
}

// Read tests check the same error cases, so no need for similar write
// error tests

func TestKBFSOpsTruncateToZeroSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	data := []byte{}
	if err := config.KBFSOps().Truncate(ctx, n, 0); err != nil {
		t.Errorf("Got error on truncate: %+v", err)
	}

	newFileBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)
	newRootBlock := getDirBlockFromCache(
		t, config, id, node.BlockPointer, p.Branch)
	lState := makeFBOLockState()
	newRootBlock, err := updateWithDirtyEntries(
		ctx, ops, lState, *p.parentPath(), newRootBlock)
	require.NoError(t, err)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during truncate: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", newFileBlock.Contents)
	} else if newRootBlock.Children["f"].GetWriter() != uid {
		t.Errorf("Wrong last writer: %v",
			newRootBlock.Children["f"].GetWriter())
	} else if newRootBlock.Children["f"].Size != 0 {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 0, Len: 0}})
}

func TestKBFSOpsTruncateSameSize(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: makeBIFromID(fileID, u),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, u), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	data := fileBlock.Contents
	if err := config.KBFSOps().Truncate(ctx, n, 10); err != nil {
		t.Errorf("Got error on truncate: %+v", err)
	} else if config.observer.localChange != nil {
		t.Errorf("Unexpected local update during truncate: %v",
			config.observer.localChange)
	} else if !bytes.Equal(data, fileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID}, nil)
}

func TestKBFSOpsTruncateSmallerSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)

	data := []byte{1, 2, 3, 4, 5}
	if err := config.KBFSOps().Truncate(ctx, n, 5); err != nil {
		t.Errorf("Got error on truncate: %+v", err)
	}

	newFileBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during truncate: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 5, Len: 0}})
}

func TestKBFSOpsTruncateShortensLastBlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	rootBlock := NewDirBlock().(*DirBlock)
	fileInfo := makeBIFromID(fileID, uid)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: fileInfo,
		EntryInfo: EntryInfo{
			Size: 10,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		makeIFP(id1, rmd, config, uid, 5, 0),
		makeIFP(id2, rmd, config, uid, 6, 5),
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	so, err := newSyncOp(fileInfo.BlockPointer)
	require.NoError(t, err)
	rmd.AddOp(so)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	testPutBlockInCache(t, config, fileBlock.IPtrs[0].BlockPointer, id, block1)
	testPutBlockInCache(t, config, fileBlock.IPtrs[1].BlockPointer, id, block2)

	data2 := []byte{10, 9}
	if err := config.KBFSOps().Truncate(ctx, n, 7); err != nil {
		t.Errorf("Got error on truncate: %+v", err)
	}

	newPBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)
	newBlock1 := getFileBlockFromCache(t, config, id,
		fileBlock.IPtrs[0].BlockPointer, p.Branch)
	newBlock2 := getFileBlockFromCache(t, config, id,
		fileBlock.IPtrs[1].BlockPointer, p.Branch)

	lState := makeFBOLockState()

	// merge unref changes so we can easily check the block changes
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 7, Len: 0}})
	mergeUnrefCache(ops, lState, p, rmd)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during truncate: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(block1.Contents, newBlock1.Contents) {
		t.Errorf("Wrote bad contents for block 1: %v", newBlock1.Contents)
	} else if !bytes.Equal(data2, newBlock2.Contents) {
		t.Errorf("Wrote bad contents for block 2: %v", newBlock2.Contents)
	} else if len(newPBlock.IPtrs) != 2 {
		t.Errorf("Wrong number of indirect pointers: %d", len(newPBlock.IPtrs))
	} else if rmd.UnrefBytes() != 0+6 {
		// The fileid and the last block was all modified and marked dirty
		t.Errorf("Truncated block not correctly unref'd, unrefBytes = %d",
			rmd.UnrefBytes())
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID, id1, id2},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer:           p.Branch,
			fileBlock.IPtrs[1].BlockPointer: p.Branch,
		})
}

func TestKBFSOpsTruncateRemovesABlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	rootBlock := NewDirBlock().(*DirBlock)
	fileInfo := makeBIFromID(fileID, uid)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: fileInfo,
		EntryInfo: EntryInfo{
			Size: 10,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		makeIFP(id1, rmd, config, uid, 5, 0),
		makeIFP(id2, rmd, config, uid, 6, 5),
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	so, err := newSyncOp(fileInfo.BlockPointer)
	require.NoError(t, err)
	rmd.AddOp(so)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	testPutBlockInCache(t, config, fileBlock.IPtrs[0].BlockPointer, id, block1)
	testPutBlockInCache(t, config, fileBlock.IPtrs[1].BlockPointer, id, block2)

	data := []byte{5, 4, 3, 2}
	if err := config.KBFSOps().Truncate(ctx, n, 4); err != nil {
		t.Errorf("Got error on truncate: %+v", err)
	}

	newPBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)
	newBlock1 := getFileBlockFromCache(t, config, id,
		fileBlock.IPtrs[0].BlockPointer, p.Branch)

	lState := makeFBOLockState()

	// merge unref changes so we can easily check the block changes
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 4, Len: 0}})
	mergeUnrefCache(ops, lState, p, rmd)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during truncate: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(data, newBlock1.Contents) {
		t.Errorf("Wrote bad contents: %v", newBlock1.Contents)
	} else if len(newPBlock.IPtrs) != 1 {
		t.Errorf("Wrong number of indirect pointers: %d", len(newPBlock.IPtrs))
	} else if rmd.UnrefBytes() != 0+5+6 {
		// The fileid and both blocks were all modified and marked dirty
		t.Errorf("Truncated block not correctly unref'd, unrefBytes = %d",
			rmd.UnrefBytes())
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID, id1, id2},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer:           p.Branch,
			fileBlock.IPtrs[0].BlockPointer: p.Branch,
		})
}

func TestKBFSOpsTruncateBiggerSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockInfo: BlockInfo{
			BlockPointer: makeBP(fileID, rmd, config, uid),
			EncodedSize:  1,
		},
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	fileNode := pathNode{makeBP(fileID, rmd, config, uid), "f"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, fileNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	testPutBlockInCache(t, config, fileNode.BlockPointer, id, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), []byte{0, 0, 0, 0, 0}, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = append(block.Contents, data...)
		}).Return(int64(5))

	data := []byte{1, 2, 3, 4, 5, 0, 0, 0, 0, 0}
	if err := config.KBFSOps().Truncate(ctx, n, 10); err != nil {
		t.Errorf("Got error on truncate: %+v", err)
	}

	newFileBlock := getFileBlockFromCache(t, config, id, fileNode.BlockPointer,
		p.Branch)

	if len(ops.nodeCache.PathFromNode(config.observer.localChange).path) !=
		len(p.path) {
		t.Errorf("Missing or incorrect local update during truncate: %v",
			config.observer.localChange)
	} else if ctx.Value(tCtxID) != config.observer.ctx.Value(tCtxID) {
		t.Errorf("Wrong context value passed in local notify: %v",
			config.observer.ctx.Value(tCtxID))
	} else if !bytes.Equal(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
	checkBlockCache(t, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			fileNode.BlockPointer: p.Branch,
		})
	// A truncate past the end of the file actually translates into a
	// write for the difference
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 5, Len: 5}})
}

func testSetExSuccess(t *testing.T, entryType EntryType, ex bool) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, entryType != Sym)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Size: 1,
			Type: entryType,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)

	expectedChanges := 1
	// SetEx() should do nothing when the exec status doesn't change.
	if entryType == Sym || entryType == Dir || (entryType == File && !ex) ||
		(entryType == Exec && ex) {
		expectedChanges = 0
	}

	var expectedPath path
	var newRmd ImmutableRootMetadata
	var blocks []kbfsblock.ID
	if expectedChanges > 0 {
		// sync block
		blocks = make([]kbfsblock.ID, 2)
		expectedPath, _ = expectSyncBlock(t, config, nil, uid, id, "",
			*p.parentPath(), rmd, false, 0, 0, 0, &newRmd, blocks)
		expectedPath.path = append(expectedPath.path, aNode)
	}

	// SetEx() should only change the type of File and Exec.
	var expectedType EntryType
	if entryType == File && ex {
		expectedType = Exec
	} else if entryType == Exec && !ex {
		expectedType = File
	} else {
		expectedType = entryType
	}

	// chmod a+x a
	err := config.KBFSOps().SetEx(ctx, n, ex)
	if err != nil {
		t.Errorf("Got unexpected error on setex: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)
	if expectedChanges != len(config.observer.batchChanges) {
		t.Errorf("got changed=%d, expected %d",
			len(config.observer.batchChanges), expectedChanges)
	} else {
		if blocks != nil {
			rootBlock = getDirBlockFromCache(
				t, config, id, newP.path[0].BlockPointer, newP.Branch)
		}
		if rootBlock.Children["a"].Type != expectedType {
			t.Errorf("a has type %s, expected %s",
				rootBlock.Children["a"].Type, expectedType)
		} else if expectedChanges > 0 {
			// SetEx() should always change the ctime of
			// non-symlinks.
			// pretend it's a rename so only ctime gets checked
			checkNewPath(t, ctx, config, newP, expectedPath, newRmd.ReadOnly(), blocks,
				expectedType, "", true)
		}
	}
	if expectedChanges > 0 {
		blocks = blocks[:len(blocks)-1] // last block is never in the cache
	}
	checkBlockCache(t, config, id, append(blocks, rootID), nil)

	if expectedChanges > 0 {
		// make sure the setAttrOp is correct
		sao, ok := newRmd.data.Changes.Ops[0].(*setAttrOp)
		if !ok {
			t.Errorf("Couldn't find the setAttrOp")
		}
		checkOp(t, sao.OpCommon, nil, nil, nil)
		dirUpdate := blockUpdate{rmd.data.Dir.BlockPointer,
			newP.path[0].BlockPointer}
		if sao.Dir != dirUpdate {
			t.Errorf("Incorrect dir update in op: %v vs. %v", sao.Dir,
				dirUpdate)
		} else if sao.Name != "a" {
			t.Errorf("Incorrect name in op: %v", sao.Name)
		} else if sao.Attr != exAttr {
			t.Errorf("Incorrect attr in op: %v", sao.Attr)
		}
	}
}

func TestSetExFileSuccess(t *testing.T) {
	testSetExSuccess(t, File, true)
}

func TestSetNoExFileSuccess(t *testing.T) {
	testSetExSuccess(t, File, false)
}

func TestSetExExecSuccess(t *testing.T) {
	testSetExSuccess(t, Exec, true)
}

func TestSetNoExExecSuccess(t *testing.T) {
	testSetExSuccess(t, Exec, false)
}

func TestSetExDirSuccess(t *testing.T) {
	testSetExSuccess(t, Dir, true)
}

func TestSetNoExDirSuccess(t *testing.T) {
	testSetExSuccess(t, Dir, false)
}

func TestSetExSymSuccess(t *testing.T) {
	testSetExSuccess(t, Sym, true)
}

func TestSetNoExSymSuccess(t *testing.T) {
	testSetExSuccess(t, Sym, false)
}

func TestSetExFailNoSuchName(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	expectedErr := NoSuchNameError{p.tailName()}

	// chmod a+x a
	if err := config.KBFSOps().SetEx(ctx, n, true); err == nil {
		t.Errorf("Got no expected error on setex")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on setex: %+v", err)
	}
}

// Other SetEx failure cases are all the same as any other block sync

func TestSetMtimeSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, uid),
		EntryInfo: EntryInfo{
			Type: File,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, uid), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, uid), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	// sync block
	var newRmd ImmutableRootMetadata
	blocks := make([]kbfsblock.ID, 2)
	expectedPath, _ := expectSyncBlock(t, config, nil, uid, id, "",
		*p.parentPath(), rmd, false, 0, 0, 0, &newRmd, blocks)
	expectedPath.path = append(expectedPath.path, aNode)

	newMtime := time.Now()
	err := config.KBFSOps().SetMtime(ctx, n, &newMtime)
	if err != nil {
		t.Errorf("Got unexpected error on setmtime: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)
	b0 := getDirBlockFromCache(
		t, config, id, newP.path[0].BlockPointer, newP.Branch)
	if b0.Children["a"].Mtime != newMtime.UnixNano() {
		t.Errorf("a has wrong mtime: %v", b0.Children["a"].Mtime)
	} else {
		checkNewPath(t, ctx, config, newP, expectedPath, newRmd.ReadOnly(), blocks,
			Exec, "", false)
	}
	blocks = blocks[:len(blocks)-1] // last block is never in the cache
	checkBlockCache(t, config, id, append(blocks, rootID), nil)

	// make sure the setAttrOp is correct
	sao, ok := newRmd.data.Changes.Ops[0].(*setAttrOp)
	if !ok {
		t.Errorf("Couldn't find the setAttrOp")
	}
	checkOp(t, sao.OpCommon, nil, nil, nil)
	dirUpdate := blockUpdate{rmd.data.Dir.BlockPointer,
		newP.path[0].BlockPointer}
	if sao.Dir != dirUpdate {
		t.Errorf("Incorrect dir update in op: %v vs. %v", sao.Dir,
			dirUpdate)
	} else if sao.Name != "a" {
		t.Errorf("Incorrect name in op: %v", sao.Name)
	} else if sao.Attr != mtimeAttr {
		t.Errorf("Incorrect attr in op: %v", sao.Attr)
	}
}

func TestSetMtimeNull(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	oldMtime := time.Now().UnixNano()
	rootBlock.Children["a"] = DirEntry{
		BlockInfo: makeBIFromID(aID, u),
		EntryInfo: EntryInfo{
			Type:  File,
			Mtime: oldMtime,
		},
	}
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	if err := config.KBFSOps().SetMtime(ctx, n, nil); err != nil {
		t.Errorf("Got unexpected error on null setmtime: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)
	if rootBlock.Children["a"].Mtime != oldMtime {
		t.Errorf("a has wrong mtime: %v", rootBlock.Children["a"].Mtime)
	} else if newP.path[0].ID != p.path[0].ID {
		t.Errorf("Got back a changed path for null setmtime test: %v", newP)
	}
	checkBlockCache(t, config, id, nil, nil)
}

func TestMtimeFailNoSuchName(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(43)
	rootBlock := NewDirBlock().(*DirBlock)
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, node.BlockPointer, id, rootBlock)
	expectedErr := NoSuchNameError{p.tailName()}

	newMtime := time.Now()
	if err := config.KBFSOps().SetMtime(ctx, n, &newMtime); err == nil {
		t.Errorf("Got no expected error on setmtime")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on setmtime: %+v", err)
	}
}

func getOrCreateSyncInfo(
	ops *folderBranchOps, lState *lockState, de DirEntry) (*syncInfo, error) {
	ops.blocks.blockLock.Lock(lState)
	defer ops.blocks.blockLock.Unlock(lState)
	return ops.blocks.getOrCreateSyncInfoLocked(lState, de)
}

func makeBlockStateDirty(config Config, kmd KeyMetadata, p path,
	ptr BlockPointer) {
	ops := getOps(config, kmd.TlfID())
	lState := makeFBOLockState()
	ops.blocks.blockLock.Lock(lState)
	defer ops.blocks.blockLock.Unlock(lState)
	df := ops.blocks.getOrCreateDirtyFileLocked(lState, p)
	df.setBlockDirty(ptr)
}

// SetMtime failure cases are all the same as any other block sync

func TestSyncCleanSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.ID = rootID
	aID := kbfsblock.FakeID(43)
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	aNode := pathNode{makeBP(aID, rmd, config, u), "a"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode}}
	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)

	// fsync a
	if err := config.KBFSOps().SyncAll(ctx, n.GetFolderBranch()); err != nil {
		t.Errorf("Got unexpected error on sync: %+v", err)
	}
	newP := ops.nodeCache.PathFromNode(n)
	if len(newP.path) != len(p.path) {
		// should be the exact same path back
		t.Errorf("Got a different length path back: %v", newP)
	} else {
		for i, n := range newP.path {
			if n != p.path[i] {
				t.Errorf("Node %d differed: %v", i, n)
			}
		}
	}
	checkBlockCache(t, config, id, nil, nil)
}

func expectSyncDirtyBlock(config *ConfigMock, kmd KeyMetadata,
	p path, ptr BlockPointer, block *FileBlock, splitAt int64,
	padSize int, opsLockHeld bool) *gomock.Call {
	branch := MasterBranch
	if config.mockDirtyBcache != nil {
		config.mockDirtyBcache.EXPECT().IsDirty(gomock.Any(), ptrMatcher{ptr},
			branch).AnyTimes().Return(true)
		config.mockDirtyBcache.EXPECT().Get(gomock.Any(), ptrMatcher{ptr},
			branch).AnyTimes().Return(block, nil)
	} else {
		config.DirtyBlockCache().Put(p.Tlf, ptr, branch, block)
	}
	if !opsLockHeld {
		makeBlockStateDirty(config, kmd, p, ptr)
	}
	c1 := config.mockBsplit.EXPECT().CheckSplit(block).Return(splitAt)

	newID := kbfsblock.FakeIDAdd(ptr.ID, 100)
	// Ideally, we'd use the size of block.Contents at the time
	// that Ready() is called, but GoMock isn't expressive enough
	// for that.
	newEncBuf := make([]byte, len(block.Contents)+padSize)
	readyBlockData := ReadyBlockData{
		buf: newEncBuf,
	}
	c2 := config.mockBops.EXPECT().Ready(gomock.Any(), kmdMatcher{kmd}, block).
		After(c1).Return(newID, len(block.Contents), readyBlockData, nil)

	newPtr := BlockPointer{ID: newID}
	if config.mockBcache != nil {
		config.mockBcache.EXPECT().Put(ptrMatcher{newPtr}, kmd.TlfID(), block, PermanentEntry).Return(nil)
		config.mockBcache.EXPECT().DeletePermanent(newID).Return(nil)
	} else {
		// Nothing to do, since the cache entry is added and
		// removed.
	}

	config.mockBserv.EXPECT().Put(gomock.Any(), kmd.TlfID(), newID,
		gomock.Any(), gomock.Any(), gomock.Any()).Return(nil)
	return c2
}

func putAndCleanAnyBlock(config *ConfigMock, p path) {
	config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), TransientEntry).
		Do(func(ptr BlockPointer, tlf tlf.ID, block Block, lifetime BlockCacheLifetime) {
			config.mockDirtyBcache.EXPECT().
				Get(gomock.Any(), ptrMatcher{BlockPointer{ID: ptr.ID}},
					p.Branch).AnyTimes().Return(nil, NoSuchBlockError{ptr.ID})
			config.mockBcache.EXPECT().
				Get(ptrMatcher{BlockPointer{ID: ptr.ID}}).
				AnyTimes().Return(block, nil)
		}).AnyTimes().Return(nil)
	config.mockDirtyBcache.EXPECT().Delete(gomock.Any(), gomock.Any(),
		p.Branch).AnyTimes().Return(nil)
}

func TestKBFSOpsStatRootSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()
	rootID := kbfsblock.FakeID(42)
	node := pathNode{makeBP(rootID, rmd, config, u), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	n := nodeFromPath(t, ops, p)

	_, err := config.KBFSOps().Stat(ctx, n)
	if err != nil {
		t.Errorf("Error on Stat: %+v", err)
	}
}

func TestKBFSOpsFailingRootOps(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", false)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, fakeMdID(1))
	ops.headStatus = headTrusted

	u := h.FirstResolvedWriter()
	rootID := kbfsblock.FakeID(42)
	rmd.data.Dir.BlockPointer = makeBP(rootID, rmd, config, u)
	node := pathNode{rmd.data.Dir.BlockPointer, "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}
	n := nodeFromPath(t, ops, p)

	// TODO: Make sure Read, Write, and Truncate fail also with
	// InvalidPathError{}.

	err := config.KBFSOps().SetEx(ctx, n, true)
	if _, ok := err.(InvalidParentPathError); !ok {
		t.Errorf("Unexpected error on SetEx: %+v", err)
	}

	err = config.KBFSOps().SetMtime(ctx, n, &time.Time{})
	if _, ok := err.(InvalidParentPathError); !ok {
		t.Errorf("Unexpected error on SetMtime: %+v", err)
	}

	// TODO: Sync succeeds, but it should fail. Fix this!
}

type testBGObserver struct {
	c chan<- struct{}
}

func (t *testBGObserver) LocalChange(ctx context.Context, node Node,
	write WriteRange) {
	// ignore
}

func (t *testBGObserver) BatchChanges(ctx context.Context,
	changes []NodeChange) {
	t.c <- struct{}{}
}

func (t *testBGObserver) TlfHandleChange(ctx context.Context,
	newHandle *TlfHandle) {
	return
}

// Tests that the background flusher will sync a dirty file if the
// application does not.
func TestKBFSOpsBackgroundFlush(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)
	config.noBGFlush = true

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "alice,bob", false)

	kbfsOps := config.KBFSOps()
	nodeA, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	if err := kbfsOps.Write(ctx, nodeA, data, 0); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}

	c := make(chan struct{})
	observer := &testBGObserver{c}
	config.Notifier().RegisterForChanges(
		[]FolderBranch{rootNode.GetFolderBranch()}, observer)

	// start the background flusher
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	config.SetBGFlushPeriod(1 * time.Millisecond)
	go ops.backgroundFlusher()

	// Make sure we get the notification
	select {
	case <-c:
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for signal")
	}

	if err := kbfsOps.Write(ctx, nodeA, data, 0); err != nil {
		t.Errorf("Got error on write: %+v", err)
	}
	select {
	case <-c:
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for signal")
	}
}

func TestKBFSOpsWriteRenameStat(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config, ctx, cancel)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Write to it.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %+v", err)
	}

	// Stat it.
	ei, err := kbfsOps.Stat(ctx, fileNode)
	if err != nil {
		t.Fatalf("Couldn't stat file: %+v", err)
	}
	if ei.Size != 1 {
		t.Errorf("Stat size %d unexpectedly not 1", ei.Size)
	}

	// Rename it.
	err = kbfsOps.Rename(ctx, rootNode, "a", rootNode, "b")
	if err != nil {
		t.Fatalf("Couldn't rename; %+v", err)
	}

	// Stat it again.
	newEi, err := kbfsOps.Stat(ctx, fileNode)
	if err != nil {
		t.Fatalf("Couldn't stat file: %+v", err)
	}
	// CTime is allowed to change after a rename, but nothing else.
	if ei.Type != newEi.Type || ei.Size != newEi.Size ||
		ei.Mtime != newEi.Mtime {
		t.Errorf("Entry info unexpectedly changed from %+v to %+v", ei, newEi)
	}
}

func TestKBFSOpsWriteRenameGetDirChildren(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config, ctx, cancel)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Write to it.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %+v", err)
	}

	// Stat it.
	ei, err := kbfsOps.Stat(ctx, fileNode)
	if err != nil {
		t.Fatalf("Couldn't stat file: %+v", err)
	}
	if ei.Size != 1 {
		t.Errorf("Stat size %d unexpectedly not 1", ei.Size)
	}

	// Rename it.
	err = kbfsOps.Rename(ctx, rootNode, "a", rootNode, "b")
	if err != nil {
		t.Fatalf("Couldn't rename; %+v", err)
	}

	// Get the stats via GetDirChildren.
	eis, err := kbfsOps.GetDirChildren(ctx, rootNode)
	if err != nil {
		t.Fatalf("Couldn't stat file: %+v", err)
	}
	// CTime is allowed to change after a rename, but nothing else.
	if newEi := eis["b"]; ei.Type != newEi.Type || ei.Size != newEi.Size ||
		ei.Mtime != newEi.Mtime {
		t.Errorf("Entry info unexpectedly changed from %+v to %+v",
			ei, eis["b"])
	}
}

func TestKBFSOpsCreateFileWithArchivedBlock(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Remove the file, which will archive the block
	err = kbfsOps.RemoveEntry(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't remove file: %+v", err)
	}

	// Wait for the archiving to finish
	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server")
	}

	// Create a second file, which will use the same initial block ID
	// from the cache, even though it's been archived, and will be
	// forced to try again.
	_, _, err = kbfsOps.CreateFile(ctx, rootNode, "b", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create second file: %+v", err)
	}
}

func TestKBFSOpsMultiBlockSyncWithArchivedBlock(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit := &BlockSplitterSimple{blockSize, 2, 100 * 1024}
	config.SetBlockSplitter(bsplit)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Write a few blocks
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %+v", err)
	}

	// Now overwrite those blocks to archive them
	newData := []byte{11, 12, 13, 14, 15, 16, 17, 18, 19, 20}
	err = kbfsOps.Write(ctx, fileNode, newData, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %+v", err)
	}

	// Wait for the archiving to finish
	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server")
	}

	// Now write the original first block, which has been archived,
	// and make sure it works.
	err = kbfsOps.Write(ctx, fileNode, data[0:blockSize], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %+v", err)
	}
}

type corruptBlockServer struct {
	BlockServer
}

func (cbs corruptBlockServer) Get(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID, context kbfsblock.Context) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	data, keyServerHalf, err := cbs.BlockServer.Get(ctx, tlfID, id, context)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	return append(data, 0), keyServerHalf, nil
}

func TestKBFSOpsFailToReadUnverifiableBlock(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)
	config.SetBlockServer(&corruptBlockServer{
		BlockServer: config.BlockServer(),
	})

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Read using a different "device"
	config2 := ConfigAsUser(config, "test_user")
	defer CheckConfigAndShutdown(ctx, t, config2)
	// Shutdown the mdserver explicitly before the state checker tries to run
	defer config2.MDServer().Shutdown()

	rootNode2 := GetRootNodeOrBust(ctx, t, config2, "test_user", false)
	// Lookup the file, which should fail on block ID verification
	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, "a")
	if _, ok := errors.Cause(err).(kbfshash.HashMismatchError); !ok {
		t.Fatalf("Could unexpectedly lookup the file: %+v", err)
	}
}

// Test that the size of a single empty block doesn't change.  If this
// test ever fails, consult max or strib before merging.
func TestKBFSOpsEmptyTlfSize(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	// Create a TLF.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)
	status, _, err := config.KBFSOps().FolderStatus(ctx,
		rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't get folder status: %+v", err)
	}
	if status.DiskUsage != 313 {
		t.Fatalf("Disk usage of an empty TLF is no longer 313.  " +
			"Talk to max or strib about why this matters.")
	}
}

type cryptoFixedTlf struct {
	Crypto
	tlf tlf.ID
}

func (c cryptoFixedTlf) MakeRandomTlfID(isPublic bool) (tlf.ID, error) {
	return c.tlf, nil
}

// TestKBFSOpsMaliciousMDServerRange tries to trick KBFSOps into
// accepting bad MDs.
func TestKBFSOpsMaliciousMDServerRange(t *testing.T) {
	config1, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "mallory")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config1, ctx, cancel)

	// Create alice's TLF.
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, "alice", false)
	fb1 := rootNode1.GetFolderBranch()

	kbfsOps1 := config1.KBFSOps()

	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "dummy.txt", false, NoExcl)
	require.NoError(t, err)

	// Create mallory's fake TLF using the same TLF ID as alice's.
	config2 := ConfigAsUser(config1, "mallory")
	crypto2 := cryptoFixedTlf{config2.Crypto(), fb1.Tlf}
	config2.SetCrypto(crypto2)
	mdserver2, err := NewMDServerMemory(mdServerLocalConfigAdapter{config2})
	require.NoError(t, err)
	config2.MDServer().Shutdown()
	config2.SetMDServer(mdserver2)
	config2.SetMDCache(NewMDCacheStandard(1))

	rootNode2 := GetRootNodeOrBust(ctx, t, config2, "alice,mallory", false)
	require.Equal(t, fb1.Tlf, rootNode2.GetFolderBranch().Tlf)

	kbfsOps2 := config2.KBFSOps()

	// Add some operations to get mallory's TLF to have a higher
	// MetadataVersion.
	_, _, err = kbfsOps2.CreateFile(
		ctx, rootNode2, "dummy.txt", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.RemoveEntry(ctx, rootNode2, "dummy.txt")
	require.NoError(t, err)

	// Now route alice's TLF to mallory's MD server.
	config1.SetMDServer(mdserver2.copy(mdServerLocalConfigAdapter{config1}))

	// Simulate the server triggering alice to update.
	config1.SetKeyCache(NewKeyCacheStandard(1))
	err = kbfsOps1.SyncFromServerForTesting(ctx, fb1)
	// TODO: We can actually fake out the PrevRoot pointer, too
	// and then we'll be caught by the handle check. But when we
	// have MDOps do the handle check, that'll trigger first.
	require.IsType(t, MDPrevRootMismatch{}, err)
}

// TODO: Test malicious mdserver and rekey flow against wrong
// TLFs being introduced upon rekey.

// Test that if GetTLFCryptKeys fails to create a TLF, the second
// attempt will also fail with the same error.  Regression test for
// KBFS-1929.
func TestGetTLFCryptKeysAfterFirstError(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config, ctx, cancel)

	createErr := errors.New("Cannot create this TLF")
	mdserver := &shimMDServer{
		MDServer: config.MDServer(),
		nextErr:  createErr,
	}
	config.SetMDServer(mdserver)

	h := parseTlfHandleOrBust(t, config, "alice", false)

	_, _, err := config.KBFSOps().GetTLFCryptKeys(ctx, h)
	if err != createErr {
		t.Fatalf("Got unexpected error when creating TLF: %+v", err)
	}

	// Reset the error.
	mdserver.nextErr = createErr
	// Should get the same error, otherwise something's wrong.
	_, _, err = config.KBFSOps().GetTLFCryptKeys(ctx, h)
	if err != createErr {
		t.Fatalf("Got unexpected error when creating TLF: %+v", err)
	}
}

func TestForceFastForwardOnEmptyTLF(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config, ctx, cancel)

	// Look up bob's public folder.
	h := parseTlfHandleOrBust(t, config, "bob", true)
	_, _, err := config.KBFSOps().GetOrCreateRootNode(ctx, h, MasterBranch)
	if _, ok := err.(WriteAccessError); !ok {
		t.Fatalf("Unexpected err reading a public TLF: %+v", err)
	}

	// There's only one folder at this point.
	kbfsOps := config.KBFSOps().(*KBFSOpsStandard)
	kbfsOps.opsLock.RLock()
	var ops *folderBranchOps
	for _, fbo := range kbfsOps.ops {
		ops = fbo
		break
	}
	kbfsOps.opsLock.RUnlock()

	// FastForward shouldn't do anything, since the TLF hasn't been
	// cleared yet.
	config.KBFSOps().ForceFastForward(ctx)
	err = ops.forcedFastForwards.Wait(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for fast forward: %+v", err)
	}
}

func TestKBFSOpsSyncAllTwoFiles(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	nodeA, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}
	nodeB, _, err := kbfsOps.CreateFile(ctx, rootNode, "b", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Write to A.
	data := []byte{1}
	err = kbfsOps.Write(ctx, nodeA, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %+v", err)
	}

	// Write to B.
	data = []byte{2}
	err = kbfsOps.Write(ctx, nodeB, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %+v", err)
	}

	// Sync both.
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync; %+v", err)
	}
}

func TestKBFSOpsCreateSyncAll(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	// Manually create a file without actually syncing it.
	// TODO(KBFS-2076) remove all this duplicated code.
	rootNode := GetRootNodeOrBust(ctx, t, config, "alice,bob", false)

	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	name := "myfile"
	var fileNode Node
	{
		rootDir := ops.nodeCache.PathFromNode(rootNode)
		co, err := newCreateOp(name, rootDir.tailPointer(), File)
		if err != nil {
			t.Fatal(err)
		}
		newBlock := &FileBlock{}

		newID, err := config.cryptoPure().MakeTemporaryBlockID()
		if err != nil {
			t.Fatal(err)
		}
		session, err := config.KBPKI().GetCurrentSession(ctx)
		if err != nil {
			t.Fatal(err)
		}

		newPtr := BlockPointer{
			ID:         newID,
			KeyGen:     1,
			DataVer:    1,
			DirectType: DirectBlock,
			Context: kbfsblock.MakeFirstContext(
				session.UID, keybase1.BlockType_DATA),
		}
		config.DirtyBlockCache().Put(ops.id(), newPtr, ops.branch(), newBlock)
		co.AddRefBlock(newPtr)
		fileNode, err = ops.nodeCache.GetOrCreate(newPtr, name, rootNode)
		if err != nil {
			t.Fatal(err)
		}
		de := DirEntry{
			BlockInfo: BlockInfo{
				BlockPointer: newPtr,
				EncodedSize:  0,
			},
			EntryInfo: EntryInfo{
				Type: File,
				Size: 0,
			},
		}
		lState := makeFBOLockState()
		ops.blocks.AddDirEntryInCache(lState, rootDir, name, de)
		ops.dirOps = append(
			ops.dirOps, cachedDirOp{co, []Node{rootNode, fileNode}})
	}

	// Write to A.
	data := []byte{1}
	kbfsOps := config.KBFSOps()
	err := kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %+v", err)
	}

	// Make sure we can see it before the sync happens.
	_, ei, err := kbfsOps.Lookup(ctx, rootNode, name)
	if err != nil {
		t.Fatal(err)
	}
	if ei.Size != uint64(len(data)) {
		t.Fatalf("Unexpected size: %d vs %d", ei.Size, len(data))
	}

	// Sync everything.
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync; %+v", err)
	}

	// Check that bob can see it.
	config2 := ConfigAsUser(config, "bob")
	defer CheckConfigAndShutdown(ctx, t, config2)

	rootNodeBob := GetRootNodeOrBust(ctx, t, config2, "alice,bob", false)
	fileNodeBob, _, err := config2.KBFSOps().Lookup(ctx, rootNodeBob, name)
	if err != nil {
		t.Fatal(err)
	}

	gotData := make([]byte, len(data))
	_, err = config2.KBFSOps().Read(ctx, fileNodeBob, gotData, 0)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(data, gotData) {
		t.Fatalf("Data didn't match: %v vs %v", data, gotData)
	}

	if len(ops.blocks.deCache) > 0 {
		t.Fatalf("%d unexpected deCache entries leftover",
			len(ops.blocks.deCache))
	}
}

func TestKBFSOpsRemoveSyncAll(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	rootNode := GetRootNodeOrBust(ctx, t, config, "alice,bob", false)
	kbfsOps := config.KBFSOps()
	name := "myfile"
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, name, false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Manually remove a file without actually syncing it.
	// TODO(KBFS-2076) remove all this duplicated code.
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	{
		rootDir := ops.nodeCache.PathFromNode(rootNode)
		ro, err := newRmOp(name, rootDir.tailPointer())
		if err != nil {
			t.Fatal(err)
		}
		ro.setFinalPath(rootDir)

		filePath := ops.nodeCache.PathFromNode(fileNode)
		ro.AddUnrefBlock(filePath.tailPointer())

		lState := makeFBOLockState()
		ops.blocks.RemoveDirEntryInCache(lState, rootDir, name)
		ops.dirOps = append(ops.dirOps, cachedDirOp{ro, []Node{rootNode}})
	}

	// Make sure we can't see it before the sync happens.
	children, err := kbfsOps.GetDirChildren(ctx, rootNode)
	if err != nil {
		t.Fatal(err)
	}
	if len(children) != 0 {
		t.Fatalf("Unexpected children: %v", children)
	}

	// Sync everything.
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync; %+v", err)
	}

	if len(ops.blocks.deCache) > 0 {
		t.Fatalf("%d unexpected deCache entries leftover",
			len(ops.blocks.deCache))
	}
}

func TestKBFSOpsRenameSameDirSyncAll(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	rootNode := GetRootNodeOrBust(ctx, t, config, "alice,bob", false)
	kbfsOps := config.KBFSOps()
	name := "myfile"
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, name, false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Manually rename a file without actually syncing it.
	// TODO(KBFS-2076) remove all this duplicated code.
	newName := "myfile"
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	{
		rootDir := ops.nodeCache.PathFromNode(rootNode)
		filePath := ops.nodeCache.PathFromNode(fileNode)

		ro, err := newRenameOp(name, rootDir.tailPointer(), newName,
			rootDir.tailPointer(), filePath.tailPointer(), File)
		if err != nil {
			t.Fatal(err)
		}

		lState := makeFBOLockState()
		dblock, err := ops.blocks.GetDirBlockForReading(
			ctx, lState, ops.head, rootDir.tailPointer(), ops.branch(), rootDir)
		if err != nil {
			t.Fatal(err)
		}

		_ = ops.blocks.RenameDirEntryInCache(
			lState, rootDir, name, rootDir, newName, dblock.Children[name])
		ops.dirOps = append(ops.dirOps, cachedDirOp{ro, []Node{rootNode}})
	}

	// Make sure we see the new name before the sync happens.
	checkChild := func(config Config, rootNode Node) {
		children, err := config.KBFSOps().GetDirChildren(ctx, rootNode)
		if err != nil {
			t.Fatal(err)
		}
		if len(children) != 1 {
			t.Fatalf("Unexpected children: %v", children)
		}
		if _, ok := children[newName]; !ok {
			t.Fatalf("Child %s missing: %v", newName, children)
		}
	}
	checkChild(config, rootNode)

	// Sync everything.
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync; %+v", err)
	}

	// Check that bob can see it.
	config2 := ConfigAsUser(config, "bob")
	defer CheckConfigAndShutdown(ctx, t, config2)

	rootNodeBob := GetRootNodeOrBust(ctx, t, config2, "alice,bob", false)
	checkChild(config2, rootNodeBob)

	if len(ops.blocks.deCache) > 0 {
		t.Fatalf("%d unexpected deCache entries leftover",
			len(ops.blocks.deCache))
	}
}

func TestKBFSOpsSetExSyncAll(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "bob")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	rootNode := GetRootNodeOrBust(ctx, t, config, "alice,bob", false)
	kbfsOps := config.KBFSOps()
	name := "myfile"
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, name, false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	// Manually set the executability of a file without actually
	// syncing it.  TODO(KBFS-2076) remove all this duplicated code.
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	{
		rootDir := ops.nodeCache.PathFromNode(rootNode)
		filePath := ops.nodeCache.PathFromNode(fileNode)

		sao, err := newSetAttrOp(name, rootDir.tailPointer(),
			exAttr, filePath.tailPointer())
		if err != nil {
			t.Fatal(err)
		}

		lState := makeFBOLockState()
		dblock, err := ops.blocks.GetDirBlockForReading(
			ctx, lState, ops.head, rootDir.tailPointer(), ops.branch(), rootDir)
		if err != nil {
			t.Fatal(err)
		}
		de := dblock.Children[name]
		de.Type = Exec

		_ = ops.blocks.SetAttrInDirEntryInCache(lState, filePath, de, sao.Attr)
		ops.dirOps = append(ops.dirOps, cachedDirOp{sao, []Node{fileNode}})
	}

	// Make sure we can't see it before the sync happens.
	checkChild := func(config Config, rootNode Node) {
		children, err := config.KBFSOps().GetDirChildren(ctx, rootNode)
		if err != nil {
			t.Fatal(err)
		}
		if len(children) != 1 {
			t.Fatalf("Unexpected children: %v", children)
		}
		if ei, ok := children[name]; !ok {
			t.Fatalf("Child %s missing: %v", name, children)
		} else if ei.Type != Exec {
			t.Fatalf("Unexpected type: %s", ei.Type)
		}
	}
	checkChild(config, rootNode)

	// Sync everything.
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync; %+v", err)
	}

	// Check that bob can see it.
	config2 := ConfigAsUser(config, "bob")
	defer CheckConfigAndShutdown(ctx, t, config2)

	//rootNodeBob := GetRootNodeOrBust(ctx, t, config2, "alice,bob", false)
	//checkChild(config2, rootNodeBob)

	if len(ops.blocks.deCache) > 0 {
		t.Fatalf("%d unexpected deCache entries leftover",
			len(ops.blocks.deCache))
	}
}
