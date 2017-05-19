// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
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
)

// testBWDelegate is a delegate we pass to tlfJournal to get info
// about its state transitions.
type testBWDelegate struct {
	t *testing.T
	// Store a context so that the tlfJournal's background context
	// will also obey the test timeout.
	testCtx    context.Context
	stateCh    chan bwState
	shutdownCh chan struct{}
}

func (d testBWDelegate) GetBackgroundContext() context.Context {
	return d.testCtx
}

func (d testBWDelegate) OnNewState(ctx context.Context, bws bwState) {
	select {
	case d.stateCh <- bws:
	case <-ctx.Done():
		assert.Fail(d.t, ctx.Err().Error())
	}
}

func (d testBWDelegate) OnShutdown(ctx context.Context) {
	select {
	case d.shutdownCh <- struct{}{}:
	case <-ctx.Done():
		assert.Fail(d.t, ctx.Err().Error())
	}
}

func (d testBWDelegate) requireNextState(
	ctx context.Context, expectedState bwState) {
	select {
	case bws := <-d.stateCh:
		require.Equal(d.t, expectedState, bws)
	case <-ctx.Done():
		assert.Fail(d.t, ctx.Err().Error())
	}
}

// testTLFJournalConfig is the config we pass to the tlfJournal, and
// also contains some helper functions for testing.
type testTLFJournalConfig struct {
	codecGetter
	logMaker
	t            *testing.T
	tlfID        tlf.ID
	splitter     BlockSplitter
	crypto       CryptoLocal
	bcache       BlockCache
	bops         BlockOps
	mdcache      MDCache
	ver          MetadataVer
	reporter     Reporter
	uid          keybase1.UID
	verifyingKey kbfscrypto.VerifyingKey
	ekg          singleEncryptionKeyGetter
	nug          normalizedUsernameGetter
	mdserver     MDServer
	dlTimeout    time.Duration
}

func (c testTLFJournalConfig) BlockSplitter() BlockSplitter {
	return c.splitter
}

func (c testTLFJournalConfig) Clock() Clock {
	return wallClock{}
}

func (c testTLFJournalConfig) Crypto() Crypto {
	return c.crypto
}

func (c testTLFJournalConfig) BlockCache() BlockCache {
	return c.bcache
}

func (c testTLFJournalConfig) BlockOps() BlockOps {
	return c.bops
}

func (c testTLFJournalConfig) MDCache() MDCache {
	return c.mdcache
}

func (c testTLFJournalConfig) MetadataVersion() MetadataVer {
	return c.ver
}

func (c testTLFJournalConfig) Reporter() Reporter {
	return c.reporter
}

func (c testTLFJournalConfig) cryptoPure() cryptoPure {
	return c.crypto
}

func (c testTLFJournalConfig) encryptionKeyGetter() encryptionKeyGetter {
	return c.ekg
}

func (c testTLFJournalConfig) mdDecryptionKeyGetter() mdDecryptionKeyGetter {
	return c.ekg
}

func (c testTLFJournalConfig) usernameGetter() normalizedUsernameGetter {
	return c.nug
}

func (c testTLFJournalConfig) MDServer() MDServer {
	return c.mdserver
}

func (c testTLFJournalConfig) diskLimitTimeout() time.Duration {
	return c.dlTimeout
}

func (c testTLFJournalConfig) BGFlushDirOpBatchSize() int {
	return 1
}

func (c testTLFJournalConfig) makeBlock(data []byte) (
	kbfsblock.ID, kbfsblock.Context, kbfscrypto.BlockCryptKeyServerHalf) {
	id, err := kbfsblock.MakePermanentID(data)
	require.NoError(c.t, err)
	bCtx := kbfsblock.MakeFirstContext(
		c.uid.AsUserOrTeam(), keybase1.BlockType_DATA)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(c.t, err)
	return id, bCtx, serverHalf
}

func (c testTLFJournalConfig) makeMD(
	revision kbfsmd.Revision, prevRoot kbfsmd.ID) *RootMetadata {
	return makeMDForTest(c.t, c.ver, c.tlfID, revision, c.uid, c.crypto, prevRoot)
}

func (c testTLFJournalConfig) checkMD(rmds *RootMetadataSigned,
	extra ExtraMetadata, expectedRevision kbfsmd.Revision,
	expectedPrevRoot kbfsmd.ID, expectedMergeStatus MergeStatus,
	expectedBranchID BranchID) {
	verifyingKey := c.crypto.SigningKeySigner.Key.GetVerifyingKey()
	checkBRMD(c.t, c.uid, verifyingKey, c.Codec(), c.Crypto(),
		rmds.MD, extra, expectedRevision, expectedPrevRoot,
		expectedMergeStatus, expectedBranchID)
	err := rmds.IsValidAndSigned(c.Codec(), c.Crypto(), extra)
	require.NoError(c.t, err)
	err = rmds.IsLastModifiedBy(c.uid, verifyingKey)
	require.NoError(c.t, err)
}

func (c testTLFJournalConfig) checkRange(rmdses []rmdsWithExtra,
	firstRevision kbfsmd.Revision, firstPrevRoot kbfsmd.ID,
	mStatus MergeStatus, bid BranchID) {
	c.checkMD(rmdses[0].rmds, rmdses[0].extra, firstRevision,
		firstPrevRoot, mStatus, bid)

	for i := 1; i < len(rmdses); i++ {
		prevID, err := kbfsmd.MakeID(c.Codec(), rmdses[i-1].rmds.MD)
		require.NoError(c.t, err)
		c.checkMD(rmdses[i].rmds, rmdses[i].extra,
			firstRevision+kbfsmd.Revision(i), prevID, mStatus, bid)
		err = rmdses[i-1].rmds.MD.CheckValidSuccessor(
			prevID, rmdses[i].rmds.MD)
		require.NoError(c.t, err)
	}
}

func setupTLFJournalTest(
	t *testing.T, ver MetadataVer, bwStatus TLFJournalBackgroundWorkStatus) (
	tempdir string, config *testTLFJournalConfig, ctx context.Context,
	cancel context.CancelFunc, tlfJournal *tlfJournal,
	delegate testBWDelegate) {
	// Set up config and dependencies.
	bsplitter := &BlockSplitterSimple{
		64 * 1024, int(64 * 1024 / bpSize), 8 * 1024}
	codec := kbfscodec.NewMsgpack()
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	crypto := NewCryptoLocal(codec, signingKey, cryptPrivateKey)
	uid := keybase1.MakeTestUID(1)
	verifyingKey := signingKey.GetVerifyingKey()
	ekg := singleEncryptionKeyGetter{kbfscrypto.MakeTLFCryptKey([32]byte{0x1})}

	cig := singleCurrentSessionGetter{
		SessionInfo{
			Name:         "fake_user",
			UID:          uid,
			VerifyingKey: verifyingKey,
		},
	}
	mdserver, err := NewMDServerMemory(newTestMDServerLocalConfig(t, cig))
	require.NoError(t, err)

	config = &testTLFJournalConfig{
		newTestCodecGetter(), newTestLogMaker(t), t, tlf.FakeID(1, false), bsplitter, crypto,
		nil, nil, NewMDCacheStandard(10), ver,
		NewReporterSimple(newTestClockNow(), 10), uid, verifyingKey, ekg, nil, mdserver, defaultDiskLimitMaxDelay + time.Second,
	}

	ctx, cancel = context.WithTimeout(
		context.Background(), individualTestTimeout)

	// Clean up the context if the rest of the setup fails.
	setupSucceeded := false
	defer func() {
		if !setupSucceeded {
			cancel()
		}
	}()

	delegate = testBWDelegate{
		t:          t,
		testCtx:    ctx,
		stateCh:    make(chan bwState),
		shutdownCh: make(chan struct{}),
	}

	tempdir, err = ioutil.TempDir(os.TempDir(), "tlf_journal")
	require.NoError(t, err)

	// Clean up the tempdir if anything in the rest of the setup
	// fails.
	defer func() {
		if !setupSucceeded {
			err := ioutil.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	delegateBlockServer := NewBlockServerMemory(config.MakeLogger(""))

	diskLimitSemaphore := newSemaphoreDiskLimiter(
		math.MaxInt64, math.MaxInt64, math.MaxInt64)
	tlfJournal, err = makeTLFJournal(ctx, uid, verifyingKey,
		tempdir, config.tlfID, config, delegateBlockServer,
		bwStatus, delegate, nil, nil, diskLimitSemaphore)
	require.NoError(t, err)

	switch bwStatus {
	case TLFJournalBackgroundWorkEnabled:
		// Read the state changes triggered by the initial
		// work signal.
		delegate.requireNextState(ctx, bwIdle)
		delegate.requireNextState(ctx, bwBusy)
		delegate.requireNextState(ctx, bwIdle)

	case TLFJournalBackgroundWorkPaused:
		delegate.requireNextState(ctx, bwPaused)

	default:
		require.FailNow(t, "Unknown bwStatus %s", bwStatus)
	}

	setupSucceeded = true
	return tempdir, config, ctx, cancel, tlfJournal, delegate
}

func teardownTLFJournalTest(
	tempdir string, config *testTLFJournalConfig, ctx context.Context,
	cancel context.CancelFunc, tlfJournal *tlfJournal,
	delegate testBWDelegate) {
	// Shutdown first so we don't get the Done() signal (from the
	// cancel() call) spuriously.
	tlfJournal.shutdown(ctx)
	select {
	case <-delegate.shutdownCh:
	case <-ctx.Done():
		assert.Fail(config.t, ctx.Err().Error())
	}

	cancel()

	select {
	case bws := <-delegate.stateCh:
		assert.Fail(config.t, "Unexpected state %s", bws)
	default:
	}

	config.mdserver.Shutdown()
	tlfJournal.delegateBlockServer.Shutdown(ctx)

	err := ioutil.RemoveAll(tempdir)
	assert.NoError(config.t, err)
}

func putOneMD(ctx context.Context, config *testTLFJournalConfig,
	tlfJournal *tlfJournal) {
	md := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	_, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
	require.NoError(config.t, err)
}

// The tests below primarily test the background work thread's
// behavior.

func testTLFJournalBasic(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	putOneMD(ctx, config, tlfJournal)

	// Wait for it to be processed.

	delegate.requireNextState(ctx, bwBusy)
	delegate.requireNextState(ctx, bwIdle)
}

func testTLFJournalPauseResume(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.pauseBackgroundWork()
	delegate.requireNextState(ctx, bwPaused)

	putOneMD(ctx, config, tlfJournal)

	// Unpause and wait for it to be processed.

	tlfJournal.resumeBackgroundWork()
	delegate.requireNextState(ctx, bwIdle)
	delegate.requireNextState(ctx, bwBusy)
	delegate.requireNextState(ctx, bwIdle)
}

func testTLFJournalPauseShutdown(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.pauseBackgroundWork()
	delegate.requireNextState(ctx, bwPaused)

	putOneMD(ctx, config, tlfJournal)

	// Should still be able to shut down while paused.
}

type hangingBlockServer struct {
	BlockServer
	// Closed on put.
	onPutCh chan struct{}
}

func (bs hangingBlockServer) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID, context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	close(bs.onPutCh)
	// Hang until the context is cancelled.
	<-ctx.Done()
	return ctx.Err()
}

func (bs hangingBlockServer) waitForPut(ctx context.Context, t *testing.T) {
	select {
	case <-bs.onPutCh:
	case <-ctx.Done():
		require.FailNow(t, ctx.Err().Error())
	}
}

func putBlock(ctx context.Context,
	t *testing.T, config *testTLFJournalConfig,
	tlfJournal *tlfJournal, data []byte) {
	id, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	require.NoError(t, err)
}

func testTLFJournalBlockOpBasic(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})
	numFlushed, rev, converted, err :=
		tlfJournal.flushBlockEntries(ctx, firstValidJournalOrdinal+1)
	require.NoError(t, err)
	require.Equal(t, 1, numFlushed)
	require.Equal(t, rev, kbfsmd.RevisionUninitialized)
	require.False(t, converted)
}

func testTLFJournalBlockOpBusyPause(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	bs := hangingBlockServer{tlfJournal.delegateBlockServer,
		make(chan struct{})}
	tlfJournal.delegateBlockServer = bs

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

	bs.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to pause while busy.

	tlfJournal.pauseBackgroundWork()
	delegate.requireNextState(ctx, bwPaused)
}

func testTLFJournalBlockOpBusyShutdown(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	bs := hangingBlockServer{tlfJournal.delegateBlockServer,
		make(chan struct{})}
	tlfJournal.delegateBlockServer = bs

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

	bs.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to shut down while busy.
}

func testTLFJournalSecondBlockOpWhileBusy(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	bs := hangingBlockServer{tlfJournal.delegateBlockServer,
		make(chan struct{})}
	tlfJournal.delegateBlockServer = bs

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

	bs.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to put a second block while busy.
	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4, 5})
}

func testTLFJournalBlockOpDiskByteLimit(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(ctx, math.MaxInt64-6, 0, 0)

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

	errCh := make(chan error, 1)
	go func() {
		data2 := []byte{5, 6, 7}
		id, bCtx, serverHalf := config.makeBlock(data2)
		errCh <- tlfJournal.putBlockData(
			ctx, id, bCtx, data2, serverHalf)
	}()

	numFlushed, rev, converted, err :=
		tlfJournal.flushBlockEntries(ctx, firstValidJournalOrdinal+1)
	require.NoError(t, err)
	require.Equal(t, 1, numFlushed)
	require.Equal(t, rev, kbfsmd.RevisionUninitialized)
	require.False(t, converted)

	// Fake an MD flush.
	md := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	err = tlfJournal.doOnMDFlushAndRemoveFlushedMDEntry(
		ctx, kbfsmd.ID{}, &RootMetadataSigned{MD: md.bareMd})

	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}

func testTLFJournalBlockOpDiskFileLimit(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(
		ctx, 0, 0, math.MaxInt64-2*filesPerBlockMax+1)

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

	errCh := make(chan error, 1)
	go func() {
		data2 := []byte{5, 6, 7}
		id, bCtx, serverHalf := config.makeBlock(data2)
		errCh <- tlfJournal.putBlockData(
			ctx, id, bCtx, data2, serverHalf)
	}()

	numFlushed, rev, converted, err :=
		tlfJournal.flushBlockEntries(ctx, firstValidJournalOrdinal+1)
	require.NoError(t, err)
	require.Equal(t, 1, numFlushed)
	require.Equal(t, rev, kbfsmd.RevisionUninitialized)
	require.False(t, converted)

	// Fake an MD flush.
	md := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	err = tlfJournal.doOnMDFlushAndRemoveFlushedMDEntry(
		ctx, kbfsmd.ID{}, &RootMetadataSigned{MD: md.bareMd})

	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}

func testTLFJournalBlockOpDiskQuotaLimit(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(ctx, 0, math.MaxInt64-6, 0)

	data1 := []byte{1, 2, 3, 4}
	putBlock(ctx, t, config, tlfJournal, data1)

	usedQuotaBytes, quotaBytes := tlfJournal.diskLimiter.getQuotaInfo()
	require.Equal(t,
		int64(math.MaxInt64-6)+int64(len(data1)), usedQuotaBytes)
	require.Equal(t, int64(math.MaxInt64), quotaBytes)

	data2 := []byte{5, 6, 7}
	errCh := make(chan error, 1)
	go func() {
		id, bCtx, serverHalf := config.makeBlock(data2)
		errCh <- tlfJournal.putBlockData(
			ctx, id, bCtx, data2, serverHalf)
	}()

	numFlushed, rev, converted, err :=
		tlfJournal.flushBlockEntries(ctx, firstValidJournalOrdinal+1)
	require.NoError(t, err)
	require.Equal(t, 1, numFlushed)
	require.Equal(t, rev, kbfsmd.RevisionUninitialized)
	require.False(t, converted)

	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	usedQuotaBytes, quotaBytes = tlfJournal.diskLimiter.getQuotaInfo()
	require.Equal(t,
		int64(math.MaxInt64-6)+int64(len(data2)), usedQuotaBytes)
	require.Equal(t, int64(math.MaxInt64), quotaBytes)
}

func testTLFJournalBlockOpDiskQuotaLimitResolve(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(ctx, 0, math.MaxInt64-6, 0)

	data1 := []byte{1, 2, 3, 4}
	id1, bCtx1, serverHalf1 := config.makeBlock(data1)
	err := tlfJournal.putBlockData(ctx, id1, bCtx1, data1, serverHalf1)
	require.NoError(t, err)

	usedQuotaBytes, quotaBytes := tlfJournal.diskLimiter.getQuotaInfo()
	require.Equal(t,
		int64(math.MaxInt64-6)+int64(len(data1)), usedQuotaBytes)
	require.Equal(t, int64(math.MaxInt64), quotaBytes)

	data2 := []byte{5, 6, 7}
	errCh := make(chan error, 1)
	go func() {
		id2, bCtx2, serverHalf2 := config.makeBlock(data2)
		errCh <- tlfJournal.putBlockData(
			ctx, id2, bCtx2, data2, serverHalf2)
	}()

	md1 := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	irmd, err := tlfJournal.putMD(ctx, md1, tlfJournal.key)
	require.NoError(t, err)
	mdID1 := irmd.mdID

	err = tlfJournal.convertMDsToBranch(ctx)
	require.NoError(t, err)

	bid, err := tlfJournal.getBranchID()
	require.NoError(t, err)

	// Ignore the block instead of flushing it.
	md2 := config.makeMD(kbfsmd.RevisionInitial+1, mdID1)
	_, retry, err := tlfJournal.doResolveBranch(
		ctx, bid, []kbfsblock.ID{id1}, md2,
		unflushedPathMDInfo{}, unflushedPathsPerRevMap{}, tlfJournal.key)
	require.NoError(t, err)
	require.False(t, retry)

	select {
	case err := <-errCh:
		require.NoError(t, err)
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	usedQuotaBytes, quotaBytes = tlfJournal.diskLimiter.getQuotaInfo()
	require.Equal(t,
		int64(math.MaxInt64-6)+int64(len(data2)), usedQuotaBytes)
	require.Equal(t, int64(math.MaxInt64), quotaBytes)
}

func testTLFJournalBlockOpDiskLimitDuplicate(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(
		ctx, math.MaxInt64-8, 0, math.MaxInt64-2*filesPerBlockMax)

	data := []byte{1, 2, 3, 4}
	id, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	require.NoError(t, err)

	// This should acquire some bytes and files, but then release
	// them.
	err = tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	require.NoError(t, err)

	// If the above incorrectly does not release bytes or files,
	// this will hang.
	err = tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	require.NoError(t, err)
}

func testTLFJournalBlockOpDiskLimitCancel(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(ctx, math.MaxInt64, 0, 0)

	ctx2, cancel2 := context.WithCancel(ctx)
	cancel2()

	data := []byte{1, 2, 3, 4}
	id, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx2, id, bCtx, data, serverHalf)
	require.Equal(t, context.Canceled, errors.Cause(err))
}

func testTLFJournalBlockOpDiskLimitTimeout(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(
		ctx, math.MaxInt64, 0, math.MaxInt64-1)
	config.dlTimeout = 3 * time.Microsecond

	data := []byte{1, 2, 3, 4}
	id, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	timeoutErr, ok := errors.Cause(err).(*ErrDiskLimitTimeout)
	require.True(t, ok)
	require.Error(t, timeoutErr.err)
	timeoutErr.err = nil
	require.Equal(t, ErrDiskLimitTimeout{
		3 * time.Microsecond, int64(len(data)),
		filesPerBlockMax, 0, 1, 0, 1, math.MaxInt64, math.MaxInt64, nil, false,
	}, *timeoutErr)
}

func testTLFJournalBlockOpDiskLimitPutFailure(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	tlfJournal.diskLimiter.onJournalEnable(
		ctx, math.MaxInt64-6, 0, math.MaxInt64-filesPerBlockMax)

	data := []byte{1, 2, 3, 4}
	id, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, id, bCtx, []byte{1}, serverHalf)
	require.IsType(t, kbfshash.HashMismatchError{}, errors.Cause(err))

	// If the above incorrectly does not release bytes or files from
	// diskLimiter on error, this will hang.
	err = tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	require.NoError(t, err)
}

type hangingMDServer struct {
	MDServer
	// Closed on put.
	onPutCh chan struct{}
}

func (md hangingMDServer) Put(
	ctx context.Context, rmds *RootMetadataSigned, _ ExtraMetadata) error {
	close(md.onPutCh)
	// Hang until the context is cancelled.
	<-ctx.Done()
	return ctx.Err()
}

func (md hangingMDServer) waitForPut(ctx context.Context, t *testing.T) {
	select {
	case <-md.onPutCh:
	case <-ctx.Done():
		require.FailNow(t, ctx.Err().Error())
	}
}

func testTLFJournalMDServerBusyPause(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	mdserver := hangingMDServer{config.MDServer(), make(chan struct{})}
	config.mdserver = mdserver

	md := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	_, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
	require.NoError(t, err)

	mdserver.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to pause while busy.

	tlfJournal.pauseBackgroundWork()
	delegate.requireNextState(ctx, bwPaused)
}

func testTLFJournalMDServerBusyShutdown(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	mdserver := hangingMDServer{config.MDServer(), make(chan struct{})}
	config.mdserver = mdserver

	md := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	_, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
	require.NoError(t, err)

	mdserver.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to shutdown while busy.
}

func testTLFJournalBlockOpWhileBusy(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	mdserver := hangingMDServer{config.MDServer(), make(chan struct{})}
	config.mdserver = mdserver

	md := config.makeMD(kbfsmd.RevisionInitial, kbfsmd.ID{})
	_, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
	require.NoError(t, err)

	mdserver.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to put a block while busy.
	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})
}

type rmdsWithExtra struct {
	rmds  *RootMetadataSigned
	extra ExtraMetadata
}

type shimMDServer struct {
	MDServer
	rmdses          []rmdsWithExtra
	nextGetRange    []*RootMetadataSigned
	nextErr         error
	getForTLFCalled bool
}

func (s *shimMDServer) GetRange(
	ctx context.Context, id tlf.ID, bid BranchID, mStatus MergeStatus,
	start, stop kbfsmd.Revision) ([]*RootMetadataSigned, error) {
	rmdses := s.nextGetRange
	s.nextGetRange = nil
	return rmdses, nil
}

func (s *shimMDServer) Put(ctx context.Context, rmds *RootMetadataSigned,
	extra ExtraMetadata) error {
	if s.nextErr != nil {
		err := s.nextErr
		s.nextErr = nil
		return err
	}
	s.rmdses = append(s.rmdses, rmdsWithExtra{rmds, extra})

	// Pretend all cancels happen after the actual put.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	return nil
}

func (s *shimMDServer) GetForTLF(
	ctx context.Context, id tlf.ID, bid BranchID, mStatus MergeStatus) (
	*RootMetadataSigned, error) {
	s.getForTLFCalled = true
	if len(s.rmdses) == 0 {
		return nil, nil
	}
	return s.rmdses[len(s.rmdses)-1].rmds, nil
}

func (s *shimMDServer) IsConnected() bool {
	return true
}

func (s *shimMDServer) Shutdown() {
}

func requireJournalEntryCounts(t *testing.T, j *tlfJournal,
	expectedBlockEntryCount, expectedMDEntryCount uint64) {
	blockEntryCount, mdEntryCount, err := j.getJournalEntryCounts()
	require.NoError(t, err)
	require.Equal(t, expectedBlockEntryCount, blockEntryCount)
	require.Equal(t, expectedMDEntryCount, mdEntryCount)
}

// The tests below test tlfJournal's MD flushing behavior.

func testTLFJournalFlushMDBasic(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	firstRevision := kbfsmd.Revision(10)
	firstPrevRoot := kbfsmd.FakeID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	// Flush all entries.
	var mdserver shimMDServer
	config.mdserver = &mdserver

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	for i := 0; i < mdCount; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd)
		require.NoError(t, err)
		require.True(t, flushed)
	}
	flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd)
	require.NoError(t, err)
	require.False(t, flushed)
	requireJournalEntryCounts(t, tlfJournal, uint64(mdCount), 0)
	testMDJournalGCd(t, tlfJournal.mdJournal)

	// Check RMDSes on the server.

	rmdses := mdserver.rmdses
	require.Equal(t, mdCount, len(rmdses))
	config.checkRange(
		rmdses, firstRevision, firstPrevRoot, Merged, NullBranchID)
}

func testTLFJournalFlushMDConflict(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	firstRevision := kbfsmd.Revision(10)
	firstPrevRoot := kbfsmd.FakeID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount/2; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	var mdserver shimMDServer
	mdserver.nextErr = kbfsmd.ServerErrorConflictRevision{}
	config.mdserver = &mdserver

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	// Simulate a flush with a conflict error halfway through.
	{
		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd)
		require.NoError(t, err)
		require.False(t, flushed)

		revision := firstRevision + kbfsmd.Revision(mdCount/2)
		md := config.makeMD(revision, prevRoot)
		_, err = tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.IsType(t, MDJournalConflictError{}, err)

		md.SetUnmerged()
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	for i := mdCount/2 + 1; i < mdCount; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		md.SetUnmerged()
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	// The journal won't flush anything while on a branch.
	requireJournalEntryCounts(t, tlfJournal, uint64(mdCount), uint64(mdCount))
}

// orderedBlockServer and orderedMDServer appends onto their shared
// puts slice when their Put() methods are called.

type orderedBlockServer struct {
	BlockServer
	lock      *sync.Mutex
	puts      *[]interface{}
	onceOnPut func()
}

func (s *orderedBlockServer) Put(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID, context kbfsblock.Context,
	buf []byte, serverHalf kbfscrypto.BlockCryptKeyServerHalf) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	*s.puts = append(*s.puts, id)
	if s.onceOnPut != nil {
		s.onceOnPut()
		s.onceOnPut = nil
	}
	return nil
}

func (s *orderedBlockServer) Shutdown(context.Context) {}

type orderedMDServer struct {
	MDServer
	lock      *sync.Mutex
	puts      *[]interface{}
	onceOnPut func() error
}

func (s *orderedMDServer) Put(
	ctx context.Context, rmds *RootMetadataSigned, _ ExtraMetadata) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	*s.puts = append(*s.puts, rmds.MD.RevisionNumber())
	if s.onceOnPut != nil {
		err := s.onceOnPut()
		s.onceOnPut = nil
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *orderedMDServer) Shutdown() {}

func testTLFJournalGCd(t *testing.T, tlfJournal *tlfJournal) {
	// The root dir shouldn't exist.
	_, err := ioutil.Stat(tlfJournal.dir)
	require.True(t, ioutil.IsNotExist(err))

	func() {
		tlfJournal.journalLock.Lock()
		defer tlfJournal.journalLock.Unlock()
		unflushedPaths := tlfJournal.unflushedPaths.getUnflushedPaths()
		require.Nil(t, unflushedPaths)
		require.Equal(t, uint64(0), tlfJournal.unsquashedBytes)
		require.Equal(t, 0, len(tlfJournal.flushingBlocks))
	}()

	requireJournalEntryCounts(t, tlfJournal, 0, 0)

	// Check child journals.
	testBlockJournalGCd(t, tlfJournal.blockJournal)
	testMDJournalGCd(t, tlfJournal.mdJournal)
}

// testTLFJournalFlushOrdering tests that we respect the relative
// orderings of blocks and MD ops when flushing, i.e. if a block op
// was added to the block journal before an MD op was added to the MD
// journal, then that block op will be flushed before that MD op.
func testTLFJournalFlushOrdering(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	bid1, bCtx1, serverHalf1 := config.makeBlock([]byte{1})
	bid2, bCtx2, serverHalf2 := config.makeBlock([]byte{2})
	bid3, bCtx3, serverHalf3 := config.makeBlock([]byte{3})

	md1 := config.makeMD(kbfsmd.Revision(10), kbfsmd.FakeID(1))

	var lock sync.Mutex
	var puts []interface{}

	bserver := orderedBlockServer{
		lock: &lock,
		puts: &puts,
	}

	tlfJournal.delegateBlockServer.Shutdown(ctx)
	tlfJournal.delegateBlockServer = &bserver

	mdserver := orderedMDServer{
		lock: &lock,
		puts: &puts,
	}

	config.mdserver = &mdserver

	// bid1 is-put-before kbfsmd.Revision(10).
	err := tlfJournal.putBlockData(
		ctx, bid1, bCtx1, []byte{1}, serverHalf1)
	require.NoError(t, err)
	irmd, err := tlfJournal.putMD(ctx, md1, tlfJournal.key)
	require.NoError(t, err)
	prevRoot := irmd.mdID

	bserver.onceOnPut = func() {
		// bid2 is-put-before kbfsmd.Revision(11).
		err := tlfJournal.putBlockData(
			ctx, bid2, bCtx2, []byte{2}, serverHalf2)
		require.NoError(t, err)
		md2 := config.makeMD(kbfsmd.Revision(11), prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md2, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	mdserver.onceOnPut = func() error {
		// bid3 is-put-before kbfsmd.Revision(12).
		err := tlfJournal.putBlockData(
			ctx, bid3, bCtx3, []byte{3}, serverHalf3)
		require.NoError(t, err)
		md3 := config.makeMD(kbfsmd.Revision(12), prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md3, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
		return nil
	}

	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	testTLFJournalGCd(t, tlfJournal)

	// These two orderings depend on the exact flushing process,
	// but there are other possible orderings which respect the
	// above is-put-before constraints and also respect the
	// kbfsmd.Revision ordering.
	expectedPuts1 := []interface{}{
		bid1, kbfsmd.Revision(10), bid2, bid3,
		kbfsmd.Revision(11), kbfsmd.Revision(12),
	}
	// This is possible since block puts are done in parallel.
	expectedPuts2 := []interface{}{
		bid1, kbfsmd.Revision(10), bid3, bid2,
		kbfsmd.Revision(11), kbfsmd.Revision(12),
	}
	require.True(t, reflect.DeepEqual(puts, expectedPuts1) ||
		reflect.DeepEqual(puts, expectedPuts2),
		"Expected %v or %v, got %v", expectedPuts1,
		expectedPuts2, puts)
}

// testTLFJournalFlushOrderingAfterSquashAndCR tests that after a
// branch is squashed multiple times, and then hits a conflict, the
// blocks are flushed completely before the conflict-resolving MD.
func testTLFJournalFlushOrderingAfterSquashAndCR(
	t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)
	tlfJournal.forcedSquashByBytes = 20

	firstRev := kbfsmd.Revision(10)
	firstPrevRoot := kbfsmd.FakeID(1)
	md1 := config.makeMD(firstRev, firstPrevRoot)

	var lock sync.Mutex
	var puts []interface{}

	bserver := orderedBlockServer{
		lock: &lock,
		puts: &puts,
	}

	tlfJournal.delegateBlockServer.Shutdown(ctx)
	tlfJournal.delegateBlockServer = &bserver

	var mdserverShim shimMDServer
	mdserver := orderedMDServer{
		MDServer: &mdserverShim,
		lock:     &lock,
		puts:     &puts,
	}

	config.mdserver = &mdserver

	// Put almost a full batch worth of block before revs 10 and 11.
	blockEnd := uint64(maxJournalBlockFlushBatchSize - 1)
	for i := uint64(0); i < blockEnd; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}

	irmd, err := tlfJournal.putMD(ctx, md1, tlfJournal.key)
	require.NoError(t, err)
	prevRoot := irmd.mdID
	md2 := config.makeMD(firstRev+1, prevRoot)
	require.NoError(t, err)
	irmd, err = tlfJournal.putMD(ctx, md2, tlfJournal.key)
	require.NoError(t, err)
	prevRoot = irmd.mdID

	// Squash revs 10 and 11.  No blocks should actually be flushed
	// yet.
	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	require.Equal(
		t, PendingLocalSquashBranchID, tlfJournal.mdJournal.getBranchID())
	requireJournalEntryCounts(t, tlfJournal, blockEnd+2, 2)

	squashMD := config.makeMD(firstRev, firstPrevRoot)
	irmd, err = tlfJournal.resolveBranch(ctx,
		PendingLocalSquashBranchID, []kbfsblock.ID{}, squashMD, tlfJournal.key)
	require.NoError(t, err)
	prevRoot = irmd.mdID
	requireJournalEntryCounts(t, tlfJournal, blockEnd+3, 1)

	// Another revision 11, with a squashable number of blocks to
	// complete the initial batch.
	for i := blockEnd; i < blockEnd+20; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}
	blockEnd += 20
	md2 = config.makeMD(firstRev+1, prevRoot)
	require.NoError(t, err)
	irmd, err = tlfJournal.putMD(ctx, md2, tlfJournal.key)
	require.NoError(t, err)
	prevRoot = irmd.mdID

	// Let it squash (avoiding a branch this time since there's only one MD).
	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, tlfJournal.mdJournal.getBranchID())
	requireJournalEntryCounts(t, tlfJournal, blockEnd+4, 2)

	// Simulate an MD conflict and try to flush again.  This will
	// flush a full batch of blocks before hitting the conflict, as
	// well as the marker for rev 10.
	mdserver.onceOnPut = func() error {
		return kbfsmd.ServerErrorConflictRevision{}
	}
	mergedBare := config.makeMD(md2.Revision(), firstPrevRoot).bareMd
	mergedBare.SetSerializedPrivateMetadata([]byte{1})
	rmds, err := SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(),
		mergedBare, time.Now())
	require.NoError(t, err)
	mdserverShim.nextGetRange = []*RootMetadataSigned{rmds}
	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	branchID := tlfJournal.mdJournal.getBranchID()
	require.NotEqual(t, PendingLocalSquashBranchID, branchID)
	require.NotEqual(t, NullBranchID, branchID)
	// Blocks: All the unflushed blocks, plus two unflushed rev markers.
	requireJournalEntryCounts(
		t, tlfJournal, blockEnd-maxJournalBlockFlushBatchSize+2, 2)

	// More blocks that are part of the resolution.
	blockEnd2 := blockEnd + maxJournalBlockFlushBatchSize + 2
	for i := blockEnd; i < blockEnd2; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}

	// Use revision 11 (as if two revisions had been merged by another
	// device).
	resolveMD := config.makeMD(md2.Revision(), firstPrevRoot)
	_, err = tlfJournal.resolveBranch(
		ctx, branchID, []kbfsblock.ID{}, resolveMD, tlfJournal.key)
	require.NoError(t, err)
	// Blocks: the ones from the last check, plus the new blocks, plus
	// the resolve rev marker.
	requireJournalEntryCounts(
		t, tlfJournal, blockEnd2-maxJournalBlockFlushBatchSize+3, 1)

	// Flush everything remaining.  All blocks should be flushed after
	// `resolveMD`.
	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	testTLFJournalGCd(t, tlfJournal)

	require.Equal(t, resolveMD.Revision(), puts[len(puts)-1])
}

// testTLFJournalFlushInterleaving tests that we interleave block and
// MD ops while respecting the relative orderings of blocks and MD ops
// when flushing.
func testTLFJournalFlushInterleaving(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	var lock sync.Mutex
	var puts []interface{}

	bserver := orderedBlockServer{
		lock: &lock,
		puts: &puts,
	}

	tlfJournal.delegateBlockServer.Shutdown(ctx)
	tlfJournal.delegateBlockServer = &bserver

	var mdserverShim shimMDServer
	mdserver := orderedMDServer{
		MDServer: &mdserverShim,
		lock:     &lock,
		puts:     &puts,
	}

	config.mdserver = &mdserver

	// Revision 1
	var bids []kbfsblock.ID
	rev1BlockEnd := maxJournalBlockFlushBatchSize * 2
	for i := 0; i < rev1BlockEnd; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}
	md1 := config.makeMD(kbfsmd.Revision(10), kbfsmd.FakeID(1))
	irmd, err := tlfJournal.putMD(ctx, md1, tlfJournal.key)
	require.NoError(t, err)
	prevRoot := irmd.mdID

	// Revision 2
	rev2BlockEnd := rev1BlockEnd + maxJournalBlockFlushBatchSize*2
	for i := rev1BlockEnd; i < rev2BlockEnd; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}
	md2 := config.makeMD(kbfsmd.Revision(11), prevRoot)
	irmd, err = tlfJournal.putMD(ctx, md2, tlfJournal.key)
	require.NoError(t, err)
	prevRoot = irmd.mdID

	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	testTLFJournalGCd(t, tlfJournal)

	// Make sure the flusher checks in between block flushes for
	// conflicting MDs on the server.
	require.True(t, mdserverShim.getForTLFCalled)

	// Make sure that: before revision 1, all the rev1 blocks were
	// put; rev2 comes last; some blocks are put between the two.
	bidsSeen := make(map[kbfsblock.ID]bool)
	md1Slot := 0
	md2Slot := 0
	for i, put := range puts {
		if bid, ok := put.(kbfsblock.ID); ok {
			t.Logf("Saw bid %s at %d", bid, i)
			bidsSeen[bid] = true
			continue
		}

		mdID, ok := put.(kbfsmd.Revision)
		require.True(t, ok)
		if mdID == md1.Revision() {
			md1Slot = i
			for j := 0; j < rev1BlockEnd; j++ {
				t.Logf("Checking bid %s at %d", bids[j], i)
				require.True(t, bidsSeen[bids[j]])
			}
		} else if mdID == md2.Revision() {
			md2Slot = i
			require.NotZero(t, md1Slot)
			require.True(t, md1Slot+1 < i)
			require.Equal(t, i, len(puts)-1)
		}
	}
	require.NotZero(t, md1Slot)
	require.NotZero(t, md2Slot)
}

type testBranchChangeListener struct {
	c chan<- struct{}
}

func (tbcl testBranchChangeListener) onTLFBranchChange(_ tlf.ID, _ BranchID) {
	tbcl.c <- struct{}{}
}

func testTLFJournalPauseBlocksAndConvertBranch(t *testing.T,
	ctx context.Context, tlfJournal *tlfJournal, config *testTLFJournalConfig) (
	firstRev kbfsmd.Revision, firstRoot kbfsmd.ID,
	retUnpauseBlockPutCh chan<- struct{}, retErrCh <-chan error,
	blocksLeftAfterFlush uint64, mdsLeftAfterFlush uint64) {
	branchCh := make(chan struct{}, 1)
	tlfJournal.onBranchChange = testBranchChangeListener{branchCh}

	var lock sync.Mutex
	var puts []interface{}

	unpauseBlockPutCh := make(chan struct{})
	bserver := orderedBlockServer{
		lock:      &lock,
		puts:      &puts,
		onceOnPut: func() { <-unpauseBlockPutCh },
	}

	tlfJournal.delegateBlockServer.Shutdown(ctx)
	tlfJournal.delegateBlockServer = &bserver

	// Revision 1
	var bids []kbfsblock.ID
	rev1BlockEnd := maxJournalBlockFlushBatchSize * 2
	for i := 0; i < rev1BlockEnd; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}
	firstRev = kbfsmd.Revision(10)
	firstRoot = kbfsmd.FakeID(1)
	md1 := config.makeMD(firstRev, firstRoot)
	irmd, err := tlfJournal.putMD(ctx, md1, tlfJournal.key)
	require.NoError(t, err)
	prevRoot := irmd.mdID
	rev := firstRev

	// Now start the blocks flushing.  One of the block puts will be
	// stuck.  During that time, put a lot more MD revisions, enough
	// to trigger branch conversion.  However, no pause should be
	// called.

	errCh := make(chan error, 1)
	go func() {
		errCh <- tlfJournal.flush(ctx)
	}()

	markers := uint64(1)
	for i := 0; i < ForcedBranchSquashRevThreshold+1; i++ {
		rev++
		md := config.makeMD(rev, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		if isRevisionConflict(err) {
			// Branch conversion is done, we can stop now.
			break
		}
		require.NoError(t, err)
		prevRoot = irmd.mdID
		markers++
	}

	// Wait for the local squash branch to appear.
	select {
	case <-branchCh:
	case <-ctx.Done():
		t.Fatalf("Timeout while waiting for branch change")
	}

	return firstRev, firstRoot, unpauseBlockPutCh, errCh,
		maxJournalBlockFlushBatchSize + markers, markers
}

// testTLFJournalConvertWhileFlushing tests that we can do branch
// conversion while blocks are still flushing.
func testTLFJournalConvertWhileFlushing(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	_, _, unpauseBlockPutCh, errCh, blocksLeftAfterFlush, mdsLeftAfterFlush :=
		testTLFJournalPauseBlocksAndConvertBranch(t, ctx, tlfJournal, config)

	// Now finish the block put, and let the flush finish.  We should
	// be on a local squash branch now.
	unpauseBlockPutCh <- struct{}{}
	err := <-errCh
	require.NoError(t, err)

	// Should be a full batch worth of blocks left, plus all the
	// revision markers above.  No squash has actually happened yet,
	// so all the revisions should be there now, just on a branch.
	requireJournalEntryCounts(
		t, tlfJournal, blocksLeftAfterFlush, mdsLeftAfterFlush)
	require.Equal(
		t, PendingLocalSquashBranchID, tlfJournal.mdJournal.getBranchID())
}

// testTLFJournalSquashWhileFlushing tests that we can do journal
// coalescing while blocks are still flushing.
func testTLFJournalSquashWhileFlushing(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	firstRev, firstPrevRoot, unpauseBlockPutCh, errCh,
		blocksLeftAfterFlush, _ :=
		testTLFJournalPauseBlocksAndConvertBranch(t, ctx, tlfJournal, config)

	// While it's paused, resolve the branch.
	resolveMD := config.makeMD(firstRev, firstPrevRoot)
	_, err := tlfJournal.resolveBranch(ctx,
		tlfJournal.mdJournal.getBranchID(), []kbfsblock.ID{}, resolveMD,
		tlfJournal.key)
	require.NoError(t, err)
	requireJournalEntryCounts(
		t, tlfJournal, blocksLeftAfterFlush+maxJournalBlockFlushBatchSize+1, 1)

	// Now finish the block put, and let the flush finish.  We
	// shouldn't be on a branch anymore.
	unpauseBlockPutCh <- struct{}{}
	err = <-errCh
	require.NoError(t, err)

	// Since flush() never saw the branch in conflict, it will finish
	// flushing everything.
	testTLFJournalGCd(t, tlfJournal)
	require.Equal(t, NullBranchID, tlfJournal.mdJournal.getBranchID())
}

type testImmediateBackOff struct {
	numBackOffs int
	resetCh     chan<- struct{}
}

func (t *testImmediateBackOff) NextBackOff() time.Duration {
	t.numBackOffs++
	return 1 * time.Nanosecond
}

func (t *testImmediateBackOff) Reset() {
	close(t.resetCh)
}

func testTLFJournalFlushRetry(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	// Stop the current background loop; replace with one that retries
	// immediately.
	tlfJournal.needShutdownCh <- struct{}{}
	<-tlfJournal.backgroundShutdownCh
	resetCh := make(chan struct{})
	b := &testImmediateBackOff{resetCh: resetCh}
	tlfJournal.backgroundShutdownCh = make(chan struct{})
	go tlfJournal.doBackgroundWorkLoop(TLFJournalBackgroundWorkPaused, b)
	select {
	case <-delegate.shutdownCh:
	case <-ctx.Done():
		assert.Fail(config.t, ctx.Err().Error())
	}

	firstRevision := kbfsmd.Revision(10)
	firstPrevRoot := kbfsmd.FakeID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	var mdserver shimMDServer
	mdserver.nextErr = errors.New("Error to force a retry")
	config.mdserver = &mdserver

	delegate.requireNextState(ctx, bwPaused)
	tlfJournal.resumeBackgroundWork()
	delegate.requireNextState(ctx, bwIdle)
	delegate.requireNextState(ctx, bwBusy)
	delegate.requireNextState(ctx, bwIdle)
	delegate.requireNextState(ctx, bwBusy)
	delegate.requireNextState(ctx, bwIdle)
	<-resetCh

	require.Equal(t, b.numBackOffs, 1)
	testTLFJournalGCd(t, tlfJournal)
}

func testTLFJournalResolveBranch(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	var bids []kbfsblock.ID
	for i := 0; i < 3; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}

	firstRevision := kbfsmd.Revision(10)
	firstPrevRoot := kbfsmd.FakeID(1)
	mdCount := 3

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	var mdserver shimMDServer
	mdserver.nextErr = kbfsmd.ServerErrorConflictRevision{}
	config.mdserver = &mdserver

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	// This will convert to a branch.
	flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd)
	require.NoError(t, err)
	require.False(t, flushed)

	// The background worker was already paused, so we won't get a
	// paused signal here.  But resume the background work now so that
	// later when the conflict resolves, it will be able to send a
	// resume signal.
	tlfJournal.resumeBackgroundWork()

	// Resolve the branch.
	resolveMD := config.makeMD(firstRevision, firstPrevRoot)
	_, err = tlfJournal.resolveBranch(ctx,
		tlfJournal.mdJournal.getBranchID(), []kbfsblock.ID{bids[1]}, resolveMD,
		tlfJournal.key)
	require.NoError(t, err)

	blockEnd, newMDEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)
	require.Equal(t, firstRevision+1, newMDEnd)

	blocks, maxMD, err := tlfJournal.getNextBlockEntriesToFlush(ctx, blockEnd)
	require.NoError(t, err)
	require.Equal(t, firstRevision, maxMD)
	// 3 blocks, 3 old MD markers, 1 new MD marker
	require.Equal(t, 7, blocks.length())
	require.Len(t, blocks.puts.blockStates, 2)
	require.Len(t, blocks.adds.blockStates, 0)
	// 1 ignored block, 3 ignored MD markers, 1 real MD marker
	require.Len(t, blocks.other, 5)
	require.Equal(t, bids[0], blocks.puts.blockStates[0].blockPtr.ID)
	require.Equal(t, bids[2], blocks.puts.blockStates[1].blockPtr.ID)

	// resolveBranch resumes background work.
	delegate.requireNextState(ctx, bwIdle)
	delegate.requireNextState(ctx, bwBusy)
}

func testTLFJournalSquashByBytes(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)
	tlfJournal.forcedSquashByBytes = 10

	data := make([]byte, tlfJournal.forcedSquashByBytes+1)
	bid, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
	require.NoError(t, err)

	firstRevision := kbfsmd.Revision(10)
	firstPrevRoot := kbfsmd.FakeID(1)
	mdCount := 3

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
	}

	// This should convert it to a branch, based on the number of
	// outstanding bytes.
	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	require.Equal(
		t, PendingLocalSquashBranchID, tlfJournal.mdJournal.getBranchID())
}

// Test that the first revision of a TLF doesn't get squashed.
func testTLFJournalFirstRevNoSquash(t *testing.T, ver MetadataVer) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, ver, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)
	tlfJournal.forcedSquashByBytes = 10

	data := make([]byte, tlfJournal.forcedSquashByBytes+1)
	bid, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
	require.NoError(t, err)

	firstRevision := kbfsmd.RevisionInitial
	mdCount := 4

	var firstMdID, prevRoot kbfsmd.ID
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + kbfsmd.Revision(i)
		md := config.makeMD(revision, prevRoot)
		irmd, err := tlfJournal.putMD(ctx, md, tlfJournal.key)
		require.NoError(t, err)
		prevRoot = irmd.mdID
		if i == 0 {
			firstMdID = irmd.mdID
		}
	}

	// This should convert it to a branch, based on the number of
	// outstanding bytes.
	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	require.Equal(
		t, PendingLocalSquashBranchID, tlfJournal.mdJournal.getBranchID())
	requireJournalEntryCounts(t, tlfJournal, 5, 4)
	unsquashedRange, err := tlfJournal.getMDRange(
		ctx, NullBranchID, firstRevision, firstRevision+3)
	require.NoError(t, err)
	require.Len(t, unsquashedRange, 1)
	require.Equal(t, firstRevision, unsquashedRange[0].RevisionNumber())
	require.Equal(t, firstMdID, unsquashedRange[0].mdID)
	squashRange, err := tlfJournal.getMDRange(
		ctx, PendingLocalSquashBranchID, firstRevision, firstRevision+3)
	require.NoError(t, err)
	require.Len(t, squashRange, 3)
	require.Equal(t, firstRevision+1, squashRange[0].RevisionNumber())
}

func TestTLFJournal(t *testing.T) {
	tests := []func(*testing.T, MetadataVer){
		testTLFJournalBasic,
		testTLFJournalPauseResume,
		testTLFJournalPauseShutdown,
		testTLFJournalBlockOpBasic,
		testTLFJournalBlockOpBusyPause,
		testTLFJournalBlockOpBusyShutdown,
		testTLFJournalSecondBlockOpWhileBusy,
		testTLFJournalMDServerBusyPause,
		testTLFJournalMDServerBusyShutdown,
		testTLFJournalBlockOpWhileBusy,
		testTLFJournalBlockOpDiskByteLimit,
		testTLFJournalBlockOpDiskFileLimit,
		testTLFJournalBlockOpDiskQuotaLimit,
		testTLFJournalBlockOpDiskQuotaLimitResolve,
		testTLFJournalBlockOpDiskLimitDuplicate,
		testTLFJournalBlockOpDiskLimitCancel,
		testTLFJournalBlockOpDiskLimitTimeout,
		testTLFJournalBlockOpDiskLimitPutFailure,
		testTLFJournalFlushMDBasic,
		testTLFJournalFlushMDConflict,
		testTLFJournalFlushOrdering,
		testTLFJournalFlushOrderingAfterSquashAndCR,
		testTLFJournalFlushInterleaving,
		testTLFJournalConvertWhileFlushing,
		testTLFJournalSquashWhileFlushing,
		testTLFJournalFlushRetry,
		testTLFJournalResolveBranch,
		testTLFJournalSquashByBytes,
		testTLFJournalFirstRevNoSquash,
	}
	runTestsOverMetadataVers(t, "testTLFJournal", tests)
}
