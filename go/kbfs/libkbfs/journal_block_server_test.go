// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"testing"

	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func setupJournalBlockServerTest(t *testing.T) (
	tempdir string, ctx context.Context, cancel context.CancelFunc,
	config *ConfigLocal, jManager *JournalManager) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_block_server")
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

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jManager, err = GetJournalManager(config)
	require.NoError(t, err)
	blockServer := jManager.blockServer()
	// Turn this on for testing.
	blockServer.enableAddBlockReference = true
	config.SetBlockServer(blockServer)

	setupSucceeded = true
	return tempdir, ctx, cancel, config, jManager
}

func teardownJournalBlockServerTest(
	ctx context.Context, t *testing.T, tempdir string,
	cancel context.CancelFunc, config Config) {
	CheckConfigAndShutdown(ctx, t, config)
	cancel()
	err := ioutil.RemoveAll(tempdir)
	assert.NoError(t, err)
}

type shutdownOnlyBlockServer struct{ BlockServer }

func (shutdownOnlyBlockServer) Shutdown(context.Context) {}

func TestJournalBlockServerPutGetAddReference(t *testing.T) {
	tempdir, ctx, cancel, config, jManager := setupJournalBlockServerTest(t)
	defer teardownJournalBlockServerTest(ctx, t, tempdir, cancel, config)

	// Use a shutdown-only BlockServer so that it errors if the
	// journal tries to access it.
	jManager.delegateBlockServer = shutdownOnlyBlockServer{}

	tlfID := tlf.FakeID(2, tlf.Private)
	err := jManager.Enable(ctx, tlfID, nil, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	blockServer := config.BlockServer()

	uid1 := keybase1.MakeTestUID(1)
	bCtx := kbfsblock.MakeFirstContext(
		uid1.AsUserOrTeam(), keybase1.BlockType_DATA)
	data := []byte{1, 2, 3, 4}
	bID, err := kbfsblock.MakePermanentID(
		data, kbfscrypto.EncryptionSecretboxWithKeyNonce)
	require.NoError(t, err)

	// Put a block.
	serverHalf, err := kbfscrypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)
	err = blockServer.Put(
		ctx, tlfID, bID, bCtx, data, serverHalf, DiskBlockAnyCache)
	require.NoError(t, err)

	// Now get the same block back.
	buf, key, err := blockServer.Get(ctx, tlfID, bID, bCtx, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Add a reference.
	uid2 := keybase1.MakeTestUID(2)
	nonce, err := kbfsblock.MakeRefNonce()
	require.NoError(t, err)
	bCtx2 := kbfsblock.MakeContext(
		uid1.AsUserOrTeam(), uid2.AsUserOrTeam(), nonce,
		keybase1.BlockType_DATA)
	err = blockServer.AddBlockReference(ctx, tlfID, bID, bCtx2)
	require.NoError(t, err)

	// Now get the same block back.
	buf, key, err = blockServer.Get(ctx, tlfID, bID, bCtx2, DiskBlockAnyCache)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)
}
