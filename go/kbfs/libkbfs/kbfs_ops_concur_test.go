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
	kbfsdata "github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfssync"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libkey"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"github.com/stretchr/testify/require"
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

func kbfsOpsConcurInit(t *testing.T, users ...kbname.NormalizedUsername) (
	*ConfigLocal, keybase1.UID, context.Context, context.CancelFunc) {
	return kbfsOpsInitNoMocks(t, users...)
}

func kbfsConcurTestShutdown(
	ctx context.Context, t *testing.T,
	config *ConfigLocal, cancel context.CancelFunc) {
	kbfsTestShutdownNoMocks(ctx, t, config, cancel)
}

// TODO: Get rid of all users of this.
func kbfsConcurTestShutdownNoCheck(
	ctx context.Context, t *testing.T,
	config *ConfigLocal, cancel context.CancelFunc) {
	kbfsTestShutdownNoMocksNoCheck(ctx, t, config, cancel)
}

// Test that only one of two concurrent GetRootMD requests can end up
// fetching the MD from the server.  The second one should wait, and
// then get it from the MD cache.
func TestKBFSOpsConcurDoubleMDGet(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onGetStalledCh, getUnstallCh, ctxStallGetForTLF :=
		StallMDOp(ctx, config, StallableMDGetForTLF, 1)

	// Initialize the MD using a different config
	c2 := ConfigAsUser(config, "test_user")
	defer CheckConfigAndShutdown(ctx, t, c2)
	rootNode := GetRootNodeOrBust(ctx, t, c2, "test_user", tlf.Private)

	n := 10
	c := make(chan error, n)
	cl := &CounterLock{}
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	ops.mdWriterLock = kbfssync.MakeLeveledMutex(
		kbfssync.MutexLevel(fboMDWriter), cl)
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
		require.NoError(t, err, "Got an error doing concurrent MD gets: err=(%s)", err)
	}
}

// Test that a read can happen concurrently with a sync
func TestKBFSOpsConcurReadDuringSync(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

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
	require.NoError(t, err, "Couldn't read data: %v\n", err)
	if nr != 1 || !bytes.Equal(data, buf) {
		t.Errorf("Got wrong data %v; expected %v", buf, data)
	}

	// now unblock Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	require.NoError(t, err, "Sync got an error: %v", err)
}

func testCalcNumFileBlocks(
	dataLen int, bsplitter *kbfsdata.BlockSplitterSimple) int {
	nChildBlocks := 1 + dataLen/int(bsplitter.MaxSize())
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	fileNodes := make([]Node, nFiles)
	kbfsOps := config.KBFSOps()
	for i := 0; i < nFiles; i++ {
		name := fmt.Sprintf("file%d", i)
		fileNode, _, err := kbfsOps.CreateFile(
			ctx, rootNode, testPPS(name), false, NoExcl)
		require.NoError(t, err, "Couldn't create file %s: %v", name, err)
		fileNodes[i] = fileNode
	}

	expectedData := make([][]byte, len(fileNodes))
	for i, fileNode := range fileNodes {
		data := make([]byte, initialWriteBytes)
		for j := 0; j < initialWriteBytes; j++ {
			data[j] = byte(initialWriteBytes * (i + 1))
		}
		err = kbfsOps.Write(ctx, fileNode, data, 0)
		require.NoError(t, err, "Couldn't write file: %v", err)
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
			require.NoError(t, err, "Couldn't write data: %v\n", err)

			// read the data back
			buf := make([]byte, j+1+initialWriteBytes)
			nr, err := kbfsOps.Read(ctx, fileNode, buf, 0)
			require.NoError(t, err, "Couldn't read data: %v\n", err)
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
	require.NoError(t, err, "Sync got an error: %v", err)

	// finally, make sure we can still read it after the sync too
	// (even though the second write hasn't been sync'd yet)
	totalSize := nOneByteWrites + initialWriteBytes
	for i, fileNode := range fileNodes {
		buf2 := make([]byte, totalSize)
		nr, err := kbfsOps.Read(ctx, fileNode, buf2, 0)
		require.NoError(t, err, "Couldn't read data: %v\n", err)
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
	bcs := config.BlockCache().(*kbfsdata.BlockCacheStandard)
	numCleanBlocks := bcs.NumCleanTransientBlocks()
	nFileBlocks := testCalcNumFileBlocks(initialWriteBytes, bsplitter)
	if g, e := numCleanBlocks, 4+nFileBlocks; g != e {
		t.Logf("Unexpected number of cached clean blocks: %d vs %d (%d vs %d)", g, e, totalSize, bsplitter.MaxSize())
	}

	err = kbfsOps.SyncAll(ctx, fileNodes[0].GetFolderBranch())
	require.NoError(t, err, "Final sync failed: %v", err)

	for _, fileNode := range fileNodes {
		if ei, err := kbfsOps.Stat(ctx, fileNode); err != nil {
			t.Fatalf("Couldn't stat: %v", err)
		} else if g, e := ei.Size, uint64(totalSize); g != e {
			t.Fatalf("Unexpected size: %d vs %d", g, e)
		}
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*kbfsdata.DirtyBlockCacheStandard)
	numDirtyBlocks := dbcs.Size()
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	var data []byte
	// Write 2 blocks worth of data
	for i := 0; i < 30; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	// Sync the initial two data blocks
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	require.NoError(t, err, "Initial sync failed: %v", err)

	// Now dirty the first block.
	newData1 := make([]byte, 10)
	copy(newData1, data[20:])
	err = kbfsOps.Write(ctx, fileNode, newData1, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

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
	require.NoError(t, err, "Couldn't write file: %v", err)
	err = kbfsOps.Write(ctx, fileNode, newData2, 30)
	require.NoError(t, err, "Couldn't write file: %v", err)

	// now unblock Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	require.NoError(t, err, "Sync got an error: %v", err)

	expectedData := make([]byte, 40)
	copy(expectedData[:10], newData1)
	copy(expectedData[10:20], data[10:20])
	copy(expectedData[20:30], newData2)
	copy(expectedData[30:40], newData2)

	gotData := make([]byte, 40)
	nr, err := kbfsOps.Read(ctx, fileNode, gotData, 0)
	require.NoError(t, err, "Couldn't read data: %v", err)
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(expectedData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", expectedData, gotData)
	}

	// Final sync
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	require.NoError(t, err, "Final sync failed: %v", err)

	gotData = make([]byte, 40)
	nr, err = kbfsOps.Read(ctx, fileNode, gotData, 0)
	require.NoError(t, err, "Couldn't read data: %v", err)
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(expectedData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", expectedData, gotData)
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*kbfsdata.DirtyBlockCacheStandard)
	numDirtyBlocks := dbcs.Size()
	if numDirtyBlocks != 0 {
		t.Errorf("%d dirty blocks left after final sync", numDirtyBlocks)
	}
}

// Test that a block write can happen concurrently with a block
// read. This is a regression test for KBFS-536.
func TestKBFSOpsConcurBlockReadWrite(t *testing.T) {
	t.Skip("Broken test since Go 1.12.4 due to extra pending requests after test termination. Panic: unable to shutdown block ops.")
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	// TODO: Use kbfsConcurTestShutdown.
	defer kbfsConcurTestShutdownNoCheck(ctx, t, config, cancel)

	// Turn off transient block caching.
	config.SetBlockCache(kbfsdata.NewBlockCacheStandard(0, 1<<30))

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

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
	lastKMD   libkey.KeyMetadata
	delegate  KeyManager
}

func (km *mdRecordingKeyManager) getLastKMD() libkey.KeyMetadata {
	km.lastKMDMu.RLock()
	defer km.lastKMDMu.RUnlock()
	return km.lastKMD
}

func (km *mdRecordingKeyManager) setLastKMD(kmd libkey.KeyMetadata) {
	km.lastKMDMu.Lock()
	defer km.lastKMDMu.Unlock()
	km.lastKMD = kmd
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForEncryption(
	ctx context.Context, kmd libkey.KeyMetadata) (kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmd)
	return km.delegate.GetTLFCryptKeyForEncryption(ctx, kmd)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, kmdToDecrypt, kmdWithKeys libkey.KeyMetadata) (
	kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmdToDecrypt)
	return km.delegate.GetTLFCryptKeyForMDDecryption(ctx,
		kmdToDecrypt, kmdWithKeys)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, kmd libkey.KeyMetadata, blockPtr kbfsdata.BlockPointer) (
	kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmd)
	return km.delegate.GetTLFCryptKeyForBlockDecryption(ctx, kmd, blockPtr)
}

func (km *mdRecordingKeyManager) GetFirstTLFCryptKey(
	ctx context.Context, kmd libkey.KeyMetadata) (
	kbfscrypto.TLFCryptKey, error) {
	km.setLastKMD(kmd)
	return km.delegate.GetFirstTLFCryptKey(ctx, kmd)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyOfAllGenerations(
	ctx context.Context, kmd libkey.KeyMetadata) (
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
	defer kbfsConcurTestShutdownNoCheck(ctx, t, config, cancel)

	<-config.BlockOps().TogglePrefetcher(false)

	km := &mdRecordingKeyManager{delegate: config.KeyManager()}

	config.SetKeyManager(km)

	// Turn off block caching.
	config.SetBlockCache(kbfsdata.NewBlockCacheStandard(0, 1<<30))

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	// Write to file to mark it dirty.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write to file: %v", err)

	lState := makeFBOLockState()

	fbo := kbfsOps.(*KBFSOpsStandard).getOpsNoAdd(
		ctx, rootNode.GetFolderBranch())
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
	require.NoError(t, err, "Couldn't write file: %v", err)

	deferredWriteCount := fbo.blocks.getDeferredWriteCountForTest(lState)
	if deferredWriteCount != 1 {
		t.Errorf("Unexpected deferred write count %d",
			deferredWriteCount)
	}

	// Unstall the sync.
	close(syncUnstallCh)

	wg.Wait()

	// Do this in the main goroutine since it isn't goroutine safe,
	// and do this after wg.Wait() since we only know it's set
	// after the goroutine exits.
	if syncErr != nil {
		t.Errorf("Couldn't sync: %v", syncErr)
	}

	md, err := fbo.getMDForRead(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err, "Couldn't get MD: %v", err)

	lastKMD := km.getLastKMD()

	if md.ReadOnlyRootMetadata != lastKMD {
		t.Error("Last MD seen by key manager != head")
	}
}

// Test that a sync can happen concurrently with a truncate. This is a
// regression test for KBFS-558.
func TestKBFSOpsConcurBlockSyncTruncate(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	<-config.BlockOps().TogglePrefetcher(false)

	km := &mdRecordingKeyManager{delegate: config.KeyManager()}

	config.SetKeyManager(km)

	// Turn off block caching.
	config.SetBlockCache(kbfsdata.NewBlockCacheStandard(0, 1<<30))

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	// Write to file to mark it dirty.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write to file: %v", err)

	lState := makeFBOLockState()

	fbo := kbfsOps.(*KBFSOpsStandard).getOpsNoAdd(
		ctx, rootNode.GetFolderBranch())
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
	require.NoError(t, err, "Couldn't truncate file: %v", err)

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

	md, err := fbo.getMDForRead(ctx, lState, mdReadNeedIdentify)
	require.NoError(t, err, "Couldn't get MD: %v", err)

	lastKMD := km.getLastKMD()
	lastRMD, ok := lastKMD.(ReadOnlyRootMetadata)
	require.True(t, ok)

	if md.ReadOnlyRootMetadata != lastRMD {
		t.Error("Last MD seen by key manager != head")
	}
}

// Tests that a file that has been truncate-extended and overwritten
// to several times can sync, and then take several deferred
// overwrites, plus one write that blocks until the dirty bcache has
// room.  This is a repro for KBFS-1846.
func TestKBFSOpsTruncateAndOverwriteDeferredWithArchivedBlock(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, "test_user")
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	bsplitter, err := kbfsdata.NewBlockSplitterSimple(
		kbfsdata.MaxBlockSizeBytesDefault, 8*1024, config.Codec())
	if err != nil {
		t.Fatal(err)
	}
	config.SetBlockSplitter(bsplitter)

	// create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %+v", err)

	err = kbfsOps.Truncate(ctx, fileNode, 131072)
	require.NoError(t, err, "Couldn't truncate file: %+v", err)

	// Write a few blocks
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	err = kbfsOps.Write(ctx, fileNode, data[0:3], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.Write(ctx, fileNode, data[3:6], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.Write(ctx, fileNode, data[6:9], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %+v", err)

	// Now overwrite those blocks to archive them
	newData := []byte{11, 12, 13, 14, 15, 16, 17, 18, 19, 20}
	err = kbfsOps.Write(ctx, fileNode, newData, 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %+v", err)

	// Wait for the archiving to finish
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	if err != nil {
		t.Fatalf("Couldn't sync from server")
	}

	fileNode2, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("b"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %+v", err)

	err = kbfsOps.Truncate(ctx, fileNode2, 131072)
	require.NoError(t, err, "Couldn't truncate file: %+v", err)

	// Now write the original first block, which has been archived,
	// and make sure it works.
	err = kbfsOps.Write(ctx, fileNode2, data[0:3], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.Write(ctx, fileNode2, data[3:6], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.Write(ctx, fileNode2, data[6:9], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

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
	require.NoError(t, err, "Couldn't write file: %+v", err)

	err = kbfsOps.Write(ctx, fileNode2, data[4:7], 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

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
	require.NoError(t, err, "Couldn't sync file: %+v", err)
}

// Test that a sync can happen concurrently with a read for a file
// large enough to have indirect blocks without messing anything
// up. This should pass with -race. This is a regression test for
// KBFS-537.
func TestKBFSOpsConcurBlockSyncReadIndirect(t *testing.T) {
	t.Skip("Broken test since Go 1.12.4 due to extra pending requests after test termination. Panic: unable to shutdown block ops.")
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// Turn off block caching.
	config.SetBlockCache(kbfsdata.NewBlockCacheStandard(0, 1<<30))

	// Use the smallest block size possible.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	// Create a file.
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	// Write to file to make an indirect block.
	data := make([]byte, bsplitter.MaxSize()+1)
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write to file: %v", err)

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
	require.NoError(t, err, "Couldn't sync file: %v", err)
	cancel()
	// Wait for the read loop to finish
	<-c
}

// Test that a write can survive a folder BlockPointer update
func TestKBFSOpsConcurWriteDuringFolderUpdate(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	// Now update the folder pointer in some other way
	_, _, err = kbfsOps.CreateFile(ctx, rootNode, testPPS("b"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	// Now sync the original file and see make sure the write survived
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}

	de, err := kbfsOps.Stat(ctx, fileNode)
	require.NoError(t, err, "Couldn't stat file: %v", err)
	if g, e := de.Size, len(data); g != uint64(e) {
		t.Errorf("Got wrong size %d; expected %d", g, e)
	}
}

// Test that a write can happen concurrently with a sync when there
// are multiple blocks in the file.
func TestKBFSOpsConcurWriteDuringSyncMultiBlocks(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit, err := kbfsdata.NewBlockSplitterSimpleExact(blockSize, 2, 100*1024)
	require.NoError(t, err)
	config.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	// 2 blocks worth of data
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	// sync these initial blocks
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't do the first sync: %v", err)

	// there should be 7 blocks at this point: the original root block
	// + 2 modifications (create + write), the top indirect file block
	// and a modification (write), and its two children blocks.
	numCleanBlocks := config.BlockCache().(*kbfsdata.BlockCacheStandard).
		NumCleanTransientBlocks()
	if numCleanBlocks != 7 {
		t.Errorf("Unexpected number of cached clean blocks: %d\n",
			numCleanBlocks)
	}

	// write to the first block
	b1data := []byte{11, 12}
	err = kbfsOps.Write(ctx, fileNode, b1data, 0)
	require.NoError(t, err, "Couldn't write 1st block of file: %v", err)

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
	require.NoError(t, err, "Couldn't write data: %v\n", err)

	// read the data back
	buf := make([]byte, 10)
	nr, err := kbfsOps.Read(ctx, fileNode, buf, 0)
	require.NoError(t, err, "Couldn't read data: %v\n", err)
	expectedData := []byte{11, 12, 3, 4, 5, 6, 7, 8, 9, 20}
	if nr != 10 || !bytes.Equal(expectedData, buf) {
		t.Errorf("Got wrong data %v; expected %v", buf, expectedData)
	}

	// now unstall Sync and make sure there was no error
	close(putUnstallCh)
	err = <-errChan
	require.NoError(t, err, "Sync got an error: %v", err)

	// finally, make sure we can still read it after the sync too
	// (even though the second write hasn't been sync'd yet)
	buf2 := make([]byte, 10)
	nr, err = kbfsOps.Read(ctx, fileNode, buf2, 0)
	require.NoError(t, err, "Couldn't read data: %v\n", err)
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
	context kbfsblock.Context, cacheType DiskBlockCacheType) (
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

	return fc.BlockServerMemory.Get(ctx, tlfID, id, context, cacheType)
}

func (fc *stallingBServer) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf,
	cacheType DiskBlockCacheType) (err error) {
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

	return fc.BlockServerMemory.Put(
		ctx, tlfID, id, context, buf, serverHalf, cacheType)
}

// Test that a write consisting of multiple blocks can be canceled
// before all blocks have been written.
func TestKBFSOpsConcurWriteParallelBlocksCanceled(t *testing.T) {
	if maxParallelBlockPuts <= 1 {
		t.Skip("Skipping because we are not putting blocks in parallel.")
	}
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// give it a remote block server with a fake client
	log := config.MakeLogger("")
	config.BlockServer().Shutdown(ctx)
	b := newStallingBServer(log)
	config.SetBlockServer(b)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit, err := kbfsdata.NewBlockSplitterSimpleExact(blockSize, 2, 100*1024)
	require.NoError(t, err)
	config.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
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
	require.NoError(t, err, "Couldn't write file: %v", err)

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

	if _, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("b"), false, NoExcl); err != nil {
		t.Fatalf("Couldn't create file after sync: %v", err)
	}

	// Avoid checking state when using a fake block server.
	config.MDServer().Shutdown()
}

// Test that, when writing multiple blocks in parallel, one error will
// cancel the remaining puts.
func TestKBFSOpsConcurWriteParallelBlocksError(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

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
		gomock.Any(), gomock.Any(), gomock.Any()).Times(3).Return(nil)
	b.EXPECT().ArchiveBlockReferences(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit, err := kbfsdata.NewBlockSplitterSimpleExact(blockSize, 2, 100*1024)
	require.NoError(t, err)
	config.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	// 15 blocks
	var data []byte
	fileBlocks := int64(15)
	for i := int64(0); i < blockSize*fileBlocks; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	// let two blocks through and fail the third:
	c = b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any()).Times(2).After(c).Return(nil)
	putErr := errors.New("This is a forced error on put")
	errPtrChan := make(chan kbfsdata.BlockPointer)
	c = b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any()).
		Do(func(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
			context kbfsblock.Context, buf []byte,
			serverHalf kbfscrypto.BlockCryptKeyServerHalf,
			_ DiskBlockCacheType) {
			errPtrChan <- kbfsdata.BlockPointer{
				ID:      id,
				Context: context,
			}
		}).After(c).Return(putErr)
	// let the rest through
	proceedChan := make(chan struct{})
	b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any(), gomock.Any()).AnyTimes().
		Do(func(ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
			context kbfsblock.Context, buf []byte,
			serverHalf kbfscrypto.BlockCryptKeyServerHalf,
			_ DiskBlockCacheType) {
			<-proceedChan
		}).After(c).Return(nil)
	b.EXPECT().RemoveBlockReferences(gomock.Any(), gomock.Any(), gomock.Any()).
		AnyTimes().Return(nil, nil)
	b.EXPECT().Shutdown(gomock.Any()).AnyTimes()

	var errPtr kbfsdata.BlockPointer
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
	err = config.BlockCache().DeletePermanent(errPtr.ID)
	require.NoError(t, err)
	if _, err := config.BlockCache().Get(errPtr); err == nil {
		t.Errorf("Failed block put for %v left block in cache", errPtr)
	}

	// State checking won't happen on the mock block server since we
	// leave ourselves in a dirty state.
}

func testKBFSOpsMultiBlockWriteDuringRetriedSync(t *testing.T, nFiles int) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	oldBServer := config.BlockServer()
	defer config.SetBlockServer(oldBServer)
	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, 1)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNodes := make([]Node, nFiles)

	fileNodes[0], _, err = kbfsOps.CreateFile(
		ctx, rootNode, testPPS("file0"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	firstData := make([]byte, 30)
	// Write 2 blocks worth of data
	for i := 0; i < 30; i++ {
		firstData[i] = byte(i)
	}

	err = kbfsOps.Write(ctx, fileNodes[0], firstData, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	err = kbfsOps.SyncAll(ctx, fileNodes[0].GetFolderBranch())
	require.NoError(t, err, "First sync failed: %v", err)

	// Remove the first file, and wait for the archiving to complete.
	err = kbfsOps.RemoveEntry(ctx, rootNode, testPPS("file0"))
	require.NoError(t, err, "Couldn't remove file: %v", err)

	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %v", err)

	fileNode2, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("file0"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	// Now write the identical first block and sync it.
	err = kbfsOps.Write(ctx, fileNode2, firstData[:20], 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	// Write all the rest of the files to sync concurrently, if any.
	for i := 1; i < nFiles; i++ {
		name := fmt.Sprintf("file%d", i)
		fileNode, _, err := kbfsOps.CreateFile(
			ctx, rootNode, testPPS(name), false, NoExcl)
		require.NoError(t, err, "Couldn't create file: %v", err)
		data := make([]byte, 30)
		// Write 2 blocks worth of data
		for j := 0; j < 30; j++ {
			data[j] = byte(j + 30*i)
		}
		err = kbfsOps.Write(ctx, fileNode, data, 0)
		require.NoError(t, err, "Couldn't write file: %v", err)
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
	require.NoError(t, err, "Couldn't write file: %v", err)

	// Unstall the sync.
	close(syncUnstallCh)
	err = <-errChan
	require.NoError(t, err, "Sync got an error: %v", err)

	// Final sync
	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err, "Final sync failed: %v", err)

	gotData := make([]byte, 30)
	nr, err := kbfsOps.Read(ctx, fileNode2, gotData, 0)
	require.NoError(t, err, "Couldn't read data: %v", err)
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(firstData, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", firstData, gotData)
	}

	// Make sure there are no dirty blocks left at the end of the test.
	dbcs := config.DirtyBlockCache().(*kbfsdata.DirtyBlockCacheStandard)
	numDirtyBlocks := dbcs.Size()
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	nFileBlocks := testCalcNumFileBlocks(40, bsplitter) * nFiles
	t.Logf("nFileBlocks=%d", nFileBlocks)

	oldBServer := config.BlockServer()
	defer config.SetBlockServer(oldBServer)
	onSyncStalledCh, syncUnstallCh, ctxStallSync :=
		StallBlockOp(ctx, config, StallableBlockPut, nFileBlocks)
	ctxStallSync, cancel2 := context.WithCancel(ctxStallSync)

	t.Log("Create and write to a file: file0")
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNodes := make([]Node, nFiles)
	fileNodes[0], _, err = kbfsOps.CreateFile(
		ctx, rootNode, testPPS("file0"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	var data []byte

	t.Log("Write 2 blocks worth of data")
	for i := 0; i < 30; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNodes[0], data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	t.Log("Sync those blocks of data")
	err = kbfsOps.SyncAll(ctx, fileNodes[0].GetFolderBranch())
	require.NoError(t, err, "First sync failed: %v", err)

	t.Log("Retrieve the metadata for the blocks so far")
	ops := getOps(config, rootNode.GetFolderBranch().Tlf)
	lState := makeFBOLockState()
	head, _ := ops.getHead(ctx, lState, mdNoCommit)
	filePath := ops.nodeCache.PathFromNode(fileNodes[0])
	pointerMap, err := ops.blocks.GetIndirectFileBlockInfos(ctx, lState, head, filePath)
	require.NoError(t, err, "Couldn't get the pointer map for file0: %+v", err)

	t.Log("Remove that file")
	err = kbfsOps.RemoveEntry(ctx, rootNode, testPPS("file0"))
	require.NoError(t, err, "Couldn't remove file: %v", err)

	t.Log("Sync from server, waiting for the archiving to complete")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %v", err)

	t.Log("Ensure that the block references have been removed rather than just archived")
	bOps := config.BlockOps()
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, "test_user", tlf.Private)
	require.NoError(t, err)
	ptrs := make([]kbfsdata.BlockPointer, len(pointerMap))
	for _, ptr := range pointerMap {
		ptrs = append(ptrs, ptr.BlockPointer)
	}
	_, err = bOps.Delete(ctx, h.TlfID(), ptrs)
	require.NoError(t, err)

	t.Log("Create file0 again")
	fileNode2, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("file0"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	t.Log("Now write the identical first block, plus a new block and sync it.")
	err = kbfsOps.Write(ctx, fileNode2, data[:20], 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	err = kbfsOps.Write(ctx, fileNode2, data[10:30], 20)
	require.NoError(t, err, "Couldn't write file: %v", err)

	t.Log("Write all the rest of the files to sync concurrently, if any.")
	for i := 1; i < nFiles; i++ {
		name := fmt.Sprintf("Create file%d", i)
		fileNode, _, err := kbfsOps.CreateFile(
			ctx, rootNode, testPPS(name), false, NoExcl)
		require.NoError(t, err, "Couldn't create file: %v", err)
		data := make([]byte, 30)
		// Write 2 blocks worth of data
		for j := 0; j < 30; j++ {
			data[j] = byte(j + 30*i)
		}
		err = kbfsOps.Write(ctx, fileNode, data, 0)
		require.NoError(t, err, "Couldn't write file: %v", err)
		fileNodes[i] = fileNode
	}

	t.Log("Sync the initial three data blocks")
	errChan := make(chan error, 1)

	t.Log("Start the sync in a goroutine")
	go func() {
		errChan <- kbfsOps.SyncAll(ctxStallSync, fileNode2.GetFolderBranch())
	}()

	t.Log("Wait for the first block to finish (before the retry)")
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Dirty the last block and extend it, so the one that was sent as " +
		"part of the first sync is no longer part of the file.")
	err = kbfsOps.Write(ctx, fileNode2, data[10:20], 40)
	require.NoError(t, err, "Couldn't write file: %v", err)
	select {
	case syncUnstallCh <- struct{}{}:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	t.Log("Wait for the rest of the first set of blocks to finish " +
		"(before the retry)")
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

	t.Log("Once the first block of the retry comes in, cancel everything.")
	select {
	case <-onSyncStalledCh:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
	cancel2()

	t.Log("Unstall the sync.")
	close(syncUnstallCh)
	err = <-errChan
	if err != context.Canceled {
		t.Errorf("Sync got an unexpected error: %v", err)
	}

	t.Log("finish the sync.")
	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file after error: %v", err)

	gotData := make([]byte, 50)
	nr, err := kbfsOps.Read(ctx, fileNode2, gotData, 0)
	require.NoError(t, err, "Couldn't read data: %v", err)
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

	t.Log("Make sure there are no dirty blocks left at the end of the test.")
	dbcs := config.DirtyBlockCache().(*kbfsdata.DirtyBlockCacheStandard)
	numDirtyBlocks := dbcs.Size()
	if numDirtyBlocks != 0 {
		t.Errorf("%d dirty blocks left after final sync", numDirtyBlocks)
	}
	// Shutdown the MDServer to disable state checking at the end of the test,
	// since we hacked stuff a bit by deleting blocks manually rather than
	// allowing them to be garbage collected.
	config.MDServer().Shutdown()
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(context.Background(), config, StallableMDPut, 1)

	putCtx, cancel2 := context.WithCancel(putCtx)

	putCtx, err := libcontext.NewContextWithCancellationDelayer(putCtx)
	if err != nil {
		t.Fatal(err)
	}

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	errChan := make(chan error, 1)
	go func() {
		_, _, err := kbfsOps.CreateFile(
			putCtx, rootNode, testPPS("a"), false, WithExcl)
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
	require.NoError(t, err, "Create returned error: %v", err)
	ctx2 := libcontext.BackgroundContextWithCancellationDelayer()
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx2)
		require.NoError(t, err)
	}()
	if _, _, err = kbfsOps.Lookup(
		ctx2, rootNode, testPPS("a")); err != nil {
		t.Fatalf("Lookup returned error: %v", err)
	}
}

// This tests the situation where cancellation happens when the MD write has
// already started, and cancellation is delayed. A delay larger than the grace
// period is introduced to MD write, so Create should fail. This is to ensure
// Ctrl-C is able to interrupt the process eventually after the grace period.
func TestKBFSOpsCanceledCreateDelayTimeoutErrors(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// This essentially fast-forwards the grace period timer, making cancellation
	// happen much faster. This way we can avoid time.Sleep.
	config.SetDelayedCancellationGracePeriod(0)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(context.Background(), config, StallableMDPut, 1)

	putCtx, cancel2 := context.WithCancel(putCtx)

	putCtx, err := libcontext.NewContextWithCancellationDelayer(putCtx)
	if err != nil {
		t.Fatal(err)
	}

	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	errChan := make(chan error, 1)
	go func() {
		_, _, err := kbfsOps.CreateFile(
			putCtx, rootNode, testPPS("a"), false, WithExcl)
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

	ctx2 := libcontext.BackgroundContextWithCancellationDelayer()
	defer func() {
		err := libcontext.CleanupCancellationDelayer(ctx2)
		require.NoError(t, err)
	}()
	// do another Op, which generates a new revision, to make sure
	// CheckConfigAndShutdown doesn't get stuck
	if _, _, err = kbfsOps.CreateFile(ctx2,
		rootNode, testPPS("b"), false, NoExcl); err != nil {
		t.Fatalf("throwaway op failed: %v", err)
	}
}

// Test that a Sync that is canceled during a successful MD put works.
func TestKBFSOpsConcurCanceledSyncSucceeds(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	data := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data[i] = 1
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

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

	err = ops.fbm.waitForDeletingBlocks(ctx)
	require.NoError(t, err)
	if len(ops.fbm.blocksToDeleteChan) > 0 {
		t.Fatalf("Blocks left to delete after sync")
	}

	// The first put actually succeeded, so SyncFromServer and make
	// sure it worked.
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %v", err)

	gotData := make([]byte, 30)
	nr, err := kbfsOps.Read(ctx, fileNode, gotData, 0)
	require.NoError(t, err, "Couldn't read data: %v", err)
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	data := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data[i] = 1
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

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
	err = ops.fbm.waitForDeletingBlocks(ctx)
	require.NoError(t, err)
	if len(ops.fbm.blocksToDeleteChan) > 0 {
		t.Fatalf("Blocks left to delete after sync")
	}

	// Wait for CR to finish
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %v", err)
}

// Test that truncating a block to a zero-contents block, for which a
// duplicate has previously been archived, works correctly after a
// cancel.  Regression test for KBFS-727.
func TestKBFSOpsTruncateWithDupBlockCanceled(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateFile(ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	// Remove that file, and wait for the archiving to complete
	err = kbfsOps.RemoveEntry(ctx, rootNode, testPPS("a"))
	require.NoError(t, err, "Couldn't remove file: %v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %v", err)

	fileNode2, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	var data []byte
	// Write some data
	for i := 0; i < 30; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps.Write(ctx, fileNode2, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	err = kbfsOps.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err, "First sync failed: %v", err)

	// Now truncate and sync, canceling during the block puts
	err = kbfsOps.Truncate(ctx, fileNode2, 0)
	require.NoError(t, err, "Couldn't truncate file: %v", err)

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
	require.NoError(t, err, "Final sync failed: %v", err)
}

type blockOpsOverQuota struct {
	BlockOps
}

func (booq *blockOpsOverQuota) Put(ctx context.Context, tlfID tlf.ID,
	blockPtr kbfsdata.BlockPointer, readyBlockData kbfsdata.ReadyBlockData) error {
	return kbfsblock.ServerErrorOverQuota{
		Throttled: true,
	}
}

// Test that a quota error causes deferred writes to error.
// Regression test for KBFS-751.
func TestKBFSOpsErrorOnBlockedWriteDuringSync(t *testing.T) {
	t.Skip("Broken pending KBFS-1261")

	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	// Write over the dirty amount of data.  TODO: make this
	// configurable for a speedier test.
	const minSyncBufCap = int64(kbfsdata.MaxBlockSizeBytesDefault)
	data := make([]byte, minSyncBufCap+1)
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

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
	moreData := make([]byte, minSyncBufCap*2+1)
	err = kbfsOps.Write(ctx, fileNode, moreData, int64(len(data)))
	require.NoError(t, err, "Couldn't write file: %v", err)

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
		for df.NumErrListeners() != 3 {
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
	if _, ok := syncErr.(kbfsblock.ServerErrorOverQuota); !ok {
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

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
	oldRef kbfsdata.BlockRef, newPtr kbfsdata.BlockPointer) NodeID {
	select {
	case <-snc.doStallUpdate:
		<-snc.unstallUpdate
	default:
	}
	return snc.NodeCache.UpdatePointer(oldRef, newPtr)
}

func (snc *stallingNodeCache) PathFromNode(node Node) kbfsdata.Path {
	snc.beforePathsCalled <- struct{}{}
	p := snc.NodeCache.PathFromNode(node)
	snc.afterPathCalled <- struct{}{}
	return p
}

// Test that a lookup that straddles a sync from the same file doesn't
// have any races.  Regression test for KBFS-1717.
func TestKBFSOpsLookupSyncRace(t *testing.T) {
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)
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
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	fileNodeA1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	// u2 syncs and then disables updates.
	if err := kbfsOps2.SyncFromServer(
		ctx, rootNode2.GetFolderBranch(), nil); err != nil {
		t.Fatal("Couldn't sync user 2 from server")
	}
	_, err = DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err, "Couldn't disable updates: %v", err)

	// u2 writes to the file.
	data := []byte{1, 2, 3}
	err = kbfsOps1.Write(ctx, fileNodeA1, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)
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
		fileNodeA2, _, err = kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
		require.NoError(t, err, "Couldn't lookup a: %v", err)
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
		if err := kbfsOps2.SyncFromServer(
			ctx, rootNode2.GetFolderBranch(), nil); err != nil {
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
	require.NoError(t, err, "Couldn't read data: %v", err)
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
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDPut, 1)

	// Use the smallest possible block size.
	bsplitter, err := kbfsdata.NewBlockSplitterSimple(20, 8*1024, config.Codec())
	require.NoError(t, err, "Couldn't create block splitter: %v", err)
	config.SetBlockSplitter(bsplitter)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %v", err)

	data := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data[i] = 1
	}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %v", err)

	// Over write the data to cause the leaf blocks to be unreferenced.
	data2 := make([]byte, 30)
	for i := 0; i < 30; i++ {
		data2[i] = byte(i + 30)
	}
	err = kbfsOps.Write(ctx, fileNode, data2, 0)
	require.NoError(t, err, "Couldn't write file: %v", err)

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
	require.NoError(t, err, "Couldn't write file: %v", err)

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
	require.NoError(t, err, "Couldn't write file: %v", err)

	// Flush the file again.
	if err := kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch()); err != nil {
		t.Fatalf("Couldn't sync: %v", err)
	}

	gotData := make([]byte, 30)
	nr, err := kbfsOps.Read(ctx, fileNode, gotData, 0)
	require.NoError(t, err, "Couldn't read data: %v", err)
	if nr != int64(len(gotData)) {
		t.Errorf("Only read %d bytes", nr)
	}
	if !bytes.Equal(data4, gotData) {
		t.Errorf("Read wrong data.  Expected %v, got %v", data4, gotData)
	}
}

// Test that during a sync of a directory, a non-syncing file can be
// updated without losing its file size after the sync completes.
// Regression test for KBFS-4165.
func TestKBFSOpsConcurWriteOfNonsyncedFileDuringSync(t *testing.T) {
	config, _, ctx, cancel := kbfsOpsConcurInit(t, "test_user")
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)
	kbfsOps := config.KBFSOps()

	t.Log("Create and sync a 0-byte file")
	rootNode := GetRootNodeOrBust(ctx, t, config, "test_user", tlf.Private)
	fileA := "a"
	fileANode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS(fileA), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Create a second file, but stall the SyncAll")
	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config, StallableMDAfterPut, 1)

	fileB := "b"
	fileBNode, _, err := kbfsOps.CreateFile(
		ctx, rootNode, testPPS(fileB), false, NoExcl)
	require.NoError(t, err)
	dataB := []byte{1, 2, 3}
	err = kbfsOps.Write(ctx, fileBNode, dataB, 0)
	require.NoError(t, err)

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.SyncAll(putCtx, rootNode.GetFolderBranch())
	}()

	// wait until Sync gets stuck at MDOps.Put()
	select {
	case <-onPutStalledCh:
	case <-ctx.Done():
		require.NoError(t, ctx.Err())
	}

	t.Log("Write some data into the first file")
	dataA := []byte{3, 2, 1}
	err = kbfsOps.Write(ctx, fileANode, dataA, 0)
	require.NoError(t, err)
	ei, err := kbfsOps.Stat(ctx, fileANode)
	require.NoError(t, err)
	require.Equal(t, uint64(len(dataA)), ei.Size)

	t.Log("Finish the sync, and make sure the first file's data " +
		"is still available")
	close(putUnstallCh)
	err = <-errChan
	require.NoError(t, err)

	ei, err = kbfsOps.Stat(ctx, fileANode)
	require.NoError(t, err)
	require.Equal(t, uint64(len(dataA)), ei.Size)

	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
}
