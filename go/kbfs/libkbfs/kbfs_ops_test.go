// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/env"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	billy "gopkg.in/src-d/go-billy.v4"
	"gopkg.in/src-d/go-billy.v4/memfs"
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

func kbfsOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context, cancel context.CancelFunc) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.SetCodec(kbfscodec.NewMsgpack())
	blockops := &CheckBlockOps{config.mockBops, ctr}
	config.SetBlockOps(blockops)
	kbfsops := NewKBFSOpsStandard(env.EmptyAppStateUpdater{}, config)
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

	// These tests don't rely on external notifications at all, so ignore any
	// goroutine attempting to register:
	c := make(chan error, 1)
	config.mockMdserv.EXPECT().RegisterForUpdate(gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(c, nil)
	config.mockMdserv.EXPECT().OffsetFromServerTime().
		Return(time.Duration(0), true).AnyTimes()
	// No chat monitoring.
	config.mockChat.EXPECT().GetChannels(gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes().
		Return(nil, nil, nil)

	// Don't test implicit teams.
	config.mockKbpki.EXPECT().ResolveImplicitTeam(
		gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes().
		Return(ImplicitTeamInfo{}, errors.New("No such team"))

	// None of these tests depend on time
	config.mockClock.EXPECT().Now().AnyTimes().Return(time.Now())

	// Ignore Notify calls for now
	config.mockRep.EXPECT().Notify(gomock.Any(), gomock.Any()).AnyTimes()

	// Ignore MerkleRoot calls for now.
	config.mockKbpki.EXPECT().GetCurrentMerkleRoot(gomock.Any()).
		Return(keybase1.MerkleRootV2{}, time.Time{}, nil).AnyTimes()

	// Max out MaxPtrsPerBlock
	config.mockBsplit.EXPECT().MaxPtrsPerBlock().
		Return(int((^uint(0)) >> 1)).AnyTimes()

	// Never split dir blocks.
	config.mockBsplit.EXPECT().SplitDirIfNeeded(gomock.Any()).DoAndReturn(
		func(block *DirBlock) ([]*DirBlock, *StringOffset) {
			return []*DirBlock{block}, nil
		}).AnyTimes()

	// Ignore Archive calls for now
	config.mockBops.EXPECT().Archive(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)
	// Ignore Archive calls for now
	config.mockBops.EXPECT().Archive(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)
	// Ignore BlockRetriever calls
	brc := &testBlockRetrievalConfig{nil, newTestLogMaker(t),
		config.BlockCache(), nil, newTestDiskBlockCacheGetter(t, nil),
		newTestSyncedTlfGetterSetter(), testInitModeGetter{InitDefault}}
	brq := newBlockRetrievalQueue(0, 0, brc)
	config.mockBops.EXPECT().BlockRetriever().AnyTimes().Return(brq)
	config.mockBops.EXPECT().Prefetcher().AnyTimes().Return(brq.prefetcher)

	// Ignore favorites
	err := errors.New("Fake error to prevent trying to read favs from disk")
	config.mockKbpki.EXPECT().GetCurrentSession(gomock.Any()).Return(
		SessionInfo{}, err)
	kbfsops.favs.Initialize(ctx)
	config.mockKbpki.EXPECT().FavoriteList(gomock.Any()).AnyTimes().
		Return(nil, nil)
	config.mockKbs.EXPECT().EncryptFavorites(gomock.Any(), gomock.Any()).
		AnyTimes().Return(nil, nil)
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
	ctx, err = NewContextWithCancellationDelayer(NewContextReplayable(
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
	config.mockBops.Prefetcher().Shutdown()
	mockCtrl.Finish()
}

type modeNoHistory struct {
	InitMode
}

func (mnh modeNoHistory) TLFEditHistoryEnabled() bool {
	return false
}

func (mnh modeNoHistory) SendEditNotificationsEnabled() bool {
	return false
}

// kbfsOpsInitNoMocks returns a config that doesn't use any mocks. The
// shutdown call is kbfsTestShutdownNoMocks.
func kbfsOpsInitNoMocks(t *testing.T, users ...kbname.NormalizedUsername) (
	*ConfigLocal, keybase1.UID, context.Context, context.CancelFunc) {
	config := MakeTestConfigOrBust(t, users...)
	// Turn off tlf edit history because it messes with the FBO state
	// asynchronously.
	config.mode = modeNoHistory{config.Mode()}
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

func checkBlockCache(
	t *testing.T, ctx context.Context, config *ConfigMock, id tlf.ID,
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
		_, err := dirtyBcache.Get(ctx, id, ptr, branch)
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

	handle1 := parseTlfHandleOrBust(t, config, "alice", tlf.Private, tlf.NullID)
	handle2 := parseTlfHandleOrBust(
		t, config, "alice,bob", tlf.Private, tlf.NullID)

	// dup for testing
	handles := []*TlfHandle{handle1, handle2, handle2}
	for _, h := range handles {
		config.KeybaseService().FavoriteAdd(
			context.Background(), h.ToFavorite().ToKBFolder(false))
	}

	// The favorites list contains our own public dir by default, even
	// if KBPKI doesn't return it.

	handle3 := parseTlfHandleOrBust(t, config, "alice", tlf.Public, tlf.NullID)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
		getOpsNoAdd(context.TODO(), FolderBranch{id, MasterBranch})
}

// createNewRMD creates a new RMD for the given name. Returns its ID
// and handle also.
func createNewRMD(t *testing.T, config Config, name string, ty tlf.Type) (
	tlf.ID, *TlfHandle, *RootMetadata) {
	id := tlf.FakeID(1, ty)
	h := parseTlfHandleOrBust(t, config, name, ty, id)
	h.tlfID = id
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	return id, h, rmd
}

func makeImmutableRMDForTest(t *testing.T, config Config, rmd *RootMetadata,
	mdID kbfsmd.ID) ImmutableRootMetadata {
	session, err := config.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	// We have to fake out the signature here because most tests
	// in this file modify the returned value, invalidating any
	// real signatures. TODO: Fix all the tests in this file to
	// not do so, and then just use MakeImmutableRootMetadata.
	if brmdv2, ok := rmd.bareMd.(*kbfsmd.RootMetadataV2); ok {
		vk := brmdv2.WriterMetadataSigInfo.VerifyingKey
		require.True(t, vk == (kbfscrypto.VerifyingKey{}) || vk == session.VerifyingKey,
			"Writer signature %s with unexpected non-nil verifying key != %s",
			brmdv2.WriterMetadataSigInfo, session.VerifyingKey)
		brmdv2.WriterMetadataSigInfo = kbfscrypto.SignatureInfo{
			VerifyingKey: session.VerifyingKey,
		}
	}
	return MakeImmutableRootMetadata(
		rmd, session.VerifyingKey, mdID, time.Now(), true)
}

// injectNewRMD creates a new RMD and makes sure the existing ops for
// its ID has as its head that RMD.
func injectNewRMD(t *testing.T, config *ConfigMock) (
	keybase1.UserOrTeamID, tlf.ID, *RootMetadata) {
	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)
	var keyGen kbfsmd.KeyGen
	if id.Type() == tlf.Public {
		keyGen = kbfsmd.PublicKeyGen
	} else {
		keyGen = kbfsmd.FirstValidKeyGen
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
		t, config, rmd, kbfsmd.FakeID(tlf.FakeIDByte(id)))
	ops.headStatus = headTrusted
	rmd.SetSerializedPrivateMetadata(make([]byte, 1))
	config.Notifier().RegisterForChanges(
		[]FolderBranch{{id, MasterBranch}}, config.observer)
	wid := h.FirstResolvedWriter()
	rmd.data.Dir.Creator = wid
	return wid, id, rmd
}

func TestKBFSOpsGetRootNodeCacheSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	_, err = ops.getMDForRead(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err)
	assert.True(t, fboIdentityDone(ops))
}

func TestKBFSOpsGetRootNodeReIdentify(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	_, err = ops.getMDForRead(ctx, lState, mdReadNeedIdentify)
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
	_, err = ops.getMDForRead(ctx, lState, mdReadNeedIdentify)
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

func (kbpki failIdentifyKBPKI) Identify(
	ctx context.Context, assertion, reason string) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
		kbpki.identifyErr
}

func TestKBFSOpsGetRootNodeCacheIdentifyFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	_, id, rmd := injectNewRMD(t, config)

	rmd.data.Dir.BlockPointer.ID = kbfsblock.FakeID(1)
	rmd.data.Dir.Type = Dir

	ops := getOps(config, id)

	expectedErr := errors.New("Identify failure")
	config.SetKBPKI(failIdentifyKBPKI{config.KBPKI(), expectedErr})

	// Trigger identify.
	lState := makeFBOLockState()
	_, err := ops.getMDForRead(ctx, lState, mdReadNeedIdentify)
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
	if rmd.TypeForKeying() != tlf.PublicKeying {
		rmd.fakeInitialRekey()
	}
	rootPtr := BlockPointer{
		ID:      kbfsblock.FakeID(42),
		KeyGen:  kbfsmd.FirstValidKeyGen,
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

func testKBFSOpsGetRootNodeCreateNewSuccess(t *testing.T, ty tlf.Type) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", ty)
	fillInNewMD(t, config, rmd)

	// create a new MD
	config.mockMdops.EXPECT().GetUnmergedForTLF(
		gomock.Any(), id, gomock.Any()).Return(ImmutableRootMetadata{}, nil)
	irmd := makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
	config.mockMdops.EXPECT().GetForTLF(gomock.Any(), id, nil).Return(irmd, nil)

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
	testKBFSOpsGetRootNodeCreateNewSuccess(t, tlf.Public)
}

func TestKBFSOpsGetRootNodeCreateNewSuccessPrivate(t *testing.T) {
	testKBFSOpsGetRootNodeCreateNewSuccess(t, tlf.Private)
}

func TestKBFSOpsGetRootMDForHandleExisting(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)
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

	ops := getOps(config, id)
	assert.False(t, fboIdentityDone(ops))

	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(2))
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
	u keybase1.UserOrTeamID) BlockPointer {
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
	u keybase1.UserOrTeamID, encodedSize uint32) BlockInfo {
	return BlockInfo{
		BlockPointer: makeBP(id, kmd, config, u),
		EncodedSize:  encodedSize,
	}
}

func makeIFP(id kbfsblock.ID, kmd KeyMetadata, config Config,
	u keybase1.UserOrTeamID, encodedSize uint32,
	off Int64Offset) IndirectFilePtr {
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

func makeBIFromID(id kbfsblock.ID, user keybase1.UserOrTeamID) BlockInfo {
	return BlockInfo{
		BlockPointer: BlockPointer{
			ID: id, KeyGen: kbfsmd.FirstValidKeyGen, DataVer: 1,
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
			pathNode.Name, prevNode,
			/* For the purposes of these tests, the type doesn't matter. */
			Dir)
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

func TestKBFSOpsGetBaseDirChildrenHidesFiles(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	u, id, rmd := injectNewRMD(t, config)

	rootID := kbfsblock.FakeID(42)
	dirBlock := NewDirBlock().(*DirBlock)
	dirBlock.Children["a"] = DirEntry{EntryInfo: EntryInfo{Type: File}}
	dirBlock.Children[".kbfs_git"] = DirEntry{EntryInfo: EntryInfo{Type: Dir}}
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
	} else if len(children) != 1 {
		t.Errorf("Got bad children back: %v", children)
	}
	for c, ei := range children {
		if de, ok := dirBlock.Children[c]; !ok {
			t.Errorf("No such child: %s", c)
		} else if !de.EntryInfo.Eq(ei) {
			t.Errorf("Wrong EntryInfo for child %s: %v", c, ei)
		}
	}
}

func TestKBFSOpsGetBaseDirChildrenCacheSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
		} else if !de.EntryInfo.Eq(ei) {
			t.Errorf("Wrong EntryInfo for child %s: %v", c, ei)
		}
	}
}

func TestKBFSOpsGetBaseDirChildrenUncachedSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id := tlf.FakeID(1, tlf.Private)

	h := parseTlfHandleOrBust(t, config, "bob#alice", tlf.Private, id)
	h.tlfID = id
	// Hack around access check in ParseTlfHandle.
	h.resolvedReaders = nil

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}

	rootID := kbfsblock.FakeID(42)
	node := pathNode{
		makeBP(rootID, rmd, config, session.UID.AsUserOrTeam()), "p"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node}}

	// won't even try getting the block if the user isn't a reader

	ops := getOps(config, id)
	n := nodeFromPath(t, ops, p)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
	ops.headStatus = headTrusted
	expectedErr := NewReadAccessError(h, "alice", "/keybase/private/bob#alice")

	if _, err := config.KBFSOps().GetDirChildren(ctx, n); err == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err != expectedErr {
		t.Errorf("Got unexpected error on root MD: %+v", err)
	}
}

func TestKBFSOpsGetBaseDirChildrenUncachedFailMissingBlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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
		} else if !de.EntryInfo.Eq(ei) {
			t.Errorf("Wrong EntryInfo for child %s: %v", c, ei)
		}
	}
}

func TestKBFSOpsLookupSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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
	expectedBNode.KeyGen = kbfsmd.FirstValidKeyGen
	if !ei.Eq(dirBlock.Children["b"].EntryInfo) {
		t.Errorf("Lookup returned a bad entry info: %v vs %v",
			ei, dirBlock.Children["b"].EntryInfo)
	} else if bPath.path[2] != expectedBNode {
		t.Errorf("Bad path node after lookup: %v vs %v",
			bPath.path[2], expectedBNode)
	}
}

func TestKBFSOpsLookupSymlinkSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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
	if !ei.Eq(dirBlock.Children["b"].EntryInfo) {
		t.Errorf("Lookup returned a bad directory entry: %v vs %v",
			ei, dirBlock.Children["b"].EntryInfo)
	} else if bn != nil {
		t.Errorf("Node for symlink is not nil: %v", bn)
	}
}

func TestKBFSOpsLookupNoSuchNameFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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

func TestKBFSOpsReadNewDataVersionFail(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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

	n, _, err := config.KBFSOps().Lookup(ctx, n, "b")
	if err != nil {
		t.Error("Unexpected error found on lookup")
	}

	buf := make([]byte, 1)
	_, err = config.KBFSOps().Read(ctx, n, buf, 0)
	if err == nil {
		t.Error("No expected error found on read")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Unexpected error after bad read: %+v", err)
	}
}

func TestKBFSOpsStatSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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
	bNode := pathNode{dirBlock.Children["b"].BlockPointer, "b"}
	p := path{FolderBranch{Tlf: id}, []pathNode{node, aNode, bNode}}
	n := nodeFromPath(t, ops, p)

	testPutBlockInCache(t, config, aNode.BlockPointer, id, dirBlock)

	ei, err := config.KBFSOps().Stat(ctx, n)
	if err != nil {
		t.Errorf("Error on Stat: %+v", err)
	}
	if !ei.Eq(dirBlock.Children["b"].EntryInfo) {
		t.Errorf("Stat returned a bad entry info: %v vs %v",
			ei, dirBlock.Children["b"].EntryInfo)
	}
}

func getBlockFromCache(
	t *testing.T, ctx context.Context, config Config, id tlf.ID,
	ptr BlockPointer, branch BranchName) Block {
	if block, err := config.DirtyBlockCache().Get(
		ctx, id, ptr, branch); err == nil {
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

func getDirBlockFromCache(
	t *testing.T, ctx context.Context, config Config, id tlf.ID,
	ptr BlockPointer, branch BranchName) *DirBlock {
	block := getBlockFromCache(t, ctx, config, id, ptr, branch)
	dblock, ok := block.(*DirBlock)
	if !ok {
		t.Errorf("Cached block %v, branch %s was not a DirBlock", ptr, branch)
	}
	return dblock
}

func getFileBlockFromCache(
	t *testing.T, ctx context.Context, config Config, id tlf.ID,
	ptr BlockPointer, branch BranchName) *FileBlock {
	block := getBlockFromCache(t, ctx, config, id, ptr, branch)
	fblock, ok := block.(*FileBlock)
	if !ok {
		t.Errorf("Cached block %v, branch %s was not a FileBlock", ptr, branch)
	}
	return fblock
}

func testCreateEntryFailDupName(t *testing.T, isDir bool) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

func testCreateEntryFailKBFSPrefix(t *testing.T, et EntryType) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
func makeDirTree(id tlf.ID, uid keybase1.UserOrTeamID, components ...string) (
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

func TestRemoveDirFailNonEmpty(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, p, blocks := makeDirTree(
		id, uid, "a", "b", "c", "d", "e")
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
	require.NotEqual(t, et, Sym)

	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)
	config.noBGFlush = true

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "alice", tlf.Private)

	kbfsOps := config.KBFSOps()
	var nodeA Node
	var err error
	if et == Dir {
		nodeA, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
		require.NoError(t, err)
		err = kbfsOps.SyncAll(ctx, nodeA.GetFolderBranch())
		require.NoError(t, err)
	} else {
		exec := false
		if et == Exec {
			exec = true
		}

		nodeA, _, err = kbfsOps.CreateFile(ctx, rootNode, "a", exec, NoExcl)
		require.NoError(t, err)

		data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
		err = kbfsOps.Write(ctx, nodeA, data, 0)
		require.NoError(t, err)
		err = kbfsOps.SyncAll(ctx, nodeA.GetFolderBranch())
		require.NoError(t, err)
	}

	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	// Remove block from the server directly, and clear caches.
	config.BlockOps().Delete(ctx, rootNode.GetFolderBranch().Tlf,
		[]BlockPointer{ops.nodeCache.PathFromNode(nodeA).tailPointer()})
	config.ResetCaches()

	err = config.KBFSOps().RemoveEntry(ctx, rootNode, "a")
	require.NoError(t, err)
	err = config.KBFSOps().SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// Shutdown the mdserver explicitly before the state checker tries
	// to run, since the sizes will definitely be wrong.
	defer config.MDServer().Shutdown()
}

func TestKBFSOpsRemoveFileMissingBlockSuccess(t *testing.T) {
	testKBFSOpsRemoveFileMissingBlockSuccess(t, File)
}

func TestKBFSOpsRemoveExecMissingBlockSuccess(t *testing.T) {
	testKBFSOpsRemoveFileMissingBlockSuccess(t, Exec)
}

func TestKBFSOpsRemoveDirMissingBlockSuccess(t *testing.T) {
	testKBFSOpsRemoveFileMissingBlockSuccess(t, Dir)
}

func TestRemoveDirFailNoSuchName(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)

	rootEntry, p, blocks := makeDirTree(
		id, uid, "a", "b", "c", "d", "e")
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

func TestRenameFailAcrossTopLevelFolders(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id1 := tlf.FakeID(1, tlf.Private)
	h1 := parseTlfHandleOrBust(t, config, "alice,bob", tlf.Private, id1)
	rmd1, err := makeInitialRootMetadata(config.MetadataVersion(), id1, h1)
	require.NoError(t, err)

	id2 := tlf.FakeID(2, tlf.Private)
	h2 := parseTlfHandleOrBust(t, config, "alice,bob,charlie", tlf.Private, id2)
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

func TestKBFSOpsCacheReadFullSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

func TestKBFSOpsWriteNewBlockSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newFileBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer,
		p.Branch)
	newRootBlock := getDirBlockFromCache(
		t, ctx, config, id, node.BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:     p.Branch,
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 0, Len: uint64(len(data))}})
}

func TestKBFSOpsWriteExtendSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newFileBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:     p.Branch,
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 5, Len: uint64(len(data))}})
}

func TestKBFSOpsWritePastEndSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newFileBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:     p.Branch,
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 7, Len: uint64(len(data))}})
}

func TestKBFSOpsWriteCauseSplit(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	b, _ := config.DirtyBlockCache().Get(ctx, id, node.BlockPointer, p.Branch)
	newRootBlock := b.(*DirBlock)

	b, _ = config.DirtyBlockCache().Get(
		ctx, id, fileNode.BlockPointer, p.Branch)
	pblock := b.(*FileBlock)
	b, _ = config.DirtyBlockCache().Get(ctx, id, makeBP(id1, rmd, config, uid),
		p.Branch)
	block1 := b.(*FileBlock)
	b, _ = config.DirtyBlockCache().Get(ctx, id, makeBP(id2, rmd, config, uid),
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

	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:            p.Branch,
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	uid, id, rmd := injectNewRMD(t, config)
	rootID := kbfsblock.FakeID(42)
	fileID := kbfsblock.FakeID(43)
	id1 := kbfsblock.FakeID(44)
	id2 := kbfsblock.FakeID(45)
	rootBlock := NewDirBlock().(*DirBlock)
	filePtr := BlockPointer{
		ID: fileID, KeyGen: kbfsmd.FirstValidKeyGen, DataVer: 1,
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
		gomock.Any(), gomock.Any(), []byte{1, 2, 3}, int64(2)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
			block.Contents = make([]byte, 5)
			copy(block.Contents, block1.Contents[0:2])
			copy(block.Contents[2:], data[0:3])
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

	newBlock1 := getFileBlockFromCache(
		t, ctx, config, id, fileBlock.IPtrs[0].BlockPointer, p.Branch)
	newBlock2 := getFileBlockFromCache(
		t, ctx, config, id, fileBlock.IPtrs[1].BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID, id1, id2},
		map[BlockPointer]BranchName{
			node.BlockPointer:               p.Branch,
			fileNode.BlockPointer:           p.Branch,
			fileBlock.IPtrs[0].BlockPointer: p.Branch,
			fileBlock.IPtrs[1].BlockPointer: p.Branch,
		})
}

// Read tests check the same error cases, so no need for similar write
// error tests

func TestKBFSOpsTruncateToZeroSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newFileBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)
	newRootBlock := getDirBlockFromCache(
		t, ctx, config, id, node.BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:     p.Branch,
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 0, Len: 0}})
}

func TestKBFSOpsTruncateSameSize(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	checkBlockCache(t, ctx, config, id, []kbfsblock.ID{rootID, fileID}, nil)
}

func TestKBFSOpsTruncateSmallerSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newFileBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:     p.Branch,
			fileNode.BlockPointer: p.Branch,
		})
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 5, Len: 0}})
}

func TestKBFSOpsTruncateShortensLastBlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newPBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)
	newBlock1 := getFileBlockFromCache(
		t, ctx, config, id, fileBlock.IPtrs[0].BlockPointer, p.Branch)
	newBlock2 := getFileBlockFromCache(
		t, ctx, config, id, fileBlock.IPtrs[1].BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID, id1, id2},
		map[BlockPointer]BranchName{
			node.BlockPointer:               p.Branch,
			fileNode.BlockPointer:           p.Branch,
			fileBlock.IPtrs[1].BlockPointer: p.Branch,
		})
}

func TestKBFSOpsTruncateRemovesABlock(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newPBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)
	newBlock1 := getFileBlockFromCache(
		t, ctx, config, id, fileBlock.IPtrs[0].BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID, id1, id2},
		map[BlockPointer]BranchName{
			node.BlockPointer:               p.Branch,
			fileNode.BlockPointer:           p.Branch,
			fileBlock.IPtrs[0].BlockPointer: p.Branch,
		})
}

func TestKBFSOpsTruncateBiggerSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

	newFileBlock := getFileBlockFromCache(
		t, ctx, config, id, fileNode.BlockPointer, p.Branch)

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
	checkBlockCache(
		t, ctx, config, id, []kbfsblock.ID{rootID, fileID},
		map[BlockPointer]BranchName{
			node.BlockPointer:     p.Branch,
			fileNode.BlockPointer: p.Branch,
		})
	// A truncate past the end of the file actually translates into a
	// write for the difference
	checkSyncOpInCache(t, config.Codec(), ops, fileNode.BlockPointer,
		[]WriteRange{{Off: 5, Len: 5}})
}

func TestSetExFailNoSuchName(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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

func TestSetMtimeNull(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	checkBlockCache(t, ctx, config, id, nil, nil)
}

func TestMtimeFailNoSuchName(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
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
	checkBlockCache(t, ctx, config, id, nil, nil)
}

func TestKBFSOpsStatRootSuccess(t *testing.T) {
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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
	mockCtrl, config, ctx, cancel := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config, ctx, cancel)

	id, h, rmd := createNewRMD(t, config, "alice", tlf.Private)

	ops := getOps(config, id)
	ops.head = makeImmutableRMDForTest(t, config, rmd, kbfsmd.FakeID(1))
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
	rootNode := GetRootNodeOrBust(ctx, t, config, "alice,bob", tlf.Private)

	kbfsOps := config.KBFSOps()
	nodeA, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	oldPtr := ops.nodeCache.PathFromNode(nodeA).tailPointer()

	staller := NewNaïveStaller(config)
	staller.StallMDOp(StallableMDAfterPut, 1, false)

	// start the background flusher
	config.SetBGFlushPeriod(1 * time.Millisecond)
	go ops.backgroundFlusher()

	// Wait for the stall to know the background work is done.
	staller.WaitForStallMDOp(StallableMDAfterPut)
	staller.UnstallOneMDOp(StallableMDAfterPut)

	// Do our own SyncAll now to ensure we wait for the bg flusher to
	// finish.
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %+v", err)
	}

	newPtr := ops.nodeCache.PathFromNode(nodeA).tailPointer()
	if oldPtr == newPtr {
		t.Fatalf("Background sync didn't update pointers")
	}
}

func TestKBFSOpsWriteRenameStat(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config, ctx, cancel)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

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
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

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
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

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
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
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
	bsplit := &BlockSplitterSimple{blockSize, 2, 100 * 1024, 0}
	config.SetBlockSplitter(bsplit)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

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
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
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
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context, cacheType DiskBlockCacheType) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	data, keyServerHalf, err := cbs.BlockServer.Get(
		ctx, tlfID, id, context, cacheType)
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
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

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

	_, err = GetRootNodeForTest(ctx, config2, "test_user", tlf.Private)
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
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)
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

func (c cryptoFixedTlf) MakeRandomTlfID(t tlf.Type) (tlf.ID, error) {
	return c.tlf, nil
}

// TestKBFSOpsMaliciousMDServerRange tries to trick KBFSOps into
// accepting bad MDs.
func TestKBFSOpsMaliciousMDServerRange(t *testing.T) {
	config1, _, ctx, cancel := kbfsOpsInitNoMocks(t, "alice", "mallory")
	// TODO: Use kbfsTestShutdownNoMocks.
	defer kbfsTestShutdownNoMocksNoCheck(t, config1, ctx, cancel)
	// Turn off tlf edit history because it messes with the FBO state
	// asynchronously.
	config1.mode = modeNoHistory{config1.Mode()}

	// Create alice's TLF.
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, "alice", tlf.Private)
	fb1 := rootNode1.GetFolderBranch()

	kbfsOps1 := config1.KBFSOps()

	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "dummy.txt", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// Create mallory's fake TLF using the same TLF ID as alice's.
	config2 := ConfigAsUser(config1, "mallory")
	config2.mode = modeNoHistory{config2.Mode()}
	crypto2 := cryptoFixedTlf{config2.Crypto(), fb1.Tlf}
	config2.SetCrypto(crypto2)
	mdserver2, err := NewMDServerMemory(mdServerLocalConfigAdapter{config2})
	require.NoError(t, err)
	config2.MDServer().Shutdown()
	config2.SetMDServer(mdserver2)
	config2.SetMDCache(NewMDCacheStandard(1))

	rootNode2 := GetRootNodeOrBust(
		ctx, t, config2, "alice,mallory", tlf.Private)
	require.Equal(t, fb1.Tlf, rootNode2.GetFolderBranch().Tlf)

	kbfsOps2 := config2.KBFSOps()

	// Add some operations to get mallory's TLF to have a higher
	// MetadataVersion.
	_, _, err = kbfsOps2.CreateFile(
		ctx, rootNode2, "dummy.txt", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.RemoveEntry(ctx, rootNode2, "dummy.txt")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Now route alice's TLF to mallory's MD server.
	config1.SetMDServer(mdserver2.copy(mdServerLocalConfigAdapter{config1}))

	// Simulate the server triggering alice to update.
	config1.SetKeyCache(NewKeyCacheStandard(1))
	err = kbfsOps1.SyncFromServer(ctx, fb1, nil)
	// TODO: We can actually fake out the PrevRoot pointer, too
	// and then we'll be caught by the handle check. But when we
	// have MDOps do the handle check, that'll trigger first.
	require.IsType(t, kbfsmd.MDPrevRootMismatch{}, err)
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

	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice", tlf.Private, id)

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
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "bob", tlf.Public)
	require.NoError(t, err)
	_, _, err = config.KBFSOps().GetOrCreateRootNode(ctx, h, MasterBranch)
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

// Regression test for KBFS-2161.
func TestDirtyPathsAfterRemoveDir(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)
	kbfsOps := config.KBFSOps()

	// Don't let the prefetcher bring the block back into the cache.
	config.BlockOps().Prefetcher().Shutdown()

	// Create a/b/c.
	nodeA, _, err := kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	nodeB, _, err := kbfsOps.CreateDir(ctx, nodeA, "b")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	nodeC, _, err := kbfsOps.CreateFile(ctx, nodeB, "c", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// Remove node c from the block cache and the server, to guarantee
	// it's not needed during the removal.
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	ptrC := ops.nodeCache.PathFromNode(nodeC).tailPointer()
	err = config.BlockCache().DeleteTransient(
		ptrC.ID, rootNode.GetFolderBranch().Tlf)
	require.NoError(t, err)

	// Remove c.
	err = kbfsOps.RemoveEntry(ctx, nodeB, "c")
	require.NoError(t, err)

	// Now a/b should be dirty.
	status, _, err := kbfsOps.FolderStatus(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	require.Len(t, status.DirtyPaths, 1)
	require.Equal(t, "test_user/a/b", status.DirtyPaths[0])

	// Now remove b, and make sure a/b is no longer dirty.
	err = kbfsOps.RemoveDir(ctx, nodeA, "b")
	require.NoError(t, err)
	status, _, err = kbfsOps.FolderStatus(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	require.Len(t, status.DirtyPaths, 1)
	require.Equal(t, "test_user/a", status.DirtyPaths[0])

	// Also make sure we can no longer create anything in the removed
	// directory.
	_, _, err = kbfsOps.CreateDir(ctx, nodeB, "d")
	require.IsType(t, UnsupportedOpInUnlinkedDirError{}, errors.Cause(err))

	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	status, _, err = kbfsOps.FolderStatus(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	require.Len(t, status.DirtyPaths, 0)

	// If the block made it back into the cache, we have a problem.
	// It shouldn't be needed for removal.
	_, err = config.BlockCache().Get(ptrC)
	require.NotNil(t, err)
}

func TestKBFSOpsBasicTeamTLF(t *testing.T) {
	var u1, u2, u3 kbname.NormalizedUsername = "u1", "u2", "u3"
	config1, uid1, ctx, cancel := kbfsOpsInitNoMocks(t, u1, u2, u3)
	defer kbfsTestShutdownNoMocks(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	config3 := ConfigAsUser(config1, u3)
	defer CheckConfigAndShutdown(ctx, t, config3)
	session3, err := config3.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid3 := session3.UID

	// These are deterministic, and should add the same TeamInfos for
	// both user configs.
	t.Log("Add teams")
	name := kbname.NormalizedUsername("t1")
	teamInfos := AddEmptyTeamsForTestOrBust(t, config1, name)
	_ = AddEmptyTeamsForTestOrBust(t, config2, name)
	_ = AddEmptyTeamsForTestOrBust(t, config3, name)
	tid := teamInfos[0].TID
	AddTeamWriterForTestOrBust(t, config1, tid, uid1)
	AddTeamWriterForTestOrBust(t, config2, tid, uid1)
	AddTeamWriterForTestOrBust(t, config3, tid, uid1)
	AddTeamWriterForTestOrBust(t, config1, tid, uid2)
	AddTeamWriterForTestOrBust(t, config2, tid, uid2)
	AddTeamWriterForTestOrBust(t, config3, tid, uid2)
	AddTeamReaderForTestOrBust(t, config1, tid, uid3)
	AddTeamReaderForTestOrBust(t, config2, tid, uid3)
	AddTeamReaderForTestOrBust(t, config3, tid, uid3)

	t.Log("Look up bob's public folder.")
	h, err := ParseTlfHandle(
		ctx, config1.KBPKI(), config1.MDOps(), string(name), tlf.SingleTeam)
	require.NoError(t, err)
	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err := kbfsOps1.GetOrCreateRootNode(
		ctx, h, MasterBranch)
	require.NoError(t, err)

	t.Log("Create a small file.")
	nodeA1, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	data := []byte{1}
	err = kbfsOps1.Write(ctx, nodeA1, data, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	t.Log("The other writer should be able to read it.")
	kbfsOps2 := config2.KBFSOps()
	rootNode2, _, err := kbfsOps2.GetOrCreateRootNode(
		ctx, h, MasterBranch)
	require.NoError(t, err)
	nodeA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	gotData2 := make([]byte, len(data))
	_, err = kbfsOps2.Read(ctx, nodeA2, gotData2, 0)
	require.NoError(t, err)
	require.True(t, bytes.Equal(data, gotData2))
	t.Log("And also should be able to write.")
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("The reader should be able to read it.")
	kbfsOps3 := config3.KBFSOps()
	rootNode3, _, err := kbfsOps3.GetOrCreateRootNode(
		ctx, h, MasterBranch)
	require.NoError(t, err)
	nodeA3, _, err := kbfsOps3.Lookup(ctx, rootNode3, "a")
	require.NoError(t, err)
	gotData3 := make([]byte, len(data))
	_, err = kbfsOps3.Read(ctx, nodeA3, gotData3, 0)
	require.NoError(t, err)
	require.True(t, bytes.Equal(data, gotData3))
	_, _, err = kbfsOps3.CreateFile(ctx, rootNode3, "c", false, NoExcl)
	require.IsType(t, WriteAccessError{}, errors.Cause(err))

	// Verify that "a" has the correct writer.
	ei, err := kbfsOps3.GetNodeMetadata(ctx, nodeA3)
	require.NoError(t, err)
	require.Equal(t, u1, ei.LastWriterUnverified)
}

type wrappedReadonlyTestIDType int

const wrappedReadonlyTestID wrappedReadonlyTestIDType = 1

type wrappedReadonlyNode struct {
	Node
}

func (wrn wrappedReadonlyNode) Readonly(ctx context.Context) bool {
	return ctx.Value(wrappedReadonlyTestID) != nil
}

func (wrn wrappedReadonlyNode) WrapChild(child Node) Node {
	return wrappedReadonlyNode{wrn.Node.WrapChild(child)}
}

func TestKBFSOpsReadonlyNodes(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	config.AddRootNodeWrapper(func(root Node) Node {
		return wrappedReadonlyNode{root}
	})

	// Not read-only, should work.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)
	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)

	// Read-only, shouldn't work.
	readonlyCtx := context.WithValue(ctx, wrappedReadonlyTestID, 1)
	_, _, err = kbfsOps.CreateDir(readonlyCtx, rootNode, "b")
	require.IsType(t, WriteToReadonlyNodeError{}, errors.Cause(err))
}

type wrappedAutocreateNode struct {
	Node
	et      EntryType
	sympath string
}

func (wan wrappedAutocreateNode) ShouldCreateMissedLookup(
	ctx context.Context, _ string) (bool, context.Context, EntryType, string) {
	return true, ctx, wan.et, wan.sympath
}

func testKBFSOpsAutocreateNodes(t *testing.T, et EntryType, sympath string) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	config.AddRootNodeWrapper(func(root Node) Node {
		return wrappedAutocreateNode{root, et, sympath}
	})

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)
	kbfsOps := config.KBFSOps()
	n, ei, err := kbfsOps.Lookup(ctx, rootNode, "a")
	require.NoError(t, err)
	if et != Sym {
		require.NotNil(t, n)
	} else {
		require.Equal(t, sympath, ei.SymPath)
	}
	require.Equal(t, et, ei.Type)
}

func TestKBFSOpsAutocreateNodesFile(t *testing.T) {
	testKBFSOpsAutocreateNodes(t, File, "")
}

func TestKBFSOpsAutocreateNodesExec(t *testing.T) {
	testKBFSOpsAutocreateNodes(t, Exec, "")
}

func TestKBFSOpsAutocreateNodesDir(t *testing.T) {
	testKBFSOpsAutocreateNodes(t, Dir, "")
}

func TestKBFSOpsAutocreateNodesSym(t *testing.T) {
	testKBFSOpsAutocreateNodes(t, Sym, "sympath")
}

func testKBFSOpsMigrateToImplicitTeam(
	t *testing.T, ty tlf.Type, name string, initialMDVer kbfsmd.MetadataVer) {
	var u1, u2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, u1, u2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
	config1.SetMetadataVersion(initialMDVer)

	config2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	config2.SetMetadataVersion(initialMDVer)

	t.Log("Create the folder before implicit teams are enabled.")
	h, err := ParseTlfHandle(
		ctx, config1.KBPKI(), config1.MDOps(), string(name), ty)
	require.NoError(t, err)
	require.False(t, h.IsBackedByTeam())
	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err := kbfsOps1.GetOrCreateRootNode(
		ctx, h, MasterBranch)
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Load the folder for u2.")
	kbfsOps2 := config2.KBFSOps()
	rootNode2, _, err := kbfsOps2.GetOrCreateRootNode(
		ctx, h, MasterBranch)
	require.NoError(t, err)
	eis, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Len(t, eis, 1)
	_, ok := eis["a"]
	require.True(t, ok)

	// These are deterministic, and should add the same
	// ImplicitTeamInfos for both user configs.
	err = EnableImplicitTeamsForTest(config1)
	require.NoError(t, err)
	teamID := AddImplicitTeamForTestOrBust(t, config1, name, "", 1, ty)
	_ = AddImplicitTeamForTestOrBust(t, config2, name, "", 1, ty)
	// The service should be adding the team TLF ID to the iteam's
	// sigchain before they call `StartMigration`.
	err = config1.KBPKI().CreateTeamTLF(ctx, teamID, h.tlfID)
	require.NoError(t, err)
	err = config2.KBPKI().CreateTeamTLF(ctx, teamID, h.tlfID)
	require.NoError(t, err)
	config1.SetMetadataVersion(kbfsmd.ImplicitTeamsVer)
	config2.SetMetadataVersion(kbfsmd.ImplicitTeamsVer)

	t.Log("Starting migration to implicit team")
	err = kbfsOps1.MigrateToImplicitTeam(ctx, h.tlfID)
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateDir(ctx, rootNode1, "b")
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Check migration from other client")
	err = kbfsOps2.SyncFromServer(ctx, rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
	eis, err = kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Len(t, eis, 2)
	_, ok = eis["a"]
	require.True(t, ok)
	_, ok = eis["b"]
	require.True(t, ok)

	t.Log("Make sure the new MD really is keyed for the implicit team")
	ops1 := getOps(config1, rootNode1.GetFolderBranch().Tlf)
	lState := makeFBOLockState()
	md, err := ops1.getMDForRead(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err)
	require.Equal(t, tlf.TeamKeying, md.TypeForKeying())
	require.Equal(t, kbfsmd.ImplicitTeamsVer, md.Version())
}

func TestKBFSOpsMigratePrivateToImplicitTeam(t *testing.T) {
	testKBFSOpsMigrateToImplicitTeam(
		t, tlf.Private, "u1,u2", kbfsmd.SegregatedKeyBundlesVer)
}

func TestKBFSOpsMigratePrivateWithReaderToImplicitTeam(t *testing.T) {
	testKBFSOpsMigrateToImplicitTeam(
		t, tlf.Private, "u1#u2", kbfsmd.SegregatedKeyBundlesVer)
}

func TestKBFSOpsMigratePrivateWithSBSToImplicitTeam(t *testing.T) {
	testKBFSOpsMigrateToImplicitTeam(
		t, tlf.Private, "u1,u2,zzz@twitter", kbfsmd.SegregatedKeyBundlesVer)
}

func TestKBFSOpsMigratePublicToImplicitTeam(t *testing.T) {
	testKBFSOpsMigrateToImplicitTeam(
		t, tlf.Public, "u1,u2", kbfsmd.SegregatedKeyBundlesVer)
}

func TestKBFSOpsMigratePrivateV2ToImplicitTeam(t *testing.T) {
	testKBFSOpsMigrateToImplicitTeam(
		t, tlf.Private, "u1,u2", kbfsmd.InitialExtraMetadataVer)
}

func TestKBFSOpsMigratePublicV2ToImplicitTeam(t *testing.T) {
	testKBFSOpsMigrateToImplicitTeam(
		t, tlf.Public, "u1,u2", kbfsmd.InitialExtraMetadataVer)
}

func TestKBFSOpsArchiveBranchType(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	t.Log("Create a private folder for the master branch.")
	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	require.False(t, rootNode.Readonly(ctx))
	fb := rootNode.GetFolderBranch()

	t.Log("Make a new revision")
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Create an archived version for the same TLF.")
	rootNodeArchived, _, err := kbfsOps.GetRootNode(
		ctx, h, MakeRevBranchName(1))
	require.NoError(t, err)

	eis, err := kbfsOps.GetDirChildren(ctx, rootNodeArchived)
	require.NoError(t, err)
	require.Len(t, eis, 0)

	eis, err = kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	require.Len(t, eis, 1)

	archiveFB := FolderBranch{fb.Tlf, MakeRevBranchName(1)}
	require.Equal(t, archiveFB, rootNodeArchived.GetFolderBranch())
	require.True(t, rootNodeArchived.Readonly(ctx))
}

type testKBFSOpsMemFileNode struct {
	Node
	fs   billy.Filesystem
	name string
}

func (n testKBFSOpsMemFileNode) GetFile(_ context.Context) billy.File {
	f, err := n.fs.Open(n.name)
	if err != nil {
		return nil
	}
	return f
}

type testKBFSOpsMemFSNode struct {
	Node
	fs billy.Filesystem
}

func (n testKBFSOpsMemFSNode) GetFS(_ context.Context) billy.Filesystem {
	return n.fs
}

func (n testKBFSOpsMemFSNode) WrapChild(child Node) Node {
	child = n.Node.WrapChild(child)
	name := child.GetBasename()
	fi, err := n.fs.Lstat(name)
	if err != nil {
		return child
	}
	if fi.IsDir() {
		childFS, err := n.fs.Chroot(name)
		if err != nil {
			return child
		}
		return &testKBFSOpsMemFSNode{
			Node: child,
			fs:   childFS,
		}
	}
	return &testKBFSOpsMemFileNode{
		Node: child,
		fs:   n.fs,
		name: name,
	}
}

type testKBFSOpsRootNode struct {
	Node
	fs billy.Filesystem
}

func (n testKBFSOpsRootNode) ShouldCreateMissedLookup(
	ctx context.Context, name string) (
	bool, context.Context, EntryType, string) {
	if name == "memfs" {
		return true, ctx, FakeDir, ""
	}
	return n.Node.ShouldCreateMissedLookup(ctx, name)
}

func (n testKBFSOpsRootNode) WrapChild(child Node) Node {
	child = n.Node.WrapChild(child)
	if child.GetBasename() == "memfs" {
		return &testKBFSOpsMemFSNode{
			Node: &ReadonlyNode{Node: child},
			fs:   n.fs,
		}
	}
	return child
}

type testKBFSOpsRootWrapper struct {
	fs billy.Filesystem
}

func (w testKBFSOpsRootWrapper) wrap(node Node) Node {
	return &testKBFSOpsRootNode{node, w.fs}
}

func TestKBFSOpsReadonlyFSNodes(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	fs := memfs.New()
	rw := testKBFSOpsRootWrapper{fs}
	config.AddRootNodeWrapper(rw.wrap)

	t.Log("Populate a memory file system with a few dirs and files")
	err := fs.MkdirAll("a/b", 0700)
	require.NoError(t, err)
	c, err := fs.Create("a/b/c")
	require.NoError(t, err)
	_, err = c.Write([]byte("cdata"))
	require.NoError(t, err)
	err = c.Close()
	require.NoError(t, err)
	d, err := fs.Create("d")
	require.NoError(t, err)
	_, err = d.Write([]byte("ddata"))
	require.NoError(t, err)
	err = d.Close()

	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)

	fsNode, _, err := kbfsOps.Lookup(ctx, rootNode, "memfs")
	require.NoError(t, err)
	children, err := kbfsOps.GetDirChildren(ctx, fsNode)
	require.NoError(t, err)
	require.Len(t, children, 2)

	aNode, _, err := kbfsOps.Lookup(ctx, fsNode, "a")
	require.NoError(t, err)
	children, err = kbfsOps.GetDirChildren(ctx, aNode)
	require.NoError(t, err)
	require.Len(t, children, 1)

	bNode, _, err := kbfsOps.Lookup(ctx, aNode, "b")
	require.NoError(t, err)
	children, err = kbfsOps.GetDirChildren(ctx, bNode)
	require.NoError(t, err)
	require.Len(t, children, 1)

	cNode, _, err := kbfsOps.Lookup(ctx, bNode, "c")
	require.NoError(t, err)
	data := make([]byte, 5)
	n, err := kbfsOps.Read(ctx, cNode, data, 0)
	require.NoError(t, err)
	require.Equal(t, int64(5), n)
	require.Equal(t, "cdata", string(data))

	dNode, _, err := kbfsOps.Lookup(ctx, fsNode, "d")
	require.NoError(t, err)
	data = make([]byte, 5)
	n, err = kbfsOps.Read(ctx, dNode, data, 0)
	require.NoError(t, err)
	require.Equal(t, int64(5), n)
	require.Equal(t, "ddata", string(data))
}

type mdServerShutdownOverride struct {
	mdServerLocal
	override bool
}

func (md mdServerShutdownOverride) isShutdown() bool {
	if md.override {
		return true
	}
	return md.mdServerLocal.isShutdown()
}

func TestKBFSOpsReset(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)
	md := &mdServerShutdownOverride{config.MDServer().(mdServerLocal), false}
	config.SetMDServer(md)

	err := EnableImplicitTeamsForTest(config)
	require.NoError(t, err)

	t.Log("Create a private folder.")
	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)

	oldID := h.tlfID
	t.Logf("Make a new revision for TLF ID %s", oldID)
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Reset the TLF")
	// Pretend the mdserver is shutdown, to avoid checking merged
	// state when shutting down the FBO (which causes a deadlock).
	md.override = true
	err = kbfsOps.Reset(ctx, h)
	require.NoError(t, err)
	require.NotEqual(t, oldID, h.tlfID)
	md.override = false

	t.Logf("Make a new revision for new TLF ID %s", h.tlfID)
	rootNode, _, err = kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	children, err := kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	require.Len(t, children, 0)
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "b")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	children, err = kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	require.Len(t, children, 1)
}

// diskMDCacheWithCommitChan notifies a channel whenever an MD is committed.
type diskMDCacheWithCommitChan struct {
	DiskMDCache
	commitCh chan<- kbfsmd.Revision

	lock sync.Mutex
	seen map[kbfsmd.Revision]bool
}

func newDiskMDCacheWithCommitChan(
	dmc DiskMDCache, commitCh chan<- kbfsmd.Revision) DiskMDCache {
	return &diskMDCacheWithCommitChan{
		DiskMDCache: dmc,
		commitCh:    commitCh,
		seen:        make(map[kbfsmd.Revision]bool),
	}
}

func (dmc *diskMDCacheWithCommitChan) Commit(
	ctx context.Context, tlfID tlf.ID, rev kbfsmd.Revision) error {
	err := dmc.DiskMDCache.Commit(ctx, tlfID, rev)
	if err != nil {
		return err
	}
	dmc.lock.Lock()
	defer dmc.lock.Unlock()
	if !dmc.seen[rev] {
		dmc.commitCh <- rev
		dmc.seen[rev] = true
	}
	return nil
}

func TestKBFSOpsUnsyncedMDCommit(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	dmcLocal, tempdir := newDiskMDCacheLocalForTest(t)
	defer shutdownDiskMDCacheTest(dmcLocal, tempdir)
	commitCh := make(chan kbfsmd.Revision)
	dmc := newDiskMDCacheWithCommitChan(dmcLocal, commitCh)
	config.diskMDCache = dmc

	t.Log("Create a private, unsynced TLF and make sure updates are committed")
	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(1), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(2), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Write using a different device")
	config2 := ConfigAsUser(config, u1)
	defer CheckConfigAndShutdown(ctx, t, config2)
	kbfsOps2 := config2.KBFSOps()
	rootNode2, _, err := kbfsOps2.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateDir(ctx, rootNode2, "b")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Sync the first device")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(3), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}

// bserverPutToDiskCache is a simple shim over a block server that
// adds blocks to the disk cache.
type bserverPutToDiskCache struct {
	BlockServer
	dbc DiskBlockCache
}

func (b bserverPutToDiskCache) Get(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context, cacheType DiskBlockCacheType) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf, err error) {
	buf, serverHalf, err = b.BlockServer.Get(
		ctx, tlfID, id, context, cacheType)
	if err != nil {
		return buf, serverHalf, err
	}

	b.dbc.Put(ctx, tlfID, id, buf, serverHalf, cacheType)
	return buf, serverHalf, nil
}

func (b bserverPutToDiskCache) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context, buf []byte,
	serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	cacheType DiskBlockCacheType) (err error) {
	err = b.BlockServer.Put(ctx, tlfID, id, context, buf, serverHalf, cacheType)
	if err != nil {
		return err
	}

	b.dbc.Put(ctx, tlfID, id, buf, serverHalf, cacheType)
	return nil
}

func enableDiskCacheForTest(
	t *testing.T, config *ConfigLocal, tempdir string) *diskBlockCacheWrapped {
	dbc, err := newDiskBlockCacheWrapped(config, "")
	require.NoError(t, err)
	config.diskBlockCache = dbc
	err = dbc.workingSetCache.WaitUntilStarted()
	require.NoError(t, err)
	err = dbc.syncCache.WaitUntilStarted()
	require.NoError(t, err)
	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	config.loadSyncedTlfsLocked()
	return dbc
}

func TestKBFSOpsSyncedMDCommit(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	config2 := ConfigAsUser(config, u1)
	defer CheckConfigAndShutdown(ctx, t, config2)

	dmcLocal, tempdir := newDiskMDCacheLocalForTest(t)
	defer shutdownDiskMDCacheTest(dmcLocal, tempdir)
	commitCh := make(chan kbfsmd.Revision)
	dmc := newDiskMDCacheWithCommitChan(dmcLocal, commitCh)
	config.diskMDCache = dmc

	dbc := enableDiskCacheForTest(t, config, tempdir)

	t.Log("Create a private, synced TLF")
	config.SetBlockServer(bserverPutToDiskCache{config.BlockServer(), dbc})
	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(1), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	config.SetTlfSyncState(
		rootNode.GetFolderBranch().Tlf, FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(2), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Stall any block gets from the device")
	staller := NewNaïveStaller(config)
	staller.StallBlockOp(StallableBlockGet, 4)
	defer staller.UndoStallBlockOp(StallableBlockGet)

	go func() {
		// Let the first (root fetch) block op through, but not the second.
		staller.WaitForStallBlockOp(StallableBlockGet)
		staller.UnstallOneBlockOp(StallableBlockGet)
	}()

	t.Log("Write using a different device")
	kbfsOps2 := config2.KBFSOps()
	rootNode2, _, err := kbfsOps2.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateDir(ctx, rootNode2, "b")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Sync the new revision, but ensure no MD commits yet")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	staller.WaitForStallBlockOp(StallableBlockGet)
	select {
	case rev := <-commitCh:
		t.Fatalf("No commit expected; rev=%d", rev)
	default:
	}

	t.Log("Unstall the final block get, and the commit should finish")
	staller.UnstallOneBlockOp(StallableBlockGet)
	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(3), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	go func() {
		// Let the first (root fetch) block op through, but not the second.
		staller.WaitForStallBlockOp(StallableBlockGet)
		staller.UnstallOneBlockOp(StallableBlockGet)
	}()

	t.Log("Write again, and this time read the MD to force a commit")
	_, _, err = kbfsOps2.CreateDir(ctx, rootNode2, "c")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	staller.WaitForStallBlockOp(StallableBlockGet)
	select {
	case rev := <-commitCh:
		t.Fatalf("No commit expected; rev=%d", rev)
	default:
	}

	_, err = kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	// Since we read the MD, it should be committed, before the
	// prefetch completes.
	select {
	case rev := <-commitCh:
		require.Equal(t, kbfsmd.Revision(4), rev)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	staller.UnstallOneBlockOp(StallableBlockGet)
}

func TestKBFSOpsPartialSyncConfig(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()

	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_cache")
	require.NoError(t, err)
	defer ioutil.RemoveAll(tempdir)
	_ = enableDiskCacheForTest(t, config, tempdir)

	t.Log("Sync should start off as disabled.")
	syncConfig, err := kbfsOps.GetSyncConfig(ctx, h.tlfID)
	require.NoError(t, err)
	require.Equal(t, keybase1.FolderSyncMode_DISABLED, syncConfig.Mode)

	t.Log("Expect an error before the TLF is initialized")
	syncConfig.Mode = keybase1.FolderSyncMode_PARTIAL
	pathsMap := map[string]bool{
		"a/b/c": true,
		"d/e/f": true,
	}
	syncConfig.Paths = make([]string, 0, 2)
	for p := range pathsMap {
		syncConfig.Paths = append(syncConfig.Paths, p)
	}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.Error(t, err)

	t.Log("Initialize the TLF")
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
	require.NoError(t, err)

	t.Log("Set a partial sync config")
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.NoError(t, err)

	t.Log("Make sure the lower-level config is encrypted")
	lowLevelConfig := config.GetTlfSyncState(h.tlfID)
	require.Equal(t, keybase1.FolderSyncMode_PARTIAL, lowLevelConfig.Mode)
	require.NotEqual(t, zeroPtr, lowLevelConfig.Paths.Ptr)
	var zeroBytes [32]byte
	require.False(t,
		bytes.Equal(zeroBytes[:], lowLevelConfig.Paths.ServerHalf.Bytes()))

	t.Log("Read it back out unencrypted")
	config.ResetCaches()
	syncConfig, err = kbfsOps.GetSyncConfig(ctx, h.tlfID)
	require.Equal(t, keybase1.FolderSyncMode_PARTIAL, syncConfig.Mode)
	require.Len(t, syncConfig.Paths, len(pathsMap))
	for _, p := range syncConfig.Paths {
		require.True(t, pathsMap[p])
		delete(pathsMap, p)
	}

	t.Log("Test some failure scenarios")
	syncConfig.Paths = []string{"a/b/c", "a/b/c"}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.Error(t, err)
	syncConfig.Paths = []string{"/a/b/c", "d/e/f"}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.Error(t, err)
	syncConfig.Paths = []string{"a/../a/b/c", "a/b/c"}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.Error(t, err)
	syncConfig.Paths = []string{"a/../../a/b/c"}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.Error(t, err)

	t.Log("Make sure the paths are cleaned and ToSlash'd")
	pathsMap = map[string]bool{
		"a/b/c": true,
		"d/e/f": true,
	}
	syncConfig.Paths = []string{"a/../a/b/c", filepath.Join("d", "e", "f")}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.NoError(t, err)
	syncConfig, err = kbfsOps.GetSyncConfig(ctx, h.tlfID)
	require.Equal(t, keybase1.FolderSyncMode_PARTIAL, syncConfig.Mode)
	require.Len(t, syncConfig.Paths, len(pathsMap))
	for _, p := range syncConfig.Paths {
		require.True(t, pathsMap[p])
		delete(pathsMap, p)
	}
}

func waitForPrefetchInTest(
	t *testing.T, ctx context.Context, config Config, node Node) {
	md, err := config.KBFSOps().GetNodeMetadata(ctx, node)
	require.NoError(t, err)
	ch, err := config.BlockOps().Prefetcher().WaitChannelForBlockPrefetch(
		ctx, md.BlockInfo.BlockPointer)
	require.NoError(t, err)
	select {
	case <-ch:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}

func TestKBFSOpsPartialSync(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()

	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_cache")
	require.NoError(t, err)
	defer ioutil.RemoveAll(tempdir)
	dbc := enableDiskCacheForTest(t, config, tempdir)

	// config2 is the writer.
	config2 := ConfigAsUser(config, u1)
	defer CheckConfigAndShutdown(ctx, t, config2)
	kbfsOps2 := config2.KBFSOps()
	// Turn the directories into indirect blocks when they have more
	// than one entry, to make sure we sync the entire parent
	// directories on partial paths.
	config2.BlockSplitter().(*BlockSplitterSimple).maxDirEntriesPerBlock = 1

	t.Log("Initialize the TLF")
	rootNode2, _, err := kbfsOps2.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	aNode, _, err := kbfsOps2.CreateDir(ctx, rootNode2, "a")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Set the sync config on first device")
	config.SetBlockServer(bserverPutToDiskCache{config.BlockServer(), dbc})
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	syncConfig := keybase1.FolderSyncConfig{
		Mode:  keybase1.FolderSyncMode_PARTIAL,
		Paths: []string{"a/b/c"},
	}
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	t.Log("Root block and 'a' block should be synced")
	checkSyncCache := func(expectedBlocks uint64) {
		waitForPrefetchInTest(t, ctx, config, rootNode)
		waitForPrefetchInTest(t, ctx, config, aNode)
		syncStatusMap := dbc.syncCache.Status(ctx)
		require.Len(t, syncStatusMap, 1)
		syncStatus, ok := syncStatusMap[syncCacheName]
		require.True(t, ok)
		require.Equal(t, expectedBlocks, syncStatus.NumBlocks)
	}
	checkSyncCache(2)

	t.Log("First device completes synced path, along with others")
	bNode, _, err := kbfsOps2.CreateDir(ctx, aNode, "b")
	require.NoError(t, err)
	b2Node, _, err := kbfsOps2.CreateDir(ctx, aNode, "b2")
	require.NoError(t, err)
	cNode, _, err := kbfsOps2.CreateDir(ctx, bNode, "c")
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateDir(ctx, b2Node, "c2")
	require.NoError(t, err)
	dNode, _, err := kbfsOps2.CreateDir(ctx, rootNode2, "d")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Blocks 'b' and 'c' should be synced, nothing else")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	// 8 blocks: root node (1 indirect, 2 direct), `a` node (1
	// indirect, 2 direct), `b` node, `c` node (and the old archived
	// ones have been GC'd from the sync cache).
	checkSyncCache(8)

	checkStatus := func(node Node, expectedStatus PrefetchStatus) {
		md, err := kbfsOps.GetNodeMetadata(ctx, node)
		require.NoError(t, err)
		require.Equal(t, expectedStatus, md.PrefetchStatus)
	}
	// Note that we're deliberately passing in Nodes created by
	// kbfsOps2 into kbfsOps here.  That's necessary to avoid
	// prefetching on the normal path by kbfsOps on the lookups it
	// would take to make those nodes.
	checkStatus(cNode, FinishedPrefetch)

	t.Log("Add more data under prefetched path")
	eNode, _, err := kbfsOps2.CreateDir(ctx, cNode, "e")
	require.NoError(t, err)
	fNode, _, err := kbfsOps2.CreateFile(ctx, eNode, "f", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.Write(ctx, fNode, []byte("fdata"), 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Check that two new blocks are synced")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	checkSyncCache(10)
	checkStatus(cNode, FinishedPrefetch)
	checkStatus(eNode, FinishedPrefetch)
	checkStatus(fNode, FinishedPrefetch)

	t.Log("Add something that's not synced")
	gNode, _, err := kbfsOps2.CreateDir(ctx, dNode, "g")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Check that the updated root block is synced, but nothing new")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	checkSyncCache(10)
	checkStatus(cNode, FinishedPrefetch)
	checkStatus(eNode, FinishedPrefetch)
	checkStatus(fNode, FinishedPrefetch)

	t.Log("Sync the new path")
	syncConfig.Paths = append(syncConfig.Paths, "d")
	_, err = kbfsOps.SetSyncConfig(ctx, h.tlfID, syncConfig)
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	checkSyncCache(12)
	checkStatus(cNode, FinishedPrefetch)
	checkStatus(eNode, FinishedPrefetch)
	checkStatus(fNode, FinishedPrefetch)
	checkStatus(dNode, FinishedPrefetch)
	checkStatus(gNode, FinishedPrefetch)
}

func TestKBFSOpsRecentHistorySync(t *testing.T) {
	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)
	// kbfsOpsConcurInit turns off notifications, so turn them back on.
	config.mode = modeTest{NewInitModeFromType(InitDefault)}

	name := "u1"
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()

	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_cache")
	require.NoError(t, err)
	defer ioutil.RemoveAll(tempdir)
	dbc := enableDiskCacheForTest(t, config, tempdir)

	// config2 is the writer.
	config2 := ConfigAsUser(config, u1)
	defer CheckConfigAndShutdown(ctx, t, config2)
	config2.mode = modeTest{NewInitModeFromType(InitDefault)}
	kbfsOps2 := config2.KBFSOps()

	config.SetBlockServer(bserverPutToDiskCache{config.BlockServer(), dbc})

	t.Log("Initialize the TLF")
	rootNode2, _, err := kbfsOps2.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	aNode, _, err := kbfsOps2.CreateDir(ctx, rootNode2, "a")
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("No files were edited, but fetching the root block will prefetch a")
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, MasterBranch)
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)

	checkWorkingSetCache := func(expectedBlocks uint64) {
		waitForPrefetchInTest(t, ctx, config, rootNode)
		waitForPrefetchInTest(t, ctx, config, aNode)

		statusMap := dbc.workingSetCache.Status(ctx)
		require.Len(t, statusMap, 1)
		status, ok := statusMap[workingSetCacheName]
		require.True(t, ok)
		require.Equal(t, expectedBlocks, status.NumBlocks)
	}
	checkWorkingSetCache(2)

	checkStatus := func(node Node, expectedStatus PrefetchStatus) {
		md, err := kbfsOps.GetNodeMetadata(ctx, node)
		require.NoError(t, err)
		require.Equal(t, expectedStatus, md.PrefetchStatus)
	}
	checkStatus(rootNode, FinishedPrefetch)
	checkStatus(aNode, FinishedPrefetch)

	t.Log("Writer adds a file, which gets prefetched")
	// Disable updates for the reader until after the edit
	// notification is sent and delivered.  This reflects a real issue
	// in production where the MD update can be delivered and
	// processed before the edit notification, and thus the new
	// activity wouldn't be properly prefetched.  TODO(KBFS-3698): fix
	// this in production and remove this disabling.
	c, err := DisableUpdatesForTesting(config, rootNode.GetFolderBranch())
	require.NoError(t, err)
	bNode, _, err := kbfsOps2.CreateFile(ctx, aNode, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.Write(ctx, bNode, []byte("bdata"), 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	c <- struct{}{}

	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	checkWorkingSetCache(3)
	checkStatus(bNode, FinishedPrefetch)
}
