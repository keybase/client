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
)

func getBlockJournalLength(t *testing.T, j *bserverTlfJournal) int {
	len, err := j.journalLength()
	require.NoError(t, err)
	return int(len)
}

func TestBserverTlfJournalBasic(t *testing.T) {
	codec := NewCodecMsgpack()
	crypto := makeTestCryptoCommon(t)

	tempdir, err := ioutil.TempDir(os.TempDir(), "bserver_tlf_journal")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)

	j, err := makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)
	defer j.shutdown()

	require.Equal(t, 0, getBlockJournalLength(t, j))

	bCtx := BlockContext{uid1, "", zeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	// Put the block.
	err = j.putData(bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.Equal(t, 1, getBlockJournalLength(t, j))

	// Make sure we get the same block back.
	buf, key, err := j.getData(bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = j.addReference(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, 2, getBlockJournalLength(t, j))

	// Make sure we get the same block via that reference.
	buf, key, err = j.getData(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Shutdown and restart.
	j.shutdown()
	j, err = makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)

	require.Equal(t, 2, getBlockJournalLength(t, j))

	// Make sure we get the same block for both refs.

	buf, key, err = j.getData(bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	buf, key, err = j.getData(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)
}

func TestBserverTlfJournalRemoveReferences(t *testing.T) {
	codec := NewCodecMsgpack()
	crypto := makeTestCryptoCommon(t)

	tempdir, err := ioutil.TempDir(os.TempDir(), "bserver_tlf_storage")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)

	j, err := makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)
	defer j.shutdown()

	require.Equal(t, 0, getBlockJournalLength(t, j))

	bCtx := BlockContext{uid1, "", zeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	// Put the block.
	err = j.putData(bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.Equal(t, 1, getBlockJournalLength(t, j))

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = j.addReference(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, 2, getBlockJournalLength(t, j))

	// Remove references.
	liveCount, err := j.removeReferences(bID, []BlockContext{bCtx, bCtx2})
	require.NoError(t, err)
	require.Equal(t, 0, liveCount)
	require.Equal(t, 3, getBlockJournalLength(t, j))

	// Add reference back, which should error.
	err = j.addReference(bID, bCtx2)
	require.IsType(t, BServerErrorBlockArchived{}, err)
	require.Equal(t, 3, getBlockJournalLength(t, j))
}

func TestBserverTlfJournalArchiveReferences(t *testing.T) {
	codec := NewCodecMsgpack()
	crypto := makeTestCryptoCommon(t)

	tempdir, err := ioutil.TempDir(os.TempDir(), "bserver_tlf_storage")
	require.NoError(t, err)
	defer func() {
		err := os.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	uid1 := keybase1.MakeTestUID(1)
	uid2 := keybase1.MakeTestUID(2)

	j, err := makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)
	defer j.shutdown()

	require.Equal(t, 0, getBlockJournalLength(t, j))

	bCtx := BlockContext{uid1, "", zeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	// Put the block.
	err = j.putData(bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.Equal(t, 1, getBlockJournalLength(t, j))

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = j.addReference(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, 2, getBlockJournalLength(t, j))

	// Archive references.
	err = j.archiveReferences(bID, []BlockContext{bCtx, bCtx2})
	require.NoError(t, err)
	require.Equal(t, 3, getBlockJournalLength(t, j))

	// Add reference back, which should error.
	err = j.addReference(bID, bCtx2)
	require.IsType(t, BServerErrorBlockArchived{}, err)
	require.Equal(t, 3, getBlockJournalLength(t, j))
}
