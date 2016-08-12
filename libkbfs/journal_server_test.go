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

func setupJournalServerTest(t *testing.T) (
	tempdir string, config Config, jServer *JournalServer) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	config = MakeTestConfigOrBust(t, "test_user")
	log := config.MakeLogger("")
	jServer = makeJournalServer(
		config, log, tempdir, config.BlockCache(),
		config.BlockServer(), config.MDOps())
	ctx := context.Background()
	err = jServer.EnableExistingJournals(ctx)
	require.NoError(t, err)
	config.SetBlockCache(jServer.blockCache())
	config.SetBlockServer(jServer.blockServer())
	config.SetMDOps(jServer.mdOps())
	return tempdir, config, jServer
}

func teardownJournalServerTest(
	t *testing.T, tempdir string, config Config) {
	err := os.RemoveAll(tempdir)
	require.NoError(t, err)
	CheckConfigAndShutdown(t, config)
}

func TestJournalServerRestart(t *testing.T) {
	tempdir, config, jServer := setupJournalServerTest(t)
	defer teardownJournalServerTest(t, tempdir, config)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jServer.delegateBlockServer = shutdownOnlyBlockServer{}

	ctx := context.Background()

	tlfID := FakeTlfID(2, false)
	err := jServer.Enable(ctx, tlfID)
	require.NoError(t, err)

	blockServer := config.BlockServer()
	mdOps := config.MDOps()
	crypto := config.Crypto()

	uid := keybase1.MakeTestUID(1)
	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)

	h, err := MakeTlfHandle(ctx, bh, config.KBPKI())
	require.NoError(t, err)

	bCtx := BlockContext{uid, "", zeroBlockRefNonce}
	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	// Put a block.

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(ctx, tlfID, bID, bCtx, data, serverHalf)
	require.NoError(t, err)

	// Put an MD.

	var rmd RootMetadata
	err = updateNewBareRootMetadata(&rmd.BareRootMetadata, tlfID, bh)
	require.NoError(t, err)
	rmd.tlfHandle = h
	rmd.Revision = MetadataRevision(1)
	rekeyDone, _, err := config.KeyManager().Rekey(ctx, &rmd, false)
	require.NoError(t, err)
	require.True(t, rekeyDone)

	_, err = mdOps.Put(ctx, &rmd)
	require.NoError(t, err)

	// Simulate a restart.

	jServer = makeJournalServer(
		config, jServer.log, tempdir, jServer.delegateBlockCache,
		jServer.delegateBlockServer, jServer.delegateMDOps)
	err = jServer.EnableExistingJournals(ctx)
	require.NoError(t, err)
	config.SetBlockCache(jServer.blockCache())
	config.SetBlockServer(jServer.blockServer())
	config.SetMDOps(jServer.mdOps())

	// Get the block.

	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Get the MD.

	head, err := mdOps.GetForTLF(ctx, tlfID)
	require.NoError(t, err)
	require.Equal(t, rmd.Revision, head.Revision)
}
