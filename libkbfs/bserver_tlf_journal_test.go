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

func getJournalLength(t *testing.T, s *bserverTlfJournal) int {
	len, err := s.journalLength()
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

	s, err := makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)
	defer s.shutdown()

	require.Equal(t, 0, getJournalLength(t, s))

	bCtx := BlockContext{uid1, "", zeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	// Put the block.
	err = s.putData(bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.Equal(t, 1, getJournalLength(t, s))

	// Make sure we get the same block back.
	buf, key, err := s.getData(bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = s.addReference(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, 2, getJournalLength(t, s))

	// Make sure we get the same block via that reference.
	buf, key, err = s.getData(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	// Shutdown and restart.
	s.shutdown()
	s, err = makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)

	require.Equal(t, 2, getJournalLength(t, s))

	// Make sure we get the same block for both refs.

	buf, key, err = s.getData(bID, bCtx)
	require.NoError(t, err)
	require.Equal(t, data, buf)
	require.Equal(t, serverHalf, key)

	buf, key, err = s.getData(bID, bCtx2)
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

	s, err := makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)
	defer s.shutdown()

	require.Equal(t, 0, getJournalLength(t, s))

	bCtx := BlockContext{uid1, "", zeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	// Put the block.
	err = s.putData(bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.Equal(t, 1, getJournalLength(t, s))

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = s.addReference(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, 2, getJournalLength(t, s))

	// Remove references.
	liveCount, err := s.removeReferences(bID, []BlockContext{bCtx, bCtx2})
	require.NoError(t, err)
	require.Equal(t, 0, liveCount)
	require.Equal(t, 3, getJournalLength(t, s))

	// Add reference back, which should error.
	err = s.addReference(bID, bCtx2)
	require.IsType(t, BServerErrorBlockArchived{}, err)
	require.Equal(t, 3, getJournalLength(t, s))
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

	s, err := makeBserverTlfJournal(codec, crypto, tempdir)
	require.NoError(t, err)
	defer s.shutdown()

	require.Equal(t, 0, getJournalLength(t, s))

	bCtx := BlockContext{uid1, "", zeroBlockRefNonce}

	data := []byte{1, 2, 3, 4}
	bID, err := crypto.MakePermanentBlockID(data)
	require.NoError(t, err)

	serverHalf, err := crypto.MakeRandomBlockCryptKeyServerHalf()
	require.NoError(t, err)

	// Put the block.
	err = s.putData(bID, bCtx, data, serverHalf)
	require.NoError(t, err)
	require.Equal(t, 1, getJournalLength(t, s))

	// Add a reference.
	nonce, err := crypto.MakeBlockRefNonce()
	require.NoError(t, err)
	bCtx2 := BlockContext{uid1, uid2, nonce}
	err = s.addReference(bID, bCtx2)
	require.NoError(t, err)
	require.Equal(t, 2, getJournalLength(t, s))

	// Archive references.
	err = s.archiveReferences(bID, []BlockContext{bCtx, bCtx2})
	require.NoError(t, err)
	require.Equal(t, 3, getJournalLength(t, s))

	// Add reference back, which should error.
	err = s.addReference(bID, bCtx2)
	require.IsType(t, BServerErrorBlockArchived{}, err)
	require.Equal(t, 3, getJournalLength(t, s))
}
