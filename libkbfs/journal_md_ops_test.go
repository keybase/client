// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

func setupJournalMDOpsTest(t *testing.T) (
	tempdir string, config *ConfigLocal,
	oldMDOps MDOps, jServer *JournalServer) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_md_ops")
	require.NoError(t, err)

	// Clean up the tempdir if the rest of the setup fails.
	setupSucceeded := false
	defer func() {
		if !setupSucceeded {
			err := os.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	config = MakeTestConfigOrBust(t, "test_user")

	// Clean up the config if the rest of the setup fails.
	defer func() {
		if !setupSucceeded {
			CheckConfigAndShutdown(t, config)
		}
	}()

	oldMDOps = config.MDOps()
	config.EnableJournaling(tempdir)
	jServer, err = GetJournalServer(config)
	// Turn off listeners to avoid background MD pushes for CR.
	jServer.onBranchChange = nil
	jServer.onMDFlush = nil
	require.NoError(t, err)

	setupSucceeded = true
	return tempdir, config, oldMDOps, jServer
}

func teardownJournalMDOpsTest(t *testing.T, tempdir string, config Config) {
	CheckConfigAndShutdown(t, config)
	err := os.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func makeMDForJournalMDOpsTest(
	t *testing.T, config Config, tlfID TlfID, h *TlfHandle,
	revision MetadataRevision) *RootMetadata {
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
	tempdir, config, oldMDOps, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, config)

	ctx := context.Background()
	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	require.NoError(t, err)

	// (1) get metadata -- allocates an ID
	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	rmd := makeMDForJournalMDOpsTest(t, config, id, h, MetadataRevision(1))

	mdID, err := mdOps.Put(ctx, rmd)
	require.NoError(t, err)
	prevRoot := mdID

	// (2) push some new metadata blocks
	for i := MetadataRevision(2); i < 8; i++ {
		rmd.SetRevision(MetadataRevision(i))
		rmd.SetPrevRoot(prevRoot)
		mdID, err := mdOps.Put(ctx, rmd)
		require.NoError(t, err, "i=%d", i)
		prevRoot = mdID
	}

	head, err := mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(7), head.Revision())

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	err = jServer.Flush(ctx, id)
	require.NoError(t, err)

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(7), head.Revision())

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(7), head.Revision())

	// (3) trigger a conflict
	rmd.SetRevision(MetadataRevision(8))
	rmd.SetPrevRoot(prevRoot)
	_, err = oldMDOps.Put(ctx, rmd)
	require.NoError(t, err)

	for i := MetadataRevision(8); i <= 10; i++ {
		rmd.SetRevision(MetadataRevision(i))
		rmd.SetPrevRoot(prevRoot)
		mdID, err := mdOps.Put(ctx, rmd)
		require.NoError(t, err, "i=%d", i)
		prevRoot = mdID
	}

	err = jServer.Flush(ctx, id)
	require.NoError(t, err)

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(8), head.Revision())

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(8), head.Revision())

	head, err = mdOps.GetUnmergedForTLF(ctx, id, NullBranchID)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(10), head.Revision())

	head, err = oldMDOps.GetUnmergedForTLF(ctx, id, NullBranchID)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(10), head.Revision())

	// (4) push some new unmerged metadata blocks linking to the
	//     middle merged block.
	var bid BranchID
	for i := MetadataRevision(11); i < 41; i++ {
		rmd.SetRevision(MetadataRevision(i))
		rmd.SetPrevRoot(prevRoot)
		mdID, err := mdOps.PutUnmerged(ctx, rmd)
		require.NoError(t, err, "i=%d", i)
		prevRoot = mdID
		bid = rmd.BID()
		require.NoError(t, err)
	}

	// (5) check for proper unmerged head
	head, err = mdOps.GetUnmergedForTLF(ctx, id, bid)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(40), head.Revision())

	head, err = oldMDOps.GetUnmergedForTLF(ctx, id, bid)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(10), head.Revision())

	// (6a) try to get unmerged range
	rmdses, err := mdOps.GetUnmergedRange(ctx, id, bid, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 33, len(rmdses))
	for i := MetadataRevision(8); i < 41; i++ {
		require.Equal(t, i, rmdses[i-8].Revision())
	}

	// (6b) try to get unmerged range subset.
	rmdses, err = mdOps.GetUnmergedRange(ctx, id, bid, 7, 14)
	require.NoError(t, err)
	require.Equal(t, 7, len(rmdses))
	for i := MetadataRevision(8); i <= 14; i++ {
		require.Equal(t, i, rmdses[i-8].Revision())
	}

	// (7) prune unmerged
	err = mdOps.PruneBranch(ctx, id, bid)
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
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(8), head.Revision())

	// (11) try to get merged range
	rmdses, err = mdOps.GetRange(ctx, id, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 8, len(rmdses))
	for i := MetadataRevision(1); i <= 8; i++ {
		require.Equal(t, i, rmdses[i-1].Revision())
	}
}

// TODO: Add a test for GetRange where the server has an overlapping
// range with the journal.

func TestJournalMDOpsPutUnmerged(t *testing.T) {
	tempdir, config, _, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, config)

	ctx := context.Background()
	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	require.NoError(t, err)

	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	rmd := makeMDForJournalMDOpsTest(t, config, id, h, MetadataRevision(1))
	rmd.SetBranchID(FakeBranchID(1))

	_, err = mdOps.PutUnmerged(ctx, rmd)
	require.NoError(t, err)
}

func TestJournalMDOpsPutUnmergedError(t *testing.T) {
	tempdir, config, _, jServer := setupJournalMDOpsTest(t)
	defer teardownJournalMDOpsTest(t, tempdir, config)

	ctx := context.Background()
	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	require.NoError(t, err)

	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	mdOps := jServer.mdOps()

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	rmd := makeMDForJournalMDOpsTest(t, config, id, h, MetadataRevision(1))

	_, err = mdOps.PutUnmerged(ctx, rmd)
	require.Error(t, err, "Unmerged put with rmd.BID() == j.branchID == NullBranchID")
}
