// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
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

func setupMDJournalTest(t testing.TB, ver MetadataVer) (
	codec kbfscodec.Codec, crypto CryptoCommon, tlfID tlf.ID,
	signer kbfscrypto.Signer, ekg singleEncryptionKeyGetter,
	bsplit BlockSplitter, tempdir string, j *mdJournal) {
	codec = kbfscodec.NewMsgpack()
	crypto = MakeCryptoCommon(codec)

	uid := keybase1.MakeTestUID(1)
	tlfID = tlf.FakeID(1, false)

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
			err := ioutil.RemoveAll(tempdir)
			assert.NoError(t, err)
		}
	}()

	log := logger.NewTestLogger(t)
	ctx := context.Background()
	j, err = makeMDJournal(
		ctx, uid, verifyingKey, codec, crypto, wallClock{},
		tlfID, ver, tempdir, log)
	require.NoError(t, err)

	bsplit = &BlockSplitterSimple{64 * 1024, 8 * 1024}

	return codec, crypto, tlfID, signer, ekg, bsplit, tempdir, j
}

func teardownMDJournalTest(t testing.TB, tempdir string) {
	err := ioutil.RemoveAll(tempdir)
	assert.NoError(t, err)
}

func makeMDForTest(t testing.TB, ver MetadataVer, tlfID tlf.ID,
	revision MetadataRevision, uid keybase1.UID,
	signer kbfscrypto.Signer, prevRoot MdID) *RootMetadata {
	nug := testNormalizedUsernameGetter{
		uid: "fake_username",
	}
	bh, err := tlf.MakeHandle([]keybase1.UID{uid}, nil, nil, nil, nil)
	require.NoError(t, err)
	h, err := MakeTlfHandle(context.Background(), bh, nug)
	require.NoError(t, err)
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	md, err := makeInitialRootMetadata(ver, tlfID, h)
	require.NoError(t, err)
	md.SetRevision(revision)
	md.fakeInitialRekey(codec, crypto)
	md.SetPrevRoot(prevRoot)
	md.SetDiskUsage(500)
	return md
}

func putMDRangeHelper(t testing.TB, ver MetadataVer, tlfID tlf.ID,
	signer kbfscrypto.Signer, firstRevision MetadataRevision,
	firstPrevRoot MdID, mdCount int, uid keybase1.UID,
	putMD func(context.Context, *RootMetadata) (MdID, error)) (
	[]*RootMetadata, MdID) {
	require.True(t, mdCount > 0)
	ctx := context.Background()
	var mds []*RootMetadata
	md := makeMDForTest(
		t, ver, tlfID, firstRevision, uid, signer, firstPrevRoot)
	mdID, err := putMD(ctx, md)
	require.NoError(t, err)
	mds = append(mds, md)
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	prevRoot := mdID
	for i := 1; i < mdCount; i++ {
		md, err = md.MakeSuccessor(ctx, ver, codec, crypto,
			nil, prevRoot, true)
		require.NoError(t, err)
		mdID, err := putMD(ctx, md)
		require.NoError(t, err)
		mds = append(mds, md)
		prevRoot = mdID
	}
	return mds, prevRoot
}

func putMDRange(t testing.TB, ver MetadataVer, tlfID tlf.ID,
	signer kbfscrypto.Signer, ekg encryptionKeyGetter,
	bsplit BlockSplitter, firstRevision MetadataRevision,
	firstPrevRoot MdID, mdCount int, j *mdJournal) ([]*RootMetadata, MdID) {
	return putMDRangeHelper(t, ver, tlfID, signer, firstRevision,
		firstPrevRoot, mdCount, j.uid,
		func(ctx context.Context, md *RootMetadata) (MdID, error) {
			return j.put(ctx, signer, ekg, bsplit, md, false)
		})
}

func checkBRMD(t *testing.T, uid keybase1.UID, key kbfscrypto.VerifyingKey,
	codec kbfscodec.Codec, crypto cryptoPure, brmd BareRootMetadata,
	extra ExtraMetadata, expectedRevision MetadataRevision,
	expectedPrevRoot MdID, expectedMergeStatus MergeStatus,
	expectedBranchID BranchID) {
	require.Equal(t, expectedRevision, brmd.RevisionNumber())
	require.Equal(t, expectedPrevRoot, brmd.GetPrevRoot())
	require.Equal(t, expectedMergeStatus, brmd.MergedStatus())
	err := brmd.IsValidAndSigned(codec, crypto, extra)
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
	checkBRMD(t, uid, key, codec, crypto, ibrmds[0], ibrmds[0].extra,
		firstRevision, firstPrevRoot, mStatus, bid)

	for i := 1; i < len(ibrmds); i++ {
		prevID := ibrmds[i-1].mdID
		checkBRMD(t, uid, key, codec, crypto, ibrmds[i],
			ibrmds[i].extra, firstRevision+MetadataRevision(i),
			prevID, mStatus, bid)
		err := ibrmds[i-1].CheckValidSuccessor(prevID, ibrmds[i])
		require.NoError(t, err)
	}
}

// noLogTB is an implementation of testing.TB that squelches all logs
// (for benchmarks).
type noLogTB struct {
	testing.TB
}

func (tb noLogTB) Log(args ...interface{}) {}

func (tb noLogTB) Logf(format string, args ...interface{}) {}

func BenchmarkMDJournalBasic(b *testing.B) {
	runBenchmarkOverMetadataVers(b, benchmarkMDJournalBasic)
}

func benchmarkMDJournalBasicBody(b *testing.B, ver MetadataVer, mdCount int) {
	b.StopTimer()

	_, _, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(noLogTB{b}, ver)
	defer teardownMDJournalTest(b, tempdir)

	putMDRangeHelper(b, ver, id, signer, MetadataRevision(10),
		fakeMdID(1), mdCount, j.uid,
		func(ctx context.Context, md *RootMetadata) (MdID, error) {
			b.StartTimer()
			defer b.StopTimer()
			return j.put(ctx, signer, ekg, bsplit, md, false)
		})
}

func benchmarkMDJournalBasic(b *testing.B, ver MetadataVer) {
	for _, mdCount := range []int{1, 10, 100, 1000, 10000} {
		mdCount := mdCount // capture range variable.
		name := fmt.Sprintf("mdCount=%d", mdCount)
		b.Run(name, func(b *testing.B) {
			b.StopTimer()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				benchmarkMDJournalBasicBody(b, ver, mdCount)
			}
		})
	}
}

func testMDJournalBasic(t *testing.T, ver MetadataVer) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	// Should start off as empty.

	head, err := j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)
	require.Equal(t, 0, getMDJournalLength(t, j))

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	mds, _ := putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	require.Equal(t, mdCount, len(mds))
	require.Equal(t, mdCount, getMDJournalLength(t, j))

	// Should now be non-empty.
	ibrmds, err := j.getRange(
		NullBranchID, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Merged, NullBranchID)

	head, err = j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)

	for i := 0; i < mdCount; i++ {
		require.Equal(t, mds[i].bareMd, ibrmds[i].BareRootMetadata, "i=%d", i)
		require.Equal(t, mds[i].extra, ibrmds[i].extra, "i=%d", i)
	}
}

func testMDJournalGetNextEntry(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
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

func testMDJournalPutCase1Empty(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	head, err := j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, md.bareMd, head.BareRootMetadata)
	require.Equal(t, md.extra, head.extra)
}

func testMDJournalPutCase1Conflict(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	_, err = j.put(ctx, signer, ekg, bsplit, md, false)
	require.Equal(t, MDJournalConflictError{}, err)
}

// The append portion of case 1 is covered by TestMDJournalBasic.

func testMDJournalPutCase1ReplaceHead(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 3
	_, prevRoot := putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	// Should just replace the head.

	ctx := context.Background()

	revision := firstRevision + MetadataRevision(mdCount) - 1
	md := makeMDForTest(t, ver, id, revision, j.uid, signer, prevRoot)
	md.SetDiskUsage(501)
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	head, err := j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, md.Revision(), head.RevisionNumber())
	require.Equal(t, md.DiskUsage(), head.DiskUsage())
	require.Equal(t, md.extra, head.extra)
}

func testMDJournalPutCase2NonEmptyReplace(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	md.SetUnmerged()
	_, err = j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)
}

func testMDJournalPutCase2NonEmptyAppend(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	mdID, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	md2 := makeMDForTest(t, ver, id, MetadataRevision(11), j.uid, signer, mdID)
	md2.SetUnmerged()
	_, err = j.put(ctx, signer, ekg, bsplit, md2, false)
	require.NoError(t, err)
}

func testMDJournalPutCase2Empty(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Flush.
	mdID, rmds, _, err := j.getNextEntryToFlush(
		ctx, md.Revision()+1, signer)
	require.NoError(t, err)
	j.removeFlushedEntry(ctx, mdID, rmds)

	md2 := makeMDForTest(t, ver, id, MetadataRevision(11), j.uid, signer, mdID)
	md2.SetUnmerged()
	_, err = j.put(ctx, signer, ekg, bsplit, md2, false)
	require.NoError(t, err)
}

func testMDJournalPutCase3NonEmptyAppend(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	bid := PendingLocalSquashBranchID
	err = j.convertToBranch(
		ctx, bid, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	head, err := j.getHead(bid)
	require.NoError(t, err)

	md2 := makeMDForTest(t, ver, id, MetadataRevision(11), j.uid, signer, head.mdID)
	md2.SetUnmerged()
	md2.SetBranchID(head.BID())
	_, err = j.put(ctx, signer, ekg, bsplit, md2, false)
	require.NoError(t, err)
}

func testMDJournalPutCase3NonEmptyReplace(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	bid := PendingLocalSquashBranchID
	err = j.convertToBranch(
		ctx, bid, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	head, err := j.getHead(bid)
	require.NoError(t, err)

	md.SetUnmerged()
	md.SetBranchID(head.BID())
	_, err = j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)
}

func testMDJournalPutCase3EmptyAppend(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)

	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Flush.
	mdID, rmds, _, err := j.getNextEntryToFlush(
		ctx, md.Revision()+1, signer)
	require.NoError(t, err)
	j.removeFlushedEntry(ctx, mdID, rmds)

	md2 := makeMDForTest(t, ver, id, MetadataRevision(11), j.uid, signer, mdID)
	md2.SetUnmerged()
	md2.SetBranchID(j.branchID)
	_, err = j.put(ctx, signer, ekg, bsplit, md2, false)
	require.NoError(t, err)
}

func testMDJournalPutCase4(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	ctx := context.Background()
	md := makeMDForTest(t, ver, id, MetadataRevision(10), j.uid, signer, fakeMdID(1))
	md.SetUnmerged()
	md.SetBranchID(FakeBranchID(1))
	_, err := j.put(ctx, signer, ekg, bsplit, md, false)
	require.NoError(t, err)
}

func testMDJournalGCd(t *testing.T, j *mdJournal) {
	err := filepath.Walk(j.j.j.dir, func(path string, _ os.FileInfo, _ error) error {
		// We should only find the root directory here.
		require.Equal(t, path, j.j.j.dir)
		return nil
	})
	require.NoError(t, err)
	err = filepath.Walk(j.mdsPath(),
		func(path string, info os.FileInfo, _ error) error {
			// We should only find the MD directory here.
			require.Equal(t, path, j.mdsPath())
			return nil
		})
	require.NoError(t, err)
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

func testMDJournalBranchConversion(t *testing.T, ver MetadataVer) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	ctx := context.Background()

	// Put a single MD in the cache to make sure it gets converted.
	mdcache := NewMDCacheStandard(10)
	cachedMd := makeMDForTest(
		t, ver, id, firstRevision, j.uid, signer, firstPrevRoot)
	err := cachedMd.bareMd.SignWriterMetadataInternally(ctx, codec, signer)
	require.NoError(t, err)
	cachedMdID, _, _, _, err := j.getEarliestWithExtra(false)
	require.NoError(t, err)
	err = mdcache.Put(MakeImmutableRootMetadata(cachedMd,
		j.key, cachedMdID, time.Now()))
	require.NoError(t, err)

	bid := PendingLocalSquashBranchID
	err = j.convertToBranch(ctx, bid, signer, kbfscodec.NewMsgpack(),
		id, mdcache)
	require.NoError(t, err)

	// Branch conversion shouldn't leave old folders behind.
	fileInfos, err := ioutil.ReadDir(j.dir)
	require.NoError(t, err)
	var names []string
	for _, fileInfo := range fileInfos {
		names = append(names, fileInfo.Name())
	}
	var expectedNames []string
	if ver < SegregatedKeyBundlesVer {
		expectedNames = []string{"md_journal", "mds"}
	} else {
		expectedNames = []string{
			"md_journal", "mds", "rkbv3", "wkbv3",
		}
	}
	require.Equal(t, expectedNames, names)

	ibrmds, err := j.getRange(
		bid, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Unmerged, ibrmds[0].BID())

	require.Equal(t, 10, getMDJournalLength(t, j))

	head, err := j.getHead(bid)
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

func testMDJournalResolveAndClear(t *testing.T, ver MetadataVer, bid BranchID) {
	_, _, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	ctx := context.Background()

	mdcache := NewMDCacheStandard(10)
	err := j.convertToBranch(ctx, bid, signer, kbfscodec.NewMsgpack(), id,
		mdcache)
	require.NoError(t, err)

	resolveRev := firstRevision
	md := makeMDForTest(t, ver, id, resolveRev, j.uid, signer, firstPrevRoot)
	resolveMdID, err := j.resolveAndClear(
		ctx, signer, ekg, bsplit, mdcache, bid, md)
	require.NoError(t, err)

	require.Equal(t, 1, getMDJournalLength(t, j))
	head, err := j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, md.Revision(), head.RevisionNumber())

	// Now put more MDs and resolve them again -- if this is a local
	// squash, it should keep the original resolution as a separate
	// entry.
	putMDRange(t, ver, id, signer, ekg, bsplit,
		resolveRev+1, resolveMdID, mdCount, j)
	err = j.convertToBranch(ctx, bid, signer, kbfscodec.NewMsgpack(), id,
		mdcache)
	require.NoError(t, err)
	numExpectedMDs := 1
	prevRoot := firstPrevRoot
	if bid == PendingLocalSquashBranchID {
		numExpectedMDs++
		resolveRev++
		prevRoot = resolveMdID
	}
	md = makeMDForTest(t, ver, id, resolveRev, j.uid, signer, prevRoot)
	_, err = j.resolveAndClear(ctx, signer, ekg, bsplit, mdcache, bid, md)
	require.NoError(t, err)
	require.Equal(t, numExpectedMDs, getMDJournalLength(t, j))
	head, err = j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, md.Revision(), head.RevisionNumber())

	flushAllMDs(t, ctx, signer, j)
}

func testMDJournalResolveAndClearRemoteBranch(t *testing.T, ver MetadataVer) {
	codec := kbfscodec.NewMsgpack()
	crypto := MakeCryptoCommon(codec)
	bid, err := crypto.MakeRandomBranchID()
	require.NoError(t, err)
	testMDJournalResolveAndClear(t, ver, bid)
}

func testMDJournalResolveAndClearLocalSquash(t *testing.T, ver MetadataVer) {
	testMDJournalResolveAndClear(t, ver, PendingLocalSquashBranchID)
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
	// Do this with InitialExtraMetadataVer only, since any later
	// version doesn't actually do any signing.
	ver := InitialExtraMetadataVer

	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	limitedSigner := limitedCryptoSigner{signer, 5}

	ctx := context.Background()

	err := j.convertToBranch(
		ctx, PendingLocalSquashBranchID, &limitedSigner,
		kbfscodec.NewMsgpack(), id, NewMDCacheStandard(10))
	require.NotNil(t, err)

	// All entries should remain unchanged, since the conversion
	// encountered an error.

	ibrmds, err := j.getRange(
		NullBranchID, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Merged, NullBranchID)

	require.Equal(t, 10, getMDJournalLength(t, j))

	head, err := j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, ibrmds[len(ibrmds)-1], head)

	// Flush all MDs so we can check garbage collection.
	flushAllMDs(t, ctx, signer, j)
}

type mdIDJournalEntryExtra struct {
	mdIDJournalEntry
	Extra int
}

func testMDJournalBranchConversionPreservesUnknownFields(t *testing.T, ver MetadataVer) {
	codec, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	var expectedEntries []mdIDJournalEntry

	firstRevision := MetadataRevision(5)
	mdCount := 5
	prevRoot := fakeMdID(1)
	ctx := context.Background()
	for i := 0; i < mdCount; i++ {
		revision := firstRevision + MetadataRevision(i)
		md := makeMDForTest(t, ver, id, revision, j.uid, signer, prevRoot)
		mdID, err := j.put(ctx, signer, ekg, bsplit, md, false)
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

	err := j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(), id,
		NewMDCacheStandard(10))
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

func testMDJournalClear(t *testing.T, ver MetadataVer) {
	_, _, id, signer, ekg, bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	ctx := context.Background()

	err := j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(), id,
		NewMDCacheStandard(10))
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

	head, err := j.getHead(bid)
	require.NoError(t, err)
	require.NotEqual(t, ImmutableBareRootMetadata{}, head)

	// Clearing the correct branch ID should clear the entire
	// journal, and reset the branch ID.
	err = j.clear(ctx, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	head, err = j.getHead(bid)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)

	head, err = j.getHead(NullBranchID)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)

	// Clearing twice should do nothing.
	err = j.clear(ctx, bid)
	require.NoError(t, err)
	require.Equal(t, NullBranchID, j.branchID)

	head, err = j.getHead(bid)
	require.NoError(t, err)
	require.Equal(t, ImmutableBareRootMetadata{}, head)

	// Put more MDs, flush them, and clear the branch ID of an empty
	// journal.
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)
	err = j.convertToBranch(
		ctx, PendingLocalSquashBranchID, signer, kbfscodec.NewMsgpack(), id,
		NewMDCacheStandard(10))
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

func testMDJournalRestart(t *testing.T, ver MetadataVer) {
	codec, crypto, id, signer, ekg,
		bsplit, tempdir, j := setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	// Restart journal.
	ctx := context.Background()
	j, err := makeMDJournal(ctx, j.uid, j.key, codec, crypto, j.clock,
		j.tlfID, j.mdVer, j.dir, j.log)
	require.NoError(t, err)

	require.Equal(t, mdCount, getMDJournalLength(t, j))

	ibrmds, err := j.getRange(
		NullBranchID, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Merged, NullBranchID)

	flushAllMDs(t, context.Background(), signer, j)
}

func testMDJournalRestartAfterBranchConversion(t *testing.T, ver MetadataVer) {
	codec, crypto, id, signer, ekg, bsplit, tempdir, j :=
		setupMDJournalTest(t, ver)
	defer teardownMDJournalTest(t, tempdir)

	// Push some new metadata blocks.

	firstRevision := MetadataRevision(10)
	firstPrevRoot := fakeMdID(1)
	mdCount := 10
	putMDRange(t, ver, id, signer, ekg, bsplit,
		firstRevision, firstPrevRoot, mdCount, j)

	// Convert to branch.

	ctx := context.Background()

	bid := PendingLocalSquashBranchID
	err := j.convertToBranch(
		ctx, bid, signer, kbfscodec.NewMsgpack(),
		id, NewMDCacheStandard(10))
	require.NoError(t, err)

	// Restart journal.

	j, err = makeMDJournal(ctx, j.uid, j.key, codec, crypto, j.clock,
		j.tlfID, j.mdVer, j.dir, j.log)
	require.NoError(t, err)

	require.Equal(t, mdCount, getMDJournalLength(t, j))

	ibrmds, err := j.getRange(
		bid, 1, firstRevision+MetadataRevision(2*mdCount))
	require.NoError(t, err)
	require.Equal(t, mdCount, len(ibrmds))

	checkIBRMDRange(t, j.uid, j.key, codec, crypto,
		ibrmds, firstRevision, firstPrevRoot, Unmerged, ibrmds[0].BID())

	flushAllMDs(t, ctx, signer, j)
}

func TestMDJournal(t *testing.T) {
	tests := []func(*testing.T, MetadataVer){
		testMDJournalBasic,
		testMDJournalGetNextEntry,
		testMDJournalPutCase1Empty,
		testMDJournalPutCase1Conflict,
		testMDJournalPutCase1ReplaceHead,
		testMDJournalPutCase2NonEmptyReplace,
		testMDJournalPutCase2NonEmptyAppend,
		testMDJournalPutCase2Empty,
		testMDJournalPutCase3NonEmptyAppend,
		testMDJournalPutCase3NonEmptyReplace,
		testMDJournalPutCase3EmptyAppend,
		testMDJournalPutCase4,
		testMDJournalBranchConversion,
		testMDJournalResolveAndClearRemoteBranch,
		testMDJournalResolveAndClearLocalSquash,
		testMDJournalBranchConversionPreservesUnknownFields,
		testMDJournalClear,
		testMDJournalRestart,
		testMDJournalRestartAfterBranchConversion,
	}
	runTestsOverMetadataVers(t, "testMDJournal", tests)
}
