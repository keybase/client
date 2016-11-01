// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"io/ioutil"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
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
	t            *testing.T
	tlfID        TlfID
	splitter     BlockSplitter
	codec        kbfscodec.Codec
	crypto       CryptoLocal
	bcache       BlockCache
	bops         BlockOps
	mdcache      MDCache
	reporter     Reporter
	uid          keybase1.UID
	verifyingKey kbfscrypto.VerifyingKey
	ekg          singleEncryptionKeyGetter
	nug          normalizedUsernameGetter
	mdserver     MDServer
}

func (c testTLFJournalConfig) BlockSplitter() BlockSplitter {
	return c.splitter
}

func (c testTLFJournalConfig) Clock() Clock {
	return wallClock{}
}

func (c testTLFJournalConfig) Codec() kbfscodec.Codec {
	return c.codec
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
	return defaultClientMetadataVer
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

func (c testTLFJournalConfig) MakeLogger(module string) logger.Logger {
	return logger.NewTestLogger(c.t)
}

func (c testTLFJournalConfig) makeBlock(data []byte) (
	BlockID, BlockContext, kbfscrypto.BlockCryptKeyServerHalf) {
	id, err := c.crypto.MakePermanentBlockID(data)
	require.NoError(c.t, err)
	bCtx := BlockContext{c.uid, "", ZeroBlockRefNonce}
	serverHalf, err := c.crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(c.t, err)
	return id, bCtx, serverHalf
}

func (c testTLFJournalConfig) makeMD(
	revision MetadataRevision, prevRoot MdID) *RootMetadata {
	return makeMDForTest(c.t, c.tlfID, revision, c.uid, c.crypto, prevRoot)
}

func (c testTLFJournalConfig) checkMD(rmds *RootMetadataSigned,
	expectedRevision MetadataRevision, expectedPrevRoot MdID,
	expectedMergeStatus MergeStatus, expectedBranchID BranchID) {
	verifyingKey := c.crypto.SigningKeySigner.Key.GetVerifyingKey()
	checkBRMD(c.t, c.uid, verifyingKey, c.Codec(), c.Crypto(),
		rmds.MD, expectedRevision, expectedPrevRoot,
		expectedMergeStatus, expectedBranchID)
	// MDv3 TODO: pass key bundles
	err := rmds.IsValidAndSigned(c.Codec(), c.Crypto(), nil)
	require.NoError(c.t, err)
	err = rmds.IsLastModifiedBy(c.uid, verifyingKey)
	require.NoError(c.t, err)
}

func (c testTLFJournalConfig) checkRange(rmdses []*RootMetadataSigned,
	firstRevision MetadataRevision, firstPrevRoot MdID,
	mStatus MergeStatus, bid BranchID) {
	c.checkMD(rmdses[0], firstRevision, firstPrevRoot, mStatus, bid)

	for i := 1; i < len(rmdses); i++ {
		prevID, err := c.Crypto().MakeMdID(rmdses[i-1].MD)
		require.NoError(c.t, err)
		c.checkMD(rmdses[i], firstRevision+MetadataRevision(i),
			prevID, mStatus, bid)
		err = rmdses[i-1].MD.CheckValidSuccessor(prevID, rmdses[i].MD)
		require.NoError(c.t, err)
	}
}

func setupTLFJournalTest(
	t *testing.T, bwStatus TLFJournalBackgroundWorkStatus) (
	tempdir string, config *testTLFJournalConfig, ctx context.Context,
	cancel context.CancelFunc, tlfJournal *tlfJournal,
	delegate testBWDelegate) {
	// Set up config and dependencies.
	bsplitter := &BlockSplitterSimple{64 * 1024, 8 * 1024}
	codec := kbfscodec.NewMsgpack()
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := kbfscrypto.MakeFakeCryptPrivateKeyOrBust("client crypt private")
	crypto := NewCryptoLocal(codec, signingKey, cryptPrivateKey)
	uid := keybase1.MakeTestUID(1)
	verifyingKey := signingKey.GetVerifyingKey()
	ekg := singleEncryptionKeyGetter{kbfscrypto.MakeTLFCryptKey([32]byte{0x1})}

	cig := singleCurrentInfoGetter{
		name:         "fake_user",
		uid:          uid,
		verifyingKey: verifyingKey,
	}
	mdserver, err := NewMDServerMemory(newTestMDServerLocalConfig(t, cig))
	require.NoError(t, err)

	config = &testTLFJournalConfig{
		t, FakeTlfID(1, false), bsplitter, codec, crypto,
		nil, nil, NewMDCacheStandard(10),
		NewReporterSimple(newTestClockNow(), 10), uid, verifyingKey, ekg, nil, mdserver,
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
			err := os.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	delegateBlockServer := NewBlockServerMemory(config)

	tlfJournal, err = makeTLFJournal(ctx, uid, verifyingKey,
		tempdir, config.tlfID, config, delegateBlockServer,
		bwStatus, delegate, nil, nil)
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
	tlfJournal.shutdown()
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
	tlfJournal.delegateBlockServer.Shutdown()

	err := os.RemoveAll(tempdir)
	assert.NoError(config.t, err)
}

func putOneMD(ctx context.Context, config *testTLFJournalConfig,
	tlfJournal *tlfJournal) {
	md := config.makeMD(MetadataRevisionInitial, MdID{})
	_, err := tlfJournal.putMD(ctx, md)
	require.NoError(config.t, err)
}

// The tests below primarily test the background work thread's
// behavior.

func TestTLFJournalBasic(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	putOneMD(ctx, config, tlfJournal)

	// Wait for it to be processed.

	delegate.requireNextState(ctx, bwBusy)
	delegate.requireNextState(ctx, bwIdle)
}

func TestTLFJournalPauseResume(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
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

func TestTLFJournalPauseShutdown(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
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
	ctx context.Context, tlfID TlfID, id BlockID, context BlockContext,
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

func TestTLFJournalBlockOpBasic(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})
	numFlushed, rev, err := tlfJournal.flushBlockEntries(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, 1, numFlushed)
	require.Equal(t, rev, MetadataRevisionUninitialized)
}

func TestTLFJournalBlockOpBusyPause(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
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

func TestTLFJournalBlockOpBusyShutdown(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
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

func TestTLFJournalSecondBlockOpWhileBusy(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
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

func TestTLFJournalMDServerBusyPause(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	mdserver := hangingMDServer{config.MDServer(), make(chan struct{})}
	config.mdserver = mdserver

	md := config.makeMD(MetadataRevisionInitial, MdID{})
	_, err := tlfJournal.putMD(ctx, md)
	require.NoError(t, err)

	mdserver.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to pause while busy.

	tlfJournal.pauseBackgroundWork()
	delegate.requireNextState(ctx, bwPaused)
}

func TestTLFJournalMDServerBusyShutdown(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	mdserver := hangingMDServer{config.MDServer(), make(chan struct{})}
	config.mdserver = mdserver

	md := config.makeMD(MetadataRevisionInitial, MdID{})
	_, err := tlfJournal.putMD(ctx, md)
	require.NoError(t, err)

	mdserver.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to shutdown while busy.
}

func TestTLFJournalBlockOpWhileBusy(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	mdserver := hangingMDServer{config.MDServer(), make(chan struct{})}
	config.mdserver = mdserver

	md := config.makeMD(MetadataRevisionInitial, MdID{})
	_, err := tlfJournal.putMD(ctx, md)
	require.NoError(t, err)

	mdserver.waitForPut(ctx, t)
	delegate.requireNextState(ctx, bwBusy)

	// Should still be able to put a block while busy.
	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})
}

type shimMDServer struct {
	MDServer
	rmdses       []*RootMetadataSigned
	nextGetRange []*RootMetadataSigned
	nextErr      error
}

func (s *shimMDServer) GetRange(
	ctx context.Context, id TlfID, bid BranchID, mStatus MergeStatus,
	start, stop MetadataRevision) ([]*RootMetadataSigned, error) {
	rmdses := s.nextGetRange
	s.nextGetRange = nil
	return rmdses, nil
}

func (s *shimMDServer) Put(
	ctx context.Context, rmds *RootMetadataSigned, _ ExtraMetadata) error {
	if s.nextErr != nil {
		err := s.nextErr
		s.nextErr = nil
		return err
	}
	s.rmdses = append(s.rmdses, rmds)

	// Pretend all cancels happen after the actual put.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	return nil
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

func TestTLFJournalFlushMDBasic(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := config.makeMD(revision, prevRoot)
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	// Flush all entries.
	var mdserver shimMDServer
	config.mdserver = &mdserver

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	for i := 0; i < mdCount; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
		require.NoError(t, err)
		require.True(t, flushed)
	}
	flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
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

func TestTLFJournalFlushMDConflict(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount/2; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := config.makeMD(revision, prevRoot)
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	var mdserver shimMDServer
	mdserver.nextErr = MDServerErrorConflictRevision{}
	config.mdserver = &mdserver

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	// Simulate a flush with a conflict error halfway through.
	{
		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
		require.NoError(t, err)
		require.True(t, flushed)

		revision := firstRevision + MetadataRevision(mdCount/2)
		md := config.makeMD(revision, prevRoot)
		_, err = tlfJournal.putMD(ctx, md)
		require.IsType(t, MDJournalConflictError{}, err)

		md.SetUnmerged()
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	for i := mdCount/2 + 1; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := config.makeMD(revision, prevRoot)
		md.SetUnmerged()
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	mdEnd = firstRevision + MetadataRevision(mdCount)

	// Flush remaining entries.
	for i := 0; i < mdCount-1; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
		require.NoError(t, err)
		require.True(t, flushed)
	}
	flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
	require.NoError(t, err)
	require.False(t, flushed)
	requireJournalEntryCounts(t, tlfJournal, uint64(mdCount), 0)
	testMDJournalGCd(t, tlfJournal.mdJournal)

	// Check RMDSes on the server.

	rmdses := mdserver.rmdses
	require.Equal(t, mdCount, len(rmdses))
	config.checkRange(rmdses, firstRevision, firstPrevRoot,
		Unmerged, rmdses[0].MD.BID())
}

// TestTLFJournalPreservesBranchID tests that the branch ID is
// preserved even if the journal is fully drained. This is a
// regression test for KBFS-1344.
func TestTLFJournalPreservesBranchID(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount-1; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := config.makeMD(revision, prevRoot)
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	var mdserver shimMDServer
	config.mdserver = &mdserver
	mdserver.nextErr = MDServerErrorConflictRevision{}

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	// Flush all entries, with the first one encountering a
	// conflict error.
	for i := 0; i < mdCount-1; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
		require.NoError(t, err)
		require.True(t, flushed)
	}

	flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
	require.NoError(t, err)
	require.False(t, flushed)
	requireJournalEntryCounts(t, tlfJournal, uint64(mdCount)-1, 0)
	testMDJournalGCd(t, tlfJournal.mdJournal)

	// Put last revision and flush it.
	{
		revision := firstRevision + MetadataRevision(mdCount-1)
		md := config.makeMD(revision, prevRoot)
		mdID, err := tlfJournal.putMD(ctx, md)
		require.IsType(t, MDJournalConflictError{}, err)

		md.SetUnmerged()
		mdID, err = tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID

		mdEnd++

		flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
		require.NoError(t, err)
		require.True(t, flushed)

		flushed, err = tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
		require.NoError(t, err)
		require.False(t, flushed)
		requireJournalEntryCounts(t, tlfJournal, uint64(mdCount), 0)
		testMDJournalGCd(t, tlfJournal.mdJournal)
	}

	// Check RMDSes on the server. In particular, the BranchID of
	// the last put MD should match the rest.
	rmdses := mdserver.rmdses
	require.Equal(t, mdCount, len(rmdses))
	config.checkRange(rmdses, firstRevision, firstPrevRoot, Unmerged,
		rmdses[0].MD.BID())
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
	ctx context.Context, tlfID TlfID, id BlockID, context BlockContext,
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

func (s *orderedBlockServer) Shutdown() {
}

type orderedMDServer struct {
	MDServer
	lock      *sync.Mutex
	puts      *[]interface{}
	onceOnPut func()
}

func (s *orderedMDServer) Put(
	ctx context.Context, rmds *RootMetadataSigned, _ ExtraMetadata) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	*s.puts = append(*s.puts, rmds.MD.RevisionNumber())
	if s.onceOnPut != nil {
		s.onceOnPut()
		s.onceOnPut = nil
	}
	return nil
}

func (s *orderedMDServer) Shutdown() {
}

// TestTLFJournalFlushOrdering tests that we respect the relative
// orderings of blocks and MD ops when flushing, i.e. if a block op
// was added to the block journal before an MD op was added to the MD
// journal, then that block op will be flushed before that MD op.
func TestTLFJournalFlushOrdering(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	bid1, bCtx1, serverHalf1 := config.makeBlock([]byte{1})
	bid2, bCtx2, serverHalf2 := config.makeBlock([]byte{2})
	bid3, bCtx3, serverHalf3 := config.makeBlock([]byte{3})

	md1 := config.makeMD(MetadataRevision(10), fakeMdID(1))

	var lock sync.Mutex
	var puts []interface{}

	bserver := orderedBlockServer{
		lock: &lock,
		puts: &puts,
	}

	tlfJournal.delegateBlockServer.Shutdown()
	tlfJournal.delegateBlockServer = &bserver

	mdserver := orderedMDServer{
		lock: &lock,
		puts: &puts,
	}

	config.mdserver = &mdserver

	// bid1 is-put-before MetadataRevision(10).
	err := tlfJournal.putBlockData(
		ctx, bid1, bCtx1, []byte{1}, serverHalf1)
	require.NoError(t, err)
	prevRoot, err := tlfJournal.putMD(ctx, md1)
	require.NoError(t, err)

	bserver.onceOnPut = func() {
		// bid2 is-put-before MetadataRevision(11).
		err := tlfJournal.putBlockData(
			ctx, bid2, bCtx2, []byte{2}, serverHalf2)
		require.NoError(t, err)
		md2 := config.makeMD(MetadataRevision(11), prevRoot)
		prevRoot, err = tlfJournal.putMD(ctx, md2)
		require.NoError(t, err)
	}

	mdserver.onceOnPut = func() {
		// bid3 is-put-before MetadataRevision(12).
		err := tlfJournal.putBlockData(
			ctx, bid3, bCtx3, []byte{3}, serverHalf3)
		require.NoError(t, err)
		md3 := config.makeMD(MetadataRevision(12), prevRoot)
		prevRoot, err = tlfJournal.putMD(ctx, md3)
		require.NoError(t, err)
	}

	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	requireJournalEntryCounts(t, tlfJournal, 0, 0)
	testMDJournalGCd(t, tlfJournal.mdJournal)

	// These two orderings depend on the exact flushing process,
	// but there are other possible orderings which respect the
	// above is-put-before constraints and also respect the
	// MetadataRevision ordering.
	expectedPuts1 := []interface{}{
		bid1, MetadataRevision(10), bid2, bid3,
		MetadataRevision(11), MetadataRevision(12),
	}
	// This is possible since block puts are done in parallel.
	expectedPuts2 := []interface{}{
		bid1, MetadataRevision(10), bid3, bid2,
		MetadataRevision(11), MetadataRevision(12),
	}
	require.True(t, reflect.DeepEqual(puts, expectedPuts1) ||
		reflect.DeepEqual(puts, expectedPuts2),
		"Expected %v or %v, got %v", expectedPuts1,
		expectedPuts2, puts)
}

// TestTLFJournalFlushInterleaving tests that we interleave block and
// MD ops while respecting the relative orderings of blocks and MD ops
// when flushing.
func TestTLFJournalFlushInterleaving(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	var lock sync.Mutex
	var puts []interface{}

	bserver := orderedBlockServer{
		lock: &lock,
		puts: &puts,
	}

	tlfJournal.delegateBlockServer.Shutdown()
	tlfJournal.delegateBlockServer = &bserver

	mdserver := orderedMDServer{
		lock: &lock,
		puts: &puts,
	}

	config.mdserver = &mdserver

	// Revision 1
	var bids []BlockID
	rev1BlockEnd := maxJournalBlockFlushBatchSize * 2
	for i := 0; i < rev1BlockEnd; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}
	md1 := config.makeMD(MetadataRevision(10), fakeMdID(1))
	prevRoot, err := tlfJournal.putMD(ctx, md1)
	require.NoError(t, err)

	// Revision 2
	rev2BlockEnd := rev1BlockEnd + maxJournalBlockFlushBatchSize*2
	for i := rev1BlockEnd; i < rev2BlockEnd; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}
	md2 := config.makeMD(MetadataRevision(11), prevRoot)
	prevRoot, err = tlfJournal.putMD(ctx, md2)
	require.NoError(t, err)

	err = tlfJournal.flush(ctx)
	require.NoError(t, err)
	requireJournalEntryCounts(t, tlfJournal, 0, 0)
	testMDJournalGCd(t, tlfJournal.mdJournal)

	// Make sure that: before revision 1, all the rev1 blocks were
	// put; rev2 comes last; some blocks are put between the two.
	bidsSeen := make(map[BlockID]bool)
	md1Slot := 0
	md2Slot := 0
	for i, put := range puts {
		if bid, ok := put.(BlockID); ok {
			t.Logf("Saw bid %s at %d", bid, i)
			bidsSeen[bid] = true
			continue
		}

		mdID, ok := put.(MetadataRevision)
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

func TestTLFJournalFlushRetry(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
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

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := config.makeMD(revision, prevRoot)
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
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
	requireJournalEntryCounts(t, tlfJournal, 0, 0)
	testMDJournalGCd(t, tlfJournal.mdJournal)
}

func TestTLFJournalResolveBranch(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	var bids []BlockID
	for i := 0; i < 3; i++ {
		data := []byte{byte(i)}
		bid, bCtx, serverHalf := config.makeBlock(data)
		bids = append(bids, bid)
		err := tlfJournal.putBlockData(ctx, bid, bCtx, data, serverHalf)
		require.NoError(t, err)
	}

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 3

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := config.makeMD(revision, prevRoot)
		mdID, err := tlfJournal.putMD(ctx, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	var mdserver shimMDServer
	mdserver.nextErr = MDServerErrorConflictRevision{}
	config.mdserver = &mdserver

	_, mdEnd, err := tlfJournal.getJournalEnds(ctx)
	require.NoError(t, err)

	// This will convert to a branch.
	flushed, err := tlfJournal.flushOneMDOp(ctx, mdEnd, mdEnd)
	require.NoError(t, err)
	require.True(t, flushed)

	// Resolve the branch.
	resolveMD := config.makeMD(firstRevision, firstPrevRoot)
	_, err = tlfJournal.resolveBranch(ctx,
		tlfJournal.mdJournal.getBranchID(), []BlockID{bids[1]}, resolveMD, nil)
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
}
