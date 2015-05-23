package libkbfs

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"code.google.com/p/gomock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type CheckBlockOps struct {
	delegate BlockOps
	tr       gomock.TestReporter
}

var _ BlockOps = (*CheckBlockOps)(nil)

func (cbo *CheckBlockOps) Get(id BlockID, context BlockContext, cryptKey BlockCryptKey, block Block) error {
	err := cbo.delegate.Get(id, context, cryptKey, block)
	if err != nil {
		return err
	}
	if fBlock, ok := block.(*FileBlock); ok && !fBlock.IsInd && context.GetQuotaSize() < uint32(len(fBlock.Contents)) {
		cbo.tr.Errorf("expected at most %d bytes, got %d bytes", context.GetQuotaSize(), len(fBlock.Contents))
	}
	return err
}

func (cbo *CheckBlockOps) Ready(block Block, cryptKey BlockCryptKey) (id BlockID, plainSize int, buf []byte, err error) {
	id, plainSize, buf, err = cbo.delegate.Ready(block, cryptKey)
	if plainSize > len(buf) {
		cbo.tr.Errorf("expected plainSize <= len(buf), got plainSize = %d, len(buf) = %d", plainSize, len(buf))
	}
	return
}

func (cbo *CheckBlockOps) Put(id BlockID, context BlockContext, buf []byte) error {
	if err := cbo.delegate.Put(id, context, buf); err != nil {
		return err
	}
	if context.GetQuotaSize() != uint32(len(buf)) {
		cbo.tr.Errorf("expected %d bytes, got %d bytes", context.GetQuotaSize(), len(buf))
	}
	return nil
}

func (cbo *CheckBlockOps) Delete(id BlockID, context BlockContext) error {
	return cbo.delegate.Delete(id, context)
}

func kbfsOpsInit(t *testing.T, changeMd bool) (mockCtrl *gomock.Controller,
	config *ConfigMock) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	blockops := &CheckBlockOps{config.mockBops, ctr}
	config.SetBlockOps(blockops)
	kbfsops := NewKBFSOpsStandard(config)
	config.SetKBFSOps(kbfsops)
	config.SetNotifier(kbfsops)

	// these are used when computing metadata IDs.  No need to check
	// in this test.
	config.mockCodec.EXPECT().Encode(gomock.Any()).AnyTimes().
		Return([]byte{0}, nil)
	if changeMd {
		// Give different values for the MD Id so we can test that it
		// is properly cached
		config.mockCrypto.EXPECT().Hash(gomock.Any()).
			Return(libkb.NodeHashShort{0}, nil)
		config.mockCrypto.EXPECT().Hash(gomock.Any()).AnyTimes().
			Return(libkb.NodeHashShort{1}, nil)
	} else {
		config.mockCrypto.EXPECT().Hash(gomock.Any()).AnyTimes().
			Return(libkb.NodeHashShort{0}, nil)
	}
	return
}

func kbfsTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	config.KBFSOps().(*KBFSOpsStandard).Shutdown()
	mockCtrl.Finish()
}

func TestKBFSOpsGetFavDirsSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	// expect one call to fetch favorites
	id1, _, _ := newDir(config, 1, true, false)
	id2, _, _ := newDir(config, 2, true, false)
	ids := []DirID{id1, id2}

	config.mockMdops.EXPECT().GetFavorites().Return(ids, nil)

	if ids2, err := config.KBFSOps().GetFavDirs(); err != nil {
		t.Errorf("Got error on favorites: %v", err)
	} else if len(ids2) != len(ids) {
		t.Errorf("Got bad ids back: %v", ids2)
	}
}

func TestKBFSOpsGetFavDirsFail(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	err := errors.New("Fake fail")
	// expect one call to favorites, and fail it
	config.mockMdops.EXPECT().GetFavorites().Return(nil, err)

	if _, err2 := config.KBFSOps().GetFavDirs(); err2 != err {
		t.Errorf("Got bad error on favorites: %v", err2)
	}
}

func makeID(config *ConfigMock) (keybase1.UID, DirID, *DirHandle) {
	userID := keybase1.MakeTestUID(15)
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = []keybase1.UID{userID}
	expectUserCalls(h, config)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().Return(userID, nil)
	return userID, id, h
}

func makeIDAndRMD(config *ConfigMock) (
	keybase1.UID, DirID, *RootMetadata) {
	userID, id, h := makeID(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeyBundle{})
	rmd.mdID = MdID{id[0]}
	config.KBFSOps().(*KBFSOpsStandard).heads[id] = rmd.mdID
	config.mockMdcache.EXPECT().Get(rmd.mdID).AnyTimes().Return(rmd, nil)
	config.Notifier().RegisterForChanges([]DirID{id}, config.observer)
	return userID, id, rmd
}

func TestKBFSOpsGetRootMDCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, rmd := makeIDAndRMD(config)
	rmd.data.Dir.Type = Dir

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmd {
		t.Errorf("Got bad MD back: %v", rmd2)
	}
}

func expectBlock(config *ConfigMock, id BlockID, block Block,
	err error) {
	config.mockBops.EXPECT().Get(id, gomock.Any(), BlockCryptKey{}, gomock.Any()).
		Do(func(id BlockID, context BlockContext, k BlockCryptKey, getBlock Block) {
		switch v := getBlock.(type) {
		case *FileBlock:
			*v = *block.(*FileBlock)

		case *DirBlock:
			*v = *block.(*DirBlock)
		}
	}).Return(err)
}

func expectGetTLFCryptKey(config *ConfigMock) {
	config.mockKeyman.EXPECT().GetTLFCryptKey(
		gomock.Any(), gomock.Any()).Return(TLFCryptKey{}, nil)
}

func expectGetBlockCryptKey(
	config *ConfigMock, id BlockID, rmd *RootMetadata) {
	config.mockKeyman.EXPECT().GetBlockCryptKey(
		gomock.Any(), id, rmd).Return(BlockCryptKey{}, nil)
}

func fillInNewMD(config *ConfigMock, rmd *RootMetadata) (
	rootID BlockID, plainSize int, block []byte) {
	config.mockKeyman.EXPECT().Rekey(rmd).Return(nil)
	expectGetTLFCryptKey(config)
	rootID = BlockID{42}
	plainSize = 3
	block = []byte{1, 2, 3, 4}

	config.mockCrypto.EXPECT().MakeRandomBlockCryptKeyServerHalf().Return(BlockCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(BlockCryptKeyServerHalf{}, TLFCryptKey{}).Return(BlockCryptKey{}, nil)
	config.mockBops.EXPECT().Ready(gomock.Any(), BlockCryptKey{}).Return(
		rootID, plainSize, block, nil)
	config.mockKops.EXPECT().PutBlockCryptKeyServerHalf(rootID, BlockCryptKeyServerHalf{}).Return(nil)
	config.mockKcache.EXPECT().PutBlockCryptKey(rootID, BlockCryptKey{}).Return(nil)
	return
}

func TestKBFSOpsGetRootMDCreateNewSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, h := makeID(config)
	rmd := NewRootMetadata(h, id)

	// create a new MD
	config.mockMdops.EXPECT().Get(id).Return(rmd, nil)
	// now KBFS will fill it in:
	rootID, plainSize, block := fillInNewMD(config, rmd)
	// now cache and put everything
	config.mockBops.EXPECT().Put(rootID, gomock.Any(), block).Return(nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), false).Return(nil)
	config.mockMdops.EXPECT().Put(id, rmd).Return(nil)
	config.mockMdcache.EXPECT().Put(rmd.mdID, rmd).Return(nil)

	if rmd2, err := config.KBFSOps().GetRootMD(id); err != nil {
		t.Errorf("Got error on root MD: %v", err)
	} else if rmd2 != rmd {
		t.Errorf("Got bad MD back: %v", rmd2)
	} else if rmd2.data.Dir.ID != rootID {
		t.Errorf("Got bad MD rootID back: %v", rmd2.data.Dir.ID)
	} else if rmd2.data.Dir.Type != Dir {
		t.Error("Got bad MD non-dir rootID back")
	} else if rmd2.data.Dir.QuotaSize != uint32(len(block)) {
		t.Errorf("Got bad MD QuotaSize back: %d", rmd2.data.Dir.QuotaSize)
	} else if rmd2.data.Dir.Size != uint64(plainSize) {
		t.Errorf("Got bad MD Size back: %d", rmd2.data.Dir.Size)
	} else if rmd2.data.Dir.Mtime == 0 {
		t.Error("Got zero MD MTime back")
	} else if rmd2.data.Dir.Ctime == 0 {
		t.Error("Got zero MD CTime back")
	}
}

func TestKBFSOpsGetRootMDCreateNewFailNonWriter(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	userID := keybase1.MakeTestUID(15)
	ownerID := keybase1.MakeTestUID(20)
	id, h, _ := newDir(config, 1, true, false)
	h.Readers = []keybase1.UID{userID}
	h.Writers = []keybase1.UID{ownerID}

	rmd := NewRootMetadata(h, id)

	// create a new MD
	expectUserCalls(h, config)
	// in reality, createNewMD should fail early because the MD server
	// will refuse to create the new MD for this user.  But for this test,
	// we won't bother
	config.mockMdops.EXPECT().Get(id).Return(rmd, nil)
	// try to get the MD for writing, but fail (no puts should happen)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().Return(userID, nil)
	expectedErr := &WriteAccessError{
		fmt.Sprintf("user_%s", userID), h.ToString(config)}

	if _, err := config.KBFSOps().GetRootMD(id); err == nil {
		t.Errorf("Got no expected error on root MD")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetRootMDForHandleExisting(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	_, id, h := makeID(config)
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
		t.Errorf("Got bad MD back: %v", rmd2)
	} else if rmd2.ID != id {
		t.Errorf("Got bad dir id back: %v", rmd2.ID)
	} else if rmd2.data.Dir.QuotaSize != 15 {
		t.Errorf("Got bad MD QuotaSize back: %d", rmd2.data.Dir.QuotaSize)
	} else if rmd2.data.Dir.Type != Dir {
		t.Error("Got bad MD non-dir rootID back")
	} else if rmd2.data.Dir.Size != 10 {
		t.Errorf("Got bad MD Size back: %d", rmd2.data.Dir.Size)
	} else if rmd2.data.Dir.Mtime != 1 {
		t.Errorf("Got bad MD MTime back: %d", rmd2.data.Dir.Mtime)
	} else if rmd2.data.Dir.Ctime != 2 {
		t.Errorf("Got bad MD CTime back: %d", rmd2.data.Dir.Ctime)
	}
}

func TestKBFSOpsGetBaseDirCacheSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	dirBlock := NewDirBlock()
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

	config.mockBcache.EXPECT().Get(rootID).Return(dirBlock, nil)

	if block, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	} else if block != dirBlock {
		t.Errorf("Got bad dirblock back: %v", block)
	}
}

func TestKBFSOpsGetBaseDirUncachedSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	dirBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

	// cache miss means fetching metadata and getting read key
	err := &NoSuchBlockError{rootID}
	config.mockBcache.EXPECT().Get(rootID).Return(nil, err)

	expectGetBlockCryptKey(config, rootID, rmd)
	expectBlock(config, rootID, dirBlock, nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), false).Return(nil)

	if _, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	}
}

func TestKBFSOpsGetBaseDirUncachedFailNonReader(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	userID := keybase1.MakeTestUID(15)
	ownerID := keybase1.MakeTestUID(20)
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = []keybase1.UID{ownerID}
	expectUserCalls(h, config)

	rmd := NewRootMetadata(h, id)
	rmdGood := NewRootMetadata(h, id)
	rmdGood.data.Dir.Type = Dir

	rootID := BlockID{42}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	p := Path{id, []PathNode{node}}

	// won't even try getting the block if the user isn't a reader
	config.KBFSOps().(*KBFSOpsStandard).heads[id] = rmd.mdID
	config.mockMdcache.EXPECT().Get(rmd.mdID).Return(rmd, nil)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().Return(userID, nil)
	expectUserCall(userID, config)
	expectedErr := &ReadAccessError{
		fmt.Sprintf("user_%s", userID), h.ToString(config)}

	if _, err := config.KBFSOps().GetDir(p); err == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetBaseDirUncachedFailMissingBlock(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	dirBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

	// cache miss means fetching metadata and getting read key, then
	// fail block fetch
	err := &NoSuchBlockError{rootID}
	config.mockBcache.EXPECT().Get(rootID).Return(nil, err)
	expectGetBlockCryptKey(config, rootID, rmd)
	expectBlock(config, rootID, dirBlock, err)

	if _, err2 := config.KBFSOps().GetDir(p); err2 == nil {
		t.Errorf("Got no expected error on getdir")
	} else if err2.Error() != err.Error() {
		t.Errorf("Got unexpected error on root MD: %v", err)
	}
}

func TestKBFSOpsGetBaseDirUncachedFailNewVersion(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	userID := keybase1.MakeTestUID(15)
	id, h, _ := newDir(config, 1, true, false)
	h.Writers = append(h.Writers, userID)
	expectUserCalls(h, config)

	rmd := NewRootMetadata(h, id)
	rmd.data.Dir.Type = Dir
	// Set the version in the future.
	rmd.data.Dir.Ver = 1

	rootID := BlockID{42}
	node := PathNode{BlockPointer{rootID, 0, 1, userID, 0}, ""}
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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, h := makeID(config)
	rmd := NewRootMetadata(h, id)
	config.KBFSOps().(*KBFSOpsStandard).heads[id] = rmd.mdID
	config.mockMdcache.EXPECT().Get(rmd.mdID).AnyTimes().Return(rmd, nil)

	rootID := BlockID{42}
	aID := BlockID{43}
	bID := BlockID{44}
	dirBlock := NewDirBlock()
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	bNode := PathNode{BlockPointer{bID, 0, 0, u, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

	config.mockBcache.EXPECT().Get(bID).Return(dirBlock, nil)

	if block, err := config.KBFSOps().GetDir(p); err != nil {
		t.Errorf("Got error on getdir: %v", err)
	} else if block != dirBlock {
		t.Errorf("Got bad dirblock back: %v", block)
	}
}

func checkBlockChange(t *testing.T, bcn *BlockChangeNode, path Path,
	index int, depth int, id BlockID) {
	if depth == index {
		for _, ptr := range bcn.Blocks {
			if ptr.ID == id {
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
	t *testing.T, config *ConfigMock, lastCall *gomock.Call, userID keybase1.UID,
	id DirID, name string, path Path, rmd *RootMetadata, newEntry bool,
	skipSync int, refBytes uint64, unrefBytes uint64,
	checkMD func(*RootMetadata), newRmd **RootMetadata, newBlocks []*DirBlock) (
	Path, *gomock.Call) {
	expectGetTLFCryptKey(config)

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

	lastID := byte(path.TailPointer().ID[0] * 2)
	for i := len(newPath.Path) - 1; i >= skipSync; i-- {
		newID := BlockID{lastID}
		newBuf := []byte{lastID}
		refBytes += uint64(len(newBuf))
		if i < len(path.Path) {
			unrefBytes += uint64(path.Path[i].QuotaSize)
		}
		lastID++
		config.mockCrypto.EXPECT().MakeRandomBlockCryptKeyServerHalf().Return(BlockCryptKeyServerHalf{}, nil)
		config.mockCrypto.EXPECT().UnmaskBlockCryptKey(BlockCryptKeyServerHalf{}, TLFCryptKey{}).Return(BlockCryptKey{}, nil)
		call := config.mockBops.EXPECT().Ready(gomock.Any(), BlockCryptKey{}).Return(
			newID, len(newBuf), newBuf, nil)
		if lastCall != nil {
			call = call.After(lastCall)
		}
		lastCall = call
		newPath.Path[i].ID = newID
		index := i
		config.mockBops.EXPECT().Put(newID, gomock.Any(), newBuf).Return(nil)
		// Hard to know whether the block will be finalized or just
		// put into the cache.  Allow either one.  I don't think
		// gomock lets us check that exactly one of them will happen.
		config.mockBcache.EXPECT().Put(newID, gomock.Any(), false).
			Do(func(id BlockID, block Block, dirty bool) {
			if newBlocks != nil {
				if dblock, ok := block.(*DirBlock); ok {
					newBlocks[index] = dblock
				} else if index == len(newBlocks)-1 {
					// just pretend this is a dirblock.  shouldn't matter.
					newBlocks[index] = NewDirBlock().(*DirBlock)
				} else {
					t.Errorf("Couldn't put new block %v as a dirblock "+
						"(%d out of %d)", newID, index+1, len(newBlocks))
				}
			}
		}).AnyTimes().Return(nil)
		if index < len(path.Path) && path.Path[index].ID != zeroID {
			config.mockBcache.EXPECT().Finalize(path.Path[index].ID, newID).
				Do(func(oldId BlockID, newID BlockID) {
				if newBlocks == nil {
					return
				}
				// get the new block straight from the mock cache!
				block, _ := config.BlockCache().Get(oldId)
				// file blocks don't need saving
				if dblock, ok := block.(*DirBlock); ok {
					newBlocks[index] = dblock
				}
			}).AnyTimes().Return(nil)
		}

		config.mockKops.EXPECT().PutBlockCryptKeyServerHalf(newID, BlockCryptKeyServerHalf{}).Return(nil)
		config.mockKcache.EXPECT().PutBlockCryptKey(newID, BlockCryptKey{}).Return(nil)
	}
	if skipSync == 0 {
		// sign the MD and put it
		config.mockMdops.EXPECT().Put(id, gomock.Any()).Return(nil)
		config.mockMdcache.EXPECT().Put(gomock.Any(), gomock.Any()).
			Do(func(id MdID, rmd *RootMetadata) {
			*newRmd = rmd
			refBlocks := rmd.data.RefBlocks.Changes
			unrefBlocks := rmd.data.UnrefBlocks.Changes
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
				if node.QuotaSize > 0 && unrefBlocks != nil {
					checkBlockChange(t, unrefBlocks, path, i, 0, node.ID)
				}
			}
			for i, node := range newPath.Path {
				if refBlocks == nil || i == len(newPath.Path)-1 {
					break
				}
				checkBlockChange(t, refBlocks, newPath, i, 0, node.ID)
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
		if node.ID != eNode.ID {
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
			eID := expectedPath.Path[i].ID
			if currDe.ID != eID {
				t.Errorf("Entry does not point to %v, but to %v",
					eID, currDe.ID)
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
			t.Errorf("Type %s unexpectedly has 0 size (%d)", currDe.Type, i)
		}
	}
}

func expectGetBlock(config *ConfigMock, id BlockID, block Block) {
	config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(false)
}

func expectGetBlockWithPut(config *ConfigMock, id BlockID, block Block) {
	config.mockBcache.EXPECT().Get(id).Return(block, nil)
	config.mockBcache.EXPECT().IsDirty(id).Return(false)
	config.mockBcache.EXPECT().Put(id, gomock.Any(), true).AnyTimes().
		Do(func(id BlockID, block Block, dirty bool) {
		config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
		config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	}).Return(nil)
}

func testCreateEntrySuccess(t *testing.T, entryType EntryType) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	rmd.data.Dir.ID = rootID
	rmd.data.Dir.Type = Dir
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID},
		Type:         Dir,
	}
	aBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// creating "a/b"
	expectGetBlock(config, aID, aBlock)
	expectGetBlock(config, rootID, rootBlock)
	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 3)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userID, id, "b", p, rmd,
			entryType != Sym, 0, 0, 0, nil, &newRmd, blocks)

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
	checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
		entryType, "b", false)
	if entryType == Sym {
		de := blocks[1].Children["b"]
		if de.Type != Sym {
			t.Error("Entry is not a symbolic link")
		}
		if de.SymPath != "c" {
			t.Errorf("Symbolic path points to the wrong thing: %s", de.SymPath)
		}
	} else if entryType != Dir {
		de := blocks[1].Children["b"]
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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID},
		Type:         Dir,
	}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

	// creating "a", which already exists in the root block
	expectGetBlock(config, rootID, rootBlock)
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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockPointer: BlockPointer{ID: bID}, Type: entryType}
	bBlock := NewFileBlock()
	if entryType == Dir {
		bBlock = NewDirBlock()
	}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	bNode := PathNode{BlockPointer{bID, 0, 0, userID, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

	// deleting "a/b"
	if entryType != Sym {
		expectGetBlock(config, bID, bBlock)
	}
	expectGetBlock(config, aID, aBlock)
	expectGetBlock(config, rootID, rootBlock)
	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ := expectSyncBlock(t, config, nil, userID, id, "",
		*p.ParentPath(), rmd, false, 0, 0, 0, nil, &newRmd, blocks)

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
	checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
		entryType, "", false)
	if _, ok := blocks[1].Children["b"]; ok {
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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	id3 := BlockID{46}
	id4 := BlockID{47}
	rootBlock := NewDirBlock().(*DirBlock)
	// TODO(akalin): Figure out actual Size value.
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 10}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userID, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userID, 5}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userID, 5}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userID, 5}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	expectGetBlock(config, id1, block1)
	expectGetBlock(config, id2, block2)
	expectGetBlock(config, id3, block3)
	expectGetBlock(config, id4, block4)

	// sync block
	unrefBytes := uint64(10 + 4*5) // fileBlock + 4 indirect blocks
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, fileID)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id1)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id2)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id3)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id4)
	}
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 1)
	expectedPath, _ := expectSyncBlock(t, config, nil, userID, id, "",
		*p.ParentPath(), rmd, false, 0, 0, unrefBytes, f, &newRmd, blocks)

	newP, err := config.KBFSOps().RemoveEntry(p)
	if err != nil {
		t.Errorf("Got error on removal: %v", err)
	}
	checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
		File, "", false)
	if _, ok := blocks[0].Children["a"]; ok {
		t.Errorf("entry for a is still around after removal")
	}
}

func TestRemoveDirFailNonEmpty(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	bBlock := NewDirBlock().(*DirBlock)
	bBlock.Children["c"] = DirEntry{
		BlockPointer: BlockPointer{ID: bID}, Type: File}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	bNode := PathNode{BlockPointer{bID, 0, 0, u, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

	expectGetBlock(config, bID, bBlock)
	expectedErr := &DirNotEmptyError{p.TailName()}

	if _, err := config.KBFSOps().RemoveDir(p); err == nil {
		t.Errorf("Got no expected error on removal")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on removal: %v", err)
	}
}

func TestRemoveDirFailNoSuchName(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	bBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	bNode := PathNode{BlockPointer{bID, 0, 0, u, 0}, "b"}
	p := Path{id, []PathNode{node, aNode, bNode}}

	expectGetBlock(config, bID, bBlock)
	expectGetBlock(config, aID, aBlock)
	expectedErr := &NoSuchNameError{p.TailName()}

	if _, err := config.KBFSOps().RemoveDir(p); err == nil {
		t.Errorf("Got no expected error on removal")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on removal: %v", err)
	}
}

func TestRenameInDirSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{ID: bID}}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// renaming "a/b" to "a/c"
	expectGetBlock(config, aID, aBlock)
	expectGetBlock(config, rootID, rootBlock)
	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 3)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userID, id, "", p, rmd, false,
			0, 0, 0, nil, &newRmd, blocks)

	var newP1 Path
	var newP2 Path
	var err error
	newP1, newP2, err = config.KBFSOps().Rename(p, "b", p, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	checkNewPath(t, config, newP1, expectedPath, newRmd, blocks,
		File, "c", true)
	checkNewPath(t, config, newP2, expectedPath, newRmd, blocks,
		File, "c", true)
	if _, ok := blocks[1].Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}

}

func TestRenameInRootSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: File}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	p := Path{id, []PathNode{node}}

	// renaming "a" to "b"
	expectGetBlock(config, rootID, rootBlock)
	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userID, id, "", p, rmd, false,
			0, 0, 0, nil, &newRmd, blocks)

	var newP1 Path
	var newP2 Path
	var err error
	newP1, newP2, err = config.KBFSOps().Rename(p, "a", p, "b")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	checkNewPath(t, config, newP1, expectedPath, newRmd, blocks,
		File, "b", true)
	checkNewPath(t, config, newP2, expectedPath, newRmd, blocks,
		File, "b", true)
	if _, ok := blocks[0].Children["a"]; ok {
		t.Errorf("entry for a is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}

}

func TestRenameAcrossDirsSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	rmd.data.Dir.ID = rootID
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{ID: bID}}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p1 := Path{id, []PathNode{node, aNode}}

	dID := BlockID{40}
	rootBlock.Children["d"] = DirEntry{
		BlockPointer: BlockPointer{ID: dID}, Type: Dir}
	dBlock := NewDirBlock().(*DirBlock)
	dNode := PathNode{BlockPointer{dID, 0, 0, userID, 0}, "d"}
	p2 := Path{id, []PathNode{node, dNode}}

	// renaming "a/b" to "d/c"
	expectGetBlock(config, aID, aBlock)
	expectGetBlock(config, dID, dBlock)
	expectGetBlockWithPut(config, rootID, rootBlock)
	config.mockBcache.EXPECT().IsDirty(rootID).Return(false)

	// sync block
	var newRmd *RootMetadata
	blocks1 := make([]*DirBlock, 2)
	expectedPath1, lastCall :=
		expectSyncBlock(t, config, nil, userID, id, "", p1, rmd, false,
			1, 0, 0, nil, nil, blocks1)
	blocks2 := make([]*DirBlock, 3)
	expectedPath2, _ :=
		expectSyncBlock(t, config, lastCall, userID, id, "", p2, rmd, false, 0,
			1, 0, nil, &newRmd, blocks2)
	// fix up old expected path's common ancestor
	expectedPath1.Path[0].ID = expectedPath2.Path[0].ID

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}

	// fix up blocks1 -- the first partial sync stops at aBlock, and
	// checkNewPath expects {rootBlock, aBlock}
	blocks1 = []*DirBlock{blocks2[0], blocks1[0]}
	checkNewPath(t, config, newP1, expectedPath1, newRmd, blocks1,
		File, "", true)
	checkNewPath(t, config, newP2, expectedPath2, newRmd, blocks2,
		File, "c", true)
	if _, ok := blocks1[0].Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}
}

func TestRenameAcrossPrefixSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	dID := BlockID{40}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{ID: bID}}
	aBlock.Children["d"] = DirEntry{BlockPointer: BlockPointer{ID: dID}}
	dBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	dNode := PathNode{BlockPointer{dID, 0, 0, userID, 0}, "d"}
	p1 := Path{id, []PathNode{node, aNode}}
	p2 := Path{id, []PathNode{node, aNode, dNode}}

	// renaming "a/b" to "a/d/c"
	// the common ancestor and its parent will be changed once and then re-read
	expectGetBlockWithPut(config, aID, aBlock)
	expectGetBlock(config, dID, dBlock)
	expectGetBlockWithPut(config, rootID, rootBlock)
	config.mockBcache.EXPECT().IsDirty(aID).Return(false)
	config.mockBcache.EXPECT().IsDirty(rootID).Return(false)

	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 4)
	expectedPath2, _ :=
		expectSyncBlock(t, config, nil, userID, id, "", p2, rmd, false,
			0, 0, 0, nil, &newRmd, blocks)

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on rename: %v", err)
	}
	if newP1.Path[0].ID != newP2.Path[0].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	if newP1.Path[1].ID != newP2.Path[1].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	if blocks[0].Children["a"].Mtime == 0 {
		t.Errorf("a's mtime didn't change")
	}
	if blocks[0].Children["a"].Ctime == 0 {
		t.Errorf("a's ctime didn't change")
	}
	// now change the times back so checkNewPath below works without hacking
	aDe := blocks[0].Children["a"]
	aDe.Mtime = 0
	aDe.Ctime = 0
	blocks[0].Children["a"] = aDe

	checkNewPath(t, config, newP2, expectedPath2, newRmd, blocks,
		File, "c", true)
	if _, ok := blocks[1].Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}
}

func TestRenameAcrossOtherPrefixSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{41}
	aID := BlockID{42}
	bID := BlockID{43}
	dID := BlockID{40}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: Dir}
	aBlock := NewDirBlock().(*DirBlock)
	aBlock.Children["d"] = DirEntry{BlockPointer: BlockPointer{ID: dID}}
	dBlock := NewDirBlock().(*DirBlock)
	dBlock.Children["b"] = DirEntry{BlockPointer: BlockPointer{ID: bID}}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	dNode := PathNode{BlockPointer{dID, 0, 0, userID, 0}, "d"}
	p1 := Path{id, []PathNode{node, aNode, dNode}}
	p2 := Path{id, []PathNode{node, aNode}}

	// renaming "a/d/b" to "a/c"
	expectGetBlockWithPut(config, aID, aBlock)
	expectGetBlock(config, dID, dBlock)
	expectGetBlock(config, rootID, rootBlock)
	config.mockBcache.EXPECT().IsDirty(aID).Return(false)

	// sync block
	var newRmd *RootMetadata
	blocks1 := make([]*DirBlock, 3)
	expectedPath1, lastCall :=
		expectSyncBlock(t, config, nil, userID, id, "", p1, rmd, false,
			2, 0, 0, nil, &newRmd, blocks1)
	blocks2 := make([]*DirBlock, 3)
	expectedPath2, _ :=
		expectSyncBlock(t, config, lastCall, userID, id, "", p2, rmd, false, 0,
			1, 0, nil, &newRmd, blocks2)
	// the new path is a prefix of the old path
	expectedPath1.Path[0].ID = expectedPath2.Path[0].ID
	expectedPath1.Path[1].ID = expectedPath2.Path[1].ID

	newP1, newP2, err := config.KBFSOps().Rename(p1, "b", p2, "c")
	if err != nil {
		t.Errorf("Got error on removal: %v", err)
	}
	if newP2.Path[0].ID != newP1.Path[0].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	if newP2.Path[1].ID != newP1.Path[1].ID {
		t.Errorf("New old path not a prefix of new new path")
	}
	if blocks2[1].Children["d"].Mtime == 0 {
		t.Errorf("d's mtime didn't change")
	}
	if blocks2[1].Children["d"].Ctime == 0 {
		t.Errorf("d's ctime didn't change")
	}
	if blocks2[0].Children["a"].Mtime == 0 {
		t.Errorf("d's mtime didn't change")
	}
	if blocks2[0].Children["a"].Ctime == 0 {
		t.Errorf("d's ctime didn't change")
	}

	checkNewPath(t, config, newP1, expectedPath1, newRmd, blocks2,
		File, "c", true)
	if _, ok := blocks1[2].Children["b"]; ok {
		t.Errorf("entry for b is still around after rename")
	} else if len(config.observer.batchUpdatePaths) != 2 {
		t.Errorf("Expected 2 batch notifications, got %d",
			len(config.observer.batchUpdatePaths))
	}
}

func TestRenameFailAcrossTopDirs(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	userID1 := keybase1.MakeTestUID(15)
	id1, h1, _ := newDir(config, 1, true, false)
	h1.Writers = append(h1.Writers, userID1)
	expectUserCalls(h1, config)

	userID2 := keybase1.MakeTestUID(20)
	id2, h2, _ := newDir(config, 2, true, false)
	h2.Writers = append(h2.Writers, userID2)
	expectUserCalls(h2, config)

	rootID1 := BlockID{41}
	aID1 := BlockID{42}
	node1 := PathNode{BlockPointer{rootID1, 0, 0, userID1, 0}, ""}
	aNode1 := PathNode{BlockPointer{aID1, 0, 0, userID1, 0}, "a"}
	p1 := Path{id1, []PathNode{node1, aNode1}}

	rootID2 := BlockID{38}
	aID2 := BlockID{39}
	node2 := PathNode{BlockPointer{rootID2, 0, 0, userID2, 0}, ""}
	aNode2 := PathNode{BlockPointer{aID2, 0, 0, userID2, 0}, "a"}
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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, fileID, fileBlock)

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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, fileID, fileBlock)

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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	id3 := BlockID{46}
	id4 := BlockID{47}
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
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, fileID, fileBlock)
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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	id3 := BlockID{46}
	id4 := BlockID{47}
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
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, fileID, fileBlock)
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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, fileID, fileBlock)

	dest := make([]byte, 4, 4)
	if n, err := config.KBFSOps().Read(p, dest, 10); err != nil {
		t.Errorf("Got error on read: %v", err)
	} else if n != 0 {
		t.Errorf("Read the wrong number of bytes: %d", n)
	}
}

func TestKBFSOpsServerReadFullSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 15}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	// cache miss means fetching metadata and getting read key
	err := &NoSuchBlockError{rootID}
	config.mockBcache.EXPECT().Get(fileID).Return(nil, err)
	expectGetBlockCryptKey(config, fileID, rmd)
	expectBlock(config, fileID, fileBlock, nil)
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), false).Return(nil)

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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	// cache miss means fetching metadata and getting read key
	err := &NoSuchBlockError{rootID}
	config.mockBcache.EXPECT().Get(fileID).Return(nil, err)
	expectGetBlockCryptKey(config, fileID, rmd)
	expectBlock(config, fileID, fileBlock, err)

	n := len(fileBlock.Contents)
	dest := make([]byte, n, n)
	if _, err2 := config.KBFSOps().Read(p, dest, 0); err == nil {
		t.Errorf("Got no expected error")
	} else if err2 != err {
		t.Errorf("Got unexpected error: %v", err2)
	}
}

func setRmdAfterWrite(config *ConfigMock, newRmd **RootMetadata) {
	config.mockMdcache.EXPECT().Put(gomock.Any(), gomock.Any()).
		Do(func(id MdID, rmd *RootMetadata) {
		if newRmd != nil {
			*newRmd = rmd
		}
	})
}

func TestKBFSOpsWriteNewBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 1}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = data
	}).Return(int64(len(data)))
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	var newRootBlock *DirBlock
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newRootBlock = block.(*DirBlock)
	}).Return(nil)
	setRmdAfterWrite(config, nil)

	if err := config.KBFSOps().Write(p, data, 0); err != nil {
		t.Errorf("Got error on write: %v", err)
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during write: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", data)
	} else if newRootBlock.Children["f"].Writer != userID {
		t.Errorf("Wrong last writer: %v", newRootBlock.Children["f"].Writer)
	} else if newRootBlock.Children["f"].Size != uint64(len(data)) {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}
}

func TestKBFSOpsWriteExtendSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
	data := []byte{6, 7, 8, 9, 10}
	expectedFullData := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = expectedFullData
	}).Return(int64(len(data)))
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).Return(nil)
	setRmdAfterWrite(config, nil)

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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
	data := []byte{6, 7, 8, 9, 10}
	expectedFullData := []byte{1, 2, 3, 4, 5, 0, 0, 6, 7, 8, 9, 10}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(7)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = expectedFullData
	}).Return(int64(len(data)))
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).Return(nil)
	setRmdAfterWrite(config, nil)

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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
	newData := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	expectedFullData := append([]byte{0}, newData...)

	expectGetBlockWithPut(config, rootID, rootBlock)
	expectGetBlockWithPut(config, fileID, fileBlock)
	config.mockBcache.EXPECT().IsDirty(rootID).Return(false)

	// only copy the first half first
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), newData, int64(1)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append([]byte{0}, data[0:5]...)
	}).Return(int64(5))

	id1 := BlockID{44}
	id2 := BlockID{45}
	// new left block
	config.mockCrypto.EXPECT().MakeRandomBlockID().Return(id1, nil)
	// the code doesn't distinguish puts for new left blocks, so it
	// will check dirtiness once.
	config.mockBcache.EXPECT().IsDirty(id1).Return(false)
	// new right block
	config.mockCrypto.EXPECT().MakeRandomBlockID().Return(id2, nil)

	config.mockBcache.EXPECT().Put(id1, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		config.mockBcache.EXPECT().Get(id).Return(block, nil)
		config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(id2, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
		config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
	}).Return(nil)
	// next we'll get the right block again
	// then the second half
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), newData[5:10], int64(0)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = data
	}).Return(int64(5))

	setRmdAfterWrite(config, nil)

	if err := config.KBFSOps().Write(p, newData, 1); err != nil {
		t.Errorf("Got error on write: %v", err)
	}
	b, _ := config.BlockCache().Get(rootID)
	newRootBlock := b.(*DirBlock)
	b, _ = config.BlockCache().Get(fileID)
	pblock := b.(*FileBlock)
	b, _ = config.BlockCache().Get(id1)
	block1 := b.(*FileBlock)
	b, _ = config.BlockCache().Get(id2)
	block2 := b.(*FileBlock)

	if len(config.observer.localUpdatePath.Path) != len(p.Path) {
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
}

func TestKBFSOpsWriteOverMultipleBlocks(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, Writer: userID}, Size: 10}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userID, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userID, 6}, 5},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}
	data := []byte{1, 2, 3, 4, 5}
	expectedFullData := []byte{5, 4, 1, 2, 3, 4, 5, 8, 7, 6}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	expectGetBlock(config, id1, block1)
	expectGetBlock(config, id2, block2)
	// only copy the first half first
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), data, int64(2)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block1.Contents[0:2], data[0:3]...)
	}).Return(int64(3))

	// The parent is always dirtied so that we can sync properly later
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		AnyTimes().Return(nil)

	var newBlock1 *FileBlock
	var newBlock2 *FileBlock
	// updated copy of block1
	c1 := config.mockBcache.EXPECT().Put(gomock.Any(), gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
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
		Do(func(id BlockID, block Block, dirty bool) {
		newBlock2 = block.(*FileBlock)
	}).After(c1).Return(nil)

	var newRmd *RootMetadata
	setRmdAfterWrite(config, &newRmd)

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
	checkBlockChange(t, newRmd.data.UnrefBlocks.Changes, p, index, 0, id1)
	checkBlockChange(t, newRmd.data.UnrefBlocks.Changes, p, index, 0, id2)
}

// Read tests check the same error cases, so no need for similar write
// error tests

func TestKBFSOpsTruncateToZeroSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	var newRootBlock *DirBlock
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newRootBlock = block.(*DirBlock)
	}).Return(nil)

	setRmdAfterWrite(config, nil)

	data := []byte{}
	if err := config.KBFSOps().Truncate(p, 0); err != nil {
		t.Errorf("Got error on truncate: %v", err)
	} else if len(config.observer.localUpdatePath.Path) != len(p.Path) {
		t.Errorf("Missing or incorrect local update during truncate: %s",
			config.observer.localUpdatePath)
	} else if !bytesEqual(data, newFileBlock.Contents) {
		t.Errorf("Wrote bad contents: %v", newFileBlock.Contents)
	} else if newRootBlock.Children["f"].Writer != userID {
		t.Errorf("Wrong last writer: %v", newRootBlock.Children["f"].Writer)
	} else if newRootBlock.Children["f"].Size != 0 {
		t.Errorf("Wrong size for written file: %d",
			newRootBlock.Children["f"].Size)
	}
}

func TestKBFSOpsTruncateSameSize(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{BlockPointer: BlockPointer{ID: fileID}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, u, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)

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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).Return(nil)

	setRmdAfterWrite(config, nil)

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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID}, Size: 10}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userID, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userID, 6}, 5},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	expectGetBlock(config, id1, block1)
	var newPBlock *FileBlock
	var newBlock1 *FileBlock
	c1 := config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newPBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(id1, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newBlock1 = block.(*FileBlock)
	}).After(c1).Return(nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).Return(nil)

	var newRmd *RootMetadata
	setRmdAfterWrite(config, &newRmd)

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
	} else if newRmd.UnrefBytes != 0+5+6 {
		// The fileid and both blocks were all modified and marked dirty
		t.Errorf("Truncated block not correctly unref'd, unrefBytes = %d",
			rmd.UnrefBytes)
	}
	checkBlockChange(t, newRmd.data.UnrefBlocks.Changes, p,
		len(p.Path)-1, 0, id2)
}

func TestKBFSOpsTruncateBiggerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["f"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID, QuotaSize: 1}}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.Contents = []byte{1, 2, 3, 4, 5}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "f"}
	p := Path{id, []PathNode{node, fileNode}}

	expectGetBlock(config, rootID, rootBlock)
	expectGetBlock(config, fileID, fileBlock)
	config.mockBsplit.EXPECT().CopyUntilSplit(
		gomock.Any(), gomock.Any(), []byte{0, 0, 0, 0, 0}, int64(5)).
		Do(func(block *FileBlock, lb bool, data []byte, off int64) {
		block.Contents = append(block.Contents, data...)
	}).Return(int64(5))

	var newFileBlock *FileBlock
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newFileBlock = block.(*FileBlock)
	}).Return(nil)
	config.mockBcache.EXPECT().Put(rootID, gomock.Any(), true).Return(nil)

	setRmdAfterWrite(config, nil)

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
	mockCtrl, config := kbfsOpsInit(t, entryType != Sym)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Size: 1, Type: entryType}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootID, rootBlock)

	expectedChanges := 1
	// SetEx() should do nothing for symlinks.
	if entryType == Sym {
		expectedChanges = 0
	}

	var expectedPath Path
	var newRmd *RootMetadata
	var blocks []*DirBlock
	if entryType != Sym {
		// sync block
		blocks = make([]*DirBlock, 2)
		expectedPath, _ = expectSyncBlock(t, config, nil, userID, id, "",
			*p.ParentPath(), rmd, false, 0, 0, 0, nil, &newRmd, blocks)
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
		t.Errorf("got changed=%d, expected %d",
			len(config.observer.batchUpdatePaths), expectedChanges)
	} else {
		if blocks != nil {
			rootBlock = blocks[0]
		}
		if rootBlock.Children["a"].Type != expectedType {
			t.Errorf("a has type %s, expected %s",
				rootBlock.Children["a"].Type, expectedType)
		} else if entryType != Sym {
			// SetEx() should always change the ctime of
			// non-symlinks.
			// pretend it's a rename so only ctime gets checked
			checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
				expectedType, "", true)
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
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootID, rootBlock)
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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: File}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootID, rootBlock)
	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ := expectSyncBlock(t, config, nil, userID, id, "",
		*p.ParentPath(), rmd, false, 0, 0, 0, nil, &newRmd, blocks)
	expectedPath.Path = append(expectedPath.Path, aNode)

	newMtime := time.Now()
	if newP, err := config.KBFSOps().SetMtime(p, &newMtime); err != nil {
		t.Errorf("Got unexpected error on setmtime: %v", err)
	} else if blocks[0].Children["a"].Mtime != newMtime.UnixNano() {
		t.Errorf("a has wrong mtime: %v", blocks[0].Children["a"].Mtime)
	} else {
		checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
			Exec, "", false)
	}
}

func TestSetMtimeNull(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	oldMtime := time.Now().UnixNano()
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: aID}, Type: File, Mtime: oldMtime}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	if newP, err := config.KBFSOps().SetMtime(p, nil); err != nil {
		t.Errorf("Got unexpected error on null setmtime: %v", err)
	} else if rootBlock.Children["a"].Mtime != oldMtime {
		t.Errorf("a has wrong mtime: %v", rootBlock.Children["a"].Mtime)
	} else if newP.Path[0].ID != p.Path[0].ID {
		t.Errorf("Got back a changed path for null setmtime test: %v", newP)
	}
}

func TestMtimeFailNoSuchName(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	expectGetBlock(config, rootID, rootBlock)
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
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{BlockPointer: BlockPointer{ID: aID}}
	aBlock := NewFileBlock().(*FileBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootID).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(aID).AnyTimes().Return(aBlock, nil)

	// sync block
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ := expectSyncBlock(t, config, nil, userID, id, "", p,
		rmd, false, 0, 0, 0, nil, &newRmd, blocks)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else {
		checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
			Exec, "", false)
	}
}

func TestSyncCleanSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, false)
	defer kbfsTestShutdown(mockCtrl, config)

	u, id, _ := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	node := PathNode{BlockPointer{rootID, 0, 0, u, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, u, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aID).Return(false)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if len(newP.Path) != len(p.Path) {
		// should be the exact same path back
		t.Errorf("Got a different length path back: %v", newP)
	} else {
		for i, n := range newP.Path {
			if n != p.Path[i] {
				t.Errorf("Node %d differed: %v", i, n)
			}
		}
	}
}

func expectSyncDirtyBlock(config *ConfigMock, id BlockID, block *FileBlock,
	splitAt int64, padSize int) *gomock.Call {
	config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(id).AnyTimes().Return(block, nil)
	c1 := config.mockBsplit.EXPECT().CheckSplit(block).Return(splitAt)

	newID := BlockID{id[0] + 100}
	// Ideally, we'd use the size of block.Contents at the time
	// that Ready() is called, but GoMock isn't expressive enough
	// for that.
	newEncBuf := make([]byte, len(block.Contents)+padSize)
	config.mockCrypto.EXPECT().MakeRandomBlockCryptKeyServerHalf().Return(BlockCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(BlockCryptKeyServerHalf{}, TLFCryptKey{}).Return(BlockCryptKey{}, nil)
	c2 := config.mockBops.EXPECT().Ready(block, BlockCryptKey{}).
		After(c1).Return(newID, len(block.Contents), newEncBuf, nil)
	config.mockBcache.EXPECT().Finalize(id, newID).After(c2).Return(nil)
	config.mockBops.EXPECT().Put(newID, gomock.Any(), newEncBuf).Return(nil)
	config.mockKops.EXPECT().PutBlockCryptKeyServerHalf(newID, BlockCryptKeyServerHalf{}).Return(nil)
	config.mockKcache.EXPECT().PutBlockCryptKey(newID, BlockCryptKey{}).Return(nil)
	return c2
}

func TestSyncDirtyMultiBlocksSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	id3 := BlockID{46}
	id4 := BlockID{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userID, 5}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, keybase1.MakeTestUID(0), 0}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userID, 7}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userID, 0}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{10, 9, 8, 7, 6}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{10, 9, 8, 7, 6}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(id1).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(id3).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(rootID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootID).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileID).AnyTimes().Return(fileBlock, nil)

	// the split is good
	expectGetTLFCryptKey(config)
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
			BlockID{id2[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id4[0] + 100})
	}
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userID, id, "", p, rmd, false, 0,
			refBytes, unrefBytes, f, &newRmd, blocks)
	config.mockBcache.EXPECT().Finalize(
		fileID, expectedPath.Path[len(expectedPath.Path)-1].ID)
	config.mockBcache.EXPECT().Finalize(
		rootID, expectedPath.Path[len(expectedPath.Path)-2].ID)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if fileBlock.IPtrs[0].QuotaSize != 5 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[1].Writer != userID {
		t.Errorf("Got unexpected writer: %s", fileBlock.IPtrs[1].Writer)
	} else if fileBlock.IPtrs[1].QuotaSize != 10 {
		t.Errorf("Indirect pointer quota size2 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[2].QuotaSize != 7 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[2].QuotaSize)
	} else if fileBlock.IPtrs[3].QuotaSize != 13 {
		t.Errorf("Indirect pointer quota size4 wrong: %d", fileBlock.IPtrs[3].QuotaSize)
	} else {
		checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
			Exec, "", false)
	}
}

func TestSyncDirtyMultiBlocksSplitInBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	id3 := BlockID{46}
	id4 := BlockID{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userID, 10}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userID, 0}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userID, 0}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userID, 0}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(id1).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(id3).Times(2).Return(false)
	config.mockBcache.EXPECT().IsDirty(id4).AnyTimes().Return(false)
	config.mockBcache.EXPECT().IsDirty(rootID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootID).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileID).AnyTimes().Return(fileBlock, nil)
	config.mockBcache.EXPECT().Get(id3).Return(block3, nil)
	expectGetTLFCryptKey(config)

	// the split is in the middle
	pad2 := 0
	pad3 := 14
	extraBytesFor3 := 2
	expectSyncDirtyBlock(config, id2, block2,
		int64(len(block2.Contents)-extraBytesFor3), pad2)
	// this causes block 3 to be updated
	var newBlock3 *FileBlock
	config.mockBcache.EXPECT().Put(id3, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newBlock3 = block.(*FileBlock)
		// id3 syncs just fine
		config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
		expectSyncDirtyBlock(config, id3, newBlock3, int64(0), pad3)
	}).Return(nil)

	// id4 is the final block, and the split causes a new block to be made
	pad4 := 9
	pad5 := 1
	c4 := expectSyncDirtyBlock(config, id4, block4, int64(3), pad4)
	var newID5 BlockID
	var newBlock5 *FileBlock
	id5 := BlockID{48}
	config.mockCrypto.EXPECT().MakeRandomBlockID().Return(id5, nil)
	config.mockBcache.EXPECT().Put(id5, gomock.Any(), true).
		Do(func(id BlockID, block Block, dirty bool) {
		newID5 = id
		newBlock5 = block.(*FileBlock)
		// id5 syncs just fine
		expectSyncDirtyBlock(config, id, newBlock5, int64(0), pad5)
		config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(true)
	}).Return(nil)

	// The parent is dirtied too since the pointers changed
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		AnyTimes().Return(nil)

	// sync block contents and their padding sizes
	refBytes := uint64((len(block2.Contents) + pad2) +
		(len(block3.Contents) + extraBytesFor3 + pad3) +
		(len(block4.Contents) + pad4) + pad5)
	unrefBytes := uint64(0) // no quota sizes on dirty blocks
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id2[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id3[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id4[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{newID5[0] + 100})
	}
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ :=
		expectSyncBlock(t, config, c4, userID, id, "", p, rmd, false, 0,
			refBytes, unrefBytes, f, &newRmd, blocks)

	newID2 := BlockID{id2[0] + 100}
	newID3 := BlockID{id3[0] + 100}
	newID4 := BlockID{id4[0] + 100}

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if len(fileBlock.IPtrs) != 5 {
		t.Errorf("Wrong number of indirect pointers: %d", len(fileBlock.IPtrs))
	} else if fileBlock.IPtrs[0].ID != id1 {
		t.Errorf("Indirect pointer id1 wrong: %v", fileBlock.IPtrs[0].ID)
	} else if fileBlock.IPtrs[0].QuotaSize != 10 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[0].Off != 0 {
		t.Errorf("Indirect pointer off1 wrong: %d", fileBlock.IPtrs[0].Off)
	} else if fileBlock.IPtrs[1].ID != newID2 {
		t.Errorf("Indirect pointer id2 wrong: %v", fileBlock.IPtrs[1].ID)
	} else if fileBlock.IPtrs[1].QuotaSize != 5 {
		t.Errorf("Indirect pointer quota size2 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[1].Off != 5 {
		t.Errorf("Indirect pointer off2 wrong: %d", fileBlock.IPtrs[1].Off)
	} else if fileBlock.IPtrs[2].ID != newID3 {
		t.Errorf("Indirect pointer id3 wrong: %v", fileBlock.IPtrs[2].ID)
	} else if fileBlock.IPtrs[2].QuotaSize != 21 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[2].QuotaSize)
	} else if fileBlock.IPtrs[2].Off != 8 {
		t.Errorf("Indirect pointer off3 wrong: %d", fileBlock.IPtrs[2].Off)
	} else if fileBlock.IPtrs[3].ID != newID4 {
		t.Errorf("Indirect pointer id4 wrong: %v", fileBlock.IPtrs[3].ID)
	} else if fileBlock.IPtrs[3].QuotaSize != 14 {
		t.Errorf("Indirect pointer quota size4 wrong: %d", fileBlock.IPtrs[3].QuotaSize)
	} else if fileBlock.IPtrs[3].Off != 15 {
		t.Errorf("Indirect pointer off4 wrong: %d", fileBlock.IPtrs[3].Off)
	} else if fileBlock.IPtrs[4].ID != (BlockID{newID5[0] + 100}) {
		t.Errorf("Indirect pointer id5 wrong: %v", fileBlock.IPtrs[4].ID)
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
		checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
			Exec, "", false)
	}
}

func TestSyncDirtyMultiBlocksCopyNextBlockSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	fileID := BlockID{43}
	id1 := BlockID{44}
	id2 := BlockID{45}
	id3 := BlockID{46}
	id4 := BlockID{47}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{
		BlockPointer: BlockPointer{ID: fileID}, Size: 20}
	fileBlock := NewFileBlock().(*FileBlock)
	fileBlock.IsInd = true
	fileBlock.IPtrs = []IndirectFilePtr{
		IndirectFilePtr{BlockPointer{id1, 0, 0, userID, 0}, 0},
		IndirectFilePtr{BlockPointer{id2, 0, 0, userID, 10}, 5},
		IndirectFilePtr{BlockPointer{id3, 0, 0, userID, 0}, 10},
		IndirectFilePtr{BlockPointer{id4, 0, 0, userID, 15}, 15},
	}
	block1 := NewFileBlock().(*FileBlock)
	block1.Contents = []byte{5, 4, 3, 2, 1}
	block2 := NewFileBlock().(*FileBlock)
	block2.Contents = []byte{10, 9, 8, 7, 6}
	block3 := NewFileBlock().(*FileBlock)
	block3.Contents = []byte{15, 14, 13, 12, 11}
	block4 := NewFileBlock().(*FileBlock)
	block4.Contents = []byte{20, 19, 18, 17, 16}
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	fileNode := PathNode{BlockPointer{fileID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, fileNode}}

	// fsync a, only block 2 is dirty
	config.mockBcache.EXPECT().IsDirty(fileID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootID).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(fileID).AnyTimes().Return(fileBlock, nil)
	config.mockBcache.EXPECT().Get(id2).Return(block2, nil)
	config.mockBcache.EXPECT().IsDirty(id2).AnyTimes().Return(false)
	config.mockBcache.EXPECT().Get(id4).Return(block4, nil)
	config.mockBcache.EXPECT().IsDirty(id4).Times(2).Return(false)
	expectGetTLFCryptKey(config)

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
		Do(func(id BlockID, block Block, dirty bool) {
		newBlock4 = block.(*FileBlock)
		// now block 4 is dirty, but it's the end of the line,
		// so nothing else to do
		expectSyncDirtyBlock(config, id4, newBlock4, int64(-1), pad4)
		config.mockBcache.EXPECT().IsDirty(id).AnyTimes().Return(false)
	}).Return(nil)

	// The parent is dirtied too since the pointers changed
	config.mockBcache.EXPECT().Put(fileID, gomock.Any(), true).
		AnyTimes().Return(nil)

	// sync block
	refBytes := uint64((len(block1.Contents) + pad1) +
		(len(block3.Contents) + pad3) +
		(len(block4.Contents) - int(split4At) + pad4))
	unrefBytes := uint64(10 + 15) // id2 and id4
	f := func(md *RootMetadata) {
		index := len(p.Path) - 1
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id1[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id3[0] + 100})
		checkBlockChange(t, md.data.RefBlocks.Changes, p, index, 0,
			BlockID{id4[0] + 100})
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id2)
		checkBlockChange(t, md.data.UnrefBlocks.Changes, p, index, 0, id4)
	}
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, _ :=
		expectSyncBlock(t, config, nil, userID, id, "", p, rmd, false, 0,
			refBytes, unrefBytes, f, &newRmd, blocks)

	newID1 := BlockID{id1[0] + 100}
	newID3 := BlockID{id3[0] + 100}
	newID4 := BlockID{id4[0] + 100}

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if len(fileBlock.IPtrs) != 3 {
		t.Errorf("Wrong number of indirect pointers: %d", len(fileBlock.IPtrs))
	} else if fileBlock.IPtrs[0].ID != newID1 {
		t.Errorf("Indirect pointer id1 wrong: %v", fileBlock.IPtrs[0].ID)
	} else if fileBlock.IPtrs[0].QuotaSize != 19 {
		t.Errorf("Indirect pointer quota size1 wrong: %d", fileBlock.IPtrs[0].QuotaSize)
	} else if fileBlock.IPtrs[0].Off != 0 {
		t.Errorf("Indirect pointer off1 wrong: %d", fileBlock.IPtrs[0].Off)
	} else if fileBlock.IPtrs[1].ID != newID3 {
		t.Errorf("Indirect pointer id3 wrong: %v", fileBlock.IPtrs[1].ID)
	} else if fileBlock.IPtrs[1].QuotaSize != 15 {
		t.Errorf("Indirect pointer quota size3 wrong: %d", fileBlock.IPtrs[1].QuotaSize)
	} else if fileBlock.IPtrs[1].Off != 10 {
		t.Errorf("Indirect pointer off3 wrong: %d", fileBlock.IPtrs[1].Off)
	} else if fileBlock.IPtrs[2].ID != newID4 {
		t.Errorf("Indirect pointer id4 wrong: %v", fileBlock.IPtrs[2].ID)
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
		checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
			Exec, "", false)
	}
}

func TestSyncDirtyWithBlockChangePointerSuccess(t *testing.T) {
	mockCtrl, config := kbfsOpsInit(t, true)
	defer kbfsTestShutdown(mockCtrl, config)

	userID, id, rmd := makeIDAndRMD(config)

	rootID := BlockID{42}
	aID := BlockID{43}
	rootBlock := NewDirBlock().(*DirBlock)
	rootBlock.Children["a"] = DirEntry{BlockPointer: BlockPointer{ID: aID}}
	aBlock := NewFileBlock().(*FileBlock)
	node := PathNode{BlockPointer{rootID, 0, 0, userID, 0}, ""}
	aNode := PathNode{BlockPointer{aID, 0, 0, userID, 0}, "a"}
	p := Path{id, []PathNode{node, aNode}}

	// fsync a
	config.mockBcache.EXPECT().IsDirty(aID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().IsDirty(rootID).AnyTimes().Return(true)
	config.mockBcache.EXPECT().Get(rootID).AnyTimes().Return(rootBlock, nil)
	config.mockBcache.EXPECT().Get(aID).AnyTimes().Return(aBlock, nil)

	// override the AnyTimes expect call done by default in expectSyncBlock()
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		AnyTimes().Return(false)

	// sync block
	refBytes := uint64(1 + 1) // 2 ref/unref blocks of 1 byte each
	var newRmd *RootMetadata
	blocks := make([]*DirBlock, 2)
	expectedPath, lastCall := expectSyncBlock(t, config, nil, userID, id, "", p,
		rmd, false, 0, refBytes, 0, nil, &newRmd, blocks)

	// expected calls for ref block changes blocks
	refBlockID := BlockID{253}
	refPlainSize := 1
	refBuf := []byte{253}
	config.mockCrypto.EXPECT().MakeRandomBlockCryptKeyServerHalf().Return(BlockCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(BlockCryptKeyServerHalf{}, TLFCryptKey{}).Return(BlockCryptKey{}, nil)
	lastCall = config.mockBops.EXPECT().Ready(gomock.Any(), BlockCryptKey{}).Return(
		refBlockID, refPlainSize, refBuf, nil).After(lastCall)
	config.mockBops.EXPECT().Put(refBlockID, gomock.Any(), refBuf).Return(nil)
	config.mockBcache.EXPECT().Put(refBlockID, gomock.Any(), false).Return(nil)
	config.mockKops.EXPECT().PutBlockCryptKeyServerHalf(refBlockID, BlockCryptKeyServerHalf{}).Return(nil)
	config.mockKcache.EXPECT().PutBlockCryptKey(refBlockID, BlockCryptKey{}).Return(nil)

	unrefBlockID := BlockID{254}
	unrefPlainSize := 0
	unrefBuf := []byte{254}
	config.mockCrypto.EXPECT().MakeRandomBlockCryptKeyServerHalf().Return(BlockCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(BlockCryptKeyServerHalf{}, TLFCryptKey{}).Return(BlockCryptKey{}, nil)
	lastCall = config.mockBops.EXPECT().Ready(gomock.Any(), BlockCryptKey{}).Return(
		unrefBlockID, unrefPlainSize, unrefBuf, nil).After(lastCall)
	config.mockBops.EXPECT().Put(unrefBlockID, gomock.Any(), unrefBuf).
		Return(nil)
	config.mockBcache.EXPECT().Put(unrefBlockID, gomock.Any(), false).
		Return(nil)
	config.mockKops.EXPECT().PutBlockCryptKeyServerHalf(unrefBlockID, BlockCryptKeyServerHalf{}).Return(nil)
	config.mockKcache.EXPECT().PutBlockCryptKey(unrefBlockID, BlockCryptKey{}).Return(nil)

	if newP, err := config.KBFSOps().Sync(p); err != nil {
		t.Errorf("Got unexpected error on sync: %v", err)
	} else if newRmd.data.RefBlocks.Pointer.ID != refBlockID {
		t.Errorf("Got unexpected refBlocks pointer: %v vs %v",
			newRmd.data.RefBlocks.Pointer.ID, refBlockID)
	} else if newRmd.data.UnrefBlocks.Pointer.ID != unrefBlockID {
		t.Errorf("Got unexpected unrefBlocks pointer: %v vs %v",
			newRmd.data.UnrefBlocks.Pointer.ID, unrefBlockID)
	} else {
		checkNewPath(t, config, newP, expectedPath, newRmd, blocks,
			Exec, "", false)
	}
}
