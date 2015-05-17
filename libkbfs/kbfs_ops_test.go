package libkbfs

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"code.google.com/p/gomock/gomock"
	"github.com/keybase/client/go/libkb"
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

func (cbo *CheckBlockOps) Ready(block Block, encryptKey Key) (id BlockId, plainSize int, buf []byte, err error) {
	id, plainSize, buf, err = cbo.delegate.Ready(block, encryptKey)
	if plainSize > len(buf) {
		cbo.t.Errorf("expected plainSize <= len(buf), got plainSize = %d, len(buf) = %d", plainSize, len(buf))
	}
	return
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
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	blockops := &CheckBlockOps{config.mockBops, t}
	config.SetBlockOps(blockops)
	kbfsops := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsops)
	config.SetNotifier(kbfsops)

	// these are used when computing metadata IDs.  No need to check
	// in this test.
	config.mockCodec.EXPECT().Encode(gomock.Any()).AnyTimes().
		Return([]byte{0}, nil)
	config.mockCrypto.EXPECT().Hash(gomock.Any()).AnyTimes().
		Return(libkb.NodeHashShort{0}, nil)
	return
}

func kbfsTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	config.KBFSOps().(*KBFSOpsStandard).Shutdown()
	mockCtrl.Finish()
}

func TestKBFSOpsGetFavDirsSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

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
	defer kbfsTestShutdown(mockCtrl, config)

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
	rmd.AddNewKeys(DirKeyBundle{})
	config.KBFSOps().(*KBFSOpsStandard).heads[id] = rmd.mdId
	config.mockMdcache.EXPECT().Get(rmd.mdId).AnyTimes().Return(rmd, nil)
	config.Notifier().RegisterForChanges([]DirId{id}, config.observer)
	return userId, id, rmd
}

func TestKBFSOpsGetRootMDCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, rmd := makeIdAndRMD(config)
	rmd.data.Dir.Type = Dir

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmd {
		t.Error("Got bad MD back: %v", rmd2)
	}
}

func TestKBFSOpsGetRootMDCacheSuccess2ndTry(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmdGood := NewRootMetadata(h, id)
	rmdGood.data.Dir.Type = Dir

	// send back new, uncached MD on first try, but succeed after
	// getting the lock
	config.mockMdops.EXPECT().Get(id).Return(rmd, nil)
	config.mockMdcache.EXPECT().Put(rmd.mdId, rmd).Return(nil)
	config.mockMdcache.EXPECT().Get(rmd.mdId).Return(rmdGood, nil)

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
	config.mockBops.EXPECT().Get(id, gomock.Any(), nil, gomock.Any()).
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
	config.mockMdops.EXPECT().Get(id).Return(rmd, nil)
	config.mockMdcache.EXPECT().Put(rmd.mdId, rmd).Return(nil)
	config.mockMdcache.EXPECT().Get(rmd.mdId).Return(rmd, nil)
}

func expectGetSecretKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKeyman.EXPECT().GetSecretKey(
		gomock.Any(), rmd).Return(nil, nil)
}

func expectGetSecretBlockKey(
	config *ConfigMock, id BlockId, rmd *RootMetadata) {
	config.mockKeyman.EXPECT().GetSecretBlockKey(
		gomock.Any(), id, rmd).Return(nil, nil)
}

func fillInNewMD(config *ConfigMock, rmd *RootMetadata) (
	rootId BlockId, plainSize int, block []byte) {
	config.mockKeyman.EXPECT().Rekey(rmd).Return(nil)
	expectGetSecretKey(config, rmd)
	rootId = BlockId{42}
	plainSize = 3
	block = []byte{1, 2, 3, 4}
	config.mockBops.EXPECT().Ready(gomock.Any(), nil).Return(
		rootId, plainSize, block, nil)
	return
}

func TestKBFSOpsGetRootMDCreateNewSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)

	// create a new MD
	createNewMD(config, rmd, id)
	// now KBFS will fill it in:
	rootId, plainSize, block := fillInNewMD(config, rmd)
	// now cache and put everything
	config.mockBops.EXPECT().Put(rootId, gomock.Any(), block).Return(nil)
	config.mockBcache.EXPECT().Put(rootId, gomock.Any(), false).Return(nil)
	config.mockMdops.EXPECT().Put(id, rmd).Return(nil)
	config.mockMdcache.EXPECT().Put(rmd.mdId, rmd).Return(nil)

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmd {
		t.Error("Got bad MD back: %v", rmd2)
	} else if rmd2.data.Dir.Id != rootId {
		t.Error("Got bad MD rootId back: %v", rmd2.data.Dir.Id)
	} else if rmd2.data.Dir.Type != Dir {
		t.Error("Got bad MD non-dir rootId back")
	} else if rmd2.data.Dir.QuotaSize != uint32(len(block)) {
		t.Error("Got bad MD QuotaSize back: %d", rmd2.data.Dir.QuotaSize)
	} else if rmd2.data.Dir.Size != uint64(plainSize) {
		t.Error("Got bad MD Size back: %d", rmd2.data.Dir.Size)
	} else if rmd2.data.Dir.Mtime == 0 {
		t.Error("Got zero MD MTime back")
	} else if rmd2.data.Dir.Ctime == 0 {
		t.Error("Got zero MD CTime back")
	}
}

func TestKBFSOpsGetRootMDCreateNewFailNonWriter(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

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
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.data.Dir = DirEntry{
		BlockPointer: BlockPointer{
			QuotaSize: 15,
		},
		Type:  Dir,
		Size:  10,
		Mtime: 1,
		Ctime: 2,
	}

	config.mockMdops.EXPECT().GetAtHandle(h).Return(rmd, nil)

	if rmd2, err := config.KBFSOps().GetRootMDForHandle(h); err != nil {
		t.Errorf("Got error on root MD for handle: %v", err)
	} else if rmd2 != rmd {
		t.Error("Got bad MD back: %v", rmd2)
	} else if rmd2.Id != id {
		t.Error("Got bad dir id back: %v", rmd2.Id)
	} else if rmd2.data.Dir.QuotaSize != 15 {
		t.Error("Got bad MD QuotaSize back: %d", rmd2.data.Dir.QuotaSize)
	} else if rmd2.data.Dir.Type != Dir {
		t.Error("Got bad MD non-dir rootId back")
	} else if rmd2.data.Dir.Size != 10 {
		t.Error("Got bad MD Size back: %d", rmd2.data.Dir.Size)
	} else if rmd2.data.Dir.Mtime != 1 {
		t.Error("Got bad MD MTime back: %d", rmd2.data.Dir.Mtime)
	} else if rmd2.data.Dir.Ctime != 2 {
		t.Error("Got bad MD CTime back: %d", rmd2.data.Dir.Ctime)
	}
}

func TestKBFSOpsGetBaseDirCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	dirBlock := NewDirBlock()
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

	config.mockBcache.EXPECT().Get(rootId).Return(dirBlock, nil)

	if block, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	} else if block != dirBlock {
		t.Errorf("Got bad dirblock back: %v", block)
	}
}

func TestKBFSOpsGetBaseDirUncachedSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	dirBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	userId := libkb.UID{15}
	ownerId := libkb.UID{20}
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = []libkb.UID{ownerId}
	expectUserCalls(h, config)

	rmd := NewRootMetadata(h, id)
	rmdGood := NewRootMetadata(h, id)
	rmdGood.data.Dir.Type = Dir

	rootId := BlockId{42}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	p := Path{id, []PathNode{node}}

	// won't even try getting the block if the user isn't a reader
	config.KBFSOps().(*KBFSOpsStandard).heads[id] = rmd.mdId
	config.mockMdcache.EXPECT().Get(rmd.mdId).Return(rmd, nil)
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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	dirBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	userId := libkb.UID{15}
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = append(h.Writers, userId)
	expectUserCalls(h, config)

	rmd := NewRootMetadata(h, id)
	rmd.data.Dir.Type = Dir
	// Set the version in the future.
	rmd.data.Dir.Ver = 1

	rootId := BlockId{42}
	node := PathNode{BlockPointer{rootId, 0, 1, userId, 0}, ""}
	p := Path{id, []PathNode{node}}

	// we won't even need to check the cache before failing
	expectedErr := &NewVersionError{p, 1}

	if _, err := config.KBFSOps().GetDir(p); err == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetNestedDirCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	config.KBFSOps().(*KBFSOpsStandard).heads[id] = rmd.mdId
	config.mockMdcache.EXPECT().Get(rmd.mdId).AnyTimes().Return(rmd, nil)

	rootId := BlockId{42}
	aId := BlockId{43}
	bId := BlockId{44}
	dirBlock := NewDirBlock()
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	bNode := PathNode{BlockPointer{bId, 0, 0, u, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

	config.mockBcache.EXPECT().Get(bId).Return(dirBlock, nil)

	if block, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	} else if block != dirBlock {
		t.Errorf("Got bad dirblock back: %v", block)
	}
}

func checkBlockChange(t *testing.T, bcn *BlockChangeNode, path Path,
	index int, depth int, id BlockId) {
	if depth == index {
		for _, ptr := range bcn.Blocks {
			if ptr.Id == id {
				return
			}
		}
		t.Errorf("Missing expected block change id %v in %s (index %d) %v",
			id, path, index, bcn.Blocks)
	} else {
		checkBlockChange(t, bcn.Children[path.Path[depth+1].Name], path, index,
			depth+1, id)
	}
}

func expectSyncBlock(
	t *testing.T, config *ConfigMock, lastCall *gomock.Call, userId libkb.UID,
	id DirId, name string, path Path, rmd *RootMetadata, newEntry bool,
	skipSync int, refBytes uint64, unrefBytes uint64,
	checkMD func(*RootMetadata)) (Path, *gomock.Call) {
	expectGetSecretKey(config, rmd)

	// construct new path
	newPath := Path{
		TopDir: id,
		Path:   make([]PathNode, 0, len(path.Path)+1),
	}
	for _, node := range path.Path {
		newPath.Path = append(newPath.Path, PathNode{Name: node.Name})
	}
	if newEntry {
		// one for the new entry
		newPath.Path = append(newPath.Path, PathNode{Name: name})
	}

	// all MD is embedded for now
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		AnyTimes().Return(true)

	lastId := byte(path.TailPointer().Id[0] * 2)
	for i := len(newPath.Path) - 1; i >= skipSync; i-- {
		newId := BlockId{lastId}
		newBuf := []byte{lastId}
		refBytes += uint64(len(newBuf))
		if i < len(path.Path) {
			unrefBytes += uint64(path.Path[i].QuotaSize)
		}
		lastId++
		config.mockCrypto.EXPECT().GenRandomSecretKey().Return(nil)
		config.mockCrypto.EXPECT().XOR(nil, nil).Return(nil, nil)
		call := config.mockBops.EXPECT().Ready(gomock.Any(), nil).Return(
			newId, len(newBuf), newBuf, nil)
		if lastCall != nil {
			call = call.After(lastCall)
		}
		lastCall = call
		newPath.Path[i].Id = newId
		config.mockBops.EXPECT().Put(newId, gomock.Any(), newBuf).Return(nil)
		config.mockBcache.EXPECT().Put(newId, gomock.Any(), false).Return(nil)
		config.mockKops.EXPECT().PutBlockKey(newId, nil).Return(nil)
		config.mockKcache.EXPECT().PutBlockKey(newId, nil).Return(nil)
	}
	if skipSync == 0 {
		// sign the MD and put it
		config.mockMdops.EXPECT().Put(id, rmd).Return(nil)
		refBlocks := rmd.data.RefBlocks.Changes
		unrefBlocks := rmd.data.UnrefBlocks.Changes
		config.mockMdcache.EXPECT().Put(rmd.mdId, rmd).
			Do(func(id MDId, rmd *RootMetadata) {
			// Check that the ref/unref bytes are correct.
			// Should have
			if rmd.RefBytes != refBytes {
				t.Errorf("Unexpected refbytes: %d vs %d",
					rmd.RefBytes, refBytes)
			}
			if rmd.UnrefBytes != unrefBytes {
				t.Errorf("Unexpected unrefbytes: %d vs %d",
					rmd.UnrefBytes, unrefBytes)
			}
			// check that the ref/unref block changes include the expected
			// blocks
			for i, node := range path.Path {
				if node.QuotaSize > 0 {
					checkBlockChange(t, unrefBlocks, path, i, 0, node.Id)
				}
			}
			for i, node := range newPath.Path {
				if i == len(newPath.Path)-1 {
					break
				}
				checkBlockChange(t, refBlocks, newPath, i, 0, node.Id)
			}
			if checkMD != nil {
				checkMD(rmd)
			}
		}).Return(nil)
	}
	return newPath, lastCall
}

func checkNewPath(t *testing.T, config Config, newPath Path, expectedPath Path,
	rmd *RootMetadata, blocks []*DirBlock, entryType EntryType,
	newName string, rename bool) {
	// TODO: check that the observer updates match the expectedPath as
	// well (but need to handle the rename case where there can be
	// multiple updates).  For now, just check that there's at least
	// one update.
	if len(config.(*ConfigMock).observer.batchUpdatePaths) < 1 {
		t.Errorf("No batch notifications sent, at least one expected")
	}

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
	currDe := rmd.data.Dir
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
			if currDe.Type != entryType {
				t.Errorf("New entry has wrong type %s, expected %s",
					currDe.Type, entryType)
			}
		}

		if (currDe.Type != File && currDe.Type != Exec) && currDe.Size == 0 {
			t.Errorf("Type %s unexpectedly has 0 size", currDe.Type)
		}
	}
}

func expectGetBlock(config *ConfigMock, id BlockId, block Block) {
	config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(false)
}

func testCreateEntrySuccess(t *testing.T, entryType EntryType) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId},
		Type:         Dir,
	}
	aBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// creating "a/b"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userId, id, "b", p, rmd, entryType != Sym, 0,
			0, 0, nil)

	var newP Path
	var err error
	switch entryType {
	case File:
		newP, _, err = config.KBFSOps().CreateFile(p, "b", false)
	case Exec:
		newP, _, err = config.KBFSOps().CreateFile(p, "b", true)
	case Dir:
		newP, _, err = config.KBFSOps().CreateDir(p, "b")
	case Sym:
		newP, _, err = config.KBFSOps().CreateLink(p, "b", "c")
	}
	if err != nil {
		t.Errorf("Got error on create: %v", err)
	}
	// Append a fake block representing the new entry.  It won't be examined
	blocks := []*DirBlock{rootBlock, aBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP, expectedPath, rmd, blocks,
		entryType, "b", false)
	if entryType == Sym {
		de := aBlock.Children["b"]
		if de.Type != Sym {
			t.Error("Entry is not a symbolic link")
		}
		if de.SymPath != "c" {
			t.Errorf("Symbolic path points to the wrong thing: %s", de.SymPath)
		}
	} else if entryType != Dir {
		de := aBlock.Children["b"]
		if de.Size != 0 {
			t.Errorf("New file has non-zero size: %d", de.Size)
		}
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
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId},
		Type:         Dir,
	}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

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

func testRemoveEntrySuccess(t *testing.T, entryType EntryType) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockPointer: BlockPointer{Id: bId}, Type: entryType}
	bBlock := NewFileBlock()
	if entryType == Dir {
		bBlock = NewDirBlock()
	}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	bNode := PathNode{BlockPointer{bId, 0, 0, userId, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

	// deleting "a/b"
	if entryType != Sym {
		expectGetBlock(config, bId, bBlock)
	}
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ := expectSyncBlock(t, config, nil, userId, id, "",
		*p.ParentPath(), rmd, false, 0, 0, 0, nil)

	var newP Path
	var err error
	if entryType == Dir {
		newP, err = config.KBFSOps().RemoveDir(p)
	} else {
		newP, err = config.KBFSOps().RemoveEntry(p)
	}
	if err != nil {
		t.Errorf("Got error on removal: %v", err)
	}
	blocks := []*DirBlock{rootBlock, aBlock}
	checkNewPath(t, config, newP, expectedPath, rmd, blocks,
		entryType, "", false)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after removal")
	}
}

func TestKBFSOpsRemoveDirSuccess(t *testing.T) {
	testRemoveEntrySuccess(t, Dir)
}

func TestKBFSOpsRemoveFileSuccess(t *testing.T) {
	testRemoveEntrySuccess(t, File)
}

func TestKBFSOpsRemoveSymlinkSuccess(t *testing.T) {
	testRemoveEntrySuccess(t, Sym)
}

func TestKBFSOpRemoveMultiBlockFileSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	// TODO(akalin): Figure out actual Size value.
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: fileId, QuotaSize: 10}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userId, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userId, 5}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userId, 5}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userId, 5}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)
	expectGetBlock(config, id1, block1)
	expectGetBlock(config, id2, block2)
	expectGetBlock(config, id3, block3)
	expectGetBlock(config, id4, block4)

	// sync block
	unrefBytes := uint64(10 + 4*5) // fileBlock + 4 indirect blocks
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, fileId)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id1)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id2)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id3)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id4)
	}
	expectedPath, _ := expectSyncBlock(t, config, nil, userId, id, "",
		*p.ParentPath(), rmd, false, 0, 0, unrefBytes, f)

	newP, err := config.KBFSOps().RemoveEntry(p)
	if err != nil {
		t.Errorf("Got error on removal: %v", err)
	}
	blocks := []*DirBlock{rootBlock}
	checkNewPath(t, config, newP, expectedPath, rmd, blocks,
		File, "", false)
	if _, ok := rootBlock.Children["a"]; ok {
		t.Errorf("entry for a is still around after removal")
	}
}

func TestRemoveDirFailNonEmpty(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	bBlock := NewDirBlock().(*DirBlock)
	bBlock.Children["c"] = DirEntry{
		BlockPointer: BlockPointer{Id: bId}, Type: File}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	bNode := PathNode{BlockPointer{bId, 0, 0, u, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	bBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	bNode := PathNode{BlockPointer{bId, 0, 0, u, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{Id: bId}}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// renaming "a/b" to "a/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userId, id, "", p, rmd, false,
			0, 0, 0, nil)

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
		File, "c", true)
	checkNewPath(t, config, newP2, expectedPath, rmd, blocks,
		File, "c", true)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}

}

func TestRenameInRootSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: File}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	p := Path{id, []PathNode{node}}

	// renaming "a" to "b"
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userId, id, "", p, rmd, false,
			0, 0, 0, nil)

	var newP1 Path
	var newP2 Path
	var err error
	newP1, newP2, err = config.KBFSOps().Rename(p, "a", p, "b")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	// append a fake block at the end for the renamed file
	blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP1, expectedPath, rmd, blocks,
		File, "b", true)
	checkNewPath(t, config, newP2, expectedPath, rmd, blocks,
		File, "b", true)
	if _, ok := rootBlock.Children["a"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}

}

func TestRenameAcrossDirsSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{Id: bId}}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p1 := Path{id, []PathNode{node, aNode}}

	dId := BlockId{40}
	rootBlock.Children["d"] = DirEntry{
		BlockPointer: BlockPointer{Id: dId}, Type: Dir}
	dBlock := NewDirBlock().(*DirBlock)
	dNode := PathNode{BlockPointer{dId, 0, 0, userId, 0}, "d"}
	p2 := Path{id, []PathNode{node, dNode}}

	// renaming "a/b" to "d/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, dId, dBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath1, lastCall :=
		expectSyncBlock(t, config, nil, userId, id, "", p1, rmd, false,
			1, 0, 0, nil)
	expectedPath2, _ :=
		expectSyncBlock(t, config, lastCall, userId, id, "", p2, rmd, false, 0,
			1, 0, nil)
	// fix up old expected path's common ancestor
	expectedPath1.Path[0].Id = expectedPath2.Path[0].Id

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	blocks := []*DirBlock{rootBlock, aBlock}
	checkNewPath(t, config, newP1, expectedPath1, rmd, blocks,
		File, "", true)
	// append a fake block at the end for the renamed file
	blocks = []*DirBlock{rootBlock, dBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP2, expectedPath2, rmd, blocks,
		File, "c", true)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}
}

func TestRenameAcrossPrefixSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	dId := BlockId{40}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{Id: bId}}
	aBlock.Children["d"] = DirEntry{BlockPointer: BlockPointer{Id: dId}}
	dBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	dNode := PathNode{BlockPointer{dId, 0, 0, userId, 0}, "d"}
	p1 := Path{id, []PathNode{node, aNode}}
	p2 := Path{id, []PathNode{node, aNode, dNode}}

	// renaming "a/b" to "a/d/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, dId, dBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath2, _ :=
		expectSyncBlock(t, config, nil, userId, id, "", p2, rmd, false,
			0, 0, 0, nil)

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
	aDe := rootBlock.Children["a"]
	aDe.Mtime = 0
	aDe.Ctime = 0
	rootBlock.Children["a"] = aDe

	// append a fake block at the end for the renamed file
	blocks := []*DirBlock{rootBlock, aBlock, dBlock, NewDirBlock().(*DirBlock)}
	checkNewPath(t, config, newP2, expectedPath2, rmd, blocks,
		File, "c", true)
	if _, ok := aBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}
}

func TestRenameAcrossOtherPrefixSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{41}
	aId := BlockId{42}
	bId := BlockId{43}
	dId := BlockId{40}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["d"] = DirEntry{BlockPointer: BlockPointer{Id: dId}}
	dBlock := NewDirBlock().(*DirBlock)
	dBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{Id: bId}}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	dNode := PathNode{BlockPointer{dId, 0, 0, userId, 0}, "d"}
	p1 := Path{id, []PathNode{node, aNode, dNode}}
	p2 := Path{id, []PathNode{node, aNode}}

	// renaming "a/d/b" to "a/c"
	expectGetBlock(config, aId, aBlock)
	expectGetBlock(config, dId, dBlock)
	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath1, lastCall :=
		expectSyncBlock(t, config, nil, userId, id, "", p1, rmd, false,
			2, 0, 0, nil)
	expectedPath2, _ :=
		expectSyncBlock(t, config, lastCall, userId, id, "", p2, rmd, false, 0,
			1, 0, nil)
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
		File, "c", true)
	if _, ok := dBlock.Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}
}

func TestRenameFailAcrossTopDirs(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

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
	node1 := PathNode{BlockPointer{rootId1, 0, 0, userId1, 0}, ""}
	aNode1 := PathNode{BlockPointer{aId1, 0, 0, userId1, 0}, "a"}
	p1 := Path{id1, []PathNode{node1, aNode1}}

	rootId2 := BlockId{38}
	aId2 := BlockId{39}
	node2 := PathNode{BlockPointer{rootId2, 0, 0, userId2, 0}, ""}
	aNode2 := PathNode{BlockPointer{aId2, 0, 0, userId2, 0}, "a"}
	p2 := Path{id2, []PathNode{node2, aNode2}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

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
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

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
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 15}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during write: %s",
			config.observer.localUpdatePath)
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
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during write: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(expectedFullData, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsWritePastEndSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during write: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(expectedFullData, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsWriteCauseSplit(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during write: %s",
			config.observer.localUpdatePath)
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
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
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
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during write: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(expectedFullData[0:5], newBlock1.Contents) {
		t.Errorf("Wrote bad contents to block 1: %v", block1.Contents)
	} else if !bytesEqual(expectedFullData[5:10], newBlock2.Contents) {
		t.Errorf("Wrote bad contents to block 2: %v", block2.Contents)
	}

	index := len(p.Path) - 1
	checkBlockChange(t, rmd.data.UnrefBlocks.Changes, p, index, 0, id1)
	checkBlockChange(t, rmd.data.UnrefBlocks.Changes, p, index, 0, id2)
}

// Read tests check the same error cases, so no need for similar write
// error tests

func TestKBFSOpsTruncateToZeroSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during truncate: %s",
			config.observer.localUpdatePath)
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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectGetBlock(config, fileId, fileBlock)

	data := fileBlock.Contents
	if err := config.KBFSOps().Truncate(p, 10); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if len(config.observer.localUpdatePath.Path) != 0 {
		t.Errorf("Unexpected local update during truncate: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(data, fileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsTruncateSmallerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during truncate: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func TestKBFSOpsTruncateRemovesABlock(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
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
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during truncate: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(data, newBlock1.Contents) {
		t.Errorf("Wrote bad contents: %v", newBlock1.Contents)
	} else if len(newPBlock.IPtrs) != 1 {
		t.Errorf("Wrong number of indirect pointers: %d", len(newPBlock.IPtrs))
	} else if rmd.UnrefBytes != 0+5+6 {
		// The fileid and both blocks were all modified and marked dirty
		t.Errorf("Truncated block not correctly unref'd, unrefBytes = %d",
			rmd.UnrefBytes)
	}
	checkBlockChange(t, rmd.data.UnrefBlocks.Changes, p, len(p.Path)-1, 0, id2)
}

func TestKBFSOpsTruncateBiggerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{Id: fileId}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

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
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during truncate: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	}
}

func testSetExSuccess(t *testing.T, entryType EntryType, ex bool) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Size: 1, Type: entryType}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootId, rootBlock)

	expectedChanges := 1
	// SetEx() should do nothing for symlinks.
	if entryType == Sym {
		expectedChanges = 0
	}

	var expectedPath Path
	if entryType != Sym {
		// sync block
		expectedPath, _ = expectSyncBlock(t, config, nil, userId, id, "",
			*p.ParentPath(), rmd, false, 0, 0, 0, nil)
		expectedPath.Path = append(expectedPath.Path, aNode)
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
	if newP, err := config.KBFSOps().SetEx(p, ex); err != nil {
		t.Errorf("Got unexpected error on setex: %v", err)
	} else if expectedChanges != len(config.observer.batchUpdatePaths) {
		t.Errorf("got changed=%t, expected %t",
			len(config.observer.batchUpdatePaths), expectedChanges)
	} else if rootBlock.Children["a"].Type != expectedType {
		t.Errorf("a has type %s, expected %s", rootBlock.Children["a"].Type, expectedType)
	} else if entryType != Sym {
		// SetEx() should always change the ctime of
		// non-symlinks.  append a fake block so checkNewPath
		// does the right thing
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		// pretend it's a rename so only ctime gets checked
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			expectedType, "", true)
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
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootId, rootBlock)
	expectedErr := &NoSuchNameError{p.TailName()}

	// chmod a+x a
	if _, err := config.KBFSOps().SetEx(p, true); err == nil {
		t.Errorf("Got no expected error on setex")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on setex: %v", err)
	}
}

// Other SetEx failure cases are all the same as any other block sync

func TestSetMtimeSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: File}
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootId, rootBlock)
	// sync block
	expectedPath, _ := expectSyncBlock(t, config, nil, userId, id, "",
		*p.ParentPath(), rmd, false, 0, 0, 0, nil)
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
			Exec, "", false)
	}
}

func TestSetMtimeNull(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	oldMtime := time.Now().UnixNano()
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{Id: aId}, Type: File, Mtime: oldMtime}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

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
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{BlockPointer: BlockPointer{Id: aId}}
	aBlock := NewFileBlock().(*FileBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(aId).AnyTimes().Return(aBlock, nil)

	// sync block
	expectedPath, _ := expectSyncBlock(t, config, nil, userId, id, "", p,
		rmd, false, 0, 0, 0, nil)
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
			Exec, "", false)
	}
}

func TestSyncCleanSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	node := PathNode{BlockPointer{rootId, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

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
	splitAt int64, padSize int) *gomock.Call {
	config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	c1 := config.mockBsplit.EXPECT().CheckSplit(block).Return(splitAt)

	newId := BlockId{id[0] + 100}
	// Ideally, we'd use the size of block.Contents at the time
	// that Ready() is called, but GoMock isn't expressive enough
	// for that.
	newEncBuf := make([]byte, len(block.Contents)+padSize)
	config.mockCrypto.EXPECT().GenRandomSecretKey().Return(nil)
	config.mockCrypto.EXPECT().XOR(nil, nil).Return(nil, nil)
	c2 := config.mockBops.EXPECT().Ready(block, nil).
		After(c1).Return(newId, len(block.Contents), newEncBuf, nil)
	config.mockBcache.EXPECT().Finalize(id, newId).After(c2).Return(nil)
	config.mockBops.EXPECT().Put(newId, gomock.Any(), newEncBuf).Return(nil)
	config.mockKops.EXPECT().PutBlockKey(newId, nil).Return(nil)
	config.mockKcache.EXPECT().PutBlockKey(newId, nil).Return(nil)
	return c2
}

func TestSyncDirtyMultiBlocksSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
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
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(id1).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(id3).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileId).AnyTimes().Return(fileBlock, nil)

	// the split is good
	expectGetSecretKey(config, rmd)
	pad2 := 5
	pad4 := 8
	expectSyncDirtyBlock(config, id2, block2, int64(0), pad2)
	expectSyncDirtyBlock(config, id4, block4, int64(0), pad4)

	// sync 2 blocks, plus their pad sizes
	refBytes := uint64((len(block2.Contents) + pad2) +
		(len(block4.Contents) + pad4))
	// Nothing will be unref'd here (the write/truncate would
	// have taken care of it)
	unrefBytes := uint64(0)
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id2[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id4[0] + 100})
	}
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userId, id, "", p, rmd, false, 0,
			refBytes, unrefBytes, f)
	config.mockBcache.EXPECT().Finalize(
		fileId, expectedPath.Path[len(expectedPath.Path)-1].Id)
	config.mockBcache.EXPECT().Finalize(
		rootId, expectedPath.Path[len(expectedPath.Path)-2].Id)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if fileBlock.IPtrs[0].QuotaSize != 5 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[1].Writer != userId {
		t.Errorf("Got unexpected writer: %s", fileBlock.IPtrs[1].Writer)
	} else if fileBlock.IPtrs[1].QuotaSize != 10 {
		t.Errorf("Indirect pointer quota size2 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[2].QuotaSize != 7 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[2].QuotaSize)
	} else if fileBlock.IPtrs[3].QuotaSize != 13 {
		t.Errorf("Indirect pointer quota size4 wrong: %d", fileBlock.IPtrs[3].QuotaSize)
	} else {
		// pretend that aBlock is a dirblock -- doesn't matter for this check
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			Exec, "", false)
	}
}

func TestSyncDirtyMultiBlocksSplitInBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
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
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

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
	pad2 := 0
	pad3 := 14
	extraBytesFor3 := 2
	expectSyncDirtyBlock(config, id2, block2,
		int64(len(block2.Contents)-extraBytesFor3), pad2)
	// this causes block 3 to be updated
	var newBlock3 *FileBlock
	config.mockBcache.EXPECT().Put(id3, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock3 = block.(*FileBlock)
		// id3 syncs just fine
		expectSyncDirtyBlock(config, id3, newBlock3, int64(0), pad3)
	}).Return(nil)

	// id4 is the final block, and the split causes a new block to be made
	pad4 := 9
	pad5 := 1
	c4 := expectSyncDirtyBlock(config, id4, block4, int64(3), pad4)
	var newId5 BlockId
	var newBlock5 *FileBlock
	config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newId5 = id
		newBlock5 = block.(*FileBlock)
		// id5 syncs just fine
		expectSyncDirtyBlock(config, id, newBlock5, int64(0), pad5)
		// it's put one more time
		config.mockBcache.EXPECT().Put(id, gomock.Any(), true).Return(nil)
	}).Return(nil)

	// The parent is dirtied too since the pointers changed
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		AnyTimes().Return(nil)

	// sync block contents and their padding sizes
	refBytes := uint64((len(block2.Contents) + pad2) +
		(len(block3.Contents) + extraBytesFor3 + pad3) +
		(len(block4.Contents) + pad4) + pad5)
	unrefBytes := uint64(0) // no quota sizes on dirty blocks
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id2[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id3[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id4[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{newId5[0] + 100})
	}
	expectedPath, _ :=
		expectSyncBlock(t, config, c4, userId, id, "", p, rmd, false, 0,
			refBytes, unrefBytes, f)
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
	} else if fileBlock.IPtrs[1].QuotaSize != 5 {
		t.Errorf("Indirect pointer quota size2 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[1].Off != 5 {
		t.Errorf("Indirect pointer off2 wrong: %d", fileBlock.IPtrs[1].Off)
	} else if fileBlock.IPtrs[2].Id != newId3 {
		t.Errorf("Indirect pointer id3 wrong: %v", fileBlock.IPtrs[2].Id)
	} else if fileBlock.IPtrs[2].QuotaSize != 21 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[2].QuotaSize)
	} else if fileBlock.IPtrs[2].Off != 8 {
		t.Errorf("Indirect pointer off3 wrong: %d", fileBlock.IPtrs[2].Off)
	} else if fileBlock.IPtrs[3].Id != newId4 {
		t.Errorf("Indirect pointer id4 wrong: %v", fileBlock.IPtrs[3].Id)
	} else if fileBlock.IPtrs[3].QuotaSize != 14 {
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
			Exec, "", false)
	}
}

func TestSyncDirtyMultiBlocksCopyNextBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	fileId := BlockId{43}
	id1 := BlockId{44}
	id2 := BlockId{45}
	id3 := BlockId{46}
	id4 := BlockId{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
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
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	fileNode := PathNode{BlockPointer{fileId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

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
	pad1 := 14
	expectSyncDirtyBlock(config, id1, block1, int64(-1), pad1)
	// this causes block 2 to be copied from (copy whole block)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), block2.Contents, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block.Contents, data...)
	}).Return(int64(5))
	// now block 2 is empty, and should be deleted

	// block 3 is dirty too, just copy part of block 4
	pad3 := 10
	split4At := int64(3)
	pad4 := 15
	expectSyncDirtyBlock(config, id3, block3, int64(-1), pad3)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), block4.Contents, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block.Contents, data[:3]...)
	}).Return(split4At)
	var newBlock4 *FileBlock
	config.mockBcache.EXPECT().Put(id4, gomock.Any(), true).
		Do(func(id BlockId, block Block, dirty bool) {
		newBlock4 = block.(*FileBlock)
		// now block 4 is dirty, but it's the end of the line,
		// so nothing else to do
		expectSyncDirtyBlock(config, id4, newBlock4, int64(-1), pad4)
	}).Return(nil)

	// The parent is dirtied too since the pointers changed
	config.mockBcache.EXPECT().Put(fileId, gomock.Any(), true).
		AnyTimes().Return(nil)

	// sync block
	refBytes := uint64((len(block1.Contents) + pad1) +
		(len(block3.Contents) + pad3) +
		(len(block4.Contents) - int(split4At) + pad4))
	unrefBytes := uint64(10 + 15) // id2 and id4
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id1[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id3[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockId{id4[0] + 100})
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id2)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id4)
	}
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userId, id, "", p, rmd, false, 0,
			refBytes, unrefBytes, f)
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
	} else if fileBlock.IPtrs[0].QuotaSize != 19 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[0].Off != 0 {
		t.Errorf("Indirect pointer off1 wrong: %d", fileBlock.IPtrs[0].Off)
	} else if fileBlock.IPtrs[1].Id != newId3 {
		t.Errorf("Indirect pointer id3 wrong: %v", fileBlock.IPtrs[1].Id)
	} else if fileBlock.IPtrs[1].QuotaSize != 15 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[1].Off != 10 {
		t.Errorf("Indirect pointer off3 wrong: %d", fileBlock.IPtrs[1].Off)
	} else if fileBlock.IPtrs[2].Id != newId4 {
		t.Errorf("Indirect pointer id4 wrong: %v", fileBlock.IPtrs[2].Id)
	} else if fileBlock.IPtrs[2].QuotaSize != 17 {
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
			Exec, "", false)
	}
}

func TestSyncDirtyWithBlockChangePointerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t)
	defer kbfsTestShutdown(mockCtrl, config)

	userId, id, rmd := makeIdAndRMD(config)

	rootId := BlockId{42}
	aId := BlockId{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{BlockPointer: BlockPointer{Id: aId}}
	aBlock := NewFileBlock().(*FileBlock)
	node := PathNode{BlockPointer{rootId, 0, 0, userId, 0}, ""}
	aNode := PathNode{BlockPointer{aId, 0, 0, userId, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootId).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootId).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(aId).AnyTimes().Return(aBlock, nil)

	// override the AnyTimes expect call done by default in expectSyncBlock()
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		AnyTimes().Return(false)

	// sync block
	refBytes := uint64(1 + 1) // 2 ref/unref blocks of 1 byte each
	expectedPath, lastCall := expectSyncBlock(t, config, nil, userId, id, "", p,
		rmd, false, 0, refBytes, 0, nil)
	config.mockBcache.EXPECT().Finalize(
		aId, expectedPath.Path[len(expectedPath.Path)-1].Id)
	config.mockBcache.EXPECT().Finalize(
		rootId, expectedPath.Path[len(expectedPath.Path)-2].Id)

	// expected calls for ref block changes blocks
	refBlockId := BlockId{253}
	refPlainSize := 1
	refBuf := []byte{253}
	config.mockCrypto.EXPECT().GenRandomSecretKey().Return(nil)
	config.mockCrypto.EXPECT().XOR(nil, nil).Return(nil, nil)
	lastCall = config.mockBops.EXPECT().Ready(gomock.Any(), nil).Return(
		refBlockId, refPlainSize, refBuf, nil).After(lastCall)
	config.mockBops.EXPECT().Put(refBlockId, gomock.Any(), refBuf).Return(nil)
	config.mockBcache.EXPECT().Put(refBlockId, gomock.Any(), false).Return(nil)
	config.mockKops.EXPECT().PutBlockKey(refBlockId, nil).Return(nil)
	config.mockKcache.EXPECT().PutBlockKey(refBlockId, nil).Return(nil)

	unrefBlockId := BlockId{254}
	unrefPlainSize := 0
	unrefBuf := []byte{254}
	config.mockCrypto.EXPECT().GenRandomSecretKey().Return(nil)
	config.mockCrypto.EXPECT().XOR(nil, nil).Return(nil, nil)
	lastCall = config.mockBops.EXPECT().Ready(gomock.Any(), nil).Return(
		unrefBlockId, unrefPlainSize, unrefBuf, nil).After(lastCall)
	config.mockBops.EXPECT().Put(unrefBlockId, gomock.Any(), unrefBuf).
		Return(nil)
	config.mockBcache.EXPECT().Put(unrefBlockId, gomock.Any(), false).
		Return(nil)
	config.mockKops.EXPECT().PutBlockKey(unrefBlockId, nil).Return(nil)
	config.mockKcache.EXPECT().PutBlockKey(unrefBlockId, nil).Return(nil)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if rmd.data.RefBlocks.Pointer.Id != refBlockId {
		t.Errorf("Got unexpected refBlocks pointer: %v vs %v",
			rmd.data.RefBlocks.Pointer.Id, refBlockId)
	} else if rmd.data.UnrefBlocks.Pointer.Id != unrefBlockId {
		t.Errorf("Got unexpected unrefBlocks pointer: %v vs %v",
			rmd.data.UnrefBlocks.Pointer.Id, unrefBlockId)
	} else {
		// pretend that aBlock is a dirblock -- doesn't matter for this check
		blocks := []*DirBlock{rootBlock, NewDirBlock().(*DirBlock)}
		checkNewPath(t, config, newP, expectedPath, rmd, blocks,
			Exec, "", false)
	}
}
