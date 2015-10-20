package libkbfs

import (
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func crTestInit(t *testing.T) (mockCtrl *gomock.Controller, config *ConfigMock,
	cr *ConflictResolver) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	id, _, _ := NewFolder(t, 1, 1, false, false)
	fbo := NewFolderBranchOps(config, FolderBranch{id, MasterBranch}, standard)
	cr = NewConflictResolver(config, fbo)
	// usernames don't matter for these tests
	config.mockKbpki.EXPECT().GetNormalizedUsername(gomock.Any(), gomock.Any()).
		AnyTimes().Return(libkb.NormalizedUsername("mockUser"), nil)
	return mockCtrl, config, cr
}

func crTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock,
	cr *ConflictResolver) {
	config.ctr.CheckForFailures()
	cr.fbo.Shutdown()
	mockCtrl.Finish()
}

func TestCRInput(t *testing.T) {
	mockCtrl, config, cr := crTestInit(t)
	defer crTestShutdown(mockCtrl, config, cr)
	ctx := context.Background()

	// First try a completely unknown revision
	cr.Resolve(MetadataRevisionUninitialized, MetadataRevisionUninitialized)
	// This should return without doing anything (i.e., without
	// calling any mock methods)
	cr.Wait(ctx)

	// Next, try resolving a few items
	branchPoint := MetadataRevision(2)
	unmergedHead := MetadataRevision(5)
	mergedHead := MetadataRevision(15)

	cr.fbo.head = &RootMetadata{
		Revision: unmergedHead,
		Flags:    MetadataFlagUnmerged,
	}
	// serve all the MDs from the cache
	for i := unmergedHead; i >= branchPoint+1; i-- {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Unmerged).Return(
			&RootMetadata{
				Revision: i,
				Flags:    MetadataFlagUnmerged,
			}, nil)
	}
	for i := MetadataRevisionInitial; i <= branchPoint; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Unmerged).Return(
			nil, NoSuchMDError{cr.fbo.id(), branchPoint, Unmerged})
	}
	config.mockMdops.EXPECT().GetUnmergedRange(gomock.Any(), cr.fbo.id(),
		MetadataRevisionInitial, branchPoint).Return(nil, nil)

	for i := branchPoint + 1; i <= mergedHead; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Merged).Return(
			&RootMetadata{Revision: i}, nil)
	}
	for i := mergedHead + 1; i <= branchPoint+2*maxMDsAtATime; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Merged).Return(
			nil, NoSuchMDError{cr.fbo.id(), i, Merged})
	}
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(),
		mergedHead+1, gomock.Any()).Return(nil, nil)

	// First try a completely unknown revision
	cr.Resolve(unmergedHead, MetadataRevisionUninitialized)
	cr.Wait(ctx)
	// Make sure sure the input is up-to-date
	if cr.currInput.merged != mergedHead {
		t.Fatalf("Unexpected merged input: %d\n", cr.currInput.merged)
	}

	// Now make sure we ignore future inputs with lesser MDs
	cr.Resolve(MetadataRevisionUninitialized, mergedHead-1)
	// This should return without doing anything (i.e., without
	// calling any mock methods)
	cr.Wait(ctx)
}

func TestCRInputFracturedRange(t *testing.T) {
	mockCtrl, config, cr := crTestInit(t)
	defer crTestShutdown(mockCtrl, config, cr)
	ctx := context.Background()

	// Next, try resolving a few items
	branchPoint := MetadataRevision(2)
	unmergedHead := MetadataRevision(5)
	mergedHead := MetadataRevision(15)

	cr.fbo.head = &RootMetadata{
		Revision: unmergedHead,
		Flags:    MetadataFlagUnmerged,
	}
	// serve all the MDs from the cache
	for i := unmergedHead; i >= branchPoint+1; i-- {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Unmerged).Return(
			&RootMetadata{
				Revision: i,
				Flags:    MetadataFlagUnmerged,
			}, nil)
	}
	for i := MetadataRevisionInitial; i <= branchPoint; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Unmerged).Return(
			nil, NoSuchMDError{cr.fbo.id(), branchPoint, Unmerged})
	}
	config.mockMdops.EXPECT().GetUnmergedRange(gomock.Any(), cr.fbo.id(),
		MetadataRevisionInitial, branchPoint).Return(nil, nil)

	skipCacheRevision := MetadataRevision(10)
	for i := branchPoint + 1; i <= mergedHead; i++ {
		// Pretend that revision 10 isn't in the cache, and needs to
		// be fetched from the server.
		if i != skipCacheRevision {
			config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Merged).Return(
				&RootMetadata{Revision: i}, nil)
		} else {
			config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Merged).Return(
				nil, NoSuchMDError{cr.fbo.id(), i, Merged})
		}
	}
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(),
		skipCacheRevision, skipCacheRevision).Return(
		[]*RootMetadata{{Revision: skipCacheRevision}}, nil)
	for i := mergedHead + 1; i <= branchPoint+2*maxMDsAtATime; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, Merged).Return(
			nil, NoSuchMDError{cr.fbo.id(), i, Merged})
	}
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(),
		mergedHead+1, gomock.Any()).Return(nil, nil)

	// Resolve the fractured revision list
	cr.Resolve(unmergedHead, MetadataRevisionUninitialized)
	cr.Wait(ctx)
	// Make sure sure the input is up-to-date
	if cr.currInput.merged != mergedHead {
		t.Fatalf("Unexpected merged input: %d\n", cr.currInput.merged)
	}
}

func testCRSharedFolderForUsers(t *testing.T, createAs keybase1.UID,
	configs map[keybase1.UID]Config, dirs []string) map[keybase1.UID]Node {
	h := NewTlfHandle()
	for u := range configs {
		h.Writers = append(h.Writers, u)
	}
	sort.Sort(UIDList(h.Writers))
	nodes := make(map[keybase1.UID]Node)

	// create by the first user
	kbfsOps := configs[createAs].KBFSOps()
	ctx := context.Background()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Errorf("Couldn't get folder: %v", err)
	}
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
	nodes[createAs] = dir

	for u, config := range configs {
		if u == createAs {
			continue
		}

		kbfsOps := config.KBFSOps()
		kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch())
		rootNode, _, err :=
			kbfsOps.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
		if err != nil {
			t.Errorf("Couldn't get folder: %v", err)
		}
		dir := rootNode
		for _, d := range dirs {
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
	expectedActions map[BlockPointer][]crAction) {
	ctx := context.Background()

	// Step 1 -- check the chains and paths
	unmergedChains, mergedChains, unmergedPaths, mergedPaths,
		recreateOps, err := cr.buildChainsAndPaths(ctx)
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
			g.NewName != e.NewName {
			t.Fatalf("Unexpected op at index %d: %v vs %v", i, g, e)
		}
	}

	// Now for step 2 -- check the actions
	actionMap, err := cr.computeActions(ctx, unmergedChains, mergedChains,
		mergedPaths, recreateOps)
	if err != nil {
		t.Fatalf("Couldn't compute actions: %v", err)
	}
	if expectedActions == nil {
		return
	}

	if !reflect.DeepEqual(expectedActions, actionMap) {
		for k, v := range expectedActions {
			t.Logf("Expected: %v -> %v", k, v)
			t.Logf("Got: %v -> %v", k, actionMap[k])
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
	ops := kbfsOpsCast.getOps(fb)
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
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodes := testCRSharedFolderForUsers(t, uid1, configs, []string{"dir"})
	dir1 := nodes[uid1]
	dir2 := nodes[uid2]
	fb := dir1.GetFolderBranch()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 makes a file
	_, _, err = config1.KBFSOps().CreateFile(ctx, dir1, "file1", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	// user2 makes a file (causes a conflict, and goes unstaged)
	_, _, err = config2.KBFSOps().CreateFile(ctx, dir2, "file2", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)
	expectedUnmergedPath := cr2.fbo.nodeCache.PathFromNode(dir2)
	mergedPath := cr1.fbo.nodeCache.PathFromNode(dir1)
	mergedPaths[expectedUnmergedPath.tailPointer()] = mergedPath
	expectedActions := map[BlockPointer][]crAction{
		mergedPath.tailPointer(): {&copyUnmergedEntryAction{
			"file2", "file2", ""}},
	}
	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, nil, expectedActions)
}

// Same as TestCRMergedChainsSimple, but the two users make changes in
// different, unrelated subdirectories, forcing the resolver to use
// mostly original block pointers when constructing the merged path.
func TestCRMergedChainsDifferentDirectories(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	nodesB := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirB"})
	dirB1 := nodesB[uid1]
	dirB2 := nodesB[uid2]
	fb := dirA1.GetFolderBranch()

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 makes a file in dir A
	_, _, err = config1.KBFSOps().CreateFile(ctx, dirA1, "file1", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	// user2 makes a file in dir B
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirB2, "file2", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)
	expectedUnmergedPath := cr2.fbo.nodeCache.PathFromNode(dirB2)
	mergedPath := cr1.fbo.nodeCache.PathFromNode(dirB1)
	mergedPaths[expectedUnmergedPath.tailPointer()] = mergedPath
	expectedActions := map[BlockPointer][]crAction{
		mergedPath.tailPointer(): {&copyUnmergedEntryAction{
			"file2", "file2", ""}},
	}
	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, nil, expectedActions)
}

// Same as TestCRMergedChainsSimple, but u1 actually deletes some of
// the subdirectories used by u2, forcing the resolver to generate
// some recreateOps.
func TestCRMergedChainsDeletedDirectories(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	fb := dirA1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	nodesB := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirA", "dirB"})
	dirB1 := nodesB[uid1]
	nodesC := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirA", "dirB", "dirC"})
	dirC2 := nodesC[uid2]
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

	// user2 makes a file in dir C
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirC2, "file2", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
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

	coB := newCreateOp("dirB",
		cr1.fbo.nodeCache.PathFromNode(dirA1).tailPointer(), File)
	coC := newCreateOp("dirC", dirBPtr, File)

	dirAPtr1 := cr1.fbo.nodeCache.PathFromNode(dirA1).tailPointer()
	expectedActions := map[BlockPointer][]crAction{
		dirCPtr:  {&copyUnmergedEntryAction{"file2", "file2", ""}},
		dirBPtr:  {&copyUnmergedEntryAction{"dirC", "dirC", ""}},
		dirAPtr1: {&copyUnmergedEntryAction{"dirB", "dirB", ""}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, []*createOp{coB, coC}, expectedActions)
}

// Same as TestCRMergedChainsSimple, but u1 actually renames one of
// the subdirectories used by u2, forcing the resolver to follow the
// path across the rename.
func TestCRMergedChainsRenamedDirectory(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	fb := dirA1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	nodesB := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirA", "dirB"})
	dirB1 := nodesB[uid1]
	nodesC := testCRSharedFolderForUsers(t, uid1, configs,
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

	// user2 makes a file in dir C
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirC2, "file2", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
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

	expectedActions := map[BlockPointer][]crAction{
		mergedPath.tailPointer(): {&copyUnmergedEntryAction{
			"file2", "file2", ""}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{expectedUnmergedPath},
		mergedPaths, nil, expectedActions)
}

// A mix of the above TestCRMergedChains* tests, with various other
// types of operations thrown in the mix (like u2 deleting unrelated
// directories, etc).
func TestCRMergedChainsComplex(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Setup:
	// /dirA/dirB/dirC
	// /dirA/dirB/dirD/file5
	// /dirE/dirF
	// /dirG/dirH

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesA := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirA"})
	dirA1 := nodesA[uid1]
	dirA2 := nodesA[uid2]
	fb := dirA1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	nodesB := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirA", "dirB"})
	dirB1 := nodesB[uid1]
	dirB2 := nodesB[uid2]
	nodesC := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirA", "dirB", "dirC"})
	dirC2 := nodesC[uid2]
	nodesD := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirA", "dirB", "dirD"})
	dirD1 := nodesD[uid1]
	dirD2 := nodesD[uid2]
	nodesE := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirE"})
	dirE1 := nodesE[uid1]
	nodesF := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirE", "dirF"})
	dirF2 := nodesF[uid2]
	dirFPtr := cr2.fbo.nodeCache.PathFromNode(dirF2).tailPointer()
	nodesG := testCRSharedFolderForUsers(t, uid1, configs, []string{"dirG"})
	dirG1 := nodesG[uid1]
	nodesH := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"dirG", "dirH"})
	dirH1 := nodesH[uid1]
	dirH2 := nodesH[uid2]
	dirHPtr := cr1.fbo.nodeCache.PathFromNode(dirH1).tailPointer()

	_, _, err = config1.KBFSOps().CreateFile(ctx, dirD1, "file5", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	config2.KBFSOps().SyncFromServer(ctx, fb)

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
	_, _, err = config1.KBFSOps().CreateFile(ctx, dirA1, "file1", false)
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

	// user2
	dirJ2, _, err := config2.KBFSOps().CreateDir(ctx, dirA2, "dirJ")
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirJ2, "file2", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirF2, "file3", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirC2, "file4", false)
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

	coF := newCreateOp("dirF",
		cr1.fbo.nodeCache.PathFromNode(dirE1).tailPointer(), File)

	mergedPathE := cr1.fbo.nodeCache.PathFromNode(dirE1)
	expectedActions := map[BlockPointer][]crAction{
		mergedPathA.tailPointer(): {&copyUnmergedEntryAction{
			"dirJ", "dirJ", ""}},
		mergedPathE.tailPointer(): {&copyUnmergedEntryAction{
			"dirF", "dirF", ""}},
		mergedPathF.tailPointer(): {&copyUnmergedEntryAction{
			"file3", "file3", ""}},
		mergedPathH.tailPointer(): {&copyUnmergedEntryAction{
			"file4", "file4", ""}},
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
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesRoot := testCRSharedFolderForUsers(t, uid1, configs, []string{"root"})
	dirRoot1 := nodesRoot[uid1]
	dirRoot2 := nodesRoot[uid2]
	fb := dirRoot1.GetFolderBranch()

	nodesA := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"root", "dirA"})
	dirA1 := nodesA[uid1]

	nodesB := testCRSharedFolderForUsers(t, uid1, configs,
		[]string{"root", "dirB"})
	dirB1 := nodesB[uid1]
	dirB2 := nodesB[uid2]

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	dirRootPtr := cr2.fbo.nodeCache.PathFromNode(dirRoot2).tailPointer()

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

	// user2 moves dirA into dirB
	err = config2.KBFSOps().Rename(ctx, dirRoot2, "dirA", dirB2, "dirA")
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
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

	ro := newRmOp("dirA", dirRootPtr)
	ro.Dir.Ref = unmergedPathRoot.tailPointer()
	ro.dropThis = true
	ro.setWriterName("u2")
	ro.setFinalPath(unmergedPathRoot)
	expectedActions := map[BlockPointer][]crAction{
		mergedPathRoot.tailPointer(): {&dropUnmergedAction{ro}},
		mergedPathB.tailPointer(): {&copyUnmergedEntryAction{
			"dirA", "dirA", "./../../"}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{unmergedPathRoot, unmergedPathB},
		mergedPaths, nil, expectedActions)
}

// Tests that conflict resolution detects and renames conflicts.
func TestCRMergedChainsConflictSimple(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(ctx)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	config2.SetClock(&TestClock{now})

	configs := make(map[keybase1.UID]Config)
	configs[uid1] = config1
	configs[uid2] = config2
	nodesRoot := testCRSharedFolderForUsers(t, uid1, configs, []string{"root"})
	dirRoot1 := nodesRoot[uid1]
	dirRoot2 := nodesRoot[uid2]
	fb := dirRoot1.GetFolderBranch()

	cr1 := testCRGetCROrBust(t, config1, fb)
	cr2 := testCRGetCROrBust(t, config2, fb)
	cr2.Shutdown()
	cr2.inputChan = make(chan conflictInput)

	// pause user 2
	_, err = DisableUpdatesForTesting(config2, fb)
	if err != nil {
		t.Fatalf("Can't disable updates for user 2: %v", err)
	}

	// user1 creates file1
	_, _, err = config1.KBFSOps().CreateFile(ctx, dirRoot1, "file1", false)
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
	}

	// user2 also create file1
	_, _, err = config2.KBFSOps().CreateFile(ctx, dirRoot2, "file1", false)
	if err != nil {
		t.Fatalf("Couldn't make dir: %v", err)
	}

	// Now step through conflict resolution manually for user 2
	mergedPaths := make(map[BlockPointer]path)

	// root
	unmergedPathRoot := cr2.fbo.nodeCache.PathFromNode(dirRoot2)
	mergedPathRoot := cr1.fbo.nodeCache.PathFromNode(dirRoot1)
	mergedPaths[unmergedPathRoot.tailPointer()] = mergedPathRoot

	nowString := now.Format(time.UnixDate)
	expectedActions := map[BlockPointer][]crAction{
		mergedPathRoot.tailPointer(): {&renameUnmergedAction{
			"file1", "file1.conflict.u2." + nowString}},
	}

	testCRCheckPathsAndActions(t, cr2, []path{unmergedPathRoot},
		mergedPaths, nil, expectedActions)
}
