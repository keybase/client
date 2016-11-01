// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type singleEncryptionKeyGetter struct {
	k kbfscrypto.TLFCryptKey
}

func (g singleEncryptionKeyGetter) GetTLFCryptKeyForEncryption(
	ctx context.Context, kmd KeyMetadata) (kbfscrypto.TLFCryptKey, error) {
	return g.k, nil
}

func (g singleEncryptionKeyGetter) GetTLFCryptKeyForMDDecryption(
	ctx context.Context, kmdToDecrypt, kmdWithKeys KeyMetadata) (
	kbfscrypto.TLFCryptKey, error) {
	return g.k, nil
}

func getMDJournalLength(t *testing.T, j *mdJournal) int {
	len, err := j.length()
	require.NoError(t, err)
	return int(len)
}

func setupMDJournalTest(t *testing.T) (
	codec kbfscodec.Codec, crypto CryptoCommon, tlfID TlfID,
	signer kbfscrypto.Signer, ekg singleEncryptionKeyGetter,
	bsplit BlockSplitter, tempdir string, j *mdJournal) {
	codec = kbfscodec.NewMsgpack()
	crypto = MakeCryptoCommon(codec)

	uid := keybase1.MakeTestUID(1)
	tlfID = FakeTlfID(1, false)

	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("fake seed")
	signer = kbfscrypto.SigningKeySigner{Key: signingKey}
	verifyingKey := signingKey.GetVerifyingKey()
	ekg = singleEncryptionKeyGetter{
		kbfscrypto.MakeTLFCryptKey([32]byte{0x1}),
	}

	tempdir, err := ioutil.TempDir(os.TempDir(), "md_journal")
	require.NoError(t, err)

	// Clean up the tempdir if the rest of the setup fails.
	setupSucceeded := false
	defer func() {
		if !setupSucceeded {
			err := os.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	log := logger.NewTestLogger(t)
	j, err = makeMDJournal(uid, verifyingKey, codec, crypto, wallClock{},
		tlfID, defaultClientMetadataVer, tempdir, log)
	require.NoError(t, err)

	bsplit = &BlockSplitterSimple{64 * 1024, 8 * 1024}

	return codec, crypto, tlfID, signer, ekg, bsplit, tempdir, j
}

func teardownMDJournalTest(t *testing.T, tempdir string) {
	err := os.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func makeMDForTest(t *testing.T, tlfID TlfID, revision MetadataRevision,
	uid keybase1.UID, signer kbfscrypto.Signer, prevRoot MdID) *RootMetadata {
	nug := testNormalizedUsernameGetter{
		uid: "fake_username",
	}
	bh, err := MakeBareTlfHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)
	h, err := MakeTlfHandle(context.Background(), bh, nug)
	require.NoError(t, err)
	crypto := MakeCryptoCommon(kbfscodec.NewMsgpack())
	md, err := makeInitialRootMetadata(defaultClientMetadataVer, tlfID, h)
	require.NoError(t, err)
	md.SetRevision(revision)
	md.fakeInitialRekey(crypto)
	md.SetPrevRoot(prevRoot)
	md.SetDiskUsage(500)
	md.bareMd.SignWriterMetadataInternally(context.Background(),
		kbfscodec.NewMsgpack(), signer)
	// TODO: Fill in an ExtraMetadata.
	return md
}

func putMDRange(t *testing.T, tlfID TlfID, signer kbfscrypto.Signer,
	ekg singleEncryptionKeyGetter, bsplit BlockSplitter,
	firstRevision MetadataRevision, firstPrevRoot MdID, mdCount int,
	j *mdJournal) MdID {
	prevRoot := firstPrevRoot
	ctx := context.Background()
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, tlfID, revision, j.uid, signer, prevRoot)
		mdID, err := j.put(ctx, signer, ekg, bsplit, md)
		require.NoError(t, err)
		prevRoot = mdID
	}
	return prevRoot
}

func checkBRMD(t *testing.T, uid keybase1.UID, key kbfscrypto.VerifyingKey,
	codec kbfscodec.Codec, crypto cryptoPure, brmd BareRootMetadata,
	expectedRevision MetadataRevision, expectedPrevRoot MdID,
	expectedMergeStatus MergeStatus, expectedBranchID BranchID) {
	require.Equal(t, expectedRevision, brmd.RevisionNumber())
	require.Equal(t, expectedPrevRoot, brmd.GetPrevRoot())
	require.Equal(t, expectedMergeStatus, brmd.MergedStatus())
	// MDv3 TODO: pass key bundles
	err := brmd.IsValidAndSigned(codec, crypto, nil)
	require.NoError(t, err)
	err = brmd.IsLastModifiedBy(uid, key)
	require.NoError(t, err)

	require.Equal(t, expectedMergeStatus == Merged,
		expectedBranchID == NullBranchID)
	require.Equal(t, expectedBranchID, brmd.BID())
}

func checkIBRMDRange(t *testing.T, uid keybase1.UID,
	key kbfscrypto.VerifyingKey, codec kbfscodec.Codec, crypto cryptoPure,
	ibrmds []ImmutableBareRootMetadata, firstRevision MetadataRevision,
	firstPrevRoot MdID, mStatus MergeStatus, bid BranchID) {
	checkBRMD(t, uid, key, codec, crypto, ibrmds[0],
		firstRevision, firstPrevRoot, mStatus, bid)

	for i := 1; i < len(ibrmds); i++ {
		prevID := ibrmds[i-1].mdID
		checkBRMD(t, uid, key, codec, crypto, ibrmds[i],
			firstRevision+MetadataRevision(i), prevID, mStatus, bid)
		err := ibrmds[i-1].CheckValidSuccessor(
			prevID, ibrmds[i])
		require.NoError(t, err)
	}
}

func TestMDJournalBasic(t *testing.T) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	// Should start off as empty.

	head, err := j.getHead()
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)
	require.Equal(t, 0, getMDJournalLength(t, j))

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	require.Equal(t, mdCount, getMDJournalLength(t, j))

	// Should now be non-empty.
	ibrmds, err := j.getRange(
		1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Merged, NullBranchID)

	head, err = j.getHead()
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)
}

func TestMDJournalGetNextEntry(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	mdID, rmds, _, err := j.getNextEntryToFlush(ctx, md.Revision(), signer)
	require.NoError(t, err)
	require.Equal(t, MdID{}, mdID)
	require.Nil(t, rmds)

	mdID, rmds, _, err = j.getNextEntryToFlush(ctx, md.Revision()+1, signer)
	require.NoError(t, err)
	require.NotEqual(t, MdID{}, mdID)
	require.Equal(t, md.bareMd, rmds.MD)

	mdID, rmds, _, err = j.getNextEntryToFlush(
		ctx, md.Revision()+100, signer)
	require.NoError(t, err)
	require.NotEqual(t, MdID{}, mdID)
	require.Equal(t, md.bareMd, rmds.MD)
}

func TestMDJournalPutCase1Empty(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	head, err := j.getHead()
	require.NoError(t, err)
	require.Equal(t, md.bareMd, head.BareRootMetadata)
}

func TestMDJournalPutCase1Conflict(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	_, err = j.put(ctx, signer, ekg, bsplit, md)
	require.Equal(t, MDJournalConflictError{}, err)
}

// The append portion of case 1 is covered by TestMDJournalBasic.

func TestMDJournalPutCase1ReplaceHead(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 3
	prevRoot := putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	// Should just replace the head.

	ctx := context.Background()

	revision := firstRevision + MetadataRevision(mdCount) - 1
	md := makeMDForTest(t, id, revision, j.uid, signer, prevRoot)
	md.SetDiskUsage(501)
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	head, err := j.getHead()
	require.NoError(t, err)
	require.Equal(t, md.Revision(), head.RevisionNumber())
	require.Equal(t, md.DiskUsage(), head.DiskUsage())
}

func TestMDJournalPutCase2NonEmptyReplace(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	md.SetUnmerged()
	_, err = j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)
}

func TestMDJournalPutCase2NonEmptyAppend(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	mdID, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	md2 := makeMDForTest(t, id, MetadataRevision(11), j.uid, signer, mdID)
	md2.SetUnmerged()
	_, err = j.put(ctx, signer, ekg, bsplit, md2)
	require.NoError(t, err)
}

func TestMDJournalPutCase2Empty(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Flush.
	mdID, rmds, _, err := j.getNextEntryToFlush(
		ctx, md.Revision()+1, signer)
	require.NoError(t, err)
	j.removeFlushedEntry(ctx, mdID, rmds)

	md2 := makeMDForTest(t, id, MetadataRevision(11), j.uid, signer, mdID)
	md2.SetUnmerged()
	_, err = j.put(ctx, signer, ekg, bsplit, md2)
	require.NoError(t, err)
}

func TestMDJournalPutCase3NonEmptyAppend(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	head, err := j.getHead()
	require.NoError(t, err)

	md2 := makeMDForTest(t, id, MetadataRevision(11), j.uid, signer, head.mdID)
	md2.SetUnmerged()
	md2.SetBranchID(head.BID())
	_, err = j.put(ctx, signer, ekg, bsplit, md2)
	require.NoError(t, err)
}

func TestMDJournalPutCase3NonEmptyReplace(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	head, err := j.getHead()
	require.NoError(t, err)

	md.SetUnmerged()
	md.SetBranchID(head.BID())
	_, err = j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)
}

func TestMDJournalPutCase3EmptyAppend(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)

	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Flush.
	mdID, rmds, _, err := j.getNextEntryToFlush(
		ctx, md.Revision()+1, signer)
	require.NoError(t, err)
	j.removeFlushedEntry(ctx, mdID, rmds)

	md2 := makeMDForTest(t, id, MetadataRevision(11), j.uid, signer, mdID)
	md2.SetUnmerged()
	md2.SetBranchID(j.branchID)
	_, err = j.put(ctx, signer, ekg, bsplit, md2)
	require.NoError(t, err)
}

func TestMDJournalPutCase4(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	md.SetUnmerged()
	md.SetBranchID(FakeBranchID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md)
	require.NoError(t, err)
}

func testMDJournalGCd(t *testing.T, j *mdJournal) {
	filepath.Walk(j.j.j.dir, func(path string, _ os.FileInfo, _ error) error {
		// We should only find the root directory here.
		require.Equal(t, path, j.j.j.dir)
		return nil
	})
	filepath.Walk(j.mdsPath(),
		func(path string, info os.FileInfo, _ error) error {
			// We should only find the MD directory here.
			require.Equal(t, path, j.mdsPath())
			return nil
		})
}

func flushAllMDs(
	t *testing.T, ctx context.Context, signer kbfscrypto.Signer, j *mdJournal) {
	end, err := j.end()
	require.NoError(t, err)
	for {
		mdID, rmds, _, err := j.getNextEntryToFlush(ctx, end, signer)
		require.NoError(t, err)
		if mdID == (MdID{}) {
			break
		}
		j.removeFlushedEntry(ctx, mdID, rmds)
	}
	testMDJournalGCd(t, j)
}

func TestMDJournalBranchConversion(t *testing.T) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	ctx := context.Background()

	// Put a single MD in the cache to make sure it gets converted.
	mdcache := NewMDCacheStandard(10)
	cachedMd := makeMDForTest(
		t, id, firstRevision, j.uid, signer, firstPrevRoot)
	err := mdcache.Put(MakeImmutableRootMetadata(cachedMd,
		j.key, fakeMdID(1), time.Now()))
	require.NoError(t, err)

	bid, err := j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, mdcache)
	require.NoError(t, err)

	// Branch conversion shouldn't leave old folders behind.
	fileInfos, err := ioutil.ReadDir(j.dir)
	require.NoError(t, err)
	for _, fileInfo := range fileInfos {
		t.Logf("name = %s", fileInfo.Name())
	}
	require.Equal(t, 2, len(fileInfos))
	require.Equal(t, "md_journal", fileInfos[0].Name())
	require.Equal(t, "mds", fileInfos[1].Name())

	ibrmds, err := j.getRange(
		1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Unmerged, ibrmds[0].BID())

	require.Equal(t, 10, getMDJournalLength(t, j))

	head, err := j.getHead()
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)

	flushAllMDs(t, ctx, signer, j)

	// Has the cache entry been replaced?
	newlyCachedMd, err := mdcache.Get(id, firstRevision, bid)
	require.NoError(t, err)
	require.Equal(t, newlyCachedMd.BID(), bid)
	require.Equal(t, newlyCachedMd.MergedStatus(), Unmerged)
	_, err = mdcache.Get(id, firstRevision, NullBranchID)
	require.Error(t, err)
}

func TestMDJournalResolveAndClear(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	ctx := context.Background()

	bid, err := j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(), id,
		NewMDCacheStandard(10))
	require.NoError(t, err)

	resolveRev := firstRevision
	md := makeMDForTest(t, id, resolveRev, j.uid, signer, firstPrevRoot)
	_, err = j.resolveAndClear(ctx, signer, ekg, bsplit, bid, md)
	require.NoError(t, err)

	require.Equal(t, 1, getMDJournalLength(t, j))
	head, err := j.getHead()
	require.NoError(t, err)
	require.Equal(t, md.Revision(), head.RevisionNumber())

	flushAllMDs(t, ctx, signer, j)
}

type limitedCryptoSigner struct {
	kbfscrypto.Signer
	remaining int
}

func (s *limitedCryptoSigner) Sign(ctx context.Context, msg []byte) (
	kbfscrypto.SignatureInfo, error) {
	if s.remaining <= 0 {
		return kbfscrypto.SignatureInfo{}, errors.New("No more Sign calls left")
	}
	s.remaining--
	return s.Signer.Sign(ctx, msg)
}

func TestMDJournalBranchConversionAtomic(t *testing.T) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	limitedSigner := limitedCryptoSigner{signer, 5}

	ctx := context.Background()

	_, err := j.convertToBranch(
		ctx, &limitedSigner, kbfscodec.NewMsgpack(), id, NewMDCacheStandard(10))
	require.NotNil(t, err)

	// All entries should remain unchanged, since the conversion
	// encountered an error.

	ibrmds, err := j.getRange(
		1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Merged, NullBranchID)

	require.Equal(t, 10, getMDJournalLength(t, j))

	head, err := j.getHead()
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)

	// Flush all MDs so we can check garbage collection.
	flushAllMDs(t, ctx, signer, j)
}

type mdIDJournalEntryExtra struct {
	mdIDJournalEntry
	Extra int
}

func TestMDJournalBranchConversionPreservesUnknownFields(t *testing.T) {
	codec, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	var expectedEntries []mdIDJournalEntry

	firstRevision := MetadataRevision(5)
	mdCount := 5
	prevRoot := fakeMdID(1)
	ctx := context.Background()
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, id, revision, j.uid, signer, prevRoot)
		mdID, err := j.put(ctx, signer, ekg, bsplit, md)
		require.NoError(t, err)

		// Add extra fields to the journal entry.
		entryFuture := mdIDJournalEntryExtra{
			mdIDJournalEntry: mdIDJournalEntry{
				ID: mdID,
			},
			Extra: i,
		}
		var entry mdIDJournalEntry
		err = kbfscodec.Update(codec, &entry, entryFuture)
		require.NoError(t, err)
		o, err := revisionToOrdinal(revision)
		require.NoError(t, err)
		j.j.j.writeJournalEntry(o, entry)

		// Zero out the MdID, since branch conversion changes
		// it.
		entry.ID = MdID{}
		expectedEntries = append(expectedEntries, entry)

		prevRoot = mdID
	}

	_, err := j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Check that the extra fields are preserved.
	_, entries, err := j.j.getEntryRange(
		firstRevision, firstRevision+MetadataRevision(mdCount))
	require.NoError(t, err)
	// Zero out MdIDs for comparison.
	for i, entry := range entries {
		entry.ID = MdID{}
		entries[i] = entry
	}
	require.Equal(t, expectedEntries, entries)

	flushAllMDs(t, ctx, signer, j)
}

func TestMDJournalClear(t *testing.T) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	ctx := context.Background()

	_, err := j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)
	require.NotEqual(t, NullBranchID, j.branchID)

	bid := j.branchID

	// Clearing the master branch shouldn't work.
	err = j.clear(ctx, NullBranchID)
	require.Error(t, err)

	// Clearing a different branch ID should do nothing.
	err = j.clear(ctx, FakeBranchID(1))
	require.NoError(t, err)
	require.Equal(t, bid, j.branchID)

	head, err := j.getHead()
	require.NoError(t, err)
	require.NotEqual(t, ImmutableBareRootMetadata{}, head)

	// Clearing the correct branch ID should clear the entire
	// journal, and reset the branch ID.
	err = j.clear(ctx, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	head, err = j.getHead()
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)

	// Clearing twice should do nothing.
	err = j.clear(ctx, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	head, err = j.getHead()
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)

	// Put more MDs, flush them, and clear the branch ID of an empty
	// journal.
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)
	_, err = j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)
	require.NotEqual(t, NullBranchID, j.branchID)

	bid = j.branchID
	flushAllMDs(t, ctx, signer, j)
	require.Equal(t, bid, j.branchID)
	err = j.clear(ctx, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	flushAllMDs(t, ctx, signer, j)
}

func TestMDJournalRestart(t *testing.T) {
	codec, crypto, id, signer, ekg,
		bsplit, tempdir, j := setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	// Restart journal.
	j, err := makeMDJournal(j.uid, j.key, codec, crypto, j.clock,
		j.tlfID, j.mdVer, j.dir, j.log)
	require.NoError(t, err)

	require.Equal(t, mdCount, getMDJournalLength(t, j))

	ibrmds, err := j.getRange(
		1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Merged, NullBranchID)

	flushAllMDs(t, context.Background(), signer, j)
}

func TestMDJournalRestartAfterBranchConversion(t *testing.T) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	// Convert to branch.

	ctx := context.Background()

	_, err := j.convertToBranch(ctx, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Restart journal.

	j, err = makeMDJournal(j.uid, j.key, codec, crypto, j.clock,
		j.tlfID, j.mdVer, j.dir, j.log)
	require.NoError(t, err)

	require.Equal(t, mdCount, getMDJournalLength(t, j))

	ibrmds, err := j.getRange(
		1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Unmerged, ibrmds[0].BID())

	flushAllMDs(t, ctx, signer, j)
}
