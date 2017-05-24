// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupJournalMDOpsTest(t *testing.T) (
	tempdir string, ctx context.Context, cancel context.CancelFunc,
	config *ConfigLocal, oldMDOps MDOps, jServer *JournalServer) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_md_ops")
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

	config = MakeTestConfigOrBust(t, "test_user")

	// Clean up the config if the rest of the setup fails.
	defer func() {
		if !setupSucceeded {
			CheckConfigAndShutdown(ctx, t, config)
		}
	}()

	oldMDOps = config.MDOps()
	_, err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jServer, err = GetJournalServer(config)
	// Turn off listeners to avoid background MD pushes for CR.
	jServer.onBranchChange = nil
	jServer.onMDFlush = nil
	require.NoError(t, err)

	// Tests need to explicitly enable journaling, to avoid races
	// where journals are enabled before they can be paused.
	err = jServer.DisableAuto(ctx)
	require.NoError(t, err)

	setupSucceeded = true
	return tempdir, ctx, cancel, config, oldMDOps, jServer
}

func teardownJournalMDOpsTest(t *testing.T, tempdir string, ctx context.Context,
	cancel context.CancelFunc, config Config) {
	CheckConfigAndShutdown(ctx, t, config)
	cancel()
	err := ioutil.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func makeMDForJournalMDOpsTest(
	t *testing.T, config Config, tlfID tlf.ID, h *TlfHandle,
	revision kbfsmd.Revision) *RootMetadata {
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), tlfID, h)
	require.NoError(t, err)
	rmd.SetRevision(revision)
	ctx := context.Background()
	rekeyDone, _, err := config.KeyManager().Rekey(ctx, rmd, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)
	return rmd
}

// TODO: Clean up the test below.

func TestJournalMDOpsBasics(t *testing.T) {
	tempdir, ctx, cancel, config, oldMDOps, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, ctx, cancel, config)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	// (1) get metadata -- allocates an ID
	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{session.UID.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.NotEqual(t, tlf.NullID, id)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	rmd := makeMDForJournalMDOpsTest(t, config, id, h, kbfsmd.Revision(1))

	irmd, err = mdOps.Put(ctx, rmd, session.VerifyingKey)
	require.NoError(t, err)
	prevRoot := irmd.mdID

	// (2) push some new metadata blocks
	for i := kbfsmd.Revision(2); i < 8; i++ {
		rmd.SetRevision(kbfsmd.Revision(i))
		rmd.SetPrevRoot(prevRoot)
		irmd, err := mdOps.Put(ctx, rmd, session.VerifyingKey)
		require.NoError(t, err, "i=%d", i)
		prevRoot = irmd.mdID
	}

	id, head, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.NotEqual(t, tlf.NullID, id)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(7), head.Revision())

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(7), head.Revision())

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	err = jServer.Flush(ctx, id)
	require.NoError(t, err)

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(7), head.Revision())

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(7), head.Revision())

	// (3) trigger a conflict
	rmd.SetRevision(kbfsmd.Revision(8))
	rmd.SetPrevRoot(prevRoot)
	resolveMD, err := rmd.deepCopy(config.Codec())
	require.NoError(t, err)
	_, err = oldMDOps.Put(ctx, rmd, session.VerifyingKey)
	require.NoError(t, err)

	for i := kbfsmd.Revision(8); i <= 10; i++ {
		rmd.SetRevision(kbfsmd.Revision(i))
		rmd.SetPrevRoot(prevRoot)
		irmd, err := mdOps.Put(ctx, rmd, session.VerifyingKey)
		require.NoError(t, err, "i=%d", i)
		prevRoot = irmd.mdID
	}

	err = jServer.Flush(ctx, id)
	require.NoError(t, err)

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(8), head.Revision())

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(8), head.Revision())

	// Find the branch ID.
	tlfJournal, ok := jServer.getTLFJournal(id)
	require.True(t, ok)
	bid := tlfJournal.mdJournal.branchID

	head, err = mdOps.GetUnmergedForTLF(ctx, id, bid)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(10), head.Revision())

	_, head, err = mdOps.GetForHandle(ctx, h, Unmerged)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(10), head.Revision())
	require.Equal(t, bid, head.BID())

	// (4) push some new unmerged metadata blocks linking to the
	//     middle merged block.
	for i := kbfsmd.Revision(11); i < 41; i++ {
		rmd.SetRevision(kbfsmd.Revision(i))
		rmd.SetPrevRoot(prevRoot)
		irmd, err := mdOps.PutUnmerged(ctx, rmd, session.VerifyingKey)
		require.NoError(t, err, "i=%d", i)
		prevRoot = irmd.mdID
		require.Equal(t, bid, rmd.BID())
		bid = rmd.BID()
		require.NoError(t, err)
	}

	// (5) check for proper unmerged head
	head, err = mdOps.GetUnmergedForTLF(ctx, id, bid)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(40), head.Revision())

	// (6a) try to get unmerged range
	rmdses, err := mdOps.GetUnmergedRange(ctx, id, bid, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 33, len(rmdses))
	for i := kbfsmd.Revision(8); i < 41; i++ {
		require.Equal(t, i, rmdses[i-8].Revision())
	}

	// (6b) try to get unmerged range subset.
	rmdses, err = mdOps.GetUnmergedRange(ctx, id, bid, 7, 14)
	require.NoError(t, err)
	require.Equal(t, 7, len(rmdses))
	for i := kbfsmd.Revision(8); i <= 14; i++ {
		require.Equal(t, i, rmdses[i-8].Revision())
	}

	// (7) resolve the branch
	_, err = mdOps.ResolveBranch(
		ctx, id, bid, nil, resolveMD, session.VerifyingKey)
	require.NoError(t, err)

	// (8) verify head is pruned
	head, err = mdOps.GetUnmergedForTLF(ctx, id, NullBranchID)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	// (9) verify revision history is pruned
	rmdses, err = mdOps.GetUnmergedRange(ctx, id, NullBranchID, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 0, len(rmdses))

	// (10) check for proper merged head
	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableRootMetadata{}, head)
	require.Equal(t, kbfsmd.Revision(8), head.Revision())

	// (11) try to get merged range
	rmdses, err = mdOps.GetRange(ctx, id, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 8, len(rmdses))
	for i := kbfsmd.Revision(1); i <= 8; i++ {
		require.Equal(t, i, rmdses[i-1].Revision())
	}
}

// TODO: Add a test for GetRange where the server has an overlapping
// range with the journal.

func TestJournalMDOpsPutUnmerged(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, ctx, cancel, config)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{session.UID.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.NotEqual(t, tlf.NullID, id)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	rmd := makeMDForJournalMDOpsTest(t, config, id, h, kbfsmd.Revision(2))
	rmd.SetPrevRoot(kbfsmd.FakeID(1))
	rmd.SetBranchID(FakeBranchID(1))

	_, err = mdOps.PutUnmerged(ctx, rmd, session.VerifyingKey)
	require.NoError(t, err)
}

func TestJournalMDOpsPutUnmergedError(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, ctx, cancel, config)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{session.UID.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.NotEqual(t, tlf.NullID, id)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	rmd := makeMDForJournalMDOpsTest(t, config, id, h, kbfsmd.Revision(1))

	_, err = mdOps.PutUnmerged(ctx, rmd, session.VerifyingKey)
	require.Error(t, err, "Unmerged put with rmd.BID() == j.branchID == NullBranchID")
}

func TestJournalMDOpsLocalSquashBranch(t *testing.T) {
	tempdir, ctx, cancel, config, _, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, ctx, cancel, config)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	bh, err := tlf.MakeHandle(
		[]keybase1.UserOrTeamID{session.UID.AsUserOrTeam()}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()
	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, irmd)
	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	tlfJournal, ok := jServer.getTLFJournal(id)
	require.True(t, ok)

	// Prepare the md journal to have a leading local squash revision.
	firstRevision := kbfsmd.Revision(1)
	initialRmd := makeMDForJournalMDOpsTest(t, config, id, h, firstRevision)
	j := tlfJournal.mdJournal
	initialMdID, err := j.put(ctx, config.Crypto(), config.KeyManager(),
		config.BlockSplitter(), initialRmd, true)
	require.NoError(t, err)

	mdCount := 10
	rmd := initialRmd
	mdID := initialMdID
	// Put several MDs after a local squash
	for i := 0; i < mdCount; i++ {
		rmd, err = rmd.MakeSuccessor(ctx, config.MetadataVersion(),
			config.Codec(), config.Crypto(), config.KeyManager(),
			config.KBPKI(), mdID, true)
		require.NoError(t, err)
		mdID, err = j.put(ctx, config.Crypto(), config.KeyManager(),
			config.BlockSplitter(), rmd, false)
		require.NoError(t, err)
	}

	mdcache := NewMDCacheStandard(10)
	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, config.Crypto(), config.Codec(),
		id, mdcache)
	require.NoError(t, err)

	// The merged head should still be the initial rmd, because we
	// marked it as a squash and it shouldn't have gotten converted.
	irmd, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.Equal(t, initialMdID, irmd.mdID)
	require.Equal(t, firstRevision, irmd.Revision())

	// The unmerged head should be the last MD we put, converted to a
	// branch.
	irmd, err = mdOps.GetUnmergedForTLF(ctx, id, PendingLocalSquashBranchID)
	require.NoError(t, err)
	require.Equal(t, rmd.Revision(), irmd.Revision())
	require.Equal(t, PendingLocalSquashBranchID, irmd.BID())

	// The merged range should just be the initial MD.
	stopRevision := firstRevision + kbfsmd.Revision(mdCount*2)
	irmds, err := mdOps.GetRange(ctx, id, firstRevision, stopRevision)
	require.NoError(t, err)
	require.Len(t, irmds, 1)
	require.Equal(t, initialMdID, irmds[0].mdID)
	require.Equal(t, firstRevision, irmds[0].Revision())

	irmds, err = mdOps.GetUnmergedRange(ctx, id, PendingLocalSquashBranchID,
		firstRevision, stopRevision)
	require.NoError(t, err)
	require.Len(t, irmds, mdCount)
	require.Equal(t, firstRevision+kbfsmd.Revision(1), irmds[0].Revision())
}
