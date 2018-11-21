// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"math"
	"os"
	"sync"
	"testing"
	"time"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupJournalServerTest(t *testing.T) (
	tempdir string, ctx context.Context, cancel context.CancelFunc,
	config *ConfigLocal, quotaUsage *EventuallyConsistentQuotaUsage,
	jServer *JournalServer) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)

	// Clean up the tempdir if the rest of the setup fails.
	setupSucceeded := false
	defer func() {
		if !setupSucceeded {
			err := ioutil.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	ctx, cancel = context.WithTimeout(
		context.Background(), individualTestTimeout)

	// Clean up the context if the rest of the setup fails.
	defer func() {
		if !setupSucceeded {
			cancel()
		}
	}()

	config = MakeTestConfigOrBust(t, "test_user1", "test_user2")

	// Clean up the config if the rest of the setup fails.
	defer func() {
		if !setupSucceeded {
			ctx := context.Background()
			CheckConfigAndShutdown(ctx, t, config)
		}
	}()

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jServer, err = GetJournalServer(config)
	require.NoError(t, err)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	quotaUsage = config.getQuotaUsage(session.UID.AsUserOrTeam())

	setupSucceeded = true
	return tempdir, ctx, cancel, config, quotaUsage, jServer
}

func teardownJournalServerTest(
	t *testing.T, tempdir string, ctx context.Context,
	cancel context.CancelFunc, config Config) {
	CheckConfigAndShutdown(ctx, t, config)
	cancel()
	err := ioutil.RemoveAll(tempdir)
	assert.NoError(t, err)
}

type quotaBlockServer struct {
	BlockServer

	quotaInfoLock sync.Mutex
	userQuotaInfo kbfsblock.QuotaInfo
	teamQuotaInfo map[keybase1.TeamID]kbfsblock.QuotaInfo
}

func (qbs *quotaBlockServer) setUserQuotaInfo(
	remoteUsageBytes, limitBytes, remoteGitUsageBytes, gitLimitBytes int64) {
	qbs.quotaInfoLock.Lock()
	defer qbs.quotaInfoLock.Unlock()
	qbs.userQuotaInfo.Limit = limitBytes
	qbs.userQuotaInfo.GitLimit = gitLimitBytes
	qbs.userQuotaInfo.Total = &kbfsblock.UsageStat{
		Bytes: map[kbfsblock.UsageType]int64{
			kbfsblock.UsageWrite:    remoteUsageBytes,
			kbfsblock.UsageGitWrite: remoteGitUsageBytes,
		},
	}
}

func (qbs *quotaBlockServer) setTeamQuotaInfo(
	tid keybase1.TeamID, remoteUsageBytes, limitBytes int64) {
	qbs.quotaInfoLock.Lock()
	defer qbs.quotaInfoLock.Unlock()
	if qbs.teamQuotaInfo == nil {
		qbs.teamQuotaInfo = make(map[keybase1.TeamID]kbfsblock.QuotaInfo)
	}
	info := qbs.teamQuotaInfo[tid]
	info.Limit = limitBytes
	info.Total = &kbfsblock.UsageStat{
		Bytes: map[kbfsblock.UsageType]int64{
			kbfsblock.UsageWrite: remoteUsageBytes,
		},
	}
	qbs.teamQuotaInfo[tid] = info
}

func (qbs *quotaBlockServer) GetUserQuotaInfo(ctx context.Context) (
	info *kbfsblock.QuotaInfo, err error) {
	qbs.quotaInfoLock.Lock()
	defer qbs.quotaInfoLock.Unlock()
	infoCopy := qbs.userQuotaInfo
	return &infoCopy, nil
}

func (qbs *quotaBlockServer) GetTeamQuotaInfo(
	ctx context.Context, tid keybase1.TeamID) (
	info *kbfsblock.QuotaInfo, err error) {
	qbs.quotaInfoLock.Lock()
	defer qbs.quotaInfoLock.Unlock()
	infoCopy := qbs.teamQuotaInfo[tid]
	return &infoCopy, nil
}

func TestJournalServerOverQuotaError(t *testing.T) {
	tempdir, ctx, cancel, config, quotaUsage, jServer :=
		setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	name := kbname.NormalizedUsername("t1")
	subname := kbname.NormalizedUsername("t1.sub")
	teamInfos := AddEmptyTeamsForTestOrBust(t, config, name, subname)
	teamID := teamInfos[0].TID
	subteamID := teamInfos[1].TID
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	AddTeamWriterForTestOrBust(t, config, teamID, session.UID)
	AddTeamWriterForTestOrBust(t, config, subteamID, session.UID)
	teamQuotaUsage := config.getQuotaUsage(teamID.AsUserOrTeam())

	qbs := &quotaBlockServer{BlockServer: config.BlockServer()}
	config.SetBlockServer(qbs)

	clock := newTestClockNow()
	config.SetClock(clock)

	// Set initial quota usage and refresh quotaUsage's cache.
	qbs.setUserQuotaInfo(1010, 1000, 2010, 2000)
	_, _, _, _, err = quotaUsage.Get(ctx, 0, 0)
	require.NoError(t, err)

	// Set team quota to be under the limit for now.
	qbs.setTeamQuotaInfo(teamID, 0, 1000)
	_, _, _, _, err = teamQuotaUsage.Get(ctx, 0, 0)
	require.NoError(t, err)

	tlfID1 := tlf.FakeID(1, tlf.Private)
	err = jServer.Enable(ctx, tlfID1, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)
	tlfID2 := tlf.FakeID(2, tlf.SingleTeam)
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "t1", tlf.SingleTeam)
	require.NoError(t, err)
	err = jServer.Enable(ctx, tlfID2, h, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)
	tlfID3 := tlf.FakeID(2, tlf.SingleTeam)
	h, err = ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "t1.sub", tlf.SingleTeam)
	require.NoError(t, err)
	err = jServer.Enable(ctx, tlfID3, h, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()

	h, err = ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1,test_user2",
		tlf.Private)
	require.NoError(t, err)
	id1 := h.ResolvedWriters()[0]

	// Put a block, which should return with a quota error.

	bCtx := kbfsblock.MakeFirstContext(id1, keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	expectedQuotaError := kbfsblock.ServerErrorOverQuota{
		Usage:     1014,
		Limit:     1000,
		Throttled: false,
	}
	require.Equal(t, expectedQuotaError, err)

	// Teams shouldn't get an error.
	err = blockServer.Put(
		ctx, tlfID2, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Subteams shouldn't get an error.
	err = blockServer.Put(
		ctx, tlfID3, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Putting it again shouldn't encounter an error.
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Advancing the time by overQuotaDuration should make it
	// return another quota error.
	clock.Add(time.Minute)
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.Equal(t, expectedQuotaError, err)

	// Putting it again shouldn't encounter an error.
	clock.Add(30 * time.Second)
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Now up the team usage, so teams (and their subteams) should get
	// an error.
	qbs.setTeamQuotaInfo(teamID, 1010, 1000)
	_, _, _, _, err = teamQuotaUsage.Get(ctx, 0, 0)
	require.NoError(t, err)
	clock.Add(time.Minute)
	err = blockServer.Put(
		ctx, tlfID2, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	expectedQuotaError = kbfsblock.ServerErrorOverQuota{
		Usage:     1014,
		Limit:     1000,
		Throttled: false,
	}
	require.Equal(t, expectedQuotaError, err)

	// Check that the subteam gets an error too.
	clock.Add(time.Minute)
	err = blockServer.Put(
		ctx, tlfID3, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.Equal(t, expectedQuotaError, err)
}

type tlfJournalConfigWithDiskLimitTimeout struct {
	tlfJournalConfig
	dlTimeout time.Duration
}

func (c tlfJournalConfigWithDiskLimitTimeout) diskLimitTimeout() time.Duration {
	return c.dlTimeout
}

func TestJournalServerOverDiskLimitError(t *testing.T) {
	tempdir, ctx, cancel, config, quotaUsage, jServer :=
		setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	qbs := &quotaBlockServer{BlockServer: config.BlockServer()}
	config.SetBlockServer(qbs)

	clock := newTestClockNow()
	config.SetClock(clock)

	// Set initial quota usage and refresh quotaUsage's cache.
	qbs.setUserQuotaInfo(1010, 1000, 2010, 2000)
	_, _, _, _, err := quotaUsage.Get(ctx, 0, 0)
	require.NoError(t, err)

	tlfID1 := tlf.FakeID(1, tlf.Private)
	err = jServer.Enable(ctx, tlfID1, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	chargedTo := session.UID.AsUserOrTeam()

	// Replace the tlfJournal config with one that has a really small
	// delay.
	tj, ok := jServer.getTLFJournal(tlfID1, nil)
	require.True(t, ok)
	tj.config = tlfJournalConfigWithDiskLimitTimeout{
		tlfJournalConfig: tj.config,
		dlTimeout:        3 * time.Microsecond,
	}
	tj.diskLimiter.onJournalEnable(
		ctx, math.MaxInt64, 0, math.MaxInt64-1, chargedTo)

	blockServer := config.BlockServer()

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1,test_user2",
		tlf.Private)
	require.NoError(t, err)
	id1 := h.ResolvedWriters()[0]

	// Put a block, which should return with a disk limit error.

	bCtx := kbfsblock.MakeFirstContext(id1, keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	usageBytes, limitBytes, usageFiles, limitFiles :=
		tj.diskLimiter.getDiskLimitInfo()
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)

	compare := func(reportable bool, err error) {
		expectedError := ErrDiskLimitTimeout{
			3 * time.Microsecond, int64(len(data)),
			filesPerBlockMax, 0, 0,
			usageBytes, usageFiles, limitBytes, limitFiles, nil, reportable,
		}
		e, ok := errors.Cause(err).(*ErrDiskLimitTimeout)
		require.True(t, ok)
		// Steal some fields that are hard to fake here (and aren't
		// important in our comparisons below).
		expectedError.availableBytes = e.availableBytes
		expectedError.availableFiles = e.availableFiles
		expectedError.err = e.err
		require.Equal(t, expectedError, *e)
	}
	compare(true, err)

	// Putting it again should encounter a regular deadline exceeded
	// error.
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	compare(false, err)

	// Advancing the time by overDiskLimitDuration should make it
	// return another quota error.
	clock.Add(time.Minute)
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	compare(true, err)

	// Putting it again should encounter a deadline error again.
	clock.Add(30 * time.Second)
	err = blockServer.Put(
		ctx, tlfID1, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	compare(false, err)
}

func TestJournalServerRestart(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jServer.delegateBlockServer = shutdownOnlyBlockServer{}

	tlfID := tlf.FakeID(2, tlf.Private)
	err := jServer.Enable(ctx, tlfID, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()
	mdOps := config.MDOps()

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1", tlf.Private)
	require.NoError(t, err)
	id := h.ResolvedWriters()[0]

	// Put a block.

	bCtx := kbfsblock.MakeFirstContext(id, keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Put an MD.

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)
	rekeyDone, _, err := config.KeyManager().Rekey(ctx, rmd, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	_, err = mdOps.Put(ctx, rmd, session.VerifyingKey,
		nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)

	// Simulate a restart.

	jServer = makeJournalServer(
		config, jServer.log, tempdir, jServer.delegateBlockCache,
		jServer.delegateDirtyBlockCache,
		jServer.delegateBlockServer, jServer.delegateMDOps, nil, nil)
	err = jServer.EnableExistingJournals(
		ctx, session.UID, session.VerifyingKey, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)
	config.SetBlockCache(jServer.blockCache())
	config.SetBlockServer(jServer.blockServer())
	config.SetMDOps(jServer.mdOps())

	// Get the block.

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Get the MD.

	head, err := mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, rmd.Revision(), head.Revision())
}

func TestJournalServerLogOutLogIn(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jServer.delegateBlockServer = shutdownOnlyBlockServer{}

	tlfID := tlf.FakeID(2, tlf.Private)
	err := jServer.Enable(ctx, tlfID, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()
	mdOps := config.MDOps()

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1", tlf.Private)
	require.NoError(t, err)
	id := h.ResolvedWriters()[0]

	// Put a block.

	bCtx := kbfsblock.MakeFirstContext(id, keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Put an MD.

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)
	rekeyDone, _, err := config.KeyManager().Rekey(ctx, rmd, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	_, err = mdOps.Put(ctx, rmd, session.VerifyingKey,
		nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)

	// Simulate a log out.

	serviceLoggedOut(ctx, config)

	// Get the block, which should fail.

	_, _, err = blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	// Get the head, which should be empty.

	head, err := mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	wg := serviceLoggedIn(
		ctx, config, session, TLFJournalBackgroundWorkPaused)
	wg.Wait()

	// Get the block.

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Get the MD.

	head, err = mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, rmd.Revision(), head.Revision())
}

func TestJournalServerLogOutDirtyOp(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	tlfID := tlf.FakeID(2, tlf.Private)
	err := jServer.Enable(ctx, tlfID, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	jServer.dirtyOpStart(tlfID)
	go func() {
		jServer.dirtyOpEnd(tlfID)
	}()

	// Should wait for the dirtyOpEnd call to happen and then
	// finish.
	//
	// TODO: Ideally, this test would be deterministic, i.e. we
	// detect when serviceLoggedOut blocks on waiting for
	// dirtyOpEnd, and only then do we call dirtyOpEnd.
	serviceLoggedOut(ctx, config)

	dirtyOps := func() uint {
		jServer.lock.RLock()
		defer jServer.lock.RUnlock()
		return jServer.dirtyOps[tlfID]
	}
	require.NotEqual(t, 0, dirtyOps)
}

func TestJournalServerMultiUser(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jServer.delegateBlockServer = shutdownOnlyBlockServer{}

	tlfID := tlf.FakeID(2, tlf.Private)
	err := jServer.Enable(ctx, tlfID, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()
	mdOps := config.MDOps()

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1,test_user2",
		tlf.Private)
	require.NoError(t, err)
	id1 := h.ResolvedWriters()[0]
	id2 := h.ResolvedWriters()[1]

	// Put a block under user 1.

	bCtx1 := kbfsblock.MakeFirstContext(id1, keybase1.BlockType_DATA)
	data1 := []byte{1, 2, 3, 4}
	bID1, err := kbfsblock.MakePermanentID(
		data1, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf1, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID1, bCtx1, data1, serverHalf1, DiskBlockAnyCache)
	require.NoError(t, err)

	// Put an MD under user 1.

	rmd1, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)
	rmd1.SetLastModifyingWriter(id1.AsUserOrBust())
	rekeyDone, _, err := config.KeyManager().Rekey(ctx, rmd1, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	_, err = mdOps.Put(ctx, rmd1, session.VerifyingKey,
		nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)

	// Log in user 2.

	serviceLoggedOut(ctx, config)

	service := config.KeybaseService().(*KeybaseDaemonLocal)
	service.setCurrentUID(id2.AsUserOrBust())
	SwitchDeviceForLocalUserOrBust(t, config, 0)

	session, err = config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	wg := serviceLoggedIn(
		ctx, config, session, TLFJournalBackgroundWorkPaused)
	wg.Wait()

	err = jServer.Enable(ctx, tlfID, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	// None of user 1's changes should be visible.

	_, _, err = blockServer.Get(ctx, tlfID, bID1, bCtx1, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	head, err := mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	// Put a block under user 2.

	bCtx2 := kbfsblock.MakeFirstContext(id2, keybase1.BlockType_DATA)
	data2 := []byte{1, 2, 3, 4, 5}
	bID2, err := kbfsblock.MakePermanentID(
		data2, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf2, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID2, bCtx2, data2, serverHalf2, DiskBlockAnyCache)
	require.NoError(t, err)

	// Put an MD under user 2.

	rmd2, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)
	rmd2.SetLastModifyingWriter(id2.AsUserOrBust())
	rekeyDone, _, err = config.KeyManager().Rekey(ctx, rmd2, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)

	_, err = mdOps.Put(ctx, rmd2, session.VerifyingKey,
		nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)

	// Log out.

	serviceLoggedOut(ctx, config)

	// No block or MD should be visible.

	_, _, err = blockServer.Get(ctx, tlfID, bID1, bCtx1, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	_, _, err = blockServer.Get(ctx, tlfID, bID2, bCtx2, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	head, err = mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	// Log in user 1.

	service.setCurrentUID(id1.AsUserOrBust())
	SwitchDeviceForLocalUserOrBust(t, config, 0)

	session, err = config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	wg = serviceLoggedIn(
		ctx, config, session, TLFJournalBackgroundWorkPaused)
	wg.Wait()

	// Only user 1's block and MD should be visible.

	buf, key, err := blockServer.Get(ctx, tlfID, bID1, bCtx1, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data1, buf)
	require.Equal(t, serverHalf1, key)

	_, _, err = blockServer.Get(ctx, tlfID, bID2, bCtx2, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	head, err = mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, id1.AsUserOrBust(), head.LastModifyingWriter())

	// Log in user 2.

	serviceLoggedOut(ctx, config)

	service.setCurrentUID(id2.AsUserOrBust())
	SwitchDeviceForLocalUserOrBust(t, config, 0)

	session, err = config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	wg = serviceLoggedIn(
		ctx, config, session, TLFJournalBackgroundWorkPaused)
	wg.Wait()

	// Only user 2's block and MD should be visible.

	_, _, err = blockServer.Get(ctx, tlfID, bID1, bCtx1, DiskBlockAnyCache)
	require.IsType(t, kbfsblock.ServerErrorBlockNonExistent{}, err)

	buf, key, err = blockServer.Get(ctx, tlfID, bID2, bCtx2, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data2, buf)
	require.Equal(t, serverHalf2, key)

	head, err = mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, id2.AsUserOrBust(), head.LastModifyingWriter())
}

func TestJournalServerEnableAuto(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	err := jServer.EnableAuto(ctx)
	require.NoError(t, err)

	status, tlfIDs := jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Zero(t, status.JournalCount)
	require.Len(t, tlfIDs, 0)

	blockServer := config.BlockServer()
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1", tlf.Private)
	require.NoError(t, err)
	id := h.ResolvedWriters()[0]
	tlfID := h.tlfID

	jServer.PauseBackgroundWork(ctx, tlfID)

	bCtx := kbfsblock.MakeFirstContext(id, keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 1, status.JournalCount)
	require.Len(t, tlfIDs, 1)

	// Stop the journal so it's not still being operated on by
	// another instance after the restart.
	tj, ok := jServer.getTLFJournal(tlfID, nil)
	require.True(t, ok)
	tj.shutdown(ctx)

	// Simulate a restart.
	jServer = makeJournalServer(
		config, jServer.log, tempdir, jServer.delegateBlockCache,
		jServer.delegateDirtyBlockCache,
		jServer.delegateBlockServer, jServer.delegateMDOps, nil, nil)
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	err = jServer.EnableExistingJournals(
		ctx, session.UID, session.VerifyingKey, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)
	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 1, status.JournalCount)
	require.Len(t, tlfIDs, 1)
}

func TestJournalServerReaderTLFs(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	err := jServer.EnableAuto(ctx)
	require.NoError(t, err)

	status, tlfIDs := jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Zero(t, status.JournalCount)
	require.Len(t, tlfIDs, 0)

	// This will end up calling journalMDOps.GetIDForHandle, which
	// initializes the journal if possible.  In this case for a
	// public, unwritable folder, it shouldn't.
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user2", tlf.Public)
	require.NoError(t, err)

	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 0, status.JournalCount)
	require.Len(t, tlfIDs, 0)

	// Neither should a private, reader folder.
	h, err = ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user2#test_user1",
		tlf.Private)
	require.NoError(t, err)

	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 0, status.JournalCount)
	require.Len(t, tlfIDs, 0)

	// Or a team folder, where you're just a reader.
	teamName := kbname.NormalizedUsername("t1")
	teamInfos := AddEmptyTeamsForTestOrBust(t, config, teamName)
	id := teamInfos[0].TID
	AddTeamWriterForTestOrBust(
		t, config, id, h.FirstResolvedWriter().AsUserOrBust())
	AddTeamReaderForTestOrBust(
		t, config, id, h.ResolvedReaders()[0].AsUserOrBust())
	h, err = ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(teamName), tlf.SingleTeam)
	require.NoError(t, err)

	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 0, status.JournalCount)
	require.Len(t, tlfIDs, 0)

	// But accessing our own should make one.
	h, err = ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1", tlf.Public)
	require.NoError(t, err)

	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 1, status.JournalCount)
	require.Len(t, tlfIDs, 1)
}

func TestJournalServerNukeEmptyJournalsOnRestart(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	err := jServer.EnableAuto(ctx)
	require.NoError(t, err)

	status, tlfIDs := jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Zero(t, status.JournalCount)
	require.Len(t, tlfIDs, 0)

	blockServer := config.BlockServer()
	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), "test_user1", tlf.Private)
	require.NoError(t, err)
	id := h.ResolvedWriters()[0]
	tlfID := h.tlfID

	// Access a TLF, which should create a journal automatically.
	bCtx := kbfsblock.MakeFirstContext(id, keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 1, status.JournalCount)
	require.Len(t, tlfIDs, 1)

	tj, ok := jServer.getTLFJournal(tlfID, nil)
	require.True(t, ok)

	// Flush the journal so it's empty.
	err = jServer.Flush(ctx, tlfID)
	require.NoError(t, err)

	// Simulate a restart and make sure the journal doesn't come back
	// up.
	jServer = makeJournalServer(
		config, jServer.log, tempdir, jServer.delegateBlockCache,
		jServer.delegateDirtyBlockCache,
		jServer.delegateBlockServer, jServer.delegateMDOps, nil, nil)
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	err = jServer.EnableExistingJournals(
		ctx, session.UID, session.VerifyingKey, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)
	status, tlfIDs = jServer.Status(ctx)
	require.True(t, status.EnableAuto)
	require.Equal(t, 0, status.JournalCount)
	require.Len(t, tlfIDs, 0)
	_, err = os.Stat(tj.dir)
	require.True(t, ioutil.IsNotExist(err))
}

func TestJournalServerTeamTLFWithRestart(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	name := kbname.NormalizedUsername("t1")
	teamInfos := AddEmptyTeamsForTestOrBust(t, config, name)
	id := teamInfos[0].TID
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	AddTeamWriterForTestOrBust(t, config, id, session.UID)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jServer.delegateBlockServer = shutdownOnlyBlockServer{}

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), string(name), tlf.SingleTeam)
	require.NoError(t, err)

	tlfID := tlf.FakeID(2, tlf.SingleTeam)
	err = jServer.Enable(ctx, tlfID, h, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()
	mdOps := config.MDOps()

	// Put a block.

	bCtx := kbfsblock.MakeFirstContext(
		id.AsUserOrTeam(), keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(data, kbfscrypto.EncryptionSecretbox)
	require.NoError(t, err)
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Put an MD.

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)
	rmd.bareMd.SetLatestKeyGenerationForTeamTLF(kbfsmd.FirstValidKeyGen)

	_, err = mdOps.Put(ctx, rmd, session.VerifyingKey,
		nil, keybase1.MDPriorityNormal)
	require.NoError(t, err)

	// Simulate a restart.

	jServer = makeJournalServer(
		config, jServer.log, tempdir, jServer.delegateBlockCache,
		jServer.delegateDirtyBlockCache,
		jServer.delegateBlockServer, jServer.delegateMDOps, nil, nil)
	err = jServer.EnableExistingJournals(
		ctx, session.UID, session.VerifyingKey, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)
	config.SetBlockCache(jServer.blockCache())
	config.SetBlockServer(jServer.blockServer())
	config.SetMDOps(jServer.mdOps())

	// Make sure the team ID was persisted.

	tj, ok := jServer.getTLFJournal(tlfID, nil)
	require.True(t, ok)
	require.Equal(t, id.AsUserOrTeam(), tj.chargedTo)

	// Get the block.

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Get the MD.

	head, err := mdOps.GetForTLF(ctx, tlfID, nil)
	require.NoError(t, err)
	require.Equal(t, rmd.Revision(), head.Revision())
}

func TestJournalQuotaStatus(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)

	// Set initial quota usage and refresh quotaUsage's cache.
	qbs := &quotaBlockServer{BlockServer: config.BlockServer()}
	config.SetBlockServer(qbs)
	qbs.setUserQuotaInfo(10, 1000, 20, 2000)

	// Make sure the quota status is correct, even if we haven't
	// written anything yet.
	s, _ := jServer.Status(ctx)
	bs := s.DiskLimiterStatus.(backpressureDiskLimiterStatus)
	require.Equal(
		t, int64(10), bs.JournalTrackerStatus.QuotaStatus.RemoteUsedBytes)
	require.Equal(
		t, int64(1000), bs.JournalTrackerStatus.QuotaStatus.QuotaBytes)
}

func TestJournalQuotaStatusForGitBlocks(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, ctx, cancel, config)
	config.SetDefaultBlockType(keybase1.BlockType_GIT)

	// Set initial quota usage and refresh quotaUsage's cache.
	qbs := &quotaBlockServer{BlockServer: config.BlockServer()}
	config.SetBlockServer(qbs)
	qbs.setUserQuotaInfo(10, 1000, 20, 2000)

	// Make sure the quota status is correct, even if we haven't
	// written anything yet.
	s, _ := jServer.Status(ctx)
	bs := s.DiskLimiterStatus.(backpressureDiskLimiterStatus)
	require.Equal(
		t, int64(20), bs.JournalTrackerStatus.QuotaStatus.RemoteUsedBytes)
	require.Equal(
		t, int64(2000), bs.JournalTrackerStatus.QuotaStatus.QuotaBytes)
}
