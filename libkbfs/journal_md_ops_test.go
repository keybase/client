// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

// TODO: Clean up the test below.

func TestJournalMDOpsBasics(t *testing.T) {
	// setup
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_md_ops")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	config := MakeTestConfigOrBust(t, "test_user")
	defer CheckConfigAndShutdown(t, config)

	log := config.MakeLogger("")
	jServer := makeJournalServer(
		config, log, tempdir, config.BlockCache(),
		config.BlockServer(), config.MDOps())

	ctx := context.Background()
	err = jServer.EnableExistingJournals(ctx)
	require.NoError(t, err)
	config.SetBlockCache(jServer.blockCache())
	config.SetBlockServer(jServer.blockServer())

	oldMDOps := config.MDOps()
	config.SetMDOps(jServer.mdOps())

	mdOps := config.MDOps()

	_, uid, err := config.KBPKI().GetCurrentUserInfo(ctx)
	require.NoError(t, err)

	// (1) get metadata -- allocates an ID
	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	id, irmd, err := mdOps.GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, irmd)

	err = jServer.Enable(ctx, id)
	require.NoError(t, err)

	var rmd RootMetadata
	err = updateNewBareRootMetadata(&rmd.BareRootMetadata, id, bh)
	require.NoError(t, err)
	rmd.tlfHandle = h
	rmd.Revision = MetadataRevision(1)
	rekeyDone, _, err := config.KeyManager().Rekey(ctx, &rmd, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)

	mdID, err := mdOps.Put(ctx, &rmd)
	require.NoError(t, err)
	prevRoot := mdID

	// (2) push some new metadata blocks
	for i := MetadataRevision(2); i < 8; i++ {
		rmd.Revision = MetadataRevision(i)
		rmd.PrevRoot = prevRoot
		mdID, err := mdOps.Put(ctx, &rmd)
		require.NoError(t, err, "i=%d", i)
		prevRoot = mdID
	}

	head, err := mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(7), head.Revision)

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.Equal(t, ImmutableRootMetadata{}, head)

	err = jServer.Flush(ctx, id)
	require.NoError(t, err)

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(7), head.Revision)

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(7), head.Revision)

	// (3) trigger a conflict
	rmd.Revision = MetadataRevision(8)
	rmd.PrevRoot = prevRoot
	_, err = oldMDOps.Put(ctx, &rmd)
	require.NoError(t, err)

	for i := MetadataRevision(8); i <= 10; i++ {
		rmd.Revision = MetadataRevision(i)
		rmd.PrevRoot = prevRoot
		mdID, err := mdOps.Put(ctx, &rmd)
		require.NoError(t, err, "i=%d", i)
		prevRoot = mdID
	}

	err = jServer.Flush(ctx, id)
	require.NoError(t, err)

	head, err = mdOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(8), head.Revision)

	head, err = oldMDOps.GetForTLF(ctx, id)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(8), head.Revision)

	head, err = mdOps.GetUnmergedForTLF(ctx, id, NullBranchID)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(10), head.Revision)

	head, err = oldMDOps.GetUnmergedForTLF(ctx, id, NullBranchID)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(10), head.Revision)

	// (4) push some new unmerged metadata blocks linking to the
	//     middle merged block.
	var bid BranchID
	for i := MetadataRevision(11); i < 41; i++ {
		rmd.Revision = MetadataRevision(i)
		rmd.PrevRoot = prevRoot
		mdID, err := mdOps.PutUnmerged(ctx, &rmd)
		require.NoError(t, err, "i=%d", i)
		prevRoot = mdID
		bid = rmd.BID
		require.NoError(t, err)
	}

	// (5) check for proper unmerged head
	head, err = mdOps.GetUnmergedForTLF(ctx, id, bid)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(40), head.Revision)

	head, err = oldMDOps.GetUnmergedForTLF(ctx, id, bid)
	require.NoError(t, err)
	require.NotNil(t, head)
	require.Equal(t, MetadataRevision(10), head.Revision)

	// (6a) try to get unmerged range
	rmdses, err := mdOps.GetUnmergedRange(ctx, id, bid, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 33, len(rmdses))
	for i := MetadataRevision(8); i < 41; i++ {
		require.Equal(t, i, rmdses[i-8].Revision)
	}

	// (6b) try to get unmerged range subset.
	rmdses, err = mdOps.GetUnmergedRange(ctx, id, bid, 7, 14)
	require.NoError(t, err)
	require.Equal(t, 7, len(rmdses))
	for i := MetadataRevision(8); i <= 14; i++ {
		require.Equal(t, i, rmdses[i-8].Revision)
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
	require.Equal(t, MetadataRevision(8), head.Revision)

	// (11) try to get merged range
	rmdses, err = mdOps.GetRange(ctx, id, 1, 100)
	require.NoError(t, err)
	require.Equal(t, 8, len(rmdses))
	for i := MetadataRevision(1); i <= 8; i++ {
		require.Equal(t, i, rmdses[i-1].Revision)
	}
}

// TODO: Add a test for GetRange where the server has an overlapping
// range with the journal.
