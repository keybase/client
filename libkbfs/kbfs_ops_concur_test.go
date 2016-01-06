package libkbfs

import (
	"bytes"
	"errors"
	"runtime"
	"sync"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
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
	Config, keybase1.UID, context.Context) {
	return kbfsOpsInitNoMocks(t, users...)
}

// Test that only one of two concurrent GetRootMD requests can end up
// fetching the MD from the server.  The second one should wait, and
// then get it from the MD cache.
func TestKBFSOpsConcurDoubleMDGet(t *testing.T) {
	config, uid, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	n := 10
	c := make(chan error, n)
	dir := FakeTlfID(0, false)
	cl := &CounterLock{}

	ops := getOps(config, dir)
	ops.mdWriterLock.locker = cl
	for i := 0; i < n; i++ {
		go func() {
			_, _, _, err := ops.getRootNode(ctx)
			c <- err
		}()
	}
	// wait until at least the first one started
	m.enter <- struct{}{}
	close(m.enter)
	// make sure that the second goroutine has also started its write
	// call, and thus must be queued behind the first one (since we
	// are guaranteed the first one is currently running, and they
	// both need the same lock).
	for cl.GetCount() < 2 {
		runtime.Gosched()
	}
	// Now let the first one complete.  The second one should find the
	// MD in the cache, and thus never call MDOps.Get().
	m.start <- struct{}{}
	close(m.start)
	for i := 0; i < n; i++ {
		err := <-c
		if err != nil {
			t.Errorf("Got an error doing concurrent MD gets: err=(%s)", err)
		}
	}
}

// Test that a read can happen concurrently with a sync
func TestKBFSOpsConcurReadDuringSync(t *testing.T) {
	config, uid, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	// create and write to a file
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}

	// now make an MDOps that will pause during Put()
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.Sync(ctx, fileNode)
	}()

	// wait until Sync gets stuck at MDOps.Put()
	m.start <- struct{}{}

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
	m.enter <- struct{}{}
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}
}

// Test that writes can happen concurrently with a sync
func testKBFSOpsConcurWritesDuringSync(t *testing.T, n int) {
	config, uid, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	// create and write to a file
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// now make an MDOps that will pause during Put()
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.Sync(ctx, fileNode)
	}()

	// wait until Sync gets stuck at MDOps.Put()
	m.start <- struct{}{}

	expectedData := make([]byte, len(data))
	copy(expectedData, data)
	for i := 0; i < n; i++ {
		// now make sure we can write the file and see the new byte we wrote
		newData := []byte{byte(i + 2)}
		err = kbfsOps.Write(ctx, fileNode, newData, int64(i+1))
		if err != nil {
			t.Errorf("Couldn't write data: %v\n", err)
		}

		// read the data back
		buf := make([]byte, i+2)
		nr, err := kbfsOps.Read(ctx, fileNode, buf, 0)
		if err != nil {
			t.Errorf("Couldn't read data: %v\n", err)
		}
		expectedData = append(expectedData, newData...)
		if nr != int64(i+2) || !bytes.Equal(expectedData, buf) {
			t.Errorf("Got wrong data %v; expected %v", buf, expectedData)
		}
	}

	// now unblock Sync and make sure there was no error
	m.enter <- struct{}{}
	err = <-errChan
	if err != nil {
		t.Errorf("Sync got an error: %v", err)
	}

	// finally, make sure we can still read it after the sync too
	// (even though the second write hasn't been sync'd yet)
	buf2 := make([]byte, n+1)
	nr, err := kbfsOps.Read(ctx, fileNode, buf2, 0)
	if err != nil {
		t.Errorf("Couldn't read data: %v\n", err)
	}
	if nr != int64(n+1) || !bytes.Equal(expectedData, buf2) {
		t.Errorf("2nd read: Got wrong data %v; expected %v", buf2, expectedData)
	}

	// there should be 5 blocks at this point: the original root block
	// + 2 modifications (create + write), the top indirect file block
	// and a modification (write).
	numCleanBlocks := config.BlockCache().(*BlockCacheStandard).cleanTransient.Len()
	if numCleanBlocks != 5 {
		t.Errorf("Unexpected number of cached clean blocks: %d\n",
			numCleanBlocks)
	}
}

// Test that a write can happen concurrently with a sync
func TestKBFSOpsConcurWriteDuringSync(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 1)
}

// Test that multiple writes can happen concurrently with a sync
// (regression for KBFS-616)
func TestKBFSOpsConcurMultipleWritesDuringSync(t *testing.T) {
	testKBFSOpsConcurWritesDuringSync(t, 10)
}

// staller is a pair of channels. Whenever something is to be
// stalled, a value is sent on stalled (if not blocked), and then
// unstall is waited on.
type staller struct {
	stalled chan<- struct{}
	unstall <-chan struct{}
}

// stallingBlockOps is an implementation of BlockOps whose operations
// sometimes stall. In particular, if the operation name matches
// stallOpName, and ctx.Value(stallKey) is a key in the corresponding
// staller is used to stall the operation.
type stallingBlockOps struct {
	stallOpName string
	stallKey    interface{}
	stallMap    map[interface{}]staller
	delegate    BlockOps
}

var _ BlockOps = (*stallingBlockOps)(nil)

func (f *stallingBlockOps) maybeStall(ctx context.Context, opName string) {
	if opName != f.stallOpName {
		return
	}

	v := ctx.Value(f.stallKey)
	chans, ok := f.stallMap[v]
	if !ok {
		return
	}

	select {
	case chans.stalled <- struct{}{}:
	default:
	}
	<-chans.unstall
}

func (f *stallingBlockOps) Get(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer,
	block Block) error {
	f.maybeStall(ctx, "get")
	return f.delegate.Get(ctx, md, blockPtr, block)
}

func (f *stallingBlockOps) Ready(
	ctx context.Context, md *RootMetadata, block Block) (
	id BlockID, plainSize int, readyBlockData ReadyBlockData, err error) {
	f.maybeStall(ctx, "ready")
	return f.delegate.Ready(ctx, md, block)
}

func (f *stallingBlockOps) Put(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer,
	readyBlockData ReadyBlockData) error {
	f.maybeStall(ctx, "put")
	return f.delegate.Put(ctx, md, blockPtr, readyBlockData)
}

func (f *stallingBlockOps) Delete(
	ctx context.Context, md *RootMetadata, id BlockID,
	context BlockContext) error {
	f.maybeStall(ctx, "delete")
	return f.delegate.Delete(ctx, md, id, context)
}

func (f *stallingBlockOps) Archive(
	ctx context.Context, md *RootMetadata, ptrs []BlockPointer) error {
	f.maybeStall(ctx, "archive")
	return f.delegate.Archive(ctx, md, ptrs)
}

// Test that a block write can happen concurrently with a block
// read. This is a regression test for KBFS-536.
func TestKBFSOpsConcurBlockReadWrite(t *testing.T) {
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer config.Shutdown()

	// Turn off transient block caching.
	config.SetBlockCache(NewBlockCacheStandard(config, 0))

	// Create a file.
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// We only need to know the first time we stall.
	onReadStalledCh := make(chan struct{}, 1)
	onWriteStalledCh := make(chan struct{}, 1)

	readUnstallCh := make(chan struct{})
	writeUnstallCh := make(chan struct{})

	stallKey := "requestName"
	readValue := "read"
	writeValue := "write"

	config.SetBlockOps(&stallingBlockOps{
		stallOpName: "get",
		stallKey:    stallKey,
		stallMap: map[interface{}]staller{
			readValue: staller{
				stalled: onReadStalledCh,
				unstall: readUnstallCh,
			},
			writeValue: staller{
				stalled: onWriteStalledCh,
				unstall: writeUnstallCh,
			},
		},
		delegate: config.BlockOps(),
	})

	var wg sync.WaitGroup

	// Start the read and wait for it to stall.
	wg.Add(1)
	var readErr error
	go func() {
		defer wg.Done()

		readCtx := context.WithValue(ctx, stallKey, readValue)
		_, readErr = kbfsOps.GetDirChildren(readCtx, rootNode)
	}()
	<-onReadStalledCh

	// Start the write and wait for it to stall.
	wg.Add(1)
	var writeErr error
	go func() {
		defer wg.Done()

		data := []byte{1}
		writeCtx := context.WithValue(ctx, stallKey, writeValue)
		writeErr = kbfsOps.Write(writeCtx, fileNode, data, 0)
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

// mdRecordingKeyManager records the last *RootMetadata argument seen
// in its KeyManager methods.
type mdRecordingKeyManager struct {
	lastMD   *RootMetadata
	lastMDMu sync.RWMutex
	delegate KeyManager
}

func (km *mdRecordingKeyManager) getLastMD() *RootMetadata {
	km.lastMDMu.RLock()
	defer km.lastMDMu.RUnlock()
	return km.lastMD
}

func (km *mdRecordingKeyManager) setLastMD(md *RootMetadata) {
	km.lastMDMu.Lock()
	defer km.lastMDMu.Unlock()
	km.lastMD = md
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForEncryption(
	ctx context.Context, md *RootMetadata) (TLFCryptKey, error) {
	km.setLastMD(md)
	return km.delegate.GetTLFCryptKeyForEncryption(ctx, md)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, md *RootMetadata) (TLFCryptKey, error) {
	km.setLastMD(md)
	return km.delegate.GetTLFCryptKeyForMDDecryption(ctx, md)
}

func (km *mdRecordingKeyManager) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, md *RootMetadata, blockPtr BlockPointer) (
	TLFCryptKey, error) {
	km.setLastMD(md)
	return km.delegate.GetTLFCryptKeyForBlockDecryption(ctx, md, blockPtr)
}

func (km *mdRecordingKeyManager) Rekey(
	ctx context.Context, md *RootMetadata) (bool, error) {
	km.setLastMD(md)
	return km.delegate.Rekey(ctx, md)
}

// Test that a sync can happen concurrently with a write. This is a
// regression test for KBFS-558.
func TestKBFSOpsConcurBlockSyncWrite(t *testing.T) {
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer config.Shutdown()

	km := &mdRecordingKeyManager{delegate: config.KeyManager()}

	config.SetKeyManager(km)

	// Turn off block caching.
	config.SetBlockCache(NewBlockCacheStandard(config, 0))

	// Create a file.
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Write to file to mark it dirty.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %v", err)
	}

	fbo := kbfsOps.(*KBFSOpsStandard).getOps(rootNode.GetFolderBranch())
	if fbo.getState() != dirtyState {
		t.Fatal("Unexpectedly not in dirty state")
	}

	// We only need to know the first time we stall.
	onSyncStalledCh := make(chan struct{}, 1)
	syncUnstallCh := make(chan struct{})

	stallKey := "requestName"
	syncValue := "sync"

	config.SetBlockOps(&stallingBlockOps{
		stallOpName: "get",
		stallKey:    stallKey,
		stallMap: map[interface{}]staller{
			syncValue: staller{
				stalled: onSyncStalledCh,
				unstall: syncUnstallCh,
			},
		},
		delegate: config.BlockOps(),
	})

	var wg sync.WaitGroup

	// Start the sync and wait for it to stall (on getting the dir
	// block).
	wg.Add(1)
	var syncErr error
	go func() {
		defer wg.Done()

		syncCtx := context.WithValue(ctx, stallKey, syncValue)
		syncErr = kbfsOps.Sync(syncCtx, fileNode)
	}()
	<-onSyncStalledCh

	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	lState := makeFBOLockState()

	deferredWriteLen := func() int {
		fbo.blockLock.Lock(lState)
		defer fbo.blockLock.Unlock(lState)
		return len(fbo.deferredWrites)
	}()
	if deferredWriteLen != 1 {
		t.Errorf("Unexpected deferred write count %d",
			deferredWriteLen)
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

	md, err := fbo.getMDLocked(ctx, lState, mdRead)
	if err != nil {
		t.Errorf("Couldn't get MD: %v", err)
	}

	lastMD := km.getLastMD()

	if md != lastMD {
		t.Error("Last MD seen by key manager != head")
	}
}

// Test that a sync can happen concurrently with a truncate. This is a
// regression test for KBFS-558.
func TestKBFSOpsConcurBlockSyncTruncate(t *testing.T) {
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	km := &mdRecordingKeyManager{delegate: config.KeyManager()}

	config.SetKeyManager(km)

	// Turn off block caching.
	config.SetBlockCache(NewBlockCacheStandard(config, 0))

	// Create a file.
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Write to file to mark it dirty.
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write to file: %v", err)
	}

	fbo := kbfsOps.(*KBFSOpsStandard).getOps(rootNode.GetFolderBranch())
	if fbo.getState() != dirtyState {
		t.Fatal("Unexpectedly not in dirty state")
	}

	// We only need to know the first time we stall.
	onSyncStalledCh := make(chan struct{}, 1)

	syncUnstallCh := make(chan struct{})

	stallKey := "requestName"
	syncValue := "sync"

	config.SetBlockOps(&stallingBlockOps{
		stallOpName: "get",
		stallKey:    stallKey,
		stallMap: map[interface{}]staller{
			syncValue: staller{
				stalled: onSyncStalledCh,
				unstall: syncUnstallCh,
			},
		},
		delegate: config.BlockOps(),
	})

	var wg sync.WaitGroup

	// Start the sync and wait for it to stall (on getting the dir
	// block).
	wg.Add(1)
	var syncErr error
	go func() {
		defer wg.Done()

		syncCtx := context.WithValue(ctx, stallKey, syncValue)
		syncErr = kbfsOps.Sync(syncCtx, fileNode)
	}()
	<-onSyncStalledCh

	err = kbfsOps.Truncate(ctx, fileNode, 0)
	if err != nil {
		t.Errorf("Couldn't truncate file: %v", err)
	}

	lState := makeFBOLockState()

	deferredWriteLen := func() int {
		fbo.blockLock.Lock(lState)
		defer fbo.blockLock.Unlock(lState)
		return len(fbo.deferredWrites)
	}()
	if deferredWriteLen != 1 {
		t.Errorf("Unexpected deferred write count %d",
			deferredWriteLen)
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

	md, err := fbo.getMDLocked(ctx, lState, mdRead)
	if err != nil {
		t.Errorf("Couldn't get MD: %v", err)
	}

	lastMD := km.getLastMD()

	if md != lastMD {
		t.Error("Last MD seen by key manager != head")
	}
}

// Test that a sync can happen concurrently with a read for a file
// large enough to have indirect blocks without messing anything
// up. This should pass with -race. This is a regression test for
// KBFS-537.
func TestKBFSOpsConcurBlockSyncReadIndirect(t *testing.T) {
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer config.Shutdown()

	// Turn off block caching.
	config.SetBlockCache(NewBlockCacheStandard(config, 0))

	// Use the smallest block size possible.
	bsplitter, err := NewBlockSplitterSimple(20, 8*1024, config.Codec())
	if err != nil {
		t.Fatalf("Couldn't create block splitter: %v", err)
	}
	config.SetBlockSplitter(bsplitter)

	// Create a file.
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
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
			select {
			case <-readCtx.Done():
				break outer
			default:
			}

			_, err := kbfsOps.Read(readCtx, fileNode, data, 0)
			if err != nil {
				t.Fatalf("Couldn't read file: %v", err)
				break
			}
		}
	}()

	err = kbfsOps.Sync(ctx, fileNode)
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}
	cancel()
	// Wait for the read loop to finish
	<-c
}

// Test that a write can survive a folder BlockPointer update
func TestKBFSOpsConcurWriteDuringFolderUpdate(t *testing.T) {
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer config.Shutdown()

	// create and write to a file
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	data := []byte{1}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// Now update the folder pointer in some other way
	_, _, err = kbfsOps.CreateFile(ctx, rootNode, "b", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// Now sync the original file and see make sure the write survived
	if err := kbfsOps.Sync(ctx, fileNode); err != nil {
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
	config, uid, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	// make blocks small
	config.BlockSplitter().(*BlockSplitterSimple).maxSize = 5

	// create and write to a file
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	// 2 blocks worth of data
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	err = kbfsOps.Write(ctx, fileNode, data, 0)
	if err != nil {
		t.Errorf("Couldn't write file: %v", err)
	}

	// sync these initial blocks
	err = kbfsOps.Sync(ctx, fileNode)
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

	// now make an MDOps that will pause during Put()
	m := NewMDOpsConcurTest(uid)
	config.SetMDOps(m)

	// start the sync
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps.Sync(ctx, fileNode)
	}()

	// wait until Sync gets stuck at MDOps.Put()
	m.start <- struct{}{}

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
	m.enter <- struct{}{}
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
	go func() {
		m.start <- struct{}{}
		m.enter <- struct{}{}
	}()
	if err := kbfsOps.Sync(ctx, fileNode); err != nil {
		t.Errorf("Couldn't sync the final write")
	}
}

// Test that a write consisting of multiple blocks can be canceled
// before all blocks have been written.
func TestKBFSOpsConcurWriteParallelBlocksCanceled(t *testing.T) {
	if maxParallelBlockPuts <= 1 {
		t.Skip("Skipping because we are not putting blocks in parallel.")
	}
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	// give it a remote block server with a fake client
	fc := NewFakeBServerClient(nil, nil, nil)
	b := newBlockServerRemoteWithClient(ctx, config, cancelableClient{fc})
	config.SetBlockServer(b)

	// make blocks small
	blockSize := int64(5)
	config.BlockSplitter().(*BlockSplitterSimple).maxSize = blockSize

	// create and write to a file
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
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
	fc.readyChan = readyChan
	fc.goChan = goChan
	fc.finishChan = finishChan

	prevNBlocks := fc.numBlocks()
	ctx, cancel := context.WithCancel(ctx)
	go func() {
		// let the first initialBlocks blocks through.
		for i := 0; i < initialBlocks; i++ {
			<-readyChan
		}

		for i := 0; i < initialBlocks; i++ {
			goChan <- struct{}{}
		}

		for i := 0; i < initialBlocks; i++ {
			<-finishChan
		}

		// Let each parallel block worker block on readyChan.
		for i := 0; i < maxParallelBlockPuts; i++ {
			<-readyChan
		}

		// Make sure all the workers are busy.
		select {
		case <-readyChan:
			t.Error("Worker unexpectedly ready")
		default:
		}

		cancel()
	}()

	err = kbfsOps.Sync(ctx, fileNode)
	if err != context.Canceled {
		t.Errorf("Sync did not get canceled error: %v", err)
	}
	nowNBlocks := fc.numBlocks()
	if nowNBlocks != prevNBlocks+2 {
		t.Errorf("Unexpected number of blocks; prev = %d, now = %d",
			prevNBlocks, nowNBlocks)
	}

	// Now clean up by letting the rest of the blocks through.
	for i := 0; i < maxParallelBlockPuts; i++ {
		goChan <- struct{}{}
	}

	for i := 0; i < maxParallelBlockPuts; i++ {
		<-finishChan
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
	fc.readyChan = nil
	fc.goChan = nil
	fc.finishChan = nil
	ctx = context.Background()
	if err := kbfsOps.Sync(ctx, fileNode); err != nil {
		t.Fatalf("Second sync failed: %v", err)
	}

	if _, _, err := kbfsOps.CreateFile(ctx, rootNode, "b", false); err != nil {
		t.Fatalf("Couldn't create file after sync: %v", err)
	}

	// Avoid checking state when using a fake block server.
	config.MDServer().Shutdown()
}

// Test that, when writing multiple blocks in parallel, one error will
// cancel the remaining puts.
func TestKBFSOpsConcurWriteParallelBlocksError(t *testing.T) {
	config, _, ctx := kbfsOpsConcurInit(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	// give it a mock'd block server
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	defer mockCtrl.Finish()
	defer ctr.CheckForFailures()
	b := NewMockBlockServer(mockCtrl)
	config.SetBlockServer(b)

	// from the folder creation, then 2 for file creation
	c := b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).Times(3).Return(nil)
	b.EXPECT().ArchiveBlockReferences(gomock.Any(), gomock.Any(),
		gomock.Any()).AnyTimes().Return(nil)

	// make blocks small
	blockSize := int64(5)
	config.BlockSplitter().(*BlockSplitterSimple).maxSize = blockSize

	// create and write to a file
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, "test_user", false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	fileNode, _, err := kbfsOps.CreateFile(ctx, rootNode, "a", false)
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
		Do(func(ctx context.Context, id BlockID, tlfID TlfID,
		context BlockContext, buf []byte,
		serverHalf BlockCryptKeyServerHalf) {
		errPtrChan <- context.(BlockPointer)
	}).After(c).Return(putErr)
	// let the rest through
	proceedChan := make(chan struct{})
	b.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().
		Do(func(ctx context.Context, id BlockID, tlfID TlfID,
		context BlockContext, buf []byte,
		serverHalf BlockCryptKeyServerHalf) {
		<-proceedChan
	}).After(c).Return(nil)
	b.EXPECT().Shutdown().AnyTimes()

	var errPtr BlockPointer
	go func() {
		errPtr = <-errPtrChan
		close(proceedChan)
	}()

	err = kbfsOps.Sync(ctx, fileNode)
	if err != putErr {
		t.Errorf("Sync did not get the expected error: %v", err)
	}

	// wait for proceedChan to close, so we know the errPtr has been set
	<-proceedChan

	// Make sure the error'd file didn't make it to the actual cache
	// -- it's still in the permanent cache because the file might
	// still be read or sync'd later.
	config.BlockCache().DeletePermanent(errPtr.ID)
	if _, err := config.BlockCache().Get(errPtr, MasterBranch); err == nil {
		t.Errorf("Failed block put for %v left block in cache", errPtr)
	}
}
