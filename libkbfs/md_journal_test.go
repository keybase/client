// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"io/ioutil"
	"os"
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type singleEncryptionKeyGetter struct {
	k TLFCryptKey
}

func (g singleEncryptionKeyGetter) GetTLFCryptKeyForEncryption(
	ctx context.Context, kmd KeyMetadata) (TLFCryptKey, error) {
	return g.k, nil
}

func getMDJournalLength(t *testing.T, j *mdJournal) int {
	len, err := j.length()
	require.NoError(t, err)
	return int(len)
}

func setupMDJournalTest(t *testing.T) (
	codec Codec, crypto CryptoCommon,
	uid keybase1.UID, id TlfID, signer cryptoSigner,
	verifyingKey VerifyingKey, ekg singleEncryptionKeyGetter,
	bsplit BlockSplitter, tempdir string, j *mdJournal) {
	codec = NewCodecMsgpack()
	crypto = MakeCryptoCommon(codec)

	uid = keybase1.MakeTestUID(1)
	id = FakeTlfID(1, false)

	signingKey := MakeFakeSigningKeyOrBust("fake seed")
	signer = cryptoSignerLocal{signingKey}
	verifyingKey = signingKey.GetVerifyingKey()
	ekg = singleEncryptionKeyGetter{MakeTLFCryptKey([32]byte{0x1})}

	tempdir, err := ioutil.TempDir(os.TempDir(), "md_journal")
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

	log := logger.NewTestLogger(t)
	j, err = makeMDJournal(uid, verifyingKey, codec, crypto, tempdir, log)
	require.NoError(t, err)

	bsplit = &BlockSplitterSimple{64 * 1024, 8 * 1024}

	return codec, crypto, uid, id, signer, verifyingKey, ekg,
		bsplit, tempdir, j
}

func teardownMDJournalTest(t *testing.T, tempdir string) {
	err := os.RemoveAll(tempdir)
	require.NoError(t, err)
}

func makeMDForTest(t *testing.T, id TlfID, revision MetadataRevision,
	uid keybase1.UID, prevRoot MdID) *RootMetadata {
	h, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)
	md := NewRootMetadata()
	err = md.Update(id, h)
	require.NoError(t, err)
	md.SetRevision(revision)
	md.FakeInitialRekey(h)
	md.SetPrevRoot(prevRoot)
	return md
}

func TestMDJournalBasic(t *testing.T) {
	codec, crypto, uid, id, signer, verifyingKey, ekg,
		bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	// Should start off as empty.

	head, err := j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)
	require.Equal(t, 0, getMDJournalLength(t, j))

	// Push some new metadata blocks.

	ctx := context.Background()

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, id, revision, uid, prevRoot)
		mdID, err := j.put(
			ctx, uid, verifyingKey, signer, ekg, bsplit, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	require.Equal(t, mdCount, getMDJournalLength(t, j))

	// Should now be non-empty.

	ibrmds, err := j.getRange(
		uid, verifyingKey, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	require.Equal(t, firstRevision, ibrmds[0].RevisionNumber())
	require.Equal(t, firstPrevRoot, ibrmds[0].GetPrevRoot())
	err = ibrmds[0].IsValidAndSigned(codec, crypto)
	require.NoError(t, err)
	err = ibrmds[0].IsLastModifiedBy(uid, verifyingKey)
	require.NoError(t, err)

	for i := 1; i < len(ibrmds); i++ {
		err := ibrmds[i].IsValidAndSigned(codec, crypto)
		require.NoError(t, err)
		err = ibrmds[i].IsLastModifiedBy(uid, verifyingKey)
		require.NoError(t, err)
		err = ibrmds[i-1].CheckValidSuccessor(
			ibrmds[i-1].mdID, ibrmds[i].BareRootMetadata)
		require.NoError(t, err)
	}

	head, err = j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)
}

func TestMDJournalReplaceHead(t *testing.T) {
	_, _, uid, id, signer, verifyingKey, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	ctx := context.Background()

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 3

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, id, revision, uid, prevRoot)
		mdID, err := j.put(
			ctx, uid, verifyingKey, signer, ekg, bsplit, md)
		md.SetDiskUsage(500)
		require.NoError(t, err)
		prevRoot = mdID
	}

	// Should just replace the head.

	revision := firstRevision + MetadataRevision(mdCount) - 1
	md := makeMDForTest(t, id, revision, uid, prevRoot)
	md.SetDiskUsage(501)
	_, err := j.put(
		ctx, uid, verifyingKey, signer, ekg, bsplit, md)
	require.NoError(t, err)

	head, err := j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, md.Revision(), head.RevisionNumber())
	require.Equal(t, md.DiskUsage(), head.DiskUsage())
}

func TestMDJournalBranchConversion(t *testing.T) {
	codec, crypto, uid, id, signer, verifyingKey, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, id, revision, uid, prevRoot)
		mdID, err := j.put(
			ctx, uid, verifyingKey, signer, ekg, bsplit, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	err := j.convertToBranch(ctx, uid, verifyingKey, signer)
	require.NoError(t, err)

	ibrmds, err := j.getRange(
		uid, verifyingKey, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	require.Equal(t, firstRevision, ibrmds[0].RevisionNumber())
	require.Equal(t, firstPrevRoot, ibrmds[0].GetPrevRoot())
	require.Equal(t, Unmerged, ibrmds[0].MergedStatus())
	err = ibrmds[0].IsValidAndSigned(codec, crypto)
	require.NoError(t, err)
	err = ibrmds[0].IsLastModifiedBy(uid, verifyingKey)
	require.NoError(t, err)

	bid := ibrmds[0].BID()
	require.NotEqual(t, NullBranchID, bid)

	for i := 1; i < len(ibrmds); i++ {
		require.Equal(t, Unmerged, ibrmds[i].MergedStatus())
		require.Equal(t, bid, ibrmds[i].BID())
		err := ibrmds[i].IsValidAndSigned(codec, crypto)
		require.NoError(t, err)
		err = ibrmds[i].IsLastModifiedBy(uid, verifyingKey)
		require.NoError(t, err)
		err = ibrmds[i-1].CheckValidSuccessor(
			ibrmds[i-1].mdID, ibrmds[i].BareRootMetadata)
		require.NoError(t, err)
	}

	require.Equal(t, 10, getMDJournalLength(t, j))

	head, err := j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)
}

type limitedCryptoSigner struct {
	cryptoSigner
	remaining int
}

func (s *limitedCryptoSigner) Sign(ctx context.Context, msg []byte) (
	SignatureInfo, error) {
	if s.remaining <= 0 {
		return SignatureInfo{}, errors.New("No more Sign calls left")
	}
	s.remaining--
	return s.cryptoSigner.Sign(ctx, msg)
}

func TestMDJournalBranchConversionAtomic(t *testing.T) {
	codec, crypto, uid, id, signer, verifyingKey, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, id, revision, uid, prevRoot)
		mdID, err := j.put(
			ctx, uid, verifyingKey, signer, ekg, bsplit, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	limitedSigner := limitedCryptoSigner{signer, 5}

	err := j.convertToBranch(ctx, uid, verifyingKey, &limitedSigner)
	require.NotNil(t, err)

	// All entries should remain unchanged, since the conversion
	// encountered an error.

	ibrmds, err := j.getRange(
		uid, verifyingKey, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	require.Equal(t, firstRevision, ibrmds[0].RevisionNumber())
	require.Equal(t, firstPrevRoot, ibrmds[0].GetPrevRoot())
	require.Equal(t, Merged, ibrmds[0].MergedStatus())
	err = ibrmds[0].IsValidAndSigned(codec, crypto)
	require.NoError(t, err)
	err = ibrmds[0].IsLastModifiedBy(uid, verifyingKey)
	require.NoError(t, err)

	for i := 1; i < len(ibrmds); i++ {
		require.Equal(t, Merged, ibrmds[i].MergedStatus())
		require.Equal(t, NullBranchID, ibrmds[i].BID())
		err := ibrmds[i].IsValidAndSigned(codec, crypto)
		require.NoError(t, err)
		err = ibrmds[i].IsLastModifiedBy(uid, verifyingKey)
		require.NoError(t, err)
		err = ibrmds[i-1].CheckValidSuccessor(
			ibrmds[i-1].mdID, ibrmds[i].BareRootMetadata)
		require.NoError(t, err)
	}

	require.Equal(t, 10, getMDJournalLength(t, j))

	head, err := j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)
}

func TestMDJournalClear(t *testing.T) {
	_, _, uid, id, signer, verifyingKey, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10

	prevRoot := firstPrevRoot
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, id, revision, uid, prevRoot)
		mdID, err := j.put(
			ctx, uid, verifyingKey, signer, ekg, bsplit, md)
		require.NoError(t, err)
		prevRoot = mdID
	}

	err := j.convertToBranch(ctx, uid, verifyingKey, signer)
	require.NoError(t, err)
	require.NotEqual(t, NullBranchID, j.branchID)

	bid := j.branchID

	// Clearing the master branch shouldn't work.
	err = j.clear(ctx, uid, verifyingKey, NullBranchID)
	require.Error(t, err)

	// Clearing a different branch ID should do nothing.

	err = j.clear(ctx, uid, verifyingKey, FakeBranchID(1))
	require.NoError(t, err)
	require.Equal(t, bid, j.branchID)

	head, err := j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableBareRootMetadata{}, head)

	// Clearing the correct branch ID should clear the entire
	// journal, and reset the branch ID.

	err = j.clear(ctx, uid, verifyingKey, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	head, err = j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)

	// Clearing twice should do nothing.

	err = j.clear(ctx, uid, verifyingKey, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	head, err = j.getHead(uid, verifyingKey)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)
}
