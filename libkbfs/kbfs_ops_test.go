package libkbfs

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"code.google.com/p/gomock/gomock"
	libkb "github.com/keybase/client/go/libkb"
)

type CheckBlockOps struct {
	delegate BlockOps
	t        *testing.T
}

func (cbo *CheckBlockOps) Get(id BlockId, context BlockContext, decryptKey Key, block Block) error {
	if err := cbo.delegate.Get(id, context, decryptKey, block); err != nil {
		return err
	}
	if fBlock, ok := block.(*FileBlock); ok && !fBlock.IsInd && context.GetQuotaSize() < uint32(len(fBlock.Contents)) {
		cbo.t.Errorf("expected at most %d bytes, got %d bytes", context.GetQuotaSize(), len(fBlock.Contents))
	}
	return nil
}

func (cbo *CheckBlockOps) Ready(block Block, encryptKey Key) (BlockId, []byte, error) {
	id, buf, err := cbo.delegate.Ready(block, encryptKey)
	if err != nil {
		return id, buf, err
	}
	return id, buf, err
}

func (cbo *CheckBlockOps) Put(id BlockId, context BlockContext, buf []byte) error {
	if err := cbo.delegate.Put(id, context, buf); err != nil {
		return err
	}
	if context.GetQuotaSize() != uint32(len(buf)) {
		cbo.t.Errorf("expected %d bytes, got %d bytes", context.GetQuotaSize(), len(buf))
	}
	return nil
}

func (cbo *CheckBlockOps) Delete(id BlockId, context BlockContext) error {
	return cbo.delegate.Delete(id, context)
}

func kbfsOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock) {
	mockCtrl = gomock.NewController(t)
	config = NewConfigMock(mockCtrl)
	blockops := &CheckBlockOps{config.mockBops, t}
	config.SetBlockOps(blockops)
	kbfsops := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsops)
	return
}

func TestKBFSOpsGetFavDirsSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch favorites
	id1, _, _ := newDir(config, 1, true, false)
	id2, _, _ := newDir(config, 2, true, false)
	ids := []DirId{id1, id2}

	config.mockMdops.EXPECT().GetFavorites().Return(ids, nil)

	if ids2, err := config.KBFSOps().GetFavDirs(); err != nil {
		t.Errorf("Got error on favorites: %v", err)
	} else if len(ids2) != len(ids) {
		t.Error("Got bad ids back: %v", ids2)
	}
}

func TestKBFSOpsGetFavDirsFail(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	err := errors.New("Fake fail")
	// expect one call to favorites, and fail it
	config.mockMdops.EXPECT().GetFavorites().Return(nil, err)

	if _, err2 := config.KBFSOps().GetFavDirs(); err2 != err {
		t.Errorf("Got bad error on favorites: %v", err2)
	}
}

func makeId(config *ConfigMock) (libkb.UID, DirId, *DirHandle) {
	userId := libkb.UID{15}
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = []libkb.UID{userId}
	expectUserCalls(h, config)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().Return(userId, nil)
	return userId, id, h
}

func makeIdAndRMD(config *ConfigMock) (
	libkb.UID, DirId, *RootMetadata) {
	userId, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeys{})
	config.mockMdcache.EXPECT().Get(id).AnyTimes().Return(rmd, nil)
	return userId, id, rmd
}

func TestKBFSOpsGetRootMDCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	_, id, rmd := makeIdAndRMD(config)
	rmd.data.Dir.IsDir = true

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmd {
		t.Error("Got bad MD back: %v", rmd2)
	}
}

func TestKBFSOpsGetRootMDCacheSuccess2ndTry(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmdGood := NewRootMetadata(h, id)
	rmdGood.data.Dir.IsDir = true

	// send back new, uncached MD on first try, but succeed after
	// getting the lock
	err := &NoSuchMDError{id.String()}
	config.mockMdcache.EXPECT().Get(id).Return(nil, err)
	config.mockMdops.EXPECT().Get(id).Return(rmd, nil)
	config.mockMdcache.EXPECT().Put(id, rmd).Return(nil)
	config.mockMdcache.EXPECT().Get(id).Return(rmdGood, nil)

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmdGood {
		t.Error("Got bad MD back: %v", rmd2)
	}
}

func expectKeyDecode(
	config *ConfigMock, packedData []byte, key Key, err error) {
	config.mockCodec.EXPECT().Decode(packedData, gomock.Any()).
		Do(func(buf []byte, obj interface{}) {
		v := obj.(*Key)
		*v = key
	}).Return(err)
}

func expectBlock(config *ConfigMock, id BlockId, block Block,
	err error) {
	config.mockBops.EXPECT().Get(id, gomock.Any(), NullKey, gomock.Any()).
		Do(func(id BlockId, context BlockContext, k Key, getBlock Block) {
		switch v := getBlock.(type) {
		case *FileBlock:
			*v = *block.(*FileBlock)

		case *DirBlock:
			*v = *block.(*DirBlock)
		}
	}).Return(err)
}

func createNewMD(config *ConfigMock, rmd *RootMetadata, id DirId) {
	err := &NoSuchMDError{id.String()}
	config.mockMdcache.EXPECT().Get(id).Return(nil, err)
	config.mockMdops.EXPECT().Get(id).Return(rmd, nil)
	config.mockMdcache.EXPECT().Put(id, rmd).Return(nil)
	config.mockMdcache.EXPECT().Get(id).Return(rmd, nil)
}

func expectGetSecretKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKeyman.EXPECT().GetSecretKey(
		gomock.Any(), rmd).Return(NullKey, nil)
}

func expectGetSecretBlockKey(
	config *ConfigMock, id BlockId, rmd *RootMetadata) {
	config.mockKeyman.EXPECT().GetSecretBlockKey(
		gomock.Any(), id, rmd).Return(NullKey, nil)
}

func fillInNewMD(config *ConfigMock, rmd *RootMetadata) (
	rootId BlockId, block []byte) {
	config.mockKeyman.EXPECT().Rekey(rmd).Return(nil)
	expectGetSecretKey(config, rmd)
	rootId = BlockId{42}
	block = []byte{1, 2, 3, 4}
	config.mockBops.EXPECT().Ready(gomock.Any(), NullKey).Return(
		rootId, block, nil)
	return
}

func TestKBFSOpsGetRootMDCreateNewSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)

	// create a new MD
	createNewMD(config, rmd, id)
	// now KBFS will fill it in:
	rootId, block := fillInNewMD(config, rmd)
	// now cache and put everything
	config.mockBops.EXPECT().Put(rootId, gomock.Any(), block).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), false).Return(nil)
	config.mockMdops.EXPECT().Put(id, rmd).Return(nil)
	config.mockMdcache.EXPECT().Put(id, rmd).Return(nil)

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmd {
		t.Error("Got bad MD back: %v", rmd2)
	} else if rmd2.data.Dir.Id != rootId {
		t.Error("Got bad MD rootId back: %v", rmd2.data.Dir.Id)
	} else if !rmd2.data.Dir.IsDir {
		t.Error("Got bad MD non-dir rootId back")
	}
}

func TestKBFSOpsGetRootMDCreateNewFailNonWriter(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId := libkb.UID{15}
	ownerId := libkb.UID{20}
	id, h, _ := newDir(config, 1, true, false)
	h.Readers = []libkb.UID{userId}
	h.Writers = []libkb.UID{ownerId}

	rmd := NewRootMetadata(h, id)

	// create a new MD
	expectUserCalls(h, config)
	// in reality, createNewMD should fail early because the MD server
	// will refuse to create the new MD for this user.  But for this test,
	// we won't bother
	createNewMD(config, rmd, id)
	// try to get the MD for writing, but fail (no puts should happen)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().Return(userId, nil)
	expectedErr := &WriteAccessError{
		fmt.Sprintf("user_%s", userId), h.ToString(config)}

	if _, err := config.KBFSOps().GetRootMD(id); err == nil {
		t.Errorf("Got no expected error on root MD")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetRootMDForHandleExisting(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.data.Dir.IsDir = true

	config.mockMdops.EXPECT().GetAtHandle(h).Return(rmd, nil)

	if rmd2, err := config.KBFSOps().GetRootMDForHandle(h); err != nil {
		t.Errorf("Got error on root MD for handle: %v", err)
	} else if rmd2 != rmd {
		t.Error("Got bad MD back: %v", rmd2)
	} else if !rmd2.data.Dir.IsDir {
		t.Error("Got bad MD non-dir rootId back")
	} else if rmd2.Id != id {
		t.Error("Got bad dir id back: %v", rmd2.Id)
	}
}

func TestKBFSOpsGetBaseDirCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	dirBlock := NewDirBlock()
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []*PathNode{node}}

	config.mockBcache.EXPECT().Get(rootId).Return(dirBlock, nil)

	if block, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	} else if block != dirBlock {
		t.Errorf("Got bad dirblock back: %v", block)
	}
}

func TestKBFSOpsGetBaseDirUncachedSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	dirBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []*PathNode{node}}

	// cache miss means fetching metadata and getting read key
	err := &NoSuchBlockError{rootId}
	config.mockBcache.EXPECT().Get(rootId).Return(nil, err)

	expectGetSecretBlockKey(config, rootId, rmd)
	expectBlock(config, rootId, dirBlock, nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), false).Return(nil)

	if _, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	}
}

func TestKBFSOpsGetBaseDirUncachedFailNonReader(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId := libkb.UID{15}
	ownerId := libkb.UID{20}
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = []libkb.UID{ownerId}
	expectUserCalls(h, config)

	rmd := NewRootMetadata(h, id)
	rmdGood := NewRootMetadata(h, id)
	rmdGood.data.Dir.IsDir = true

	rootId := BlockId{42}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	p := Path{id, []*PathNode{node}}

	// won't even try getting the block if the user isn't a reader
	config.mockMdcache.EXPECT().Get(id).Return(rmd, nil)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().Return(userId, nil)
	expectUserCall(userId, config)
	expectedErr := &ReadAccessError{
		fmt.Sprintf("user_%s", userId), h.ToString(config)}

	if _, err := config.KBFSOps().GetDir(p); err == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetBaseDirUncachedFailMissingBlock(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	dirBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []*PathNode{node}}

	// cache miss means fetching metadata and getting read key, then
	// fail block fetch
	err := &NoSuchBlockError{rootId}
	config.mockBcache.EXPECT().Get(rootId).Return(nil, err)
	expectGetSecretBlockKey(config, rootId, rmd)
	expectBlock(config, rootId, dirBlock, err)

	if _, err2 := config.KBFSOps().GetDir(p); err2 == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err2.Error() != err.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetBaseDirUncachedFailNewVersion(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId := libkb.UID{15}
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = append(h.Writers, userId)
	expectUserCalls(h, config)

	rmd := NewRootMetadata(h, id)
	rmd.data.Dir.IsDir = true
	// Set the version in the future.
	rmd.data.Dir.Ver = 1

	rootId := BlockId{42}
	node := &PathNode{BlockPointer{rootId, 0, 1, userId, 0}, ""}
	p := Path{id, []*PathNode{node}}

	// we won't even need to check the cache before failing
	expectedErr := &NewVersionError{p.ToString(config), 1}

	if _, err := config.KBFSOps().GetDir(p); err == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetNestedDirCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	config.mockMdcache.EXPECT().Get(id).AnyTimes().Return(rmd, nil)

	rootId := BlockId{42}
	aId := BlockId{43}
	bId := BlockId{44}
	dirBlock := NewDirBlock()
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	bNode := &PathNode{BlockPointer{bId, 0, 0, u, 0}, "b"}
	p := Path{id, []*PathNode{node, aNode, bNode}}

	config.mockBcache.EXPECT().Get(bId).Return(dirBlock, nil)

	if block, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	} else if block != dirBlock {
		t.Errorf("Got bad dirblock back: %v", block)
	}
}

func expectSyncBlock(
	config *ConfigMock, lastCall *gomock.Call, userId libkb.UID, id DirId,
	name string, path Path, rmd *RootMetadata, newEntry bool, skipSync int) (
	Path, *gomock.Call) {
	expectGetSecretKey(config, rmd)

	// construct new path
	newPath := Path{
		TopDir: id,
		Path:   make([]*PathNode, 0, len(path.Path)+1),
	}
	for _, node := range path.Path {
		newPath.Path = append(newPath.Path, &PathNode{Name: node.Name})
	}
	if newEntry {
		// one for the new entry
		newPath.Path = append(newPath.Path, &PathNode{Name: name})
	}

	lastId := byte(path.TailPointer().Id[0] * 2)
	for i := len(newPath.Path) - 1; i >= skipSync; i-- {
		node := newPath.Path[i]
		newId := BlockId{lastId}
		newBuf := []byte{lastId}
		lastId++
		config.mockCrypto.EXPECT().GenRandomSecretKey().Return(NullKey)
		config.mockCrypto.EXPECT().XOR(NullKey, NullKey).Return(NullKey, nil)
		call := config.mockBops.EXPECT().Ready(gomock.Any(), NullKey).Return(
			newId, newBuf, nil)
		if lastCall != nil {
			call = call.After(lastCall)
		}
		lastCall = call
		node.Id = newId
		config.mockBops.EXPECT().Put(newId, gomock.Any(), newBuf).Return(nil)
		config.mockBcache.EXPECT().Put(newId, gomock.Any(), false).Return(nil)
		config.mockKops.EXPECT().PutBlockKey(newId, NullKey).Return(nil)
		config.mockKcache.EXPECT().PutBlockKey(newId, NullKey).Return(nil)
	}
	if skipSync == 0 {
		// sign the MD and put it
		config.mockMdops.EXPECT().Put(id, rmd).Return(nil)
		config.mockMdcache.EXPECT().Put(id, rmd).Return(nil)
	}
	return newPath, lastCall
}

func checkNewPath(t *testing.T, config Config, newPath Path, expectedPath Path,
	rmd *RootMetadata, blocks []*DirBlock, isDir bool, isEx bool,
	newName string, rename bool) {
	// make sure the new path looks right
	if len(newPath.Path) != len(expectedPath.Path) {
		t.Errorf("Unexpected new path length: %d", len(newPath.Path))
		return
	}
	if newPath.TopDir != expectedPath.TopDir {
		t.Errorf("Unexpected topdir in new path: %s",
			newPath.TopDir)
	}
	// check all names and IDs
	for i, node := range newPath.Path {
		eNode := expectedPath.Path[i]
		if node.Id != eNode.Id {
			t.Errorf("Wrong id on new path[%d]: %v vs. %v", i, node, eNode)
		}
		if node.Name != eNode.Name {
			t.Errorf("Wrong name on new path[%d]: %v vs. %v", i, node, eNode)
		}
	}

	// all the entries should point correctly and have the right times set
	currDe := &rmd.data.Dir
	for i, dblock := range blocks {
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

		if i < len(expectedPath.Path) {
			eId := expectedPath.Path[i].Id
			if currDe.Id != eId {
				t.Errorf("Entry does not point to %v, but to %v",
					eId, currDe.Id)
			}
		}

		if i < len(blocks)-1 {
			var nextName string
			if i+1 >= len(expectedPath.Path) {
				// new symlinks don't have an entry in the path
				nextName = newName
			} else {
				nextName = expectedPath.Path[i+1].Name
			}
			nextDe, ok := dblock.Children[nextName]
			if !ok {
				t.Errorf("No entry (%d) for %s", i, nextName)
			}
			currDe = nextDe
		} else if newName != "" {
			if currDe.IsDir != isDir {
				t.Errorf("New entry has wrong type (%d), isDir=%s",
					i, currDe.IsDir)
			}
			if currDe.IsExec != isEx {
				t.Errorf("New entry has wrong exec (%d), isEx=%s",
					i, currDe.IsExec)
			}
		}
	}
}

func expectGetBlock(config *ConfigMock, id BlockId, block Block) {
	config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(false)
}

func testCreateEntrySuccess(t *testing.T, isDir bool, isEx bool, isLink bool) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId},
		IsDir:        true,
	}
	aBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// creating "a/b"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ :=
		expectSyncBlock(config, nil, userId, id, "b", p, rmd, !isLink, 0)

	var newP Path
	var err error
	if isDir {
		newP, _, err = config.KBFSOps().CreateDir(p, "b")
	} else if isLink {
		newP, _, err = config.KBFSOps().CreateLink(p, "b", "c")
	} else {
		newP, _, err = config.KBFSOps().CreateFile(p, "b", isEx)
	}
	if err != nil {
		t.Errorf("Got error on create: %v", err)
	}
	// Append a fake block representing the new entry.  It won't be examined
	blocks := []*DirBlock{rootBlock, aBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP, expectedPath, rmd, blocks,
		isDir, isEx, "b", false)
	if isLink {
		de := aBlock.Children["b"]
		if !de.IsSym {
			t.Errorf("Entry is not a symbolic link")
		}
		if de.SymPath != "c" {
			t.Errorf("Symbolic path points to the wrong thing: %s", de.SymPath)
		}
	}
}

func TestKBFSOpsCreateDirSuccess(t *testing.T) {
	testCreateEntrySuccess(t, true, false, false)
}

func TestKBFSOpsCreateFileSuccess(t *testing.T) {
	testCreateEntrySuccess(t, false, false, false)
}

func TestKBFSOpsCreateExecFileSuccess(t *testing.T) {
	testCreateEntrySuccess(t, false, true, false)
}

func TestKBFSOpsCreateLinkSuccess(t *testing.T) {
	testCreateEntrySuccess(t, false, false, true)
}

func testCreateEntryFailDupName(t *testing.T, isDir bool) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId},
		IsDir:        true,
	}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []*PathNode{node}}

	// creating "a", which already exists in the root block
	expectGetBlock(config, rootId, rootBlock)
	expectedErr := &NameExistsError{"a"}

	var err error
	// dir and link have different checks for dup name
	if isDir {
		_, _, err = config.KBFSOps().CreateDir(p, "a")
	} else {
		_, _, err = config.KBFSOps().CreateLink(p, "a", "b")
	}
	if err == nil {
		t.Errorf("Got no expected error on create")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on create: %v", err)
	}
}

func TestCreateDirFailDupName(t *testing.T) {
	testCreateEntryFailDupName(t, true)
}

func TestCreateLinkFailDupName(t *testing.T) {
	testCreateEntryFailDupName(t, false)
}

func testRemoveEntrySuccess(t *testing.T, isDir bool) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: isDir}
	bBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	bNode := &PathNode{BlockPointer{bId, 0, 0, userId, 0}, "b"}
	p := Path{id, []*PathNode{node, aNode, bNode}}

	// deleting "a/b"
	expectGetBlock(config, bId, bBlock)
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ := expectSyncBlock(config, nil, userId, id, "",
		*p.ParentPath(), rmd, false, 0)

	var newP Path
	var err error
	if isDir {
		newP, err = config.KBFSOps().RemoveDir(p)
	} else {
		newP, err = config.KBFSOps().RemoveEntry(p)
	}
	if err != nil {
		t.Errorf("Got error on removal: %v", err)
	}
	blocks := []*DirBlock{rootBlock, aBlock}
	checkNewPath(t, config, newP, expectedPath, rmd, blocks,
		isDir, false, "", false)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after removal")
	}
}

func TestKBFSOpsRemoveDirSuccess(t *testing.T) {
	testRemoveEntrySuccess(t, true)
}

func TestKBFSOpsRemoveFileSuccess(t *testing.T) {
	testRemoveEntrySuccess(t, false)
}

func TestRemoveDirFailNonEmpty(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	bBlock := NewDirBlock().(*DirBlock)
	bBlock.Children["c"] = &DirEntry{
		BlockPointer: BlockPointer{Id: bId}, IsDir: false}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	bNode := &PathNode{BlockPointer{bId, 0, 0, u, 0}, "b"}
	p := Path{id, []*PathNode{node, aNode, bNode}}

	expectGetBlock(config, bId, bBlock)
	expectedErr := &DirNotEmptyError{p.TailName()}

	if _, err := config.KBFSOps().RemoveDir(p); err == nil {
		t.Errorf("Got no expected error on removal")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on removal: %v", err)
	}
}

func TestRemoveDirFailNoSuchName(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	bBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	bNode := &PathNode{BlockPointer{bId, 0, 0, u, 0}, "b"}
	p := Path{id, []*PathNode{node, aNode, bNode}}

	expectGetBlock(config, bId, bBlock)
	expectGetBlock(config, aId, aBlock)
	expectedErr := &NoSuchNameError{p.TailName()}

	if _, err := config.KBFSOps().RemoveDir(p); err == nil {
		t.Errorf("Got no expected error on removal")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on removal: %v", err)
	}
}

func TestRenameInDirSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = &DirEntry{BlockPointer: BlockPointer{Id: bId}}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// renaming "a/b" to "a/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ :=
		expectSyncBlock(config, nil, userId, id, "", p, rmd, false, 0)

	var newP1 Path
	var newP2 Path
	var err error
	newP1, newP2, err = config.KBFSOps().Rename(p, "b", p, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	// append a fake block at the end for the renamed file
	blocks := []*DirBlock{rootBlock, aBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP1, expectedPath, rmd, blocks,
		false, false, "c", true)
	checkNewPath(t, config, newP2, expectedPath, rmd, blocks,
		false, false, "c", true)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	}
}

func TestRenameAcrossDirsSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = &DirEntry{BlockPointer: BlockPointer{Id: bId}}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p1 := Path{id, []*PathNode{node, aNode}}

	dId := BlockId{40}
	rootBlock.Children["d"] = &DirEntry{
		BlockPointer: BlockPointer{Id: dId}, IsDir: true}
	dBlock := NewDirBlock().(*DirBlock)
	dNode := &PathNode{BlockPointer{dId, 0, 0, userId, 0}, "d"}
	p2 := Path{id, []*PathNode{node, dNode}}

	// renaming "a/b" to "d/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, dId, dBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath1, lastCall :=
		expectSyncBlock(config, nil, userId, id, "", p1, rmd, false, 1)
	expectedPath2, _ :=
		expectSyncBlock(config, lastCall, userId, id, "", p2, rmd, false, 0)
	// fix up old expected path's common ancestor
	expectedPath1.Path[0].Id = expectedPath2.Path[0].Id

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	blocks := []*DirBlock{rootBlock, aBlock}
	checkNewPath(t, config, newP1, expectedPath1, rmd, blocks,
		false, false, "", true)
	// append a fake block at the end for the renamed file
	blocks = []*DirBlock{rootBlock, dBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP2, expectedPath2, rmd, blocks,
		false, false, "c", true)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	}
}

func TestRenameAcrossPrefixSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	dId := BlockId{40}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = &DirEntry{BlockPointer: BlockPointer{Id: bId}}
	aBlock.Children["d"] = &DirEntry{BlockPointer: BlockPointer{Id: dId}}
	dBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	dNode := &PathNode{BlockPointer{dId, 0, 0, userId, 0}, "d"}
	p1 := Path{id, []*PathNode{node, aNode}}
	p2 := Path{id, []*PathNode{node, aNode, dNode}}

	// renaming "a/b" to "a/d/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, dId, dBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath2, _ :=
		expectSyncBlock(config, nil, userId, id, "", p2, rmd, false, 0)

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	if newP1.Path[0].Id != newP2.Path[0].Id {
		t.Errorf("New old path not a prefix of new new path")
	}
	if newP1.Path[1].Id != newP2.Path[1].Id {
		t.Errorf("New old path not a prefix of new new path")
	}
	if rootBlock.Children["a"].Mtime == 0 {
		t.Errorf("a's mtime didn't change")
	}
	if rootBlock.Children["a"].Ctime == 0 {
		t.Errorf("a's ctime didn't change")
	}
	// now change the times back so checkNewPath below works without hacking
	rootBlock.Children["a"].Mtime = 0
	rootBlock.Children["a"].Ctime = 0

	// append a fake block at the end for the renamed file
	blocks := []*DirBlock{rootBlock, aBlock, dBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP2, expectedPath2, rmd, blocks,
		false, false, "c", true)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	}
}

func TestRenameAcrossOtherPrefixSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	dId := BlockId{40}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsDir: true}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["d"] = &DirEntry{BlockPointer: BlockPointer{Id: dId}}
	dBlock := NewDirBlock().(*DirBlock)
	dBlock.Children["b"] = &DirEntry{BlockPointer: BlockPointer{Id: bId}}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	dNode := &PathNode{BlockPointer{dId, 0, 0, userId, 0}, "d"}
	p1 := Path{id, []*PathNode{node, aNode, dNode}}
	p2 := Path{id, []*PathNode{node, aNode}}

	// renaming "a/d/b" to "a/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, dId, dBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath1, lastCall :=
		expectSyncBlock(config, nil, userId, id, "", p1, rmd, false, 2)
	expectedPath2, _ :=
		expectSyncBlock(config, lastCall, userId, id, "", p2, rmd, false, 0)
	// the new path is a prefix of the old path
	expectedPath1.Path[0].Id = expectedPath2.Path[0].Id
	expectedPath1.Path[1].Id = expectedPath2.Path[1].Id

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on removal: %v", err)
	}
	if newP2.Path[0].Id != newP1.Path[0].Id {
		t.Errorf("New old path not a prefix of new new path")
	}
	if newP2.Path[1].Id != newP1.Path[1].Id {
		t.Errorf("New old path not a prefix of new new path")
	}
	if aBlock.Children["d"].Mtime == 0 {
		t.Errorf("d's mtime didn't change")
	}
	if aBlock.Children["d"].Ctime == 0 {
		t.Errorf("d's ctime didn't change")
	}

	blocks := []*DirBlock{rootBlock, aBlock, dBlock}
	checkNewPath(t, config, newP1, expectedPath1, rmd, blocks,
		false, false, "c", true)
	if _, ok := dBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	}
}

func TestRenameFailAcrossTopDirs(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId1 := libkb.UID{15}
	id1, h1, _ := newDir(config, 1, true, false)
	h1.Writers = append(h1.Writers, userId1)
	expectUserCalls(h1, config)

	userId2 := libkb.UID{20}
	id2, h2, _ := newDir(config, 2, true, false)
	h2.Writers = append(h2.Writers, userId2)
	expectUserCalls(h2, config)

	rootId1 := BlockId{41}
	aId1 := BlockId{42}
	node1 := &PathNode{BlockPointer{rootId1, 0, 0, userId1, 0}, ""}
	aNode1 := &PathNode{BlockPointer{aId1, 0, 0, userId1, 0}, "a"}
	p1 := Path{id1, []*PathNode{node1, aNode1}}

	rootId2 := BlockId{38}
	aId2 := BlockId{39}
	node2 := &PathNode{BlockPointer{rootId2, 0, 0, userId2, 0}, ""}
	aNode2 := &PathNode{BlockPointer{aId2, 0, 0, userId2, 0}, "a"}
	p2 := Path{id2, []*PathNode{node2, aNode2}}

	expectedErr := &RenameAcrossDirsError{}

	if _, _, err := config.KBFSOps().Rename(p1, "b", p2, "c"); err == nil {
		t.Errorf("Got no expected error on rename")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on rename: %v", err)
	}
}

func bytesEqual(actual []byte, expected []byte) bool {
	// TODO: this must be built in somewhere
	if len(actual) != len(expected) {
		return false
	}
	for i, b := range actual {
		if expected[i] != b {
			return false
		}
	}
	return true
}

func TestKBFSOpsCacheReadFullSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, fileId, fileBlock)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if n2, err := config.KBFSOps().Read(p, dest, 0); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytesEqual(dest, fileBlock.Contents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadPartialSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, fileId, fileBlock)

	dest := make([]byte, 4, 4)
	if n, err := config.KBFSOps().Read(p, dest, 2); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n != 4 {
		t.Errorf("Read the wrong number of bytes: %d", n)
	} else if !bytesEqual(dest, fileBlock.Contents[2:6]) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadFullMultiBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, u, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, u, 6}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, u, 7}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, u, 8}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "a"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, fileId, fileBlock)
	expectGetBlock(config, id1, block1)
	expectGetBlock(config, id2, block2)
	expectGetBlock(config, id3, block3)
	expectGetBlock(config, id4, block4)

	n := 20
	dest := make([]byte, n, n)
	fullContents := append(block1.Contents, block2.Contents...)
	fullContents = append(fullContents, block3.Contents...)
	fullContents = append(fullContents, block4.Contents...)
	if n2, err := config.KBFSOps().Read(p, dest, 0); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytesEqual(dest, fullContents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadPartialMultiBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, u, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, u, 6}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, u, 7}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, u, 8}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "a"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, fileId, fileBlock)
	expectGetBlock(config, id1, block1)
	expectGetBlock(config, id2, block2)
	expectGetBlock(config, id3, block3)

	n := 10
	dest := make([]byte, n, n)
	contents := append(block1.Contents[3:], block2.Contents...)
	contents = append(contents, block3.Contents[:3]...)
	if n2, err := config.KBFSOps().Read(p, dest, 3); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytesEqual(dest, contents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsCacheReadFailPastEnd(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, fileId, fileBlock)

	dest := make([]byte, 4, 4)
	if n, err := config.KBFSOps().Read(p, dest, 10); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n != 0 {
		t.Errorf("Read the wrong number of bytes: %d", n)
	}
}

func TestKBFSOpsServerReadFullSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 15}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	// cache miss means fetching metadata and getting read key
	err := &NoSuchBlockError{rootId}
	config.mockBcache.EXPECT().Get(fileId).Return(nil, err)
	expectGetSecretBlockKey(config, fileId, rmd)
	expectBlock(config, fileId, fileBlock, nil)
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), false).Return(nil)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if n2, err := config.KBFSOps().Read(p, dest, 0); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n2 != int64(n) {
		t.Errorf("Read the wrong number of bytes: %d", n2)
	} else if !bytesEqual(dest, fileBlock.Contents) {
		t.Errorf("Read bad contents: %v", dest)
	}
}

func TestKBFSOpsServerReadFailNoSuchBlock(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	// cache miss means fetching metadata and getting read key
	err := &NoSuchBlockError{rootId}
	config.mockBcache.EXPECT().Get(fileId).Return(nil, err)
	expectGetSecretBlockKey(config, fileId, rmd)
	expectBlock(config, fileId, fileBlock, err)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if _, err2 := config.KBFSOps().Read(p, dest, 0); err == nil {
		t.Errorf("Got no expected error")
	} else if err2 != err {
		t.Errorf("Got unexpected error: %v", err2)
	}
}

func TestKBFSOpsWriteNewBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = data
	}).Return(int64(len(data)))
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	var newRootBlock *DirBlock
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newRootBlock = block.(*DirBlock)
	}).Return(nil)

	if err := config.KBFSOps().Write(p, data, 0); err != nil {
		t.Errorf("Got error on write: %v", err)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	} else if newRootBlock.Children["f"].Writer != userId {
		t.Errorf("Wrong last writer: %v", newRootBlock.Children["f"].Writer)
	} else if newRootBlock.Children["f"].Size != uint64(len(data)) {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}
}

func TestKBFSOpsWriteExtendSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}
	data := []byte{6, 7, 8, 9, 10}
	expectedFullData := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = expectedFullData
	}).Return(int64(len(data)))
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).Return(nil)

	if err := config.KBFSOps().Write(p, data, 5); err != nil {
		t.Errorf("Got error on write: %v", err)
	} else if !bytesEqual(expectedFullData, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsWritePastEndSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}
	data := []byte{6, 7, 8, 9, 10}
	expectedFullData := []byte{1, 2, 3, 4, 5, 0, 0, 6, 7, 8, 9, 10}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(7)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = expectedFullData
	}).Return(int64(len(data)))
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).Return(nil)

	if err := config.KBFSOps().Write(p, data, 7); err != nil {
		t.Errorf("Got error on write: %v", err)
	} else if !bytesEqual(expectedFullData, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsWriteCauseSplit(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}
	newData := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	expectedFullData := append([]byte{0}, newData...)

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	// only copy the first half first
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), newData, int64(1)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append([]byte{0}, data[0:5]...)
	}).Return(int64(5))

	var pblock *FileBlock
	var id1 BlockId
	var block1 *FileBlock
	var id2 BlockId
	var block2 *FileBlock
	var newRootBlock *DirBlock
	// new indirect parent block (will be put, once on creation, once on update)
	c1 := config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		pblock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		After(c1).AnyTimes().Return(nil)
	// new right block
	c2 := config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		id2 = id
		// copy the block so it will have the same pointer, and we can safely
		// return it for the Get() later
		block2 = block.(*FileBlock)
		config.mockBcache.EXPECT().Get(id2).Return(block2, nil)
		config.mockBcache.EXPECT().IsDirty(id2).AnyTimes().Return(true)
	}).After(c1).Return(nil)
	// updated copy of original block
	c3 := config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		id1 = id
		block1 = block.(*FileBlock)
	}).After(c2).Return(nil)
	// next we'll get the right block again
	// then the second half
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), newData[5:10], int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = data
	}).Return(int64(5))
	// updated right block
	config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		After(c3).Return(nil)

	// the directory entry will be updated a couple times
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newRootBlock = block.(*DirBlock)
	}).AnyTimes().Return(nil)

	if err := config.KBFSOps().Write(p, newData, 1); err != nil {
		t.Errorf("Got error on write: %v", err)
	} else if !bytesEqual(expectedFullData[0:6], block1.Contents) {
		t.Errorf("Wrote bad contents to block 1: %v", block1.Contents)
	} else if !bytesEqual(expectedFullData[6:11], block2.Contents) {
		t.Errorf("Wrote bad contents to block 2: %v", block2.Contents)
	} else if !pblock.IsInd {
		t.Errorf("Parent block is not indirect!")
	} else if len(pblock.IPtrs) != 2 {
		t.Errorf("Wrong number of pointers in pblock: %v", pblock.IPtrs)
	} else if pblock.IPtrs[0].Id != id1 {
		t.Errorf("Parent block has wrong id for block 1: %v (vs. %v)",
			pblock.IPtrs[0].Id, id1)
	} else if pblock.IPtrs[1].Id != id2 {
		t.Errorf("Parent block has wrong id for block 2: %v",
			pblock.IPtrs[1].Id)
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
}

func TestKBFSOpsWriteOverMultipleBlocks(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{
		BlockPointer: BlockPointer{Id: fileId, Writer: userId}, Size: 10}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userId, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userId, 6}, 5},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}
	data := []byte{1, 2, 3, 4, 5}
	expectedFullData := []byte{5, 4, 1, 2, 3, 4, 5, 8, 7, 6}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	expectGetBlock(config, id1, block1)
	expectGetBlock(config, id2, block2)
	// only copy the first half first
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(2)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block1.Contents[0:2], data[0:3]...)
	}).Return(int64(3))

	// The parent is always dirtied so that we can sync properly later
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		AnyTimes().Return(nil)

	var newBlock1 *FileBlock
	var newBlock2 *FileBlock
	// updated copy of block1
	c1 := config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock1 = block.(*FileBlock)
	}).Return(nil)

	// update block 2
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data[3:], int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(data, block2.Contents[2:]...)
	}).Return(int64(2))

	// updated copy of block2
	config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock2 = block.(*FileBlock)
	}).After(c1).Return(nil)

	if err := config.KBFSOps().Write(p, data, 2); err != nil {
		t.Errorf("Got error on write: %v", err)
	} else if !bytesEqual(expectedFullData[0:5], newBlock1.Contents) {
		t.Errorf("Wrote bad contents to block 1: %v", block1.Contents)
	} else if !bytesEqual(expectedFullData[5:10], newBlock2.Contents) {
		t.Errorf("Wrote bad contents to block 2: %v", block2.Contents)
	}
}

// Read tests check the same error cases, so no need for similar write
// error tests

func TestKBFSOpsTruncateToZeroSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	var newRootBlock *DirBlock
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newRootBlock = block.(*DirBlock)
	}).Return(nil)

	data := []byte{}
	if err := config.KBFSOps().Truncate(p, 0); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", newFileBlock.Contents)
	} else if newRootBlock.Children["f"].Writer != userId {
		t.Errorf("Wrong last writer: %v", newRootBlock.Children["f"].Writer)
	} else if newRootBlock.Children["f"].Size != 0 {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}
}

func TestKBFSOpsTruncateSameSize(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)

	data := fileBlock.Contents
	if err := config.KBFSOps().Truncate(p, 10); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if !bytesEqual(data, fileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsTruncateSmallerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).Return(nil)

	data := []byte{1, 2, 3, 4, 5}
	if err := config.KBFSOps().Truncate(p, 5); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsTruncateRemovesABlock(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{
		BlockPointer: BlockPointer{Id: fileId}, Size: 10}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userId, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userId, 6}, 5},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	expectGetBlock(config, id1, block1)
	var newPBlock *FileBlock
	var newBlock1 *FileBlock
	c1 := config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newPBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(id1, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock1 = block.(*FileBlock)
	}).After(c1).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).Return(nil)

	data := []byte{5, 4, 3, 2}
	if err := config.KBFSOps().Truncate(p, 4); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if !bytesEqual(data, newBlock1.Contents) {
		t.Errorf("Wrote bad contents: %v", newBlock1.Contents)
	} else if len(newPBlock.IPtrs) != 1 {
		t.Errorf("Wrong number of indirect pointers: %d", len(newPBlock.IPtrs))
	}
}

func TestKBFSOpsTruncateBiggerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = &DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []*PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), []byte{0, 0, 0, 0, 0}, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block.Contents, data...)
	}).Return(int64(5))

	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), true).Return(nil)

	data := []byte{1, 2, 3, 4, 5, 0, 0, 0, 0, 0}
	if err := config.KBFSOps().Truncate(p, 10); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func testSetExSuccess(t *testing.T, ex bool) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsExec: false}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// chmod a+x a
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ := expectSyncBlock(config, nil, userId, id, "",
		*p.ParentPath(), rmd, false, 0)
	expectedPath.Path = append(expectedPath.Path, aNode)

	if newP, err := config.KBFSOps().SetEx(p, ex); err != nil {
		t.Errorf("Got unexpected error on setex: %v", err)
	} else if rootBlock.Children["a"].IsExec != ex {
		t.Errorf("a is not executable, as expected")
	} else {
		// append a fake block so checkNewPath does the right thing
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		// pretend it's a rename so only ctime gets checked
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			false, true, "", true)
	}
}

func TestSetExChangedSuccess(t *testing.T) {
	testSetExSuccess(t, true)
}

func TestSetExNoChangeSuccess(t *testing.T) {
	// even no change should cause the ctime to change, leading to a
	// whole new path
	testSetExSuccess(t, false)
}

func TestSetExFailNoSuchName(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// chmod a+x a
	expectGetBlock(config, rootId, rootBlock)
	expectedErr := &NoSuchNameError{p.TailName()}

	if _, err := config.KBFSOps().SetEx(p, true); err == nil {
		t.Errorf("Got no expected error on setex")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on setex: %v", err)
	}
}

// Other SetEx failure cases are all the same as any other block sync

func TestSetMtimeSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsExec: false}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// chmod a+x a
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ := expectSyncBlock(config, nil, userId, id, "",
		*p.ParentPath(), rmd, false, 0)
	expectedPath.Path = append(expectedPath.Path, aNode)

	newMtime := time.Now()
	if newP, err := config.KBFSOps().SetMtime(p, &newMtime); err != nil {
		t.Errorf("Got unexpected error on setmtime: %v", err)
	} else if rootBlock.Children["a"].Mtime != newMtime.UnixNano() {
		t.Errorf("a has wrong mtime: %v", newMtime)
	} else {
		// append a fake block so checkNewPath does the right thing
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			false, true, "", false)
	}
}

func TestSetMtimeNull(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	oldMtime := time.Now().UnixNano()
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: aId}, IsExec: false, Mtime: oldMtime}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	if newP, err := config.KBFSOps().SetMtime(p, nil); err != nil {
		t.Errorf("Got unexpected error on null setmtime: %v", err)
	} else if rootBlock.Children["a"].Mtime != oldMtime {
		t.Errorf("a has wrong mtime: %v", rootBlock.Children["a"].Mtime)
	} else if newP.Path[0].Id != p.Path[0].Id {
		t.Errorf("Got back a changed path for null setmtime test: %v", newP)
	}
}

func TestMtimeFailNoSuchName(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// chmod a+x a
	expectGetBlock(config, rootId, rootBlock)
	expectedErr := &NoSuchNameError{p.TailName()}

	newMtime := time.Now()
	if _, err := config.KBFSOps().SetMtime(p, &newMtime); err == nil {
		t.Errorf("Got no expected error on setmtime")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on setmtime: %v", err)
	}
}

// SetMtime failure cases are all the same as any other block sync

func TestSyncDirtySuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{BlockPointer: BlockPointer{Id: aId}}
	aBlock := NewFileBlock().(*FileBlock)
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(aId).AnyTimes().Return(aBlock, nil)

	// sync block
	expectedPath, _ :=
		expectSyncBlock(config, nil, userId, id, "", p, rmd, false, 0)
	config.mockBcache.EXPECT().Finalize(
		aId, expectedPath.Path[len(expectedPath.Path)-1].Id)
	config.mockBcache.EXPECT().Finalize(
		rootId, expectedPath.Path[len(expectedPath.Path)-2].Id)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else {
		// pretend that aBlock is a dirblock -- doesn't matter for this check
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			false, true, "", false)
	}
}

func TestSyncCleanSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	node := &PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := &PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []*PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aId).Return(false)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if len(newP.Path) != len(p.Path) {
		// should be the exact same path back
		t.Errorf("Got a different length path back: %v", newP)
	} else {
		for i, n := range newP.Path {
			if n != p.Path[i] {
				t.Errorf("Node %i differed: %v", n)
			}
		}
	}
}

func expectSyncDirtyBlock(config *ConfigMock, id BlockId, block *FileBlock,
	splitAt int64, encSize int) *gomock.Call {
	config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	c1 := config.mockBsplit.EXPECT().CheckSplit(block).Return(splitAt)

	newId := BlockId{id[0] + 100}
	newEncBuf := make([]byte, encSize)
	config.mockCrypto.EXPECT().GenRandomSecretKey().Return(NullKey)
	config.mockCrypto.EXPECT().XOR(NullKey, NullKey).Return(NullKey, nil)
	c2 := config.mockBops.EXPECT().Ready(block, NullKey).
		After(c1).Return(newId, newEncBuf, nil)
	config.mockBcache.EXPECT().Finalize(id, newId).After(c2).Return(nil)
	config.mockBops.EXPECT().Put(newId, gomock.Any(), newEncBuf).Return(nil)
	config.mockKops.EXPECT().PutBlockKey(newId, NullKey).Return(nil)
	config.mockKcache.EXPECT().PutBlockKey(newId, NullKey).Return(nil)
	return c2
}

func TestSyncDirtyMultiBlocksSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: fileId}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userId, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, libkb.UID{0}, 0}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userId, 7}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userId, 0}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{10, 9, 8, 7, 6}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{10, 9, 8, 7, 6}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(id1).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(id3).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileId).AnyTimes().Return(fileBlock, nil)

	// the split is good
	expectGetSecretKey(config, rmd)
	expectSyncDirtyBlock(config, id2, block2, int64(0), 5)
	expectSyncDirtyBlock(config, id4, block4, int64(0), 8)

	// sync block
	expectedPath, _ :=
		expectSyncBlock(config, nil, userId, id, "", p, rmd, false, 0)
	config.mockBcache.EXPECT().Finalize(
		fileId, expectedPath.Path[len(expectedPath.Path)-1].Id)
	config.mockBcache.EXPECT().Finalize(
		rootId, expectedPath.Path[len(expectedPath.Path)-2].Id)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if fileBlock.IPtrs[1].Writer != userId {
		t.Errorf("Got unexpected writer: %s", fileBlock.IPtrs[1].Writer)
	} else {
		// pretend that aBlock is a dirblock -- doesn't matter for this check
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			false, true, "", false)
	}
}

func TestSyncDirtyMultiBlocksSplitInBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: fileId}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userId, 10}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userId, 0}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userId, 0}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userId, 0}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(id1).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(id3).Return(false)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileId).AnyTimes().Return(fileBlock, nil)
	config.mockBcache.EXPECT().Get(id3).Return(block3, nil)
	expectGetSecretKey(config, rmd)

	// the split is in the middle
	expectSyncDirtyBlock(config, id2, block2, int64(3), 6)
	// this causes block 3 to be updated
	var newBlock3 *FileBlock
	config.mockBcache.EXPECT().Put(id3, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock3 = block.(*FileBlock)
		// id3 syncs just fine
		expectSyncDirtyBlock(config, id3, newBlock3, int64(0), 14)
	}).Return(nil)

	// id4 is the final block, and the split causes a new block to be made
	c4 := expectSyncDirtyBlock(config, id4, block4, int64(3), 9)
	var newId5 BlockId
	var newBlock5 *FileBlock
	config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newId5 = id
		newBlock5 = block.(*FileBlock)
		// id5 syncs just fine
		expectSyncDirtyBlock(config, id, newBlock5, int64(0), 1)
		// it's put one more time
		config.mockBcache.EXPECT().Put(id, gomock.Any(), true).Return(nil)
	}).Return(nil)

	// The parent is dirtied too since the pointers changed
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		AnyTimes().Return(nil)

	// sync block
	expectedPath, _ :=
		expectSyncBlock(config, c4, userId, id, "", p, rmd, false, 0)
	config.mockBcache.EXPECT().Finalize(
		fileId, expectedPath.Path[len(expectedPath.Path)-1].Id)
	config.mockBcache.EXPECT().Finalize(
		rootId, expectedPath.Path[len(expectedPath.Path)-2].Id)

	newId2 := BlockId{id2[0] + 100}
	newId3 := BlockId{id3[0] + 100}
	newId4 := BlockId{id4[0] + 100}

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if len(fileBlock.IPtrs) != 5 {
		t.Errorf("Wrong number of indirect pointers: %d", len(fileBlock.IPtrs))
	} else if fileBlock.IPtrs[0].Id != id1 {
		t.Errorf("Indirect pointer id1 wrong: %v", fileBlock.IPtrs[0].Id)
	} else if fileBlock.IPtrs[0].QuotaSize != 10 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[0].Off != 0 {
		t.Errorf("Indirect pointer off1 wrong: %d", fileBlock.IPtrs[0].Off)
	} else if fileBlock.IPtrs[1].Id != newId2 {
		t.Errorf("Indirect pointer id2 wrong: %v", fileBlock.IPtrs[1].Id)
	} else if fileBlock.IPtrs[1].QuotaSize != 6 {
		t.Errorf("Indirect pointer quota size2 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[1].Off != 5 {
		t.Errorf("Indirect pointer off2 wrong: %d", fileBlock.IPtrs[1].Off)
	} else if fileBlock.IPtrs[2].Id != newId3 {
		t.Errorf("Indirect pointer id3 wrong: %v", fileBlock.IPtrs[2].Id)
	} else if fileBlock.IPtrs[2].QuotaSize != 14 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[2].QuotaSize)
	} else if fileBlock.IPtrs[2].Off != 8 {
		t.Errorf("Indirect pointer off3 wrong: %d", fileBlock.IPtrs[2].Off)
	} else if fileBlock.IPtrs[3].Id != newId4 {
		t.Errorf("Indirect pointer id4 wrong: %v", fileBlock.IPtrs[3].Id)
	} else if fileBlock.IPtrs[3].QuotaSize != 9 {
		t.Errorf("Indirect pointer quota size4 wrong: %d", fileBlock.IPtrs[3].QuotaSize)
	} else if fileBlock.IPtrs[3].Off != 15 {
		t.Errorf("Indirect pointer off4 wrong: %d", fileBlock.IPtrs[3].Off)
	} else if fileBlock.IPtrs[4].Id != (BlockId{newId5[0] + 100}) {
		t.Errorf("Indirect pointer id5 wrong: %v", fileBlock.IPtrs[4].Id)
	} else if fileBlock.IPtrs[4].QuotaSize != 1 {
		t.Errorf("Indirect pointer quota size5 wrong: %d", fileBlock.IPtrs[4].QuotaSize)
	} else if fileBlock.IPtrs[4].Off != 18 {
		t.Errorf("Indirect pointer off5 wrong: %d", fileBlock.IPtrs[4].Off)
	} else if !bytesEqual([]byte{10, 9, 8}, block2.Contents) {
		t.Errorf("Block 2 has the wrong data: %v", block2.Contents)
	} else if !bytesEqual(
		[]byte{7, 6, 15, 14, 13, 12, 11}, newBlock3.Contents) {
		t.Errorf("Block 3 has the wrong data: %v", newBlock3.Contents)
	} else if !bytesEqual([]byte{20, 19, 18}, block4.Contents) {
		t.Errorf("Block 4 has the wrong data: %v", block4.Contents)
	} else if !bytesEqual([]byte{17, 16}, newBlock5.Contents) {
		t.Errorf("Block 5 has the wrong data: %v", newBlock5.Contents)
	} else {
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			false, true, "", false)
	}
}

func TestSyncDirtyMultiBlocksCopyNextBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer mockCtrl.Finish()

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = &DirEntry{
		BlockPointer: BlockPointer{Id: fileId}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userId, 0}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userId, 10}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userId, 0}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userId, 15}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := &PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := &PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []*PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileId).AnyTimes().Return(fileBlock, nil)
	config.mockBcache.EXPECT().Get(id2).Return(block2, nil)
	config.mockBcache.EXPECT().IsDirty(id2).AnyTimes().Return(false)
	config.mockBcache.EXPECT().Get(id4).Return(block4, nil)
	config.mockBcache.EXPECT().IsDirty(id4).Return(false)
	expectGetSecretKey(config, rmd)

	// the split is in the middle
	expectSyncDirtyBlock(config, id1, block1, int64(-1), 14)
	// this causes block 2 to be copied from (copy whole block)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), block2.Contents, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block.Contents, data...)
	}).Return(int64(5))
	// now block 2 is empty, and should be deleted

	// block 3 is dirty too, just copy part of block 4
	expectSyncDirtyBlock(config, id3, block3, int64(-1), 10)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), block4.Contents, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block.Contents, data[:3]...)
	}).Return(int64(3))
	var newBlock4 *FileBlock
	config.mockBcache.EXPECT().Put(id4, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock4 = block.(*FileBlock)
		// now block 4 is dirty, but it's the end of the line,
		// so nothing else to do
		expectSyncDirtyBlock(config, id4, newBlock4, int64(-1), 15)
	}).Return(nil)

	// The parent is dirtied too since the pointers changed
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		AnyTimes().Return(nil)

	// sync block
	expectedPath, _ :=
		expectSyncBlock(config, nil, userId, id, "", p, rmd, false, 0)
	config.mockBcache.EXPECT().Finalize(
		fileId, expectedPath.Path[len(expectedPath.Path)-1].Id)
	config.mockBcache.EXPECT().Finalize(
		rootId, expectedPath.Path[len(expectedPath.Path)-2].Id)

	newId1 := BlockId{id1[0] + 100}
	newId3 := BlockId{id3[0] + 100}
	newId4 := BlockId{id4[0] + 100}

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if len(fileBlock.IPtrs) != 3 {
		t.Errorf("Wrong number of indirect pointers: %d", len(fileBlock.IPtrs))
	} else if fileBlock.IPtrs[0].Id != newId1 {
		t.Errorf("Indirect pointer id1 wrong: %v", fileBlock.IPtrs[0].Id)
	} else if fileBlock.IPtrs[0].QuotaSize != 14 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[0].Off != 0 {
		t.Errorf("Indirect pointer off1 wrong: %d", fileBlock.IPtrs[0].Off)
	} else if fileBlock.IPtrs[1].Id != newId3 {
		t.Errorf("Indirect pointer id3 wrong: %v", fileBlock.IPtrs[1].Id)
	} else if fileBlock.IPtrs[1].QuotaSize != 10 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[1].Off != 10 {
		t.Errorf("Indirect pointer off3 wrong: %d", fileBlock.IPtrs[1].Off)
	} else if fileBlock.IPtrs[2].Id != newId4 {
		t.Errorf("Indirect pointer id4 wrong: %v", fileBlock.IPtrs[2].Id)
	} else if fileBlock.IPtrs[2].QuotaSize != 15 {
		t.Errorf("Indirect pointer quota size4 wrong: %d", fileBlock.IPtrs[2].QuotaSize)
	} else if fileBlock.IPtrs[2].Off != 18 {
		t.Errorf("Indirect pointer off4 wrong: %d", fileBlock.IPtrs[2].Off)
	} else if !bytesEqual([]byte{5, 4, 3, 2, 1, 10, 9, 8, 7, 6},
		block1.Contents) {
		t.Errorf("Block 1 has the wrong data: %v", block1.Contents)
	} else if !bytesEqual(
		[]byte{15, 14, 13, 12, 11, 20, 19, 18}, block3.Contents) {
		t.Errorf("Block 3 has the wrong data: %v", block3.Contents)
	} else if !bytesEqual([]byte{17, 16}, newBlock4.Contents) {
		t.Errorf("Block 4 has the wrong data: %v", newBlock4.Contents)
	} else {
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			false, true, "", false)
	}
}
