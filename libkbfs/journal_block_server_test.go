// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupJournalBlockServerTest(t *testing.T) (
	tempdir string, config *ConfigLocal, jServer *JournalServer) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_block_server")
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

	config.EnableJournaling(tempdir)
	jServer, err = GetJournalServer(config)
	require.NoError(t, err)
	blockServer := jServer.blockServer()
	// Turn this on for testing.
	blockServer.enableAddBlockReference = true
	config.SetBlockServer(blockServer)

	setupSucceeded = true
	return tempdir, config, jServer
}

func teardownJournalBlockServerTest(
	t *testing.T, tempdir string, config Config) {
	CheckConfigAndShutdown(t, config)
	err := os.RemoveAll(tempdir)
	assert.NoError(t, err)
}

type shutdownOnlyBlockServer struct{ BlockServer }

func (shutdownOnlyBlockServer) Shutdown() {}

func TestJournalBlockServerPutGetAddReference(t *testing.T) {
	tempdir, config, jServer := setupJournalBlockServerTest(t)
	defer teardownJournalBlockServerTest(t, tempdir, config)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jServer.delegateBlockServer = shutdownOnlyBlockServer{}

	ctx := context.Background()

	tlfID := tlf.FakeID(2, false)
	err := jServer.Enable(ctx, tlfID, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()
	crypto := config.Crypto()

	uid1 := keybase1.MakeTestUID(1)
	bCtx := BlockContext{uid1, "", ZeroBlockRefNonce}
	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	// Put a block.
	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(ctx, tlfID, bID, bCtx, data, serverHalf)
	require.NoError(t, err)

	// Now get the same block back.
	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Add a reference.
	uid2 := keybase1.MakeTestUID(2)
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = blockServer.AddBlockReference(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)

	// Now get the same block back.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)
}
