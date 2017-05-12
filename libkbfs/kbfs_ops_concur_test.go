// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"errors"
	"fmt"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

// CounterLock keeps track of the number of lock attempts
type CounterLock struct {
	countLock sync.Mutex
	realLock  sync.Mutex
	count     int
}

func (cl *CounterLock) Lock() {
	cl.countLock.Lock()
	cl.count++
	cl.countLock.Unlock()
	cl.realLock.Lock()
}

func (cl *CounterLock) Unlock() {
	cl.realLock.Unlock()
}

func (cl *CounterLock) GetCount() int {
	cl.countLock.Lock()
	defer cl.countLock.Unlock()
	return cl.count
}

func kbfsOpsConcurInit(t *testing.T, users ...libkb.NormalizedUsername) (
	*ConfigLocal, keybase1.UID, context.Context, context.CancelFunc) {
	return kbfsOpsInitNoMocks(t, users...)
}

func kbfsConcurTestShutdown(t *testing.T, config *ConfigLocal,
	ctx context.Context, cancel context.CancelFunc) {
	kbfsTestShutdownNoMocks(t, config, ctx, cancel)
}

// TODO: Get rid of all users of this.
func kbfsConcurTestShutdownNoCheck(t *testing.T, config *ConfigLocal,
	ctx context.Context, cancel context.CancelFunc) {
	kbfsTestShutdownNoMocksNoCheck(t, config, ctx, cancel)
}

// Test that only one of two concurrent GetRootMD requests can end up
// fetching the MD from the server.  The second one should wait, and
// then get it from the MD cache.
func TestKBFSOpsConcurDoubleMDGet(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onGetStalledCh, getUnstallCh, ctxStallGetForTLF :=
		StallMDOp(ctx, config, StallableMDGetForTLF, 1)

	// Initialize the MD using a different config
	c2 := ConfigAsUser(config, "test_user")
	defer CheckConfigAndShutdown(ctx, t, c2)
	rootNode := GetRootNodeOrBust(ctx, t, c2, "test_user", false)

	n := 10
	c := make(chan error, n)
	cl := &CounterLock{}
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	ops.mdWriterLock.locker = cl
	for i := 0; i < n; i++ {
		go func() {
			_, _, _, err := ops.getRootNode(ctxStallGetForTLF)
			c <- err
		}()
	}

	// wait until the first one starts the get
	<-onGetStalledCh
	// make sure that the second goroutine has also started its write
	// call, and thus must be queued behind the first one (since we
	// are guaranteed the first one is currently running, and they
	// both need the same lock).
	for cl.GetCount() < 2 {
		runtime.Gosched()
	}
	// Now let the first one complete.  The second one should find the
	// MD in the cache, and thus never call MDOps.Get().
	close(getUnstallCh)
	for i := 0; i < n; i++ {
		err := <-c
		if err != nil {
			t.Errorf("Got an error doing concurrent MD gets: err=(%s)", err)
		}
	}
}

// Test that a read can happen concurrently with a sync
func TestKBFSOpsConcurReadDuringSync(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.SyncAll(putCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh

	// now make sure we can read the file and see the byte we wrote
	buf := make([]byte, 1)
	nr, err := kbfsOps.Read(ctx, fileNode, buf, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v\n", err)
	}
	if nr != 1 || !bytes.Equal(data, buf) {
		t.Errorf("Got wrong data %v; expected %v", buf, data)
	}

	// now unblock Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}
}

func testCalcNumFileBlocks(dataLen int, bsplitter *BlockSplitterSimple) int {
	nChildBlocks := 1 + dataLen/int(bsplitter.maxSize)
	nFileBlocks := nChildBlocks
	for nChildBlocks > 1 {
		parentBlocks := 0
		// Add parent blocks for each level of the tree.
		for i := 0; i < nChildBlocks; i += bsplitter.MaxPtrsPerBlock() {
			parentBlocks++
		}
		nFileBlocks += parentBlocks
		nChildBlocks = parentBlocks
	}
	return nFileBlocks
}

// Test that writes can happen concurrently with a sync
func testKBFSOpsConcurWritesDuringSync(t *testing.T,
	initialWriteBytes int, nOneByteWrites int, nFiles int) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	fileNodes := make([]Node, nFiles)
	kbfsOps := config.KBFSOps()
	for i := 0; i < nFiles; i++ {
		name := fmt.Sprintf("file%d", i)
		fileNode, _, err := kbfsOps.CreateFile(
			ctx, rootNode, name, false, NoExcl)
		if err != nil {
			t.Fatalf("Couldn't create file %s: %v", name, err)
		}
		fileNodes[i] = fileNode
	}

	expectedData := make([][]byte, len(fileNodes))
	for i, fileNode := range fileNodes {
		data := make([]byte, initialWriteBytes)
		for j := 0; j < initialWriteBytes; j++ {
			data[j] = byte(initialWriteBytes * (i + 1))
		}
		err = kbfsOps.Write(ctx, fileNode, data, 0)
		if err != nil {
			t.Errorf("Couldn't write file: %v", err)
		}
		expectedData[i] = make([]byte, len(data))
		copy(expectedData[i], data)
	}

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.SyncAll(putCtx, fileNodes[0].GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	select {
	case <-onPutStalledCh:
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for stall")
	}

	for i, fileNode := range fileNodes {
		for j := 0; j < nOneByteWrites; j++ {
			// now make sure we can write the file and see the new
			// byte we wrote
			newData := []byte{byte(nOneByteWrites * (j + 2))}
			err = kbfsOps.Write(ctx, fileNode, newData,
				int64(j+initialWriteBytes))
			if err != nil {
				t.Errorf("Couldn't write data: %v\n", err)
			}

			// read the data back
			buf := make([]byte, j+1+initialWriteBytes)
			nr, err := kbfsOps.Read(ctx, fileNode, buf, 0)
			if err != nil {
				t.Errorf("Couldn't read data: %v\n", err)
			}
			expectedData[i] = append(expectedData[i], newData...)
			if nr != int64(j+1+initialWriteBytes) ||
				!bytes.Equal(expectedData[i], buf) {
				t.Errorf("Got wrong data %v; expected %v", buf, expectedData[i])
			}
		}
	}

	// now unblock Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}

	// finally, make sure we can still read it after the sync too
	// (even though the second write hasn't been sync'd yet)
	totalSize := nOneByteWrites + initialWriteBytes
	for i, fileNode := range fileNodes {
		buf2 := make([]byte, totalSize)
		nr, err := kbfsOps.Read(ctx, fileNode, buf2, 0)
		if err != nil {
			t.Errorf("Couldn't read data: %v\n", err)
		}
		if nr != int64(totalSize) ||
			!bytes.Equal(expectedData[i], buf2) {
			t.Errorf("2nd read: Got wrong data %v; expected %v",
				buf2, expectedData[i])
		}
	}

	// there should be 4+n clean blocks at this point: the original
	// root block + 2 modifications (create + write), the empty file
	// block, the n initial modification blocks plus top block (if
	// applicable).
	bcs := config.BlockCache().(*BlockCacheStandard)
	numCleanBlocks := bcs.cleanTransient.Len()
	nFileBlocks := testCalcNumFileBlocks(initialWriteBytes, bsplitter)
	if g, e := numCleanBlocks, 4+nFileBlocks; g != e {
		t.Logf("Unexpected number of cached clean blocks: %d vs %d (%d vs %d)", g, e, totalSize, bsplitter.maxSize)
	}

	err = kbfsOps.SyncAll(ctx, fileNodes[0].GetFolderBranch())
	if err != nil {
		t.Fatalf("Final sync failed: %v", err)
	}

	for _, fileNode := range fileNodes {
		if ei, err := kbfsOps.Stat(ctx, fileNode); err != nil {
			t.Fatalf("Couldn't stat: %v", err)
		} else if g, e := ei.Size, uint64(totalSize); g != e {
			t.Fatalf("Unexpected size: %d vs %d", g, e)
		}
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*DirtyBlockCacheStandard)
	numDirtyBlocks := len(dbcs.cache)
	if numDirtyBlocks != 0 {
		t.Errorf("%d dirty blocks left after final sync", numDirtyBlocks)
	}
}

// Test that a write can happen concurrently with a sync
func TestKBFSOpsConcurWriteDuringSync(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 1, 1, 1)
}

// Test that multiple writes can happen concurrently with a sync
// (regression for KBFS-616)
func TestKBFSOpsConcurMultipleWritesDuringSync(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 1, 10, 1)
}

// Test that multiple indirect writes can happen concurrently with a
// sync (regression for KBFS-661)
func TestKBFSOpsConcurMultipleIndirectWritesDuringSync(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 25, 50, 1)
}

// Test that a write can happen concurrently with a sync all of two files.
func TestKBFSOpsConcurWriteDuringSyncAllTwoFiles(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 1, 1, 2)
}

// Test that a write can happen concurrently with a sync all of ten files.
func TestKBFSOpsConcurWriteDuringSyncAllTenFiles(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 1, 1, 10)
}

// Test that writes that happen concurrently with a sync, which write
// to the same block, work correctly.
func TestKBFSOpsConcurDeferredDoubleWritesDuringSync(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	var data []byte
	// Write 2 blocks worth of data
	for i := 0; i < 30; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Sync the initial two data blocks
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Initial sync failed: %v", err)
	}

	// Now dirty the first block.
	newData1 := make([]byte, 10)
	copy(newData1, data[20:])
	err = kbfsOps.Write(ctx, fileNode, newData1, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.SyncAll(putCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh

	// Now dirty the second block, twice.
	newData2 := make([]byte, 10)
	copy(newData2, data[:10])
	err = kbfsOps.Write(ctx, fileNode, newData2, 20)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}
	err = kbfsOps.Write(ctx, fileNode, newData2, 30)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// now unblock Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}

	expectedData := make([]byte, 40)
	copy(expectedData[:10], newData1)
	copy(expectedData[10:20], data[10:20])
	copy(expectedData[20:30], newData2)
	copy(expectedData[30:40], newData2)

	gotData := make([]byte, 40)
	nr, err := kbfsOps.Read(ctx, fileNode, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(expectedData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", expectedData, gotData)
	}

	// Final sync
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Final sync failed: %v", err)
	}

	gotData = make([]byte, 40)
	nr, err = kbfsOps.Read(ctx, fileNode, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(expectedData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", expectedData, gotData)
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*DirtyBlockCacheStandard)
	numDirtyBlocks := len(dbcs.cache)
	if numDirtyBlocks != 0 {
		t.Errorf("%d dirty blocks left after final sync", numDirtyBlocks)
	}
}

// Test that a block write can happen concurrently with a block
// read. This is a regression test for KBFS-536.
func TestKBFSOpsConcurBlockReadWrite(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	// TODO: Use kbfsConcurTestShutdown.
	defer kbfsConcurTestShutdownNoCheck(t, config, ctx, cancel)

	// Turn off transient block caching.
	config.SetBlockCache(NewBlockCacheStandard(0, 1<<30))

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	onReadStalledCh, readUnstallCh, ctxStallRead :=
		StallBlockOp(ctx, config, StallableBlockGet, 1)
	onWriteStalledCh, writeUnstallCh, ctxStallWrite :=
		StallBlockOp(ctx, config, StallableBlockGet, 1)

	var wg sync.WaitGroup

	// Start the read and wait for it to stall.
	wg.Add(1)
	var readErr error
	go func() {
		defer wg.Done()

		_, readErr = kbfsOps.GetDirChildren(ctxStallRead, rootNode)
	}()
	<-onReadStalledCh

	// Start the write and wait for it to stall.
	wg.Add(1)
	var writeErr error
	go func() {
		defer wg.Done()

		data := []byte{1}
		writeErr = kbfsOps.Write(ctxStallWrite, fileNode, data, 0)
	}()
	<-onWriteStalledCh

	// Unstall the read, which shouldn't blow up.
	close(readUnstallCh)

	// Finally, unstall the write.
	close(writeUnstallCh)

	wg.Wait()

	// Do these in the main goroutine since t isn't goroutine
	// safe, and do these after wg.Wait() since we only know
	// they're set after the goroutines exit.
	if readErr != nil {
		t.Errorf("Couldn't get children: %v", readErr)
	}
	if writeErr != nil {
		t.Errorf("Couldn't write file: %v", writeErr)
	}
}

// mdRecordingKeyManager records the last KeyMetadata argument seen
// in its KeyManager methods.
type mdRecordingKeyManager struct {
	lastKMDMu sync.RWMutex
	lastKMD   KeyMetadata
	delegate  KeyManager
}

func (km *mdRecordingKeyManager) getLastKMD() KeyMetadata {
	km.lastKMDMu.RLock()
	defer km.lastKMDMu.RUnlock()
	return km.lastKMD
}

func (km *mdRecordingKeyManager) setLastKMD(kmd KeyMetadata) {
	km.lastKMDMu.Lock()
	defer km.lastKMDMu.Unlock()
	km.lastKMD = kmd
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForEncryption(
	ctx context.Context, kmd KeyMetadata) (kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmd)
	return km.delegate.GetTLFCryptKeyForEncryption(ctx, kmd)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, kmdToDecrypt, kmdWithKeys KeyMetadata) (
	kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmdToDecrypt)
	return km.delegate.GetTLFCryptKeyForMDDecryption(ctx,
		kmdToDecrypt, kmdWithKeys)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer) (
	kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmd)
	return km.delegate.GetTLFCryptKeyForBlockDecryption(ctx, kmd, blockPtr)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyOfAllGenerations(
	ctx context.Context, kmd KeyMetadata) (
	keys []kbfscrypto.TLFCryptKey, err error) {
	km.setLastKMD(kmd)
	return km.delegate.GetTLFCryptKeyOfAllGenerations(ctx, kmd)
}

func (km *mdRecordingKeyManager) Rekey(
	ctx context.Context, md *RootMetadata, promptPaper bool) (
	bool, *kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(md)
	return km.delegate.Rekey(ctx, md, promptPaper)
}

// Test that a sync can happen concurrently with a write. This is a
// regression test for KBFS-558.
func TestKBFSOpsConcurBlockSyncWrite(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	// TODO: Use kbfsConcurTestShutdown.
	defer kbfsConcurTestShutdownNoCheck(t, config, ctx, cancel)

	km := &mdRecordingKeyManager{delegate: config.KeyManager()}

	config.SetKeyManager(km)

	// Turn off block caching.
	config.SetBlockCache(NewBlockCacheStandard(0, 1<<30))

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Write to file to mark it dirty.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %v", err)
	}

	lState := makeFBOLockState()

	fbo := kbfsOps.(*KBFSOpsStandard).getOpsNoAdd(rootNode.GetFolderBranch())
	if fbo.blocks.GetState(lState) != dirtyState {
		t.Fatal("Unexpectedly not in dirty state")
	}

	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, 1)

	var wg sync.WaitGroup

	// Start the sync and wait for it to stall (on getting the dir
	// block).
	wg.Add(1)
	var syncErr error
	go func() {
		defer wg.Done()

		syncErr = kbfsOps.SyncAll(ctxStallSync, fileNode.GetFolderBranch())
	}()
	<-onSyncStalledCh

	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	deferredWriteCount := fbo.blocks.getDeferredWriteCountForTest(lState)
	if deferredWriteCount != 1 {
		t.Errorf("Unexpected deferred write count %d",
			deferredWriteCount)
	}

	// Unstall the sync.
	close(syncUnstallCh)

	wg.Wait()

	// Do this in the main goroutine since t isn't goroutine safe,
	// and do this after wg.Wait() since we only know it's set
	// after the goroutine exits.
	if syncErr != nil {
		t.Errorf("Couldn't sync: %v", syncErr)
	}

	md, err := fbo.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
	if err != nil {
		t.Errorf("Couldn't get MD: %v", err)
	}

	lastKMD := km.getLastKMD()

	if md.ReadOnlyRootMetadata != lastKMD {
		t.Error("Last MD seen by key manager != head")
	}
}

// Test that a sync can happen concurrently with a truncate. This is a
// regression test for KBFS-558.
func TestKBFSOpsConcurBlockSyncTruncate(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	km := &mdRecordingKeyManager{delegate: config.KeyManager()}

	config.SetKeyManager(km)

	// Turn off block caching.
	config.SetBlockCache(NewBlockCacheStandard(0, 1<<30))

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Write to file to mark it dirty.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %v", err)
	}

	lState := makeFBOLockState()

	fbo := kbfsOps.(*KBFSOpsStandard).getOpsNoAdd(rootNode.GetFolderBranch())
	if fbo.blocks.GetState(lState) != dirtyState {
		t.Fatal("Unexpectedly not in dirty state")
	}

	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, 1)

	// Start the sync and wait for it to stall (on getting the dir
	// block).
	syncErrCh := make(chan error, 1)
	go func() {
		syncErrCh <- kbfsOps.SyncAll(ctxStallSync, fileNode.GetFolderBranch())
	}()
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for sync to stall: %v", ctx.Err())
	}

	err = kbfsOps.Truncate(ctx, fileNode, 0)
	if err != nil {
		t.Errorf("Couldn't truncate file: %v", err)
	}

	deferredWriteCount := fbo.blocks.getDeferredWriteCountForTest(lState)
	if deferredWriteCount != 1 {
		t.Errorf("Unexpected deferred write count %d",
			deferredWriteCount)
	}

	// Unstall the sync.
	close(syncUnstallCh)

	// Do this in the main goroutine since it isn't goroutine safe,
	// and do this after wg.Wait() since we only know it's set
	// after the goroutine exits.
	select {
	case syncErr := <-syncErrCh:
		if syncErr != nil {
			t.Errorf("Couldn't sync: %v", syncErr)
		}
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for sync: %v", ctx.Err())
	}

	md, err := fbo.getMDForReadLocked(ctx, lState, mdReadNeedIdentify)
	if err != nil {
		t.Errorf("Couldn't get MD: %v", err)
	}

	lastKMD := km.getLastKMD()

	if md.ReadOnlyRootMetadata != lastKMD {
		t.Error("Last MD seen by key manager != head")
	}
}

// Tests that a file that has been truncate-extended and overwritten
// to several times can sync, and then take several deferred
// overwrites, plus one write that blocks until the dirty bcache has
// room.  This is a repro for KBFS-1846.
func TestKBFSOpsTruncateAndOverwriteDeferredWithArchivedBlock(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(t, config, ctx, cancel)

	bsplitter, err := NewBlockSplitterSimple(MaxBlockSizeBytesDefault, 8*1024,
		config.Codec())
	if err != nil {
		t.Fatal(err)
	}
	config.SetBlockSplitter(bsplitter)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	err = kbfsOps.Truncate(ctx, fileNode, 131072)
	if err != nil {
		t.Fatalf("Couldn't truncate file: %+v", err)
	}

	// Write a few blocks
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	err = kbfsOps.Write(ctx, fileNode, data[0:3], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.Write(ctx, fileNode, data[3:6], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.Write(ctx, fileNode, data[6:9], 0)
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

	fileNode2, _, err := kbfsOps.CreateFile(ctx, rootNode, "b", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %+v", err)
	}

	err = kbfsOps.Truncate(ctx, fileNode2, 131072)
	if err != nil {
		t.Fatalf("Couldn't truncate file: %+v", err)
	}

	// Now write the original first block, which has been archived,
	// and make sure it works.
	err = kbfsOps.Write(ctx, fileNode2, data[0:3], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.Write(ctx, fileNode2, data[3:6], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.Write(ctx, fileNode2, data[6:9], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	oldBServer := config.BlockServer()
	defer config.SetBlockServer(oldBServer)
	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, 1)

	// Start the sync and wait for it to stall (on getting the dir
	// block).
	syncErrCh := make(chan error, 1)
	go func() {
		syncErrCh <- kbfsOps.SyncAll(ctxStallSync, fileNode2.GetFolderBranch())
	}()
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for sync to stall: %v", ctx.Err())
	}

	err = kbfsOps.Write(ctx, fileNode2, data[1:4], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	err = kbfsOps.Write(ctx, fileNode2, data[4:7], 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %+v", err)
	}

	// The last write blocks because the dirty buffer is now full.
	writeErrCh := make(chan error, 1)
	go func() {
		writeErrCh <- kbfsOps.Write(ctx, fileNode2, data[7:10], 0)
	}()

	// Unstall the sync.
	close(syncUnstallCh)

	// Do this in the main goroutine since it isn't goroutine safe,
	// and do this after wg.Wait() since we only know it's set
	// after the goroutine exits.
	select {
	case syncErr := <-syncErrCh:
		if syncErr != nil {
			t.Errorf("Couldn't sync: %v", syncErr)
		}
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for sync: %v", ctx.Err())
	}

	select {
	case writeErr := <-writeErrCh:
		if writeErr != nil {
			t.Errorf("Couldn't write file: %v", writeErr)
		}
	case <-ctx.Done():
		t.Fatalf("Timeout waiting for write: %v", ctx.Err())
	}

	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %+v", err)
	}
}

// Test that a sync can happen concurrently with a read for a file
// large enough to have indirect blocks without messing anything
// up. This should pass with -race. This is a regression test for
// KBFS-537.
func TestKBFSOpsConcurBlockSyncReadIndirect(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// Turn off block caching.
	config.SetBlockCache(NewBlockCacheStandard(0, 1<<30))

	// Use the smallest block size possible.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	// Write to file to make an indirect block.
	data := make([]byte, bsplitter.maxSize+1)
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %v", err)
	}

	// Decouple the read context from the sync context.
	readCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Read in a loop in a separate goroutine until we encounter
	// an error or the test ends.
	c := make(chan struct{})
	go func() {
		defer close(c)
	outer:
		for {
			_, err := kbfsOps.Read(readCtx, fileNode, data, 0)
			select {
			case <-readCtx.Done():
				break outer
			default:
			}
			if err != nil {
				t.Errorf("Couldn't read file: %v", err)
				break
			}
		}
	}()

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}
	cancel()
	// Wait for the read loop to finish
	<-c
}

// Test that a write can survive a folder BlockPointer update
func TestKBFSOpsConcurWriteDuringFolderUpdate(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Now update the folder pointer in some other way
	_, _, err = kbfsOps.CreateFile(ctx, rootNode, "b", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Now sync the original file and see make sure the write survived
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}

	de, err := kbfsOps.Stat(ctx, fileNode)
	if err != nil {
		t.Errorf("Couldn't stat file: %v", err)
	}
	if g, e := de.Size, len(data); g != uint64(e) {
		t.Errorf("Got wrong size %d; expected %d", g, e)
	}
}

// Test that a write can happen concurrently with a sync when there
// are multiple blocks in the file.
func TestKBFSOpsConcurWriteDuringSyncMultiBlocks(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit := &BlockSplitterSimple{blockSize, 2, 100 * 1024}
	config.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// 2 blocks worth of data
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// sync these initial blocks
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != nil {
		t.Errorf("Couldn't do the first sync: %v", err)
	}

	// there should be 7 blocks at this point: the original root block
	// + 2 modifications (create + write), the top indirect file block
	// and a modification (write), and its two children blocks.
	numCleanBlocks := config.BlockCache().(*BlockCacheStandard).cleanTransient.Len()
	if numCleanBlocks != 7 {
		t.Errorf("Unexpected number of cached clean blocks: %d\n",
			numCleanBlocks)
	}

	// write to the first block
	b1data := []byte{11, 12}
	err = kbfsOps.Write(ctx, fileNode, b1data, 0)
	if err != nil {
		t.Errorf("Couldn't write 1st block of file: %v", err)
	}

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.SyncAll(putCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh

	// now make sure we can write the second block of the file and see
	// the new bytes we wrote
	newData := []byte{20}
	err = kbfsOps.Write(ctx, fileNode, newData, 9)
	if err != nil {
		t.Errorf("Couldn't write data: %v\n", err)
	}

	// read the data back
	buf := make([]byte, 10)
	nr, err := kbfsOps.Read(ctx, fileNode, buf, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v\n", err)
	}
	expectedData := []byte{11, 12, 3, 4, 5, 6, 7, 8, 9, 20}
	if nr != 10 || !bytes.Equal(expectedData, buf) {
		t.Errorf("Got wrong data %v; expected %v", buf, expectedData)
	}

	// now unstall Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}

	// finally, make sure we can still read it after the sync too
	// (even though the second write hasn't been sync'd yet)
	buf2 := make([]byte, 10)
	nr, err = kbfsOps.Read(ctx, fileNode, buf2, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v\n", err)
	}
	if nr != 10 || !bytes.Equal(expectedData, buf2) {
		t.Errorf("2nd read: Got wrong data %v; expected %v", buf2, expectedData)
	}

	// Final sync to clean up
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Errorf("Couldn't sync the final write")
	}
}

type stallingBServer struct {
	*BlockServerMemory

	readyChan  chan<- struct{}
	goChan     <-chan struct{}
	finishChan chan<- struct{}
}

func newStallingBServer(log logger.Logger) *stallingBServer {
	return &stallingBServer{BlockServerMemory: NewBlockServerMemory(log)}
}

func (fc *stallingBServer) maybeWaitOnChannel(ctx context.Context) error {
	if fc.readyChan == nil {
		return nil
	}

	// say we're ready, and wait for a signal to proceed or a
	// cancellation.
	select {
	case fc.readyChan <- struct{}{}:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case <-fc.goChan:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (fc *stallingBServer) maybeFinishOnChannel(ctx context.Context) error {
	if fc.finishChan != nil {
		select {
		case fc.finishChan <- struct{}{}:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

func (fc *stallingBServer) Get(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context) (
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	err error) {
	err = fc.maybeWaitOnChannel(ctx)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, err
	}
	defer func() {
		finishErr := fc.maybeFinishOnChannel(ctx)
		if err == nil {
			err = finishErr
		}
	}()

	return fc.BlockServerMemory.Get(ctx, tlfID, id, context)
}

func (fc *stallingBServer) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf) (err error) {
	err = fc.maybeWaitOnChannel(ctx)
	if err != nil {
		return err
	}
	defer func() {
		finishErr := fc.maybeFinishOnChannel(ctx)
		if err == nil {
			err = finishErr
		}
	}()

	return fc.BlockServerMemory.Put(ctx, tlfID, id, context, buf, serverHalf)
}

// Test that a write consisting of multiple blocks can be canceled
// before all blocks have been written.
func TestKBFSOpsConcurWriteParallelBlocksCanceled(t *testing.T) {
	if maxParallelBlockPuts <= 1 {
		t.Skip("Skipping because we are not putting blocks in parallel.")
	}
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// give it a remote block server with a fake client
	log := config.MakeLogger("")
	config.BlockServer().Shutdown(ctx)
	b := newStallingBServer(log)
	config.SetBlockServer(b)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit := &BlockSplitterSimple{blockSize, 2, 100 * 1024}
	config.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	// Two initial blocks, then maxParallelBlockPuts blocks that
	// will be processed but discarded, then three extra blocks
	// that will be ignored.
	initialBlocks := 2
	extraBlocks := 3
	totalFileBlocks := initialBlocks + maxParallelBlockPuts + extraBlocks
	var data []byte
	for i := int64(0); i < blockSize*int64(totalFileBlocks); i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// now set a control channel, let a couple blocks go in, and then
	// cancel the context
	readyChan := make(chan struct{})
	goChan := make(chan struct{})
	finishChan := make(chan struct{})
	b.readyChan = readyChan
	b.goChan = goChan
	b.finishChan = finishChan

	prevNBlocks := b.numBlocks()
	nowNBlocks := 0
	ctx2, cancel2 := context.WithCancel(ctx)
	go func() {
		// let the first initialBlocks blocks through.
		for i := 0; i < initialBlocks; i++ {
			select {
			case <-readyChan:
			case <-ctx.Done():
				t.Error(ctx.Err())
			}
		}

		for i := 0; i < initialBlocks; i++ {
			select {
			case goChan <- struct{}{}:
			case <-ctx.Done():
				t.Error(ctx.Err())
			}
		}

		for i := 0; i < initialBlocks; i++ {
			select {
			case <-finishChan:
			case <-ctx.Done():
				t.Error(ctx.Err())
			}
		}

		// Get the number of blocks now, before canceling the context,
		// because after canceling the context we would be racing with
		// cleanup code that could delete the put blocks.
		nowNBlocks = b.numBlocks()

		// Let each parallel block worker block on readyChan.
		for i := 0; i < maxParallelBlockPuts; i++ {
			select {
			case <-readyChan:
			case <-ctx.Done():
				t.Error(ctx.Err())
			}
		}

		// Make sure all the workers are busy.
		select {
		case <-readyChan:
			t.Error("Worker unexpectedly ready")
		case <-ctx.Done():
			t.Error(ctx.Err())
		default:
		}

		// Let all the workers go through.
		cancel2()
	}()

	err = kbfsOps.SyncAll(ctx2, fileNode.GetFolderBranch())
	if err != context.Canceled {
		t.Errorf("Sync did not get canceled error: %v", err)
	}
	if nowNBlocks != prevNBlocks+2 {
		t.Errorf("Unexpected number of blocks; prev = %d, now = %d",
			prevNBlocks, nowNBlocks)
	}

	// Make sure there are no more workers, i.e. the extra blocks
	// aren't sent to the server.
	select {
	case <-readyChan:
		t.Error("Worker unexpectedly ready")
	default:
	}

	// As a regression for KBFS-635, test that a second sync succeeds,
	// and that future operations also succeed.
	//
	// Create new objects to avoid racing with goroutines from the
	// first sync.
	config.BlockServer().Shutdown(ctx)
	b = newStallingBServer(log)
	config.SetBlockServer(b)
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Second sync failed: %v", err)
	}

	if _, _, err := kbfsOps.CreateFile(ctx, rootNode, "b", false, NoExcl); err != nil {
		t.Fatalf("Couldn't create file after sync: %v", err)
	}

	// Avoid checking state when using a fake block server.
	config.MDServer().Shutdown()
}

// Test that, when writing multiple blocks in parallel, one error will
// cancel the remaining puts.
func TestKBFSOpsConcurWriteParallelBlocksError(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// give it a mock'd block server
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	defer mockCtrl.Finish()
	defer ctr.CheckForFailures()
	b := NewMockBlockServer(mockCtrl)
	config.BlockServer().Shutdown(ctx)
	config.SetBlockServer(b)

	// from the folder creation, then 2 for file creation
	c := b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).Times(3).Return(nil)
	b.EXPECT().ArchiveBlockReferences(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit := &BlockSplitterSimple{blockSize, 2, 100 * 1024}
	config.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	// 15 blocks
	var data []byte
	fileBlocks := int64(15)
	for i := int64(0); i < blockSize*fileBlocks; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// let two blocks through and fail the third:
	c = b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).Times(2).After(c).Return(nil)
	putErr := errors.New("This is a forced error on put")
	errPtrChan := make(chan BlockPointer)
	c = b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).
		Do(func(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
			context kbfsblock.Context, buf []byte,
			serverHalf kbfscrypto.BlockCryptKeyServerHalf) {
			errPtrChan <- BlockPointer{
				ID:      id,
				Context: context,
			}
		}).After(c).Return(putErr)
	// let the rest through
	proceedChan := make(chan struct{})
	b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().
		Do(func(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
			context kbfsblock.Context, buf []byte,
			serverHalf kbfscrypto.BlockCryptKeyServerHalf) {
			<-proceedChan
		}).After(c).Return(nil)
	b.EXPECT().RemoveBlockReferences(gomock.Any(), gomock.Any(), gomock.Any()).
		AnyTimes().Return(nil, nil)
	b.EXPECT().Shutdown(gomock.Any()).AnyTimes()

	var errPtr BlockPointer
	go func() {
		errPtr = <-errPtrChan
		close(proceedChan)
	}()

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	if err != putErr {
		t.Errorf("Sync did not get the expected error: %v", err)
	}

	// wait for proceedChan to close, so we know the errPtr has been set
	<-proceedChan

	// Make sure the error'd file didn't make it to the actual cache
	// -- it's still in the permanent cache because the file might
	// still be read or sync'd later.
	config.BlockCache().DeletePermanent(errPtr.ID)
	if _, err := config.BlockCache().Get(errPtr); err == nil {
		t.Errorf("Failed block put for %v left block in cache", errPtr)
	}

	// State checking won't happen on the mock block server since we
	// leave ourselves in a dirty state.
}

func testKBFSOpsMultiBlockWriteDuringRetriedSync(t *testing.T, nFiles int) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	oldBServer := config.BlockServer()
	defer config.SetBlockServer(oldBServer)
	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, 1)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNodes := make([]Node, nFiles)

	fileNodes[0], _, err = kbfsOps.CreateFile(
		ctx, rootNode, "file0", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	firstData := make([]byte, 30)
	// Write 2 blocks worth of data
	for i := 0; i < 30; i++ {
		firstData[i] = byte(i)
	}

	err = kbfsOps.Write(ctx, fileNodes[0], firstData, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	err = kbfsOps.SyncAll(ctx, fileNodes[0].GetFolderBranch())
	if err != nil {
		t.Fatalf("First sync failed: %v", err)
	}

	// Remove the first file, and wait for the archiving to complete.
	err = kbfsOps.RemoveEntry(ctx, rootNode, "file0")
	if err != nil {
		t.Fatalf("Couldn't remove file: %v", err)
	}

	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	fileNode2, _, err := kbfsOps.CreateFile(
		ctx, rootNode, "file0", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Now write the identical first block and sync it.
	err = kbfsOps.Write(ctx, fileNode2, firstData[:20], 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Write all the rest of the files to sync concurrently, if any.
	for i := 1; i < nFiles; i++ {
		name := fmt.Sprintf("file%d", i)
		fileNode, _, err := kbfsOps.CreateFile(
			ctx, rootNode, name, false, NoExcl)
		if err != nil {
			t.Fatalf("Couldn't create file: %v", err)
		}
		data := make([]byte, 30)
		// Write 2 blocks worth of data
		for j := 0; j < 30; j++ {
			data[j] = byte(j + 30*i)
		}
		err = kbfsOps.Write(ctx, fileNode, data, 0)
		if err != nil {
			t.Errorf("Couldn't write file: %v", err)
		}
		fileNodes[i] = fileNode
	}

	// Sync the initial two data blocks
	errChan := make(chan error)
	// start the sync
	go func() {
		errChan <- kbfsOps.SyncAll(ctxStallSync, fileNode2.GetFolderBranch())
	}()
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatalf("Timeout waiting to stall")
	}

	// Now write the second block.
	err = kbfsOps.Write(ctx, fileNode2, firstData[20:], 20)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Unstall the sync.
	close(syncUnstallCh)
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}

	// Final sync
	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Final sync failed: %v", err)
	}

	gotData := make([]byte, 30)
	nr, err := kbfsOps.Read(ctx, fileNode2, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(firstData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", firstData, gotData)
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*DirtyBlockCacheStandard)
	numDirtyBlocks := len(dbcs.cache)
	if numDirtyBlocks != 0 {
		t.Errorf("%d dirty blocks left after final sync", numDirtyBlocks)
	}
}

// When writes happen on a multi-block file concurrently with a sync,
// and the sync has to retry due to an archived block, test that
// everything works correctly.  Regression test for KBFS-700.
func TestKBFSOpsMultiBlockWriteDuringRetriedSync(t *testing.T) {
	testKBFSOpsMultiBlockWriteDuringRetriedSync(t, 1)
}

// When writes happen on a multi-block file concurrently with a
// 2-file sync, and the sync has to retry due to an archived
// block, test that everything works correctly.
func TestKBFSOpsMultiBlockWriteDuringRetriedSyncAllTwoFiles(t *testing.T) {
	testKBFSOpsMultiBlockWriteDuringRetriedSync(t, 2)
}

// Test that a sync of a multi-block file that hits both a retriable
// error and a unretriable error leave the system in a clean state.
// Regression test for KBFS-1508.
func testKBFSOpsMultiBlockWriteWithRetryAndError(t *testing.T, nFiles int) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	nFileBlocks := testCalcNumFileBlocks(40, bsplitter) * nFiles
	t.Logf("nFileBlocks=%d", nFileBlocks)

	oldBServer := config.BlockServer()
	defer config.SetBlockServer(oldBServer)
	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, nFileBlocks)
	ctxStallSync, cancel2 := context.WithCancel(ctxStallSync)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNodes := make([]Node, nFiles)
	fileNodes[0], _, err = kbfsOps.CreateFile(
		ctx, rootNode, "file0", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	var data []byte
	// Write 2 blocks worth of data
	for i := 0; i < 30; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNodes[0], data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	err = kbfsOps.SyncAll(ctx, fileNodes[0].GetFolderBranch())
	if err != nil {
		t.Fatalf("First sync failed: %v", err)
	}

	// Remove that file, and wait for the archiving to complete
	err = kbfsOps.RemoveEntry(ctx, rootNode, "file0")
	if err != nil {
		t.Fatalf("Couldn't remove file: %v", err)
	}

	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	fileNode2, _, err := kbfsOps.CreateFile(
		ctx, rootNode, "file0", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Now write the identical first block, plus a new block and sync it.
	err = kbfsOps.Write(ctx, fileNode2, data[:20], 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	err = kbfsOps.Write(ctx, fileNode2, data[10:30], 20)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Write all the rest of the files to sync concurrently, if any.
	for i := 1; i < nFiles; i++ {
		name := fmt.Sprintf("file%d", i)
		fileNode, _, err := kbfsOps.CreateFile(
			ctx, rootNode, name, false, NoExcl)
		if err != nil {
			t.Fatalf("Couldn't create file: %v", err)
		}
		data := make([]byte, 30)
		// Write 2 blocks worth of data
		for j := 0; j < 30; j++ {
			data[j] = byte(j + 30*i)
		}
		err = kbfsOps.Write(ctx, fileNode, data, 0)
		if err != nil {
			t.Errorf("Couldn't write file: %v", err)
		}
		fileNodes[i] = fileNode
	}

	// Sync the initial three data blocks
	errChan := make(chan error, 1)
	// start the sync
	go func() {
		errChan <- kbfsOps.SyncAll(ctxStallSync, fileNode2.GetFolderBranch())
	}()

	// Wait for the first block to finish (before the retry)
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	// Dirty the last block and extend it, so the one that was sent as
	// part of the first sync is no longer part of the file.
	err = kbfsOps.Write(ctx, fileNode2, data[10:20], 40)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}
	select {
	case syncUnstallCh <- struct{}{}:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	// Wait for the rest of the first set of blocks to finish (before the retry)
	for i := 0; i < nFileBlocks-1; i++ {
		t.Logf("Waiting for sync %d", i)
		select {
		case <-onSyncStalledCh:
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}
		select {
		case syncUnstallCh <- struct{}{}:
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}
	}

	// Once the first block of the retry comes in, cancel everything.
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	cancel2()

	// Unstall the sync.
	close(syncUnstallCh)
	err = <-errChan
	if err != context.Canceled {
		t.Errorf("Sync got an unexpected error: %v", err)
	}

	// Finish the sync
	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	if err != nil {
		t.Errorf("Couldn't sync file after error: %v", err)
	}

	gotData := make([]byte, 50)
	nr, err := kbfsOps.Read(ctx, fileNode2, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	expectedData := make([]byte, 0, 45)
	expectedData = append(expectedData, data[0:20]...)
	expectedData = append(expectedData, data[10:30]...)
	expectedData = append(expectedData, data[10:20]...)
	if !bytes.Equal(expectedData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", expectedData, gotData)
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*DirtyBlockCacheStandard)
	numDirtyBlocks := len(dbcs.cache)
	if numDirtyBlocks != 0 {
		for ptr := range dbcs.cache {
			t.Logf("Block %v still dirty", ptr.id)
		}
		t.Errorf("%d dirty blocks left after final sync, sync=%d wait=%d", numDirtyBlocks, dbcs.syncBufBytes, dbcs.waitBufBytes)
	}
}

// Test that a sync of a multi-block file that hits both a retriable
// error and a unretriable error leave the system in a clean state.
// Regression test for KBFS-1508.
func TestKBFSOpsMultiBlockWriteWithRetryAndError(t *testing.T) {
	testKBFSOpsMultiBlockWriteWithRetryAndError(t, 1)
}

// Test that a multi-file sync that includes a multi-block file that
// hits both a retriable error and a unretriable error leave the
// system in a clean state.
func TestKBFSOpsMultiBlockWriteWithRetryAndErrorTwoFiles(t *testing.T) {
	testKBFSOpsMultiBlockWriteWithRetryAndError(t, 2)
}

// This tests the situation where cancellation happens when the MD write has
// already started, and cancellation is delayed. Since no extra delay greater
// than the grace period in MD writes is introduced, Create should succeed.
func TestKBFSOpsCanceledCreateNoError(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(context.Background(), config, StallableMDPut, 1)

	putCtx, cancel2 := context.WithCancel(putCtx)

	putCtx, err := NewContextWithCancellationDelayer(putCtx)
	if err != nil {
		t.Fatal(err)
	}

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	errChan := make(chan error, 1)
	go func() {
		_, _, err := kbfsOps.CreateFile(putCtx, rootNode, "a", false, WithExcl)
		errChan <- err
	}()

	// Wait until Create gets stuck at MDOps.Put(). At this point, the delayed
	// cancellation should have been enabled.
	select {
	case <-onPutStalledCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	cancel2()
	close(putUnstallCh)

	// We expect no canceled error
	select {
	case err = <-errChan:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	ctx2 := BackgroundContextWithCancellationDelayer()
	defer CleanupCancellationDelayer(ctx2)
	if _, _, err = kbfsOps.Lookup(
		ctx2, rootNode, "a"); err != nil {
		t.Fatalf("Lookup returned error: %v", err)
	}
}

// This tests the situation where cancellation happens when the MD write has
// already started, and cancellation is delayed. A delay larger than the grace
// period is introduced to MD write, so Create should fail. This is to ensure
// Ctrl-C is able to interrupt the process eventually after the grace period.
func TestKBFSOpsCanceledCreateDelayTimeoutErrors(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// This essentially fast-forwards the grace period timer, making cancellation
	// happen much faster. This way we can avoid time.Sleep.
	config.SetDelayedCancellationGracePeriod(0)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(context.Background(), config, StallableMDPut, 1)

	putCtx, cancel2 := context.WithCancel(putCtx)

	putCtx, err := NewContextWithCancellationDelayer(putCtx)
	if err != nil {
		t.Fatal(err)
	}

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	errChan := make(chan error, 1)
	go func() {
		_, _, err := kbfsOps.CreateFile(putCtx, rootNode, "a", false, WithExcl)
		errChan <- err
	}()

	// Wait until Create gets stuck at MDOps.Put(). At this point, the delayed
	// cancellation should have been enabled.
	select {
	case <-onPutStalledCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	cancel2()

	select {
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	case <-putCtx.Done():
		// The cancellation delayer makes cancellation become async. This makes
		// sure ctx is actually canceled before unstalling.
	case <-time.After(time.Second):
		// We have a grace period of 0s. This is too long; something must have gone
		// wrong!
		t.Fatalf("it took too long for cancellation to happen")
	}

	close(putUnstallCh)

	// We expect a canceled error
	select {
	case err = <-errChan:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	if err != context.Canceled {
		t.Fatalf("Create didn't fail after grace period after cancellation."+
			" Got %v; expecting context.Canceled", err)
	}

	ctx2 := BackgroundContextWithCancellationDelayer()
	defer CleanupCancellationDelayer(ctx2)
	// do another Op, which generates a new revision, to make sure
	// CheckConfigAndShutdown doesn't get stuck
	if _, _, err = kbfsOps.CreateFile(ctx2,
		rootNode, "b", false, NoExcl); err != nil {
		t.Fatalf("throwaway op failed: %v", err)
	}
}

// Test that a Sync that is canceled during a successful MD put works.
func TestKBFSOpsConcurCanceledSyncSucceeds(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	data := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data[i] = 1
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	unpauseDeleting := make(chan struct{})
	ops.fbm.blocksToDeletePauseChan <- unpauseDeleting

	// start the sync
	errChan := make(chan error)
	cancelCtx, cancel := context.WithCancel(putCtx)
	go func() {
		errChan <- kbfsOps.SyncAll(cancelCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh
	cancel()
	close(putUnstallCh)

	// We expect a canceled error
	err = <-errChan
	if err != context.Canceled {
		t.Fatalf("No expected canceled error: %v", err)
	}

	// Flush the file.  This will result in conflict resolution, and
	// an extra copy of the file, but that's ok for now.
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}
	if len(ops.fbm.blocksToDeleteChan) == 0 {
		t.Fatalf("No blocks to delete after error")
	}

	unpauseDeleting <- struct{}{}

	ops.fbm.waitForDeletingBlocks(ctx)
	if len(ops.fbm.blocksToDeleteChan) > 0 {
		t.Fatalf("Blocks left to delete after sync")
	}

	// The first put actually succeeded, so
	// SyncFromServerForTesting and make sure it worked.
	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	gotData := make([]byte, 30)
	nr, err := kbfsOps.Read(ctx, fileNode, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(data, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", data, gotData)
	}
}

// Test that when a Sync that is canceled during a successful MD put,
// and then another Sync hits a conflict but then is also canceled,
// and finally a Sync succeeds (as a conflict), the TLF is left in a
// reasonable state where CR can succeed.  Regression for KBFS-1569.
func TestKBFSOpsConcurCanceledSyncFailsAfterCanceledSyncSucceeds(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	data := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data[i] = 1
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// start the sync
	errChan := make(chan error)
	cancelCtx, cancel := context.WithCancel(putCtx)
	go func() {
		errChan <- kbfsOps.SyncAll(cancelCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh
	cancel()
	close(putUnstallCh)

	// We expect a canceled error
	err = <-errChan
	if err != context.Canceled {
		t.Fatalf("No expected canceled error: %v", err)
	}

	// Cancel this one after it succeeds.
	onUnmergedPutStalledCh, unmergedPutUnstallCh, putUnmergedCtx :=
		StallMDOp(ctx, config, StallableMDAfterPutUnmerged, 1)

	// Flush the file again, which will result in an unmerged put,
	// which we will also cancel.
	cancelCtx, cancel = context.WithCancel(putUnmergedCtx)
	go func() {
		errChan <- kbfsOps.SyncAll(cancelCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.PutUnmerged()
	<-onUnmergedPutStalledCh
	cancel()
	close(unmergedPutUnstallCh)

	// We expect a canceled error, or possibly a nil error since we
	// ignore the PutUnmerged error internally.
	err = <-errChan
	if err != context.Canceled && err != nil {
		t.Fatalf("No expected canceled error: %v", err)
	}

	// Now finally flush the file again, which will result in a
	// conflict file.
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}

	// Wait for all the deletes to go through.
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	ops.fbm.waitForDeletingBlocks(ctx)
	if len(ops.fbm.blocksToDeleteChan) > 0 {
		t.Fatalf("Blocks left to delete after sync")
	}

	// Wait for CR to finish
	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
}

// Test that truncating a block to a zero-contents block, for which a
// duplicate has previously been archived, works correctly after a
// cancel.  Regression test for KBFS-727.
func TestKBFSOpsTruncateWithDupBlockCanceled(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// Remove that file, and wait for the archiving to complete
	err = kbfsOps.RemoveEntry(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't remove file: %v", err)
	}
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	fileNode2, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	var data []byte
	// Write some data
	for i := 0; i < 30; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode2, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("First sync failed: %v", err)
	}

	// Now truncate and sync, canceling during the block puts
	err = kbfsOps.Truncate(ctx, fileNode2, 0)
	if err != nil {
		t.Errorf("Couldn't truncate file: %v", err)
	}

	// Sync the initial two data blocks
	errChan := make(chan error)
	// start the sync
	cancelCtx, cancel := context.WithCancel(ctx)

	oldBServer := config.BlockServer()
	defer config.SetBlockServer(oldBServer)
	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(cancelCtx, config, StallableBlockPut, 1)

	go func() {
		errChan <- kbfsOps.SyncAll(ctxStallSync, fileNode2.GetFolderBranch())
	}()
	<-onSyncStalledCh

	cancel()
	// Unstall the sync.
	close(syncUnstallCh)
	err = <-errChan
	if err != context.Canceled {
		t.Errorf("Sync got wrong error: %v", err)
	}

	// Final sync
	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Final sync failed: %v", err)
	}
}

type blockOpsOverQuota struct {
	BlockOps
}

func (booq *blockOpsOverQuota) Put(ctx context.Context, tlfID tlf.ID,
	blockPtr BlockPointer, readyBlockData ReadyBlockData) error {
	return kbfsblock.BServerErrorOverQuota{
		Throttled: true,
	}
}

// Test that a quota error causes deferred writes to error.
// Regression test for KBFS-751.
func TestKBFSOpsErrorOnBlockedWriteDuringSync(t *testing.T) {
	t.Skip("Broken pending KBFS-1261")

	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Write over the dirty amount of data.  TODO: make this
	// configurable for a speedier test.
	dbcs := config.DirtyBlockCache().(*DirtyBlockCacheStandard)
	data := make([]byte, dbcs.minSyncBufCap+1)
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	realBlockOps := config.BlockOps()

	config.SetBlockOps(&blockOpsOverQuota{BlockOps: config.BlockOps()})

	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, 1)

	// Block the Sync
	// Sync the initial two data blocks
	syncErrCh := make(chan error)
	go func() {
		syncErrCh <- kbfsOps.SyncAll(ctxStallSync, fileNode.GetFolderBranch())
	}()
	<-onSyncStalledCh

	// Write more data which should get accepted but deferred.
	moreData := make([]byte, dbcs.minSyncBufCap*2+1)
	err = kbfsOps.Write(ctx, fileNode, moreData, int64(len(data)))
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Now write more data which should get blocked
	newData := make([]byte, 1)
	writeErrCh := make(chan error)
	go func() {
		writeErrCh <- kbfsOps.Write(ctx, fileNode, newData,
			int64(len(data)+len(moreData)))
	}()

	// Wait until the second write is blocked
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	func() {
		lState := makeFBOLockState()
		filePath := ops.nodeCache.PathFromNode(fileNode)
		ops.blocks.blockLock.Lock(lState)
		defer ops.blocks.blockLock.Unlock(lState)
		df := ops.blocks.getOrCreateDirtyFileLocked(lState, filePath)
		// TODO: locking
		for len(df.errListeners) != 3 {
			ops.blocks.blockLock.Unlock(lState)
			runtime.Gosched()
			ops.blocks.blockLock.Lock(lState)
		}
	}()

	// Unblock the sync
	close(syncUnstallCh)

	// Both errors should be an OverQuota error
	syncErr := <-syncErrCh
	writeErr := <-writeErrCh
	if _, ok := syncErr.(kbfsblock.BServerErrorOverQuota); !ok {
		t.Fatalf("Unexpected sync err: %v", syncErr)
	}
	if writeErr != syncErr {
		t.Fatalf("Unexpected write err: %v", writeErr)
	}

	// Finish the sync to clear out the byte counts
	config.SetBlockOps(realBlockOps)
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't finish sync: %v", err)
	}
}

func TestKBFSOpsCancelGetFavorites(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	serverConn, conn := rpc.MakeConnectionForTest(t)
	daemon := newKeybaseDaemonRPCWithClient(
		nil,
		conn.GetClient(),
		config.MakeLogger(""))
	config.SetKeybaseService(daemon)

	f := func(ctx context.Context) error {
		_, err := config.KBFSOps().GetFavorites(ctx)
		return err
	}
	testRPCWithCanceledContext(t, serverConn, f)
}

type stallingNodeCache struct {
	NodeCache

	doStallUpdate     <-chan struct{}
	unstallUpdate     <-chan struct{}
	beforePathsCalled chan<- struct{}
	afterPathCalled   chan<- struct{}
}

func (snc *stallingNodeCache) UpdatePointer(
	oldRef BlockRef, newPtr BlockPointer) bool {
	select {
	case <-snc.doStallUpdate:
		<-snc.unstallUpdate
	default:
	}
	return snc.NodeCache.UpdatePointer(oldRef, newPtr)
}

func (snc *stallingNodeCache) PathFromNode(node Node) path {
	snc.beforePathsCalled <- struct{}{}
	p := snc.NodeCache.PathFromNode(node)
	snc.afterPathCalled <- struct{}{}
	return p
}

// Test that a lookup that straddles a sync from the same file doesn't
// have any races.  Regression test for KBFS-1717.
func TestKBFSOpsLookupSyncRace(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, false)
	kbfsOps2 := config2.KBFSOps()
	ops2 := getOps(config2, rootNode2.GetFolderBranch().Tlf)
	doStallUpdate := make(chan struct{}, 1)
	unstallUpdate := make(chan struct{})
	beforePathsCalled := make(chan struct{})
	afterPathCalled := make(chan struct{})
	snc := &stallingNodeCache{
		NodeCache:         ops2.nodeCache,
		doStallUpdate:     doStallUpdate,
		unstallUpdate:     unstallUpdate,
		beforePathsCalled: beforePathsCalled,
		afterPathCalled:   afterPathCalled,
	}
	ops2.nodeCache = snc
	ops2.blocks.nodeCache = snc
	defer func() {
		ops2.nodeCache = snc.NodeCache
		ops2.blocks.nodeCache = snc.NodeCache
	}()

	// u1 creates a file.
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, false)
	kbfsOps1 := config1.KBFSOps()
	fileNodeA1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// u2 syncs and then disables updates.
	if err := kbfsOps2.SyncFromServerForTesting(
		ctx, rootNode2.GetFolderBranch()); err != nil {
		t.Fatal("Couldn't sync user 2 from server")
	}
	_, err = DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't disable updates: %v", err)
	}

	// u2 writes to the file.
	data := []byte{1, 2, 3}
	err = kbfsOps1.Write(ctx, fileNodeA1, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}
	if err := kbfsOps1.SyncAll(ctx, fileNodeA1.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't finish sync: %v", err)
	}

	// u2 tries to lookup the file, which will block until we drain
	// the afterPathCalled channel.
	var wg sync.WaitGroup
	wg.Add(1)
	var fileNodeA2 Node
	go func() {
		defer wg.Done()
		var err error
		fileNodeA2, _, err = kbfsOps2.Lookup(ctx, rootNode2, "a")
		if err != nil {
			t.Errorf("Couldn't lookup a: %v", err)
		}
	}()
	// Wait for the lookup to block.
	select {
	case <-beforePathsCalled:
	case <-ctx.Done():
		t.Fatal("Timeout while waiting for lookup to block")
	}

	// u2 starts to sync but the sync is stalled while holding the
	// block lock.
	doStallUpdate <- struct{}{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := kbfsOps2.SyncFromServerForTesting(
			ctx, rootNode2.GetFolderBranch()); err != nil {
			t.Errorf("Couldn't sync user 2 from server: %v", err)
		}
	}()

	// Unblock the lookup.
	select {
	case <-afterPathCalled:
	case <-ctx.Done():
		t.Fatal("Timeout while waiting for afterPathCalled")
	}

	// Wait for the sync to block and let the sync succeed (which will
	// let the lookup succeed).  NOTE: To repro KBFS-1717, this call
	// needs to go before we unblock the paths lookup.  However, with
	// the fix for KBFS-1717, the test will hang if we do that since
	// the Lookup holds blockLock while it gets the path.  So as is,
	// this isn't a direct repro but it's still a test worth having
	// around.
	select {
	case unstallUpdate <- struct{}{}:
	case <-ctx.Done():
		t.Fatal("Timeout while waiting for sync to block")
	}
	wg.Wait()

	// Now u2 reads using the node it just looked up, and should see
	// the right data.
	gotData := make([]byte, len(data))
	// Read needs a path lookup too, so revert the node cache.
	ops2.nodeCache = snc.NodeCache
	ops2.blocks.nodeCache = snc.NodeCache
	nr, err := kbfsOps2.Read(ctx, fileNodeA2, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(data, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", data, gotData)
	}
}

// Test that a Sync of a multi-block file that fails twice, and then
// retried later, is successful.  Regression test for KBFS-2157.
func TestKBFSOpsConcurMultiblockOverwriteWithCanceledSync(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(t, config, ctx, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", false)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	data := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data[i] = 1
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// Over write the data to cause the leaf blocks to be unreferenced.
	data2 := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data2[i] = byte(i + 30)
	}
	err = kbfsOps.Write(ctx, fileNode, data2, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// start the sync
	errChan := make(chan error)
	cancelCtx, cancel := context.WithCancel(putCtx)
	go func() {
		errChan <- kbfsOps.SyncAll(cancelCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh
	cancel()
	close(putUnstallCh)

	// We expect a canceled error
	err = <-errChan
	if err != context.Canceled {
		t.Fatalf("No expected canceled error: %v", err)
	}

	data3 := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data3[i] = byte(i + 60)
	}
	err = kbfsOps.Write(ctx, fileNode, data3, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	onPutStalledCh, putUnstallCh, putCtx =
		StallMDOp(ctx, config, StallableMDPut, 1)

	// Cancel it again.
	cancelCtx, cancel = context.WithCancel(putCtx)
	go func() {
		errChan <- kbfsOps.SyncAll(cancelCtx, fileNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	<-onPutStalledCh
	cancel()
	close(putUnstallCh)

	// We expect a canceled error
	err = <-errChan
	if err != context.Canceled {
		t.Fatalf("No expected canceled error: %v", err)
	}

	data4 := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data4[i] = byte(i + 90)
	}
	err = kbfsOps.Write(ctx, fileNode, data4, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Flush the file again.
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}

	gotData := make([]byte, 30)
	nr, err := kbfsOps.Read(ctx, fileNode, gotData, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v", err)
	}
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(data4, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", data4, gotData)
	}
}
