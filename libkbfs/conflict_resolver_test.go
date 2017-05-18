// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func crTestInit(t *testing.T) (ctx context.Context, cancel context.CancelFunc,
	mockCtrl *gomock.Controller, config *ConfigMock, cr *ConflictResolver) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.SetCodec(kbfscodec.NewMsgpack())
	config.SetClock(wallClock{})
	id := tlf.FakeID(1, tlf.Private)
	fbo := newFolderBranchOps(config, FolderBranch{id, MasterBranch}, standard)
	// usernames don't matter for these tests
	config.mockKbpki.EXPECT().GetNormalizedUsername(gomock.Any(), gomock.Any()).
		AnyTimes().Return(libkb.NormalizedUsername("mockUser"), nil)

	mockDaemon := NewMockKeybaseService(mockCtrl)
	mockDaemon.EXPECT().LoadUserPlusKeys(
		gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes().Return(
		UserInfo{Name: "mockUser"}, nil)
	config.SetKeybaseService(mockDaemon)

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
	initSuccess = true
	return ctx, cancel, mockCtrl, config, fbo.cr
}

func crTestShutdown(ctx context.Context, cancel context.CancelFunc,
	mockCtrl *gomock.Controller, config *ConfigMock, cr *ConflictResolver) {
	CleanupCancellationDelayer(ctx)
	config.ctr.CheckForFailures()
	cr.fbo.Shutdown(ctx)
	cancel()
	mockCtrl.Finish()
}

type failingCodec struct {
	kbfscodec.Codec
}

func (fc failingCodec) Encode(interface{}) ([]byte, error) {
	return nil, errors.New("Stopping resolution process early")
}

func crMakeFakeRMD(rev kbfsmd.Revision, bid BranchID) ImmutableRootMetadata {
	var writerFlags WriterFlags
	if bid != NullBranchID {
		writerFlags = MetadataFlagUnmerged
	}
	key := kbfscrypto.MakeFakeVerifyingKeyOrBust("fake key")
	return MakeImmutableRootMetadata(&RootMetadata{
		bareMd: &BareRootMetadataV2{
			WriterMetadataV2: WriterMetadataV2{
				ID:     tlf.FakeID(0x1, tlf.Private),
				WFlags: writerFlags,
				BID:    bid,
			},
			WriterMetadataSigInfo: kbfscrypto.SignatureInfo{
				VerifyingKey: key,
			},
			Revision: rev,
			PrevRoot: kbfsmd.FakeID(byte(rev - 1)),
		},
		tlfHandle: &TlfHandle{name: "fake"},
	}, key, kbfsmd.FakeID(byte(rev)), time.Now())
}

func TestCRInput(t *testing.T) {
	ctx, cancel, mockCtrl, config, cr := crTestInit(t)
	defer crTestShutdown(ctx, cancel, mockCtrl, config, cr)

	// First try a completely unknown revision
	cr.Resolve(
		ctx, kbfsmd.RevisionUninitialized, kbfsmd.RevisionUninitialized)
	// This should return without doing anything (i.e., without
	// calling any mock methods)
	cr.Wait(ctx)

	// Next, try resolving a few items
	branchPoint := kbfsmd.Revision(2)
	unmergedHead := kbfsmd.Revision(5)
	mergedHead := kbfsmd.Revision(15)

	crypto := MakeCryptoCommon(config.Codec())
	bid, err := crypto.MakeRandomBranchID()
	if err != nil {
		t.Fatalf("Branch id err: %+v", bid)
	}
	cr.fbo.bid = bid
	cr.fbo.head = crMakeFakeRMD(unmergedHead, bid)
	cr.fbo.headStatus = headTrusted
	// serve all the MDs from the cache
	config.mockMdcache.EXPECT().Put(gomock.Any()).AnyTimes().Return(nil)
	for i := unmergedHead; i >= branchPoint+1; i-- {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, bid).Return(
			crMakeFakeRMD(i, bid), nil)
	}
	for i := kbfsmd.RevisionInitial; i <= branchPoint; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, bid).Return(
			ImmutableRootMetadata{}, NoSuchMDError{cr.fbo.id(), branchPoint, bid})
	}
	config.mockMdops.EXPECT().GetUnmergedRange(gomock.Any(), cr.fbo.id(),
		bid, kbfsmd.RevisionInitial, branchPoint).Return(nil, nil)

	for i := branchPoint; i <= mergedHead; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, NullBranchID).Return(
			crMakeFakeRMD(i, NullBranchID), nil)
	}
	for i := mergedHead + 1; i <= branchPoint-1+2*maxMDsAtATime; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, NullBranchID).Return(
			ImmutableRootMetadata{}, NoSuchMDError{cr.fbo.id(), i, NullBranchID})
	}
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(), mergedHead+1,
		gomock.Any()).Return(nil, nil)

	// CR doesn't see any operations and so it does resolution early.
	// Just cause an error so it doesn't bother the mocks too much.
	config.SetCodec(failingCodec{config.Codec()})
	config.mockRep.EXPECT().ReportErr(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any())

	// First try a completely unknown revision
	cr.Resolve(ctx, unmergedHead, kbfsmd.RevisionUninitialized)
	cr.Wait(ctx)
	// Make sure sure the input is up-to-date
	if cr.currInput.merged != mergedHead {
		t.Fatalf("Unexpected merged input: %d", cr.currInput.merged)
	}

	// Now make sure we ignore future inputs with lesser MDs
	cr.Resolve(ctx, kbfsmd.RevisionUninitialized, mergedHead-1)
	// This should return without doing anything (i.e., without
	// calling any mock methods)
	cr.Wait(ctx)
}

func TestCRInputFracturedRange(t *testing.T) {
	ctx, cancel, mockCtrl, config, cr := crTestInit(t)
	defer crTestShutdown(ctx, cancel, mockCtrl, config, cr)

	// Next, try resolving a few items
	branchPoint := kbfsmd.Revision(2)
	unmergedHead := kbfsmd.Revision(5)
	mergedHead := kbfsmd.Revision(15)

	crypto := MakeCryptoCommon(config.Codec())
	bid, err := crypto.MakeRandomBranchID()
	if err != nil {
		t.Fatalf("Branch id err: %+v", bid)
	}
	cr.fbo.bid = bid
	cr.fbo.head = crMakeFakeRMD(unmergedHead, bid)
	cr.fbo.headStatus = headTrusted
	// serve all the MDs from the cache
	config.mockMdcache.EXPECT().Put(gomock.Any()).AnyTimes().Return(nil)
	for i := unmergedHead; i >= branchPoint+1; i-- {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, bid).Return(crMakeFakeRMD(i, bid), nil)
	}
	for i := kbfsmd.RevisionInitial; i <= branchPoint; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, bid).Return(
			ImmutableRootMetadata{}, NoSuchMDError{cr.fbo.id(), branchPoint, bid})
	}
	config.mockMdops.EXPECT().GetUnmergedRange(gomock.Any(), cr.fbo.id(),
		bid, kbfsmd.RevisionInitial, branchPoint).Return(nil, nil)

	skipCacheRevision := kbfsmd.Revision(10)
	for i := branchPoint; i <= mergedHead; i++ {
		// Pretend that revision 10 isn't in the cache, and needs to
		// be fetched from the server.
		if i != skipCacheRevision {
			config.mockMdcache.EXPECT().Get(cr.fbo.id(), i,
				NullBranchID).Return(crMakeFakeRMD(i, NullBranchID), nil)
		} else {
			config.mockMdcache.EXPECT().Get(cr.fbo.id(), i,
				NullBranchID).Return(
				ImmutableRootMetadata{}, NoSuchMDError{cr.fbo.id(), i, NullBranchID})
		}
	}
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(),
		skipCacheRevision, skipCacheRevision).Return(
		[]ImmutableRootMetadata{crMakeFakeRMD(skipCacheRevision, NullBranchID)}, nil)
	for i := mergedHead + 1; i <= branchPoint-1+2*maxMDsAtATime; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, NullBranchID).Return(
			ImmutableRootMetadata{}, NoSuchMDError{cr.fbo.id(), i, NullBranchID})
	}
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(), mergedHead+1,
		gomock.Any()).Return(nil, nil)

	// CR doesn't see any operations and so it does resolution early.
	// Just cause an error so it doesn't bother the mocks too much.
	config.SetCodec(failingCodec{config.Codec()})
	config.mockRep.EXPECT().ReportErr(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any())

	// Resolve the fractured revision list
	cr.Resolve(ctx, unmergedHead, kbfsmd.RevisionUninitialized)
	cr.Wait(ctx)
	// Make sure sure the input is up-to-date
	if cr.currInput.merged != mergedHead {
		t.Fatalf("Unexpected merged input: %d", cr.currInput.merged)
	}
}

func testCRSharedFolderForUsers(
	t *testing.T, ctx context.Context, name string, createAs keybase1.UID,
	configs map[keybase1.UID]Config, dirs []string) map[keybase1.UID]Node {
	nodes := make(map[keybase1.UID]Node)

	// create by the first user
	kbfsOps := configs[createAs].KBFSOps()
	rootNode := GetRootNodeOrBust(ctx, t, configs[createAs], name, tlf.Private)
	dir := rootNode
	for _, d := range dirs {
		dirNext, _, err := kbfsOps.CreateDir(ctx, dir, d)
		if _, ok := err.(NameExistsError); ok {
			dirNext, _, err = kbfsOps.Lookup(ctx, dir, d)
			if err != nil {
				t.Fatalf("Couldn't lookup dir: %v", err)
			}
		} else if err != nil {
			t.Fatalf("Couldn't create dir: %v", err)
		}
		dir = dirNext
	}
	err := kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}
	nodes[createAs] = dir

	for u, config := range configs {
		if u == createAs {
			continue
		}

		kbfsOps := config.KBFSOps()
		kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
		rootNode := GetRootNodeOrBust(ctx, t, config, name, tlf.Private)
		dir := rootNode
		for _, d := range dirs {
			var err error
			dir, _, err = kbfsOps.Lookup(ctx, dir, d)
			if err != nil {
				t.Fatalf("Couldn't lookup dir: %v", err)
			}
		}
		nodes[u] = dir
	}
	return nodes
}

func testCRCheckPathsAndActions(t *testing.T, cr *ConflictResolver,
	expectedUnmergedPaths []path, expectedMergedPaths map[BlockPointer]path,
	expectedRecreateOps []*createOp,
	expectedActions map[BlockPointer]crActionList) {
	ctx := BackgroundContextWithCancellationDelayer()
	defer CleanupCancellationDelayer(ctx)
	lState := makeFBOLockState()

	// Step 1 -- check the chains and paths
	unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, _, _, err := cr.buildChainsAndPaths(ctx, lState, false)
	if err != nil {
		t.Fatalf("Couldn't build chains and paths: %v", err)
	}

	// we don't care about the order of the unmerged paths, so put
	// them into maps for comparison
	eUPathMap := make(map[BlockPointer]path)
	for _, p := range expectedUnmergedPaths {
		eUPathMap[p.tailPointer()] = p
	}
	uPathMap := make(map[BlockPointer]path)
	for _, p := range unmergedPaths {
		uPathMap[p.tailPointer()] = p
	}

	if !reflect.DeepEqual(eUPathMap, uPathMap) {
		t.Fatalf("Unmerged paths aren't right.  Expected %v, got %v",
			expectedUnmergedPaths, unmergedPaths)
	}

	if !reflect.DeepEqual(expectedMergedPaths, mergedPaths) {
		for k, v := range expectedMergedPaths {
			t.Logf("Expected: %v -> %v", k, v.path)
			t.Logf("Got: %v -> %v", k, mergedPaths[k].path)
		}
		t.Fatalf("Merged paths aren't right.  Expected %v, got %v",
			expectedMergedPaths, mergedPaths)
	}

	if g, e := len(recreateOps), len(expectedRecreateOps); g != e {
		t.Fatalf("Different number of recreate ops: %d vs %d", g, e)
	}

	// Can't use reflect.DeepEqual on the array since these contain
	// pointers which will always differ.
	for i, op := range expectedRecreateOps {
		if g, e := *recreateOps[i], *op; g.Dir.Unref != e.Dir.Unref ||
			g.NewName != e.NewName || g.Type != e.Type {
			t.Fatalf("Unexpected op at index %d: %v vs %v", i, g, e)
		}
	}

	// Now for step 2 -- check the actions
	actionMap, _, err := cr.computeActions(
		ctx, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, recreateOps, writerInfo{})
	if err != nil {
		t.Fatalf("Couldn't compute actions: %v", err)
	}
	if expectedActions == nil {
		return
	}

	// Set writer infos to match so DeepEqual will succeed.
	for k, v := range expectedActions {
		v2, ok := actionMap[k]
		if !ok || (len(v) != len(v2)) {
			break
		}
		for i := 0; i < len(v); i++ {
			switch x := v[i].(type) {
			case *dropUnmergedAction:
				y := v2[i].(*dropUnmergedAction)
				y.op.setWriterInfo(x.op.getWriterInfo())
			}
		}
	}

	if !reflect.DeepEqual(expectedActions, actionMap) {
		for k, v := range expectedActions {
			t.Logf("Sub %v eq=%v", k, reflect.DeepEqual(v, actionMap[k]))
			t.Logf("Expected: %v", v)
			t.Logf("Got:      %v", actionMap[k])
		}
		t.Fatalf("Actions aren't right.  Expected %v, got %v",
			expectedActions, actionMap)
	}
}

func testCRGetCROrBust(t *testing.T, config Config,
	fb FolderBranch) *ConflictResolver {
	kbfsOpsCast, ok := config.KBFSOps().(*KBFSOpsStandard)
	if !ok {
		t.Fatalf("Unexpected KBFSOps type")
	}
	ops := kbfsOpsCast.getOpsNoAdd(fb)
	return ops.cr
}

// Make two users, u1 and u2, with some common directories in a shared
// folder.  Pause updates on u2, and have both users make different
// updates in a shared subdirectory.  Then run through the first few
// conflict resolution steps directly through u2's conflict resolver
// and make sure the resulting unmerged path maps correctly to the
// merged path.
func TestCRMergedChainsSimple(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodes := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dir"})
	dir1 := nodes[uid1]
	dir2 := nodes[uid2]
	fb := dir1.GetFolderBranch()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 makes a file
	_, _, err = config1.KBFSOps().CreateFile(ctx, dir1, "file1", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dir1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// user2 makes a file (causes a conflict, and goes unstaged)
	_, _, err = config2.KBFSOps().CreateFile(ctx, dir2, "file2", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dir2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)
	expectedUnmergedPath := cr2.fbo.nodeCache.PathFromNode(dir2)
	mergedPath := cr1.fbo.nodeCache.PathFromNode(dir1)
	mergedPaths[expectedUnmergedPath.tailPointer()] = mergedPath
	expectedActions := map[BlockPointer]crActionList{
		mergedPath.tailPointer(): {&copyUnmergedEntryAction{
			"file2", "file2", "", false, false, DirEntry{}, nil}},
	}
	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, nil, expectedActions)
}

// Same as TestCRMergedChainsSimple, but the two users make changes in
// different, unrelated subdirectories, forcing the resolver to use
// mostly original block pointers when constructing the merged path.
func TestCRMergedChainsDifferentDirectories(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	nodesB := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirB"})
	dirB1 := nodesB[uid1]
	dirB2 := nodesB[uid2]
	fb := dirA1.GetFolderBranch()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 makes a file in dir A
	_, _, err = config1.KBFSOps().CreateFile(ctx, dirA1, "file1", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirA1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// user2 makes a file in dir B
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirB2, "file2", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dirB2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)
	expectedUnmergedPath := cr2.fbo.nodeCache.PathFromNode(dirB2)
	mergedPath := cr1.fbo.nodeCache.PathFromNode(dirB1)
	mergedPaths[expectedUnmergedPath.tailPointer()] = mergedPath
	expectedActions := map[BlockPointer]crActionList{
		mergedPath.tailPointer(): {&copyUnmergedEntryAction{
			"file2", "file2", "", false, false, DirEntry{}, nil}},
	}
	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, nil, expectedActions)
}

// Same as TestCRMergedChainsSimple, but u1 actually deletes some of
// the subdirectories used by u2, forcing the resolver to generate
// some recreateOps.
func TestCRMergedChainsDeletedDirectories(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	fb := dirA1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	nodesB := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB"})
	dirB1 := nodesB[uid1]
	nodesC := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB", "dirC"})
	dirC2 := nodesC[uid2]
	dirAPtr := cr1.fbo.nodeCache.PathFromNode(dirA1).tailPointer()
	dirBPtr := cr1.fbo.nodeCache.PathFromNode(dirB1).tailPointer()
	dirCPtr := cr2.fbo.nodeCache.PathFromNode(dirC2).tailPointer()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 deletes dirB and dirC
	err = config1.KBFSOps().RemoveDir(ctx, dirB1, "dirC")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config1.KBFSOps().RemoveDir(ctx, dirA1, "dirB")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirB1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 makes a file in dir C
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirC2, "file2", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dirC2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2

	expectedUnmergedPath := cr2.fbo.nodeCache.PathFromNode(dirC2)
	// The merged path will consist of the latest root and dirA
	// components, plus the original blockpointers of the deleted
	// nodes.
	mergedPaths := make(map[BlockPointer]path)
	mergedPath := cr1.fbo.nodeCache.PathFromNode(dirA1)
	mergedPath.path = append(mergedPath.path, pathNode{
		BlockPointer: dirBPtr,
		Name:         "dirB",
	})
	mergedPath.path = append(mergedPath.path, pathNode{
		BlockPointer: dirCPtr,
		Name:         "dirC",
	})
	mergedPaths[expectedUnmergedPath.tailPointer()] = mergedPath

	coB, err := newCreateOp("dirB", dirAPtr, Dir)
	require.NoError(t, err)
	coC, err := newCreateOp("dirC", dirBPtr, Dir)
	require.NoError(t, err)

	dirAPtr1 := cr1.fbo.nodeCache.PathFromNode(dirA1).tailPointer()
	expectedActions := map[BlockPointer]crActionList{
		dirCPtr: {&copyUnmergedEntryAction{"file2", "file2", "",
			false, false, DirEntry{}, nil}},
		dirBPtr: {&copyUnmergedEntryAction{"dirC", "dirC", "", false, false,
			DirEntry{}, nil}},
		dirAPtr1: {&copyUnmergedEntryAction{"dirB", "dirB", "", false, false,
			DirEntry{}, nil}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, []*createOp{coB, coC}, expectedActions)
}

// Same as TestCRMergedChainsSimple, but u1 actually renames one of
// the subdirectories used by u2, forcing the resolver to follow the
// path across the rename.
func TestCRMergedChainsRenamedDirectory(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	fb := dirA1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	nodesB := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB"})
	dirB1 := nodesB[uid1]
	nodesC := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB", "dirC"})
	dirC1 := nodesC[uid1]
	dirC2 := nodesC[uid2]
	dirCPtr := cr1.fbo.nodeCache.PathFromNode(dirC1).tailPointer()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 makes /dirA/dirD and renames dirC into it
	dirD1, _, err := config1.KBFSOps().CreateDir(ctx, dirA1, "dirD")
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
	}
	err = config1.KBFSOps().Rename(ctx, dirB1, "dirC", dirD1, "dirC")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirA1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 makes a file in dir C
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirC2, "file2", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dirC2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2

	expectedUnmergedPath := cr2.fbo.nodeCache.PathFromNode(dirC2)
	// The merged path will be the dirD/dirC path
	mergedPaths := make(map[BlockPointer]path)
	mergedPath := cr1.fbo.nodeCache.PathFromNode(dirD1)
	mergedPath.path = append(mergedPath.path, pathNode{
		BlockPointer: dirCPtr,
		Name:         "dirC",
	})
	mergedPaths[expectedUnmergedPath.tailPointer()] = mergedPath

	expectedActions := map[BlockPointer]crActionList{
		mergedPath.tailPointer(): {&copyUnmergedEntryAction{
			"file2", "file2", "", false, false, DirEntry{}, nil}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, nil, expectedActions)
}

// A mix of the above TestCRMergedChains* tests, with various other
// types of operations thrown in the mix (like u2 deleting unrelated
// directories, etc).
func TestCRMergedChainsComplex(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	// Setup:
	// /dirA/dirB/dirC
	// /dirA/dirB/dirD/file5
	// /dirE/dirF
	// /dirG/dirH

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	dirA2 := nodesA[uid2]
	fb := dirA1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	nodesB := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB"})
	dirB1 := nodesB[uid1]
	dirB2 := nodesB[uid2]
	nodesC := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB", "dirC"})
	dirC2 := nodesC[uid2]
	nodesD := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirA", "dirB", "dirD"})
	dirD1 := nodesD[uid1]
	dirD2 := nodesD[uid2]
	nodesE := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirE"})
	dirE1 := nodesE[uid1]
	nodesF := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirE", "dirF"})
	dirF2 := nodesF[uid2]
	dirEPtr := cr2.fbo.nodeCache.PathFromNode(dirE1).tailPointer()
	dirFPtr := cr2.fbo.nodeCache.PathFromNode(dirF2).tailPointer()
	nodesG := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dirG"})
	dirG1 := nodesG[uid1]
	nodesH := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"dirG", "dirH"})
	dirH1 := nodesH[uid1]
	dirH2 := nodesH[uid2]
	dirHPtr := cr1.fbo.nodeCache.PathFromNode(dirH1).tailPointer()

	_, _, err = config1.KBFSOps().CreateFile(ctx, dirD1, "file5", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirD1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	config2.KBFSOps().SyncFromServerForTesting(ctx, fb)

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user 1:
	// touch /dirA/file1
	// rm -rf /dirE/dirF
	// mv /dirG/dirH /dirA/dirI
	//
	// user 2:
	// mkdir /dirA/dirJ
	// touch /dirA/dirJ/file2
	// touch /dirE/dirF/file3
	// touch /dirA/dirB/dirC/file4
	// mv /dirA/dirB/dirC/file4 /dirG/dirH/file4
	// rm /dirA/dirB/dirD/file5
	// rm -rf /dirA/dirB/dirD

	// user 1:
	_, _, err = config1.KBFSOps().CreateFile(ctx, dirA1, "file1", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config1.KBFSOps().RemoveDir(ctx, dirE1, "dirF")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config1.KBFSOps().Rename(ctx, dirG1, "dirH", dirA1, "dirI")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirA1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2
	dirJ2, _, err := config2.KBFSOps().CreateDir(ctx, dirA2, "dirJ")
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirJ2, "file2", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirF2, "file3", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirC2, "file4", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config2.KBFSOps().Rename(ctx, dirC2, "file4", dirH2, "file4")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config2.KBFSOps().RemoveEntry(ctx, dirD2, "file5")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config2.KBFSOps().RemoveDir(ctx, dirB2, "dirD")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dirB2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2

	uPathA2 := cr2.fbo.nodeCache.PathFromNode(dirA2)
	uPathF2 := cr2.fbo.nodeCache.PathFromNode(dirF2)
	// no expected unmerged path for dirJ or dirC
	uPathH2 := cr2.fbo.nodeCache.PathFromNode(dirH2)
	// no expected unmerged path for dirD
	uPathB2 := cr2.fbo.nodeCache.PathFromNode(dirB2)

	mergedPaths := make(map[BlockPointer]path)
	// Both users updated A
	mergedPathA := cr1.fbo.nodeCache.PathFromNode(dirA1)
	mergedPaths[uPathA2.tailPointer()] = mergedPathA
	// user 1 deleted dirF, so reconstruct
	mergedPathF := cr1.fbo.nodeCache.PathFromNode(dirE1)
	mergedPathF.path = append(mergedPathF.path, pathNode{
		BlockPointer: dirFPtr,
		Name:         "dirF",
	})
	mergedPaths[uPathF2.tailPointer()] = mergedPathF
	// dirH from user 2 is /dirA/dirI for user 1
	mergedPathH := cr1.fbo.nodeCache.PathFromNode(dirA1)
	mergedPathH.path = append(mergedPathH.path, pathNode{
		BlockPointer: dirHPtr,
		Name:         "dirI",
	})
	mergedPaths[uPathH2.tailPointer()] = mergedPathH
	// dirB wasn't touched by user 1
	mergedPathB := cr1.fbo.nodeCache.PathFromNode(dirB1)
	mergedPaths[uPathB2.tailPointer()] = mergedPathB

	coF, err := newCreateOp("dirF", dirEPtr, Dir)
	require.NoError(t, err)

	mergedPathE := cr1.fbo.nodeCache.PathFromNode(dirE1)
	expectedActions := map[BlockPointer]crActionList{
		mergedPathA.tailPointer(): {&copyUnmergedEntryAction{
			"dirJ", "dirJ", "", false, false, DirEntry{}, nil}},
		mergedPathE.tailPointer(): {&copyUnmergedEntryAction{
			"dirF", "dirF", "", false, false, DirEntry{}, nil}},
		mergedPathF.tailPointer(): {&copyUnmergedEntryAction{
			"file3", "file3", "", false, false, DirEntry{}, nil}},
		mergedPathH.tailPointer(): {&copyUnmergedEntryAction{
			"file4", "file4", "", false, false, DirEntry{}, nil}},
		mergedPathB.tailPointer(): {&rmMergedEntryAction{"dirD"}},
	}
	// `rm file5` doesn't get an action because the parent directory
	// was deleted in the unmerged branch.

	testCRCheckPathsAndActions(t, cr2, []path{uPathA2, uPathF2, uPathH2,
		uPathB2}, mergedPaths, []*createOp{coF}, expectedActions)
}

// Tests that conflict resolution detects and can fix rename cycles.
func TestCRMergedChainsRenameCycleSimple(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	clock, now := newTestClockAndTimeNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesRoot := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"root"})
	dirRoot1 := nodesRoot[uid1]
	dirRoot2 := nodesRoot[uid2]
	fb := dirRoot1.GetFolderBranch()

	nodesA := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"root", "dirA"})
	dirA1 := nodesA[uid1]

	nodesB := testCRSharedFolderForUsers(t, ctx, name, uid1, configs,
		[]string{"root", "dirB"})
	dirB1 := nodesB[uid1]
	dirB2 := nodesB[uid2]

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 moves dirB into dirA
	err = config1.KBFSOps().Rename(ctx, dirRoot1, "dirB", dirA1, "dirB")
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirRoot1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 moves dirA into dirB
	err = config2.KBFSOps().Rename(ctx, dirRoot2, "dirA", dirB2, "dirA")
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dirRoot2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2

	mergedPaths := make(map[BlockPointer]path)

	// root
	unmergedPathRoot := cr2.fbo.nodeCache.PathFromNode(dirRoot2)
	mergedPathRoot := cr1.fbo.nodeCache.PathFromNode(dirRoot1)
	mergedPaths[unmergedPathRoot.tailPointer()] = mergedPathRoot
	unmergedPathB := cr2.fbo.nodeCache.PathFromNode(dirB2)
	mergedPathB := cr1.fbo.nodeCache.PathFromNode(dirB1)
	mergedPaths[unmergedPathB.tailPointer()] = mergedPathB

	ro, err := newRmOp("dirA", unmergedPathRoot.tailPointer())
	require.NoError(t, err)
	err = ro.Dir.setRef(unmergedPathRoot.tailPointer())
	require.NoError(t, err)
	ro.dropThis = true
	ro.setWriterInfo(writerInfo{})
	ro.setFinalPath(unmergedPathRoot)
	ro.setLocalTimestamp(now)
	expectedActions := map[BlockPointer]crActionList{
		mergedPathRoot.tailPointer(): {&dropUnmergedAction{ro}},
		mergedPathB.tailPointer(): {&copyUnmergedEntryAction{
			"dirA", "dirA", "./../", false, false, DirEntry{}, nil}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{unmergedPathRoot, unmergedPathB},
		mergedPaths, nil, expectedActions)
}

// Tests that conflict resolution detects and renames conflicts.
func TestCRMergedChainsConflictSimple(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	clock, now := newTestClockAndTimeNow()
	config2.SetClock(clock)

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesRoot := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"root"})
	dirRoot1 := nodesRoot[uid1]
	dirRoot2 := nodesRoot[uid2]
	fb := dirRoot1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 creates file1
	_, _, err = config1.KBFSOps().CreateFile(
		ctx, dirRoot1, "file1", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't make file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirRoot1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 also create file1, but makes it executable
	_, _, err = config2.KBFSOps().CreateFile(
		ctx, dirRoot2, "file1", true, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dirRoot2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)

	// root
	unmergedPathRoot := cr2.fbo.nodeCache.PathFromNode(dirRoot2)
	mergedPathRoot := cr1.fbo.nodeCache.PathFromNode(dirRoot1)
	mergedPaths[unmergedPathRoot.tailPointer()] = mergedPathRoot

	cre := WriterDeviceDateConflictRenamer{}
	expectedActions := map[BlockPointer]crActionList{
		mergedPathRoot.tailPointer(): {&renameUnmergedAction{
			"file1",
			cre.ConflictRenameHelper(now, "u2", "dev1", "file1"),
			"", 0, false, zeroPtr, zeroPtr}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{unmergedPathRoot},
		mergedPaths, nil, expectedActions)
}

// Tests that conflict resolution detects and renames conflicts.
func TestCRMergedChainsConflictFileCollapse(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	clock, now := newTestClockAndTimeNow()
	config2.SetClock(clock)

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesRoot := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"root"})
	dirRoot1 := nodesRoot[uid1]
	dirRoot2 := nodesRoot[uid2]
	fb := dirRoot1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// user1 creates file
	_, _, err = config1.KBFSOps().CreateFile(
		ctx, dirRoot1, "file", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't make file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirRoot1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 lookup
	err = config2.KBFSOps().SyncFromServerForTesting(ctx, fb)
	if err != nil {
		t.Fatalf("Couldn't sync user 2")
	}
	file2, _, err := config2.KBFSOps().Lookup(ctx, dirRoot2, "file")
	if err != nil {
		t.Fatalf("Couldn't lookup file: %v", err)
	}

	filePtr := cr2.fbo.nodeCache.PathFromNode(file2).tailPointer()
	dirRootPtr := cr2.fbo.nodeCache.PathFromNode(dirRoot2).tailPointer()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 deletes the file and creates another
	err = config1.KBFSOps().RemoveEntry(ctx, dirRoot1, "file")
	if err != nil {
		t.Fatalf("Couldn't remove file: %v", err)
	}
	_, _, err = config1.KBFSOps().CreateFile(
		ctx, dirRoot1, "file", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't re-make file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dirRoot1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 updates the file attribute and writes too.
	err = config2.KBFSOps().SetEx(ctx, file2, true)
	if err != nil {
		t.Fatalf("Couldn't set ex: %v", err)
	}
	err = config2.KBFSOps().Write(ctx, file2, []byte{1, 2, 3}, 0)
	if err != nil {
		t.Fatalf("Couldn't write: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, file2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)

	// file (needs to be recreated)
	unmergedPathFile := cr2.fbo.nodeCache.PathFromNode(file2)
	mergedPathFile := cr1.fbo.nodeCache.PathFromNode(dirRoot1)
	mergedPathFile.path = append(mergedPathFile.path, pathNode{
		BlockPointer: filePtr,
		Name:         "file",
	})
	mergedPaths[unmergedPathFile.tailPointer()] = mergedPathFile

	coFile, err := newCreateOp("file", dirRootPtr, Exec)
	require.NoError(t, err)

	cre := WriterDeviceDateConflictRenamer{}
	mergedPathRoot := cr1.fbo.nodeCache.PathFromNode(dirRoot1)
	// Both unmerged actions should collapse into just one rename operation
	expectedActions := map[BlockPointer]crActionList{
		mergedPathRoot.tailPointer(): {&renameUnmergedAction{
			"file",
			cre.ConflictRenameHelper(now, "u2", "dev1", "file"),
			"", 0, false, zeroPtr, zeroPtr}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{unmergedPathFile},
		mergedPaths, []*createOp{coFile}, expectedActions)
}

// Test that actions get executed properly in the simple case of two
// files being created simultaneously in the same directory.
func TestCRDoActionsSimple(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodes := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dir"})
	dir1 := nodes[uid1]
	dir2 := nodes[uid2]
	fb := dir1.GetFolderBranch()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 makes a file
	_, _, err = config1.KBFSOps().CreateFile(ctx, dir1, "file1", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dir1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// user2 makes a file (causes a conflict, and goes unstaged)
	_, _, err = config2.KBFSOps().CreateFile(ctx, dir2, "file2", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, dir2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	lState := makeFBOLockState()

	// Now run through conflict resolution manually for user2.
	unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, _, _, err := cr2.buildChainsAndPaths(ctx, lState, false)
	if err != nil {
		t.Fatalf("Couldn't build chains and paths: %v", err)
	}

	actionMap, _, err := cr2.computeActions(ctx, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, recreateOps, writerInfo{})
	if err != nil {
		t.Fatalf("Couldn't compute actions: %v", err)
	}

	lbc := make(localBcache)
	newFileBlocks := make(fileBlockMap)
	dirtyBcache := simpleDirtyBlockCacheStandard()
	err = cr2.doActions(ctx, lState, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, actionMap, lbc, newFileBlocks, dirtyBcache)
	if err != nil {
		t.Fatalf("Couldn't do actions: %v", err)
	}

	// Does the merged block contain both entries?
	mergedRootPath := cr1.fbo.nodeCache.PathFromNode(dir1)
	block1, ok := lbc[mergedRootPath.tailPointer()]
	if !ok {
		t.Fatalf("Couldn't find merged block at path %s", mergedRootPath)
	}
	if g, e := len(block1.Children), 2; g != e {
		t.Errorf("Unexpected number of children: %d vs %d", g, e)
	}
	for _, file := range []string{"file1", "file2"} {
		if _, ok := block1.Children[file]; !ok {
			t.Errorf("Couldn't find entry in merged children: %s", file)
		}
	}
	if len(newFileBlocks) != 0 {
		t.Errorf("Unexpected new file blocks!")
	}
}

// Test that actions get executed properly in the case of two
// simultaneous writes to the same file.
func TestCRDoActionsWriteConflict(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	clock, now := newTestClockAndTimeNow()
	config2.SetClock(clock)

	name := userName1.String() + "," + userName2.String()

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodes := testCRSharedFolderForUsers(t, ctx, name, uid1, configs, []string{"dir"})
	dir1 := nodes[uid1]
	dir2 := nodes[uid2]
	fb := dir1.GetFolderBranch()

	// user1 makes a file
	file1, _, err := config1.KBFSOps().CreateFile(
		ctx, dir1, "file", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, dir1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}

	// user2 lookup
	err = config2.KBFSOps().SyncFromServerForTesting(ctx, fb)
	if err != nil {
		t.Fatalf("Couldn't sync user 2")
	}
	file2, _, err := config2.KBFSOps().Lookup(ctx, dir2, "file")
	if err != nil {
		t.Fatalf("Couldn't lookup file: %v", err)
	}

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()

	// user1 writes the file
	err = config1.KBFSOps().Write(ctx, file1, []byte{1, 2, 3}, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}
	err = config1.KBFSOps().SyncAll(ctx, file1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// user2 writes the file
	unmergedData := []byte{4, 5, 6}
	err = config2.KBFSOps().Write(ctx, file2, unmergedData, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}
	err = config2.KBFSOps().SyncAll(ctx, file2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	lState := makeFBOLockState()

	// Now run through conflict resolution manually for user2.
	unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, _, _, err := cr2.buildChainsAndPaths(ctx, lState, false)
	if err != nil {
		t.Fatalf("Couldn't build chains and paths: %v", err)
	}

	actionMap, _, err := cr2.computeActions(ctx, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, recreateOps, writerInfo{})
	if err != nil {
		t.Fatalf("Couldn't compute actions: %v", err)
	}

	lbc := make(localBcache)
	newFileBlocks := make(fileBlockMap)
	dirtyBcache := simpleDirtyBlockCacheStandard()
	err = cr2.doActions(ctx, lState, unmergedChains, mergedChains,
		unmergedPaths, mergedPaths, actionMap, lbc, newFileBlocks, dirtyBcache)
	if err != nil {
		t.Fatalf("Couldn't do actions: %v", err)
	}

	// Does the merged block contain the two files?
	mergedRootPath := cr1.fbo.nodeCache.PathFromNode(dir1)
	cre := WriterDeviceDateConflictRenamer{}
	mergedName := cre.ConflictRenameHelper(now, "u2", "dev1", "file")
	if len(newFileBlocks) != 1 {
		t.Errorf("Unexpected new file blocks!")
	}
	if blocks, ok := newFileBlocks[mergedRootPath.tailPointer()]; !ok {
		t.Errorf("No blocks for dir merged ptr: %v",
			mergedRootPath.tailPointer())
	} else if len(blocks) != 1 {
		t.Errorf("Unexpected number of blocks")
	} else if fblock, ok := blocks[mergedName]; !ok {
		t.Errorf("No block for name %s", mergedName)
	} else if fblock.IsInd {
		t.Errorf("Unexpected indirect block")
	} else if g, e := fblock.Contents, unmergedData; !reflect.DeepEqual(g, e) {
		t.Errorf("Unexpected block contents: %v vs %v", g, e)
	}

	// NOTE: the action doesn't actually create the entry, so this
	// test can only check that newFileBlocks looks correct.
}
