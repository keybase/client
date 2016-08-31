// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io/ioutil"
	"os"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
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
	t        *testing.T
	tlfID    TlfID
	splitter BlockSplitter
	codec    Codec
	crypto   CryptoLocal
	cig      singleCurrentInfoGetter
	ekg      singleEncryptionKeyGetter
	mdserver MDServer
}

func (c testTLFJournalConfig) BlockSplitter() BlockSplitter {
	return c.splitter
}

func (c testTLFJournalConfig) Codec() Codec {
	return c.codec
}

func (c testTLFJournalConfig) Crypto() Crypto {
	return c.crypto
}

func (c testTLFJournalConfig) cryptoPure() cryptoPure {
	return c.crypto
}

func (c testTLFJournalConfig) currentInfoGetter() currentInfoGetter {
	return c.cig
}

func (c testTLFJournalConfig) encryptionKeyGetter() encryptionKeyGetter {
	return c.ekg
}

func (c testTLFJournalConfig) MDServer() MDServer {
	return c.mdserver
}

func (c testTLFJournalConfig) MakeLogger(module string) logger.Logger {
	return logger.NewTestLogger(c.t)
}

func (c testTLFJournalConfig) makeBlock(data []byte) (
	BlockID, BlockContext, BlockCryptKeyServerHalf) {
	id, err := c.crypto.MakePermanentBlockID(data)
	require.NoError(c.t, err)
	bCtx := BlockContext{c.cig.uid, "", zeroBlockRefNonce}
	serverHalf, err := c.crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(c.t, err)
	return id, bCtx, serverHalf
}

func (c testTLFJournalConfig) makeMD(
	revision MetadataRevision, prevRoot MdID) *RootMetadata {
	return makeMDForTest(c.t, c.tlfID, revision, c.cig.uid, prevRoot)
}

func (c testTLFJournalConfig) checkMD(rmds *RootMetadataSigned,
	expectedRevision MetadataRevision, expectedPrevRoot MdID,
	expectedMergeStatus MergeStatus, expectedBranchID BranchID) {
	uid := c.cig.uid
	verifyingKey := c.crypto.signingKey.GetVerifyingKey()
	checkBRMD(c.t, uid, verifyingKey, c.Codec(), c.Crypto(),
		rmds.MD, expectedRevision, expectedPrevRoot,
		expectedMergeStatus, expectedBranchID)
	err := rmds.IsValidAndSigned(c.Codec(), c.Crypto())
	require.NoError(c.t, err)
	err = rmds.IsLastModifiedBy(uid, verifyingKey)
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
	codec := NewCodecMsgpack()
	signingKey := MakeFakeSigningKeyOrBust("client sign")
	cryptPrivateKey := MakeFakeCryptPrivateKeyOrBust("client crypt private")
	crypto := NewCryptoLocal(codec, signingKey, cryptPrivateKey)
	cig := singleCurrentInfoGetter{
		name:         "fake_user",
		uid:          keybase1.MakeTestUID(1),
		verifyingKey: signingKey.GetVerifyingKey(),
	}
	ekg := singleEncryptionKeyGetter{MakeTLFCryptKey([32]byte{0x1})}
	mdserver, err := NewMDServerMemory(newTestMDServerLocalConfig(t, cig))
	require.NoError(t, err)

	config = &testTLFJournalConfig{
		t, FakeTlfID(1, false), bsplitter, codec, crypto,
		cig, ekg, mdserver,
	}

	// Time out individual tests after 10 seconds.
	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)

	delegate = testBWDelegate{
		t:          t,
		testCtx:    ctx,
		stateCh:    make(chan bwState),
		shutdownCh: make(chan struct{}),
	}

	tempdir, err = ioutil.TempDir(os.TempDir(), "tlf_journal")
	require.NoError(t, err)
	// Clean up the tempdir if anything in the setup fails/panics.
	defer func() {
		if r := recover(); r != nil {
			err := os.RemoveAll(tempdir)
			if err != nil {
				t.Errorf(err.Error())
			}
		}
	}()

	delegateBlockServer := NewBlockServerMemory(config)

	tlfJournal, err = makeTLFJournal(ctx, tempdir, config.tlfID, config,
		delegateBlockServer, bwStatus, delegate)
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
		require.FailNow(config.t, ctx.Err().Error())
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
	require.NoError(config.t, err)
}

func putBlock(ctx context.Context,
	t *testing.T, config *testTLFJournalConfig,
	tlfJournal *tlfJournal, data []byte) {
	id, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, id, bCtx, data, serverHalf)
	require.NoError(t, err)
}

// The tests below primarily test the background work thread's
// behavior.

func TestTLFJournalBasic(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkEnabled)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

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

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

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

	putBlock(ctx, t, config, tlfJournal, []byte{1, 2, 3, 4})

	// Should still be able to shut down while paused.
}

type hangingBlockServer struct {
	BlockServer
	// Closed on put.
	onPutCh chan struct{}
}

func (bs hangingBlockServer) Put(
	ctx context.Context, tlfID TlfID, id BlockID, context BlockContext,
	buf []byte, serverHalf BlockCryptKeyServerHalf) error {
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
	ctx context.Context, rmds *RootMetadataSigned) error {
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

// The test below test tlfJournal's block flushing behavior.
//
// TODO: Move it to block_journal_test.go, since nothing in it depends
// on tlfJournal. (Contrast with the MD flushing behavior, which
// requires its locking behavior to be tested.)

func TestTLFJournalFlushBlock(t *testing.T) {
	tempdir, config, ctx, cancel, tlfJournal, delegate :=
		setupTLFJournalTest(t, TLFJournalBackgroundWorkPaused)
	defer teardownTLFJournalTest(
		tempdir, config, ctx, cancel, tlfJournal, delegate)

	// Put a block.

	data := []byte{1, 2, 3, 4}
	bID, bCtx, serverHalf := config.makeBlock(data)
	err := tlfJournal.putBlockData(ctx, bID, bCtx, data, serverHalf)
	require.NoError(t, err)

	// Add some references.

	uid2 := keybase1.MakeTestUID(2)
	nonce, err := config.crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{config.cig.uid, uid2, nonce}
	err = tlfJournal.addBlockReference(ctx, bID, bCtx2)

	require.NoError(t, err)
	nonce2, err := config.crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx3 := BlockContext{config.cig.uid, uid2, nonce2}
	err = tlfJournal.addBlockReference(ctx, bID, bCtx3)
	require.NoError(t, err)

	// Remove some references.

	liveCounts, err := tlfJournal.removeBlockReferences(
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx, bCtx2},
		})
	require.NoError(t, err)
	require.Equal(t, map[BlockID]int{bID: 1}, liveCounts)

	// Archive the rest.

	require.NoError(t, err)
	err = tlfJournal.archiveBlockReferences(
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx3},
		})
	require.NoError(t, err)

	// Then remove them.

	require.NoError(t, err)
	liveCounts, err = tlfJournal.removeBlockReferences(
		ctx, map[BlockID][]BlockContext{
			bID: {bCtx3},
		})
	require.NoError(t, err)
	require.Equal(t, map[BlockID]int{bID: 0}, liveCounts)

	blockServer := tlfJournal.delegateBlockServer

	flush := func() {
		flushed, err := tlfJournal.flushOneBlockOp(ctx)
		require.NoError(t, err)
		require.True(t, flushed)
	}

	// Flush the block put.

	flush()

	tlfID := config.tlfID
	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the reference adds.

	flush()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	flush()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the reference removals.

	flush()

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the reference archival.

	flush()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Flush the last removal.

	flush()

	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx3)
	require.IsType(t, BServerErrorBlockNonExistent{}, err)

	_, e, _, _, err := tlfJournal.blockJournal.getNextEntryToFlush(ctx)
	require.NoError(t, err)
	require.Nil(t, e)
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
	ctx context.Context, rmds *RootMetadataSigned) error {
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

	for i := 0; i < mdCount; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx)
		require.NoError(t, err)
		require.True(t, flushed)
	}
	flushed, err := tlfJournal.flushOneMDOp(ctx)
	require.NoError(t, err)
	require.False(t, flushed)
	requireJournalEntryCounts(t, tlfJournal, 0, 0)

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

	// Simulate a flush with a conflict error halfway through.
	{
		flushed, err := tlfJournal.flushOneMDOp(ctx)
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

	// Flush remaining entries.
	for i := 0; i < mdCount-1; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx)
		require.NoError(t, err)
		require.True(t, flushed)
	}
	flushed, err := tlfJournal.flushOneMDOp(ctx)
	require.NoError(t, err)
	require.False(t, flushed)
	requireJournalEntryCounts(t, tlfJournal, 0, 0)

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

	// Flush all entries, with the first one encountering a
	// conflict error.
	for i := 0; i < mdCount-1; i++ {
		flushed, err := tlfJournal.flushOneMDOp(ctx)
		require.NoError(t, err)
		require.True(t, flushed)
	}

	flushed, err := tlfJournal.flushOneMDOp(ctx)
	require.NoError(t, err)
	require.False(t, flushed)
	requireJournalEntryCounts(t, tlfJournal, 0, 0)

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

		flushed, err := tlfJournal.flushOneMDOp(ctx)
		require.NoError(t, err)
		require.True(t, flushed)

		flushed, err = tlfJournal.flushOneMDOp(ctx)
		require.NoError(t, err)
		require.False(t, flushed)
		requireJournalEntryCounts(t, tlfJournal, 0, 0)
	}

	// Check RMDSes on the server. In particular, the BranchID of
	// the last put MD should match the rest.
	rmdses := mdserver.rmdses
	require.Equal(t, mdCount, len(rmdses))
	config.checkRange(rmdses, firstRevision, firstPrevRoot, Unmerged,
		rmdses[0].MD.BID())
}
