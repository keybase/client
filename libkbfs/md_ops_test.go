// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type shimCrypto struct {
	Crypto
	pure cryptoPure
	key  kbfscrypto.SigningKey
}

func (c shimCrypto) Sign(
	ctx context.Context, data []byte) (kbfscrypto.SignatureInfo, error) {
	return c.key.Sign(data), nil
}

func (c shimCrypto) SignForKBFS(
	ctx context.Context, data []byte) (kbfscrypto.SignatureInfo, error) {
	return c.key.SignForKBFS(data)
}

func (c shimCrypto) Verify(
	msg []byte, sigInfo kbfscrypto.SignatureInfo) (err error) {
	return kbfscrypto.Verify(msg, sigInfo)
}

func (c shimCrypto) MakeTLFWriterKeyBundleID(
	wkb TLFWriterKeyBundleV3) (TLFWriterKeyBundleID, error) {
	return c.pure.MakeTLFWriterKeyBundleID(wkb)
}

func (c shimCrypto) MakeTLFReaderKeyBundleID(
	rkb TLFReaderKeyBundleV3) (TLFReaderKeyBundleID, error) {
	return c.pure.MakeTLFReaderKeyBundleID(rkb)
}

func injectShimCrypto(config Config) {
	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("test key")
	crypto := shimCrypto{
		config.Crypto(),
		MakeCryptoCommon(kbfscodec.NewMsgpack()),
		signingKey,
	}
	config.SetCrypto(crypto)
}

func mdOpsInit(t *testing.T, ver MetadataVer) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	config.SetMetadataVersion(ver)
	mdops := NewMDOpsStandard(config)
	config.SetMDOps(mdops)
	config.SetCodec(kbfscodec.NewMsgpack())
	config.SetKeyBundleCache(NewKeyBundleCacheStandard(1))
	config.mockMdserv.EXPECT().OffsetFromServerTime().
		Return(time.Duration(0), true).AnyTimes()
	config.mockClock.EXPECT().Now().Return(time.Now()).AnyTimes()
	injectShimCrypto(config)
	interposeDaemonKBPKI(config, "alice", "bob", "charlie")
	ctx = context.Background()
	return
}

func mdOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func addFakeRMDData(t *testing.T,
	codec kbfscodec.Codec, crypto cryptoPure, rmd *RootMetadata,
	h *TlfHandle) {
	rmd.SetRevision(kbfsmd.Revision(1))
	pmd := PrivateMetadata{}
	// TODO: Will have to change this for private folders if we
	// un-mock out those tests.
	buf, err := codec.Encode(pmd)
	require.NoError(t, err)
	rmd.SetSerializedPrivateMetadata(buf)
	rmd.SetLastModifyingWriter(h.FirstResolvedWriter())
	rmd.SetLastModifyingUser(h.FirstResolvedWriter())
	if !h.IsPublic() {
		rmd.fakeInitialRekey()
	}
}

func newRMDS(t *testing.T, config Config, h *TlfHandle) (
	*RootMetadataSigned, ExtraMetadata) {
	id := tlf.FakeID(1, h.IsPublic())

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	addFakeRMDData(t, config.Codec(), config.Crypto(), rmd, h)
	ctx := context.Background()

	// Encode and sign writer metadata.
	err = rmd.bareMd.SignWriterMetadataInternally(ctx, config.Codec(), config.Crypto())
	require.NoError(t, err)

	rmds, err := SignBareRootMetadata(
		ctx, config.Codec(), config.Crypto(), config.Crypto(),
		rmd.bareMd, time.Now())
	require.NoError(t, err)
	return rmds, rmd.extra
}

func verifyMDForPublic(config *ConfigMock, rmds *RootMetadataSigned,
	hasVerifyingKeyErr error) {
	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(hasVerifyingKeyErr)
	if hasVerifyingKeyErr == nil {
		config.mockMdcache.EXPECT().Put(gomock.Any())
	}
}

// kmdMatcher implements the gomock.Matcher interface to compare
// KeyMetadata objects.
type kmdMatcher struct {
	kmd KeyMetadata
}

func (m kmdMatcher) Matches(x interface{}) bool {
	kmd, ok := x.(KeyMetadata)
	if !ok {
		return false
	}
	return (m.kmd.TlfID() == kmd.TlfID()) &&
		(m.kmd.LatestKeyGeneration() == kmd.LatestKeyGeneration())
}

func (m kmdMatcher) String() string {
	return fmt.Sprintf("Matches KeyMetadata with TlfID=%s and key generation %d",
		m.kmd.TlfID(), m.kmd.LatestKeyGeneration())
}

func expectGetTLFCryptKeyForEncryption(config *ConfigMock, kmd KeyMetadata) {
	config.mockKeyman.EXPECT().GetTLFCryptKeyForEncryption(gomock.Any(),
		kmdMatcher{kmd}).Return(kbfscrypto.TLFCryptKey{}, nil)
}

func expectGetTLFCryptKeyForMDDecryption(config *ConfigMock, kmd KeyMetadata) {
	config.mockKeyman.EXPECT().GetTLFCryptKeyForMDDecryption(gomock.Any(),
		kmdMatcher{kmd}, kmdMatcher{kmd}).Return(
		kbfscrypto.TLFCryptKey{}, nil)
}

func expectGetTLFCryptKeyForMDDecryptionAtMostOnce(config *ConfigMock,
	kmd KeyMetadata) {
	config.mockKeyman.EXPECT().GetTLFCryptKeyForMDDecryption(gomock.Any(),
		kmdMatcher{kmd}, kmdMatcher{kmd}).MaxTimes(1).Return(
		kbfscrypto.TLFCryptKey{}, nil)
}

func verifyMDForPrivateHelper(
	config *ConfigMock, rmds *RootMetadataSigned, minTimes, maxTimes int) {
	mdCopy, err := rmds.MD.DeepCopy(config.Codec())
	if err != nil {
		panic(err)
	}
	fakeRMD := RootMetadata{
		bareMd: mdCopy,
	}
	expectGetTLFCryptKeyForMDDecryptionAtMostOnce(config, &fakeRMD)
	var pmd PrivateMetadata
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		gomock.Any(), kbfscrypto.TLFCryptKey{}).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(pmd, nil)

	if rmds.MD.IsFinal() {
		config.mockKbpki.EXPECT().HasUnverifiedVerifyingKey(gomock.Any(), gomock.Any(),
			gomock.Any()).AnyTimes().Return(nil)
	} else {
		config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any()).AnyTimes().Return(nil)
	}
	config.mockMdcache.EXPECT().Put(gomock.Any()).AnyTimes()
}

func verifyMDForPrivate(
	config *ConfigMock, rmds *RootMetadataSigned) {
	verifyMDForPrivateHelper(config, rmds, 1, 1)
}

func putMDForPrivate(config *ConfigMock, rmd *RootMetadata) {
	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		rmd.data, kbfscrypto.TLFCryptKey{}).Return(
		EncryptedPrivateMetadata{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		Return(true)
	config.mockMdserv.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any()).Return(nil)
	config.mockMdcache.EXPECT().Put(gomock.Any())
}

func testMDOpsGetForHandlePublicSuccess(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	verifyMDForPublic(config, rmds, nil)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil)

	// Do this first, since rmds is consumed.
	expectedMD := rmds.MD
	_, rmd2, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, expectedMD, rmd2.bareMd)
}

func expectGetKeyBundles(ctx context.Context, config *ConfigMock, extra ExtraMetadata) {
	if extraV3, ok := extra.(*ExtraMetadataV3); ok {
		config.mockMdserv.EXPECT().GetKeyBundles(
			ctx, gomock.Any(), gomock.Any(), gomock.Any()).
			Return(&extraV3.wkb, &extraV3.rkb, nil)
	}
}

func testMDOpsGetForHandlePrivateSuccess(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	// Do this first, since rmds is consumed.
	expectedMD := rmds.MD
	_, rmd2, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, expectedMD, rmd2.bareMd)
}

func testMDOpsGetForUnresolvedHandlePublicSuccess(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil)

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@twitter", true)
	require.NoError(t, err)

	config.mockMdserv.EXPECT().GetForHandle(ctx, hUnresolved.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil).Times(2)

	// First time should fail.
	_, _, err = config.MDOps().GetForHandle(ctx, hUnresolved, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")

	// Second time should succeed.
	if _, _, err := config.MDOps().GetForHandle(ctx, hUnresolved, Merged); err != nil {
		t.Errorf("Got error on get: %v", err)
	}
}

func testMDOpsGetForUnresolvedMdHandlePublicSuccess(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	mdHandle1, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,dave@twitter", true)
	require.NoError(t, err)

	mdHandle2, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob,charlie", true)
	require.NoError(t, err)

	mdHandle3, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@twitter,charlie@twitter", true)
	require.NoError(t, err)

	rmds1, _ := newRMDS(t, config, mdHandle1)

	rmds2, _ := newRMDS(t, config, mdHandle2)

	rmds3, _ := newRMDS(t, config, mdHandle3)

	// Do this before setting tlfHandles to nil.
	verifyMDForPublic(config, rmds2, nil)
	verifyMDForPublic(config, rmds3, nil)

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), "alice,bob,charlie@twitter", true)
	require.NoError(t, err)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds1, nil)

	// First time should fail.
	_, _, err = config.MDOps().GetForHandle(ctx, h, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")
	daemon.addNewAssertionForTestOrBust("charlie", "charlie@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds2, nil)

	// Second and time should succeed.
	if _, _, err := config.MDOps().GetForHandle(ctx, h, Merged); err != nil {
		t.Errorf("Got error on get: %v", err)
	}

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds3, nil)

	if _, _, err := config.MDOps().GetForHandle(ctx, h, Merged); err != nil {
		t.Errorf("Got error on get: %v", err)
	}
}

func testMDOpsGetForUnresolvedHandlePublicFailure(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@github,bob@twitter", true)
	require.NoError(t, err)

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, hUnresolved.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil)

	// Should still fail.
	_, _, err = config.MDOps().GetForHandle(ctx, hUnresolved, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func testMDOpsGetForHandlePublicFailFindKey(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, VerifyingKeyNotFoundError{})

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil)

	_, _, err := config.MDOps().GetForHandle(ctx, h, Merged)
	if _, ok := err.(UnverifiableTlfUpdateError); !ok {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

type failVerifyCrypto struct {
	Crypto
	err error
}

func (c failVerifyCrypto) Verify(msg []byte, sigInfo kbfscrypto.SignatureInfo) error {
	return c.err
}

func testMDOpsGetForHandlePublicFailVerify(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	// Change something in rmds that affects the computed MdID,
	// which will then cause an MDMismatchError.
	rmds.MD.(MutableBareRootMetadata).SetRefBytes(100)
	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil)

	_, _, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.IsType(t, MDMismatchError{}, err)
}

func testMDOpsGetForHandleFailGet(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)

	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(tlf.NullID, nil, err)

	if _, _, err2 := config.MDOps().GetForHandle(ctx, h, Merged); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func testMDOpsGetForHandleFailHandleCheck(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	// Make a different handle.
	otherH := parseTlfHandleOrBust(t, config, "alice", false)
	config.mockMdserv.EXPECT().GetForHandle(ctx, otherH.ToBareHandleOrBust(), Merged).Return(tlf.NullID, rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	_, _, err := config.MDOps().GetForHandle(ctx, otherH, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func testMDOpsGetSuccess(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.TlfID(), NullBranchID, Merged).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	// Do this first, since rmds is consumed.
	expectedMD := rmds.MD
	rmd2, err := config.MDOps().GetForTLF(ctx, rmds.MD.TlfID())
	require.NoError(t, err)
	require.Equal(t, expectedMD, rmd2.bareMd)
}

func testMDOpsGetBlankSigFailure(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)
	rmds.SigInfo = kbfscrypto.SignatureInfo{}

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.TlfID(), NullBranchID, Merged).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	if _, err := config.MDOps().GetForTLF(ctx, rmds.MD.TlfID()); err == nil {
		t.Error("Got no error on get")
	}
}

func testMDOpsGetFailGet(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, true)
	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, id, NullBranchID, Merged).Return(nil, err)

	if _, err2 := config.MDOps().GetForTLF(ctx, id); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func testMDOpsGetFailIDCheck(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	id2 := tlf.FakeID(2, true)

	config.mockMdserv.EXPECT().GetForTLF(ctx, id2, NullBranchID, Merged).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	if _, err := config.MDOps().GetForTLF(ctx, id2); err == nil {
		t.Errorf("Got no error on bad id check test")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad id check test: %v", err)
	}
}

func makeRMDSRange(t *testing.T, config Config,
	start kbfsmd.Revision, count int, prevID kbfsmd.ID) (
	rmdses []*RootMetadataSigned, extras []ExtraMetadata) {
	id := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	for i := 0; i < count; i++ {
		rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
		if err != nil {
			t.Fatal(err)
		}

		addFakeRMDData(t, config.Codec(), config.Crypto(), rmd, h)
		rmd.SetPrevRoot(prevID)
		rmd.SetRevision(start + kbfsmd.Revision(i))

		ctx := context.Background()

		// Encode and sign writer metadata.
		err = rmd.bareMd.SignWriterMetadataInternally(ctx, config.Codec(), config.Crypto())
		require.NoError(t, err)

		rmds, err := SignBareRootMetadata(
			ctx, config.Codec(), config.Crypto(), config.Crypto(),
			rmd.bareMd, time.Now())
		require.NoError(t, err)
		currID, err := kbfsmd.MakeID(config.Codec(), rmds.MD)
		require.NoError(t, err)
		prevID = currID
		rmdses = append(rmdses, rmds)
		extras = append(extras, rmd.extra)
	}
	return rmdses, extras
}

type keyBundleMDServer struct {
	MDServer
	nextGetRange []*RootMetadataSigned

	lock sync.RWMutex
	wkbs map[TLFWriterKeyBundleID]TLFWriterKeyBundleV3
	rkbs map[TLFReaderKeyBundleID]TLFReaderKeyBundleV3
}

func makeKeyBundleMDServer(mdServer MDServer) *keyBundleMDServer {
	return &keyBundleMDServer{
		MDServer: mdServer,
		wkbs:     make(map[TLFWriterKeyBundleID]TLFWriterKeyBundleV3),
		rkbs:     make(map[TLFReaderKeyBundleID]TLFReaderKeyBundleV3),
	}
}

func (mds *keyBundleMDServer) putWKB(
	id TLFWriterKeyBundleID, wkb TLFWriterKeyBundleV3) {
	mds.lock.Lock()
	defer mds.lock.Unlock()
	mds.wkbs[id] = wkb
}

func (mds *keyBundleMDServer) putRKB(
	id TLFReaderKeyBundleID, rkb TLFReaderKeyBundleV3) {
	mds.lock.Lock()
	defer mds.lock.Unlock()
	mds.rkbs[id] = rkb
}

func (mds *keyBundleMDServer) processRMDSes(
	rmds *RootMetadataSigned, extra ExtraMetadata) {
	if extraV3, ok := extra.(*ExtraMetadataV3); ok {
		mds.putWKB(rmds.MD.GetTLFWriterKeyBundleID(), extraV3.wkb)
		mds.putRKB(rmds.MD.GetTLFReaderKeyBundleID(), extraV3.rkb)
	}
}

func (mds *keyBundleMDServer) GetRange(
	ctx context.Context, id tlf.ID, bid BranchID, mStatus MergeStatus,
	start, stop kbfsmd.Revision) ([]*RootMetadataSigned, error) {
	rmdses := mds.nextGetRange
	mds.nextGetRange = nil
	return rmdses, nil
}

func (mds *keyBundleMDServer) GetKeyBundles(ctx context.Context, tlfID tlf.ID,
	wkbID TLFWriterKeyBundleID, rkbID TLFReaderKeyBundleID) (
	*TLFWriterKeyBundleV3, *TLFReaderKeyBundleV3, error) {
	mds.lock.RLock()
	defer mds.lock.RUnlock()
	wkb := mds.wkbs[wkbID]
	rkb := mds.rkbs[rkbID]
	return &wkb, &rkb, nil
}

func testMDOpsGetRangeSuccessHelper(
	t *testing.T, ver MetadataVer, fromStart bool) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, kbfsmd.FakeID(1))

	start := kbfsmd.Revision(100)
	stop := start + kbfsmd.Revision(len(rmdses))
	if fromStart {
		start = 0
	}

	for _, rmds := range rmdses {
		verifyMDForPrivate(config, rmds)
	}

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	mdServer.nextGetRange = rmdses
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}

	// Do this first since rmdses is consumed.
	expectedMDs := make([]BareRootMetadata, len(rmdses))
	for i, rmds := range rmdses {
		expectedMDs[i] = rmds.MD
	}
	rmds, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop)
	require.NoError(t, err)
	require.Equal(t, len(rmdses), len(rmds))
	for i := 0; i < len(rmdses); i++ {
		require.Equal(t, expectedMDs[i], rmds[i].bareMd)
	}
}

func testMDOpsGetRangeSuccess(t *testing.T, ver MetadataVer) {
	testMDOpsGetRangeSuccessHelper(t, ver, false)
}

func testMDOpsGetRangeFromStartSuccess(t *testing.T, ver MetadataVer) {
	testMDOpsGetRangeSuccessHelper(t, ver, true)
}

func testMDOpsGetRangeFailBadPrevRoot(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, kbfsmd.FakeID(1))

	rmdses[2].MD.(MutableBareRootMetadata).SetPrevRoot(kbfsmd.FakeID(1))

	start := kbfsmd.Revision(100)
	stop := start + kbfsmd.Revision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1)
	}

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	mdServer.nextGetRange = rmdses
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}

	_, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop)
	require.IsType(t, MDMismatchError{}, err)
}

type fakeMDServerPut struct {
	MDServer

	lastRmdsLock sync.Mutex
	lastRmds     *RootMetadataSigned
}

func (s *fakeMDServerPut) Put(ctx context.Context, rmds *RootMetadataSigned,
	_ ExtraMetadata) error {
	s.lastRmdsLock.Lock()
	defer s.lastRmdsLock.Unlock()
	s.lastRmds = rmds
	return nil
}

func (s *fakeMDServerPut) getLastRmds() *RootMetadataSigned {
	s.lastRmdsLock.Lock()
	defer s.lastRmdsLock.Unlock()
	return s.lastRmds
}

func (s *fakeMDServerPut) Shutdown() {}

func validatePutPublicRMDS(
	ctx context.Context, t *testing.T, ver MetadataVer, config Config,
	inputRmd BareRootMetadata, rmds *RootMetadataSigned) {
	// TODO: Handle private RMDS, too.

	// Verify LastModifying* fields.
	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	require.Equal(t, session.UID, rmds.MD.LastModifyingWriter())
	require.Equal(t, session.UID, rmds.MD.GetLastModifyingUser())

	// Verify signature of WriterMetadata.
	buf, err := rmds.MD.GetSerializedWriterMetadata(config.Codec())
	require.NoError(t, err)
	err = kbfscrypto.Verify(buf, rmds.GetWriterMetadataSigInfo())
	require.NoError(t, err)

	// Verify encoded PrivateMetadata.
	var data PrivateMetadata
	err = config.Codec().Decode(rmds.MD.GetSerializedPrivateMetadata(), &data)
	require.NoError(t, err)

	// Verify signature of RootMetadata.
	buf, err = config.Codec().Encode(rmds.MD)
	require.NoError(t, err)
	err = kbfscrypto.Verify(buf, rmds.SigInfo)
	require.NoError(t, err)

	expectedRmd, err := inputRmd.DeepCopy(config.Codec())
	require.NoError(t, err)

	// Overwrite written fields.
	expectedRmd.SetLastModifyingWriter(rmds.MD.LastModifyingWriter())
	expectedRmd.SetLastModifyingUser(rmds.MD.GetLastModifyingUser())
	if ver < SegregatedKeyBundlesVer {
		expectedRmd.(*BareRootMetadataV2).WriterMetadataSigInfo =
			rmds.MD.(*BareRootMetadataV2).WriterMetadataSigInfo
	}
	expectedRmd.SetSerializedPrivateMetadata(rmds.MD.GetSerializedPrivateMetadata())

	require.Equal(t, expectedRmd, rmds.MD)
}

func testMDOpsPutPublicSuccess(t *testing.T, ver MetadataVer) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice", "bob")
	config.SetMetadataVersion(ver)
	defer CheckConfigAndShutdown(ctx, t, config)

	config.MDServer().Shutdown()
	var mdServer fakeMDServerPut
	config.SetMDServer(&mdServer)

	id := tlf.FakeID(1, true)
	h := parseTlfHandleOrBust(t, config, "alice,bob", true)

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	rmd.data = makeFakePrivateMetadataFuture(t).toCurrent()
	rmd.tlfHandle = h

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)
	_, err = config.MDOps().Put(ctx, rmd, session.VerifyingKey)

	rmds := mdServer.getLastRmds()
	validatePutPublicRMDS(ctx, t, ver, config, rmd.bareMd, rmds)
}

func testMDOpsPutPrivateSuccess(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	config.SetCodec(kbfscodec.NewMsgpack())

	id := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	addFakeRMDData(t, config.Codec(), config.Crypto(), rmd, h)

	putMDForPrivate(config, rmd)

	key := kbfscrypto.MakeFakeVerifyingKeyOrBust("test key")
	if _, err := config.MDOps().Put(ctx, rmd, key); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

type failEncodeCodec struct {
	kbfscodec.Codec
	err error
}

func (c failEncodeCodec) Encode(obj interface{}) ([]byte, error) {
	return nil, c.err
}

func testMDOpsPutFailEncode(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	id := tlf.FakeID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		rmd.data, kbfscrypto.TLFCryptKey{}).Return(
		EncryptedPrivateMetadata{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		Return(true)

	session, err := config.KBPKI().GetCurrentSession(ctx)
	require.NoError(t, err)

	err = errors.New("Fake fail")
	config.SetCodec(failEncodeCodec{config.Codec(), err})

	if _, err2 := config.MDOps().Put(
		ctx, rmd, session.VerifyingKey); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func testMDOpsGetRangeFailFinal(t *testing.T, ver MetadataVer) {
	mockCtrl, config, ctx := mdOpsInit(t, ver)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, kbfsmd.FakeID(1))
	rmdses[2].MD.(MutableBareRootMetadata).SetFinalBit()
	rmdses[2].MD.(MutableBareRootMetadata).SetPrevRoot(rmdses[1].MD.GetPrevRoot())

	start := kbfsmd.Revision(100)
	stop := start + kbfsmd.Revision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1)
	}

	mdServer := makeKeyBundleMDServer(config.MDServer())
	config.SetMDServer(mdServer)

	mdServer.nextGetRange = rmdses
	for i, e := range extras {
		mdServer.processRMDSes(rmdses[i], e)
	}
	_, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop)
	require.IsType(t, MDMismatchError{}, err)
}

func TestMDOps(t *testing.T) {
	tests := []func(*testing.T, MetadataVer){
		testMDOpsGetForHandlePublicSuccess,
		testMDOpsGetForHandlePrivateSuccess,
		testMDOpsGetForUnresolvedHandlePublicSuccess,
		testMDOpsGetForUnresolvedMdHandlePublicSuccess,
		testMDOpsGetForUnresolvedHandlePublicFailure,
		testMDOpsGetForHandlePublicFailFindKey,
		testMDOpsGetForHandlePublicFailVerify,
		testMDOpsGetForHandleFailGet,
		testMDOpsGetForHandleFailHandleCheck,
		testMDOpsGetSuccess,
		testMDOpsGetBlankSigFailure,
		testMDOpsGetFailGet,
		testMDOpsGetFailIDCheck,
		testMDOpsGetRangeSuccess,
		testMDOpsGetRangeFromStartSuccess,
		testMDOpsGetRangeFailBadPrevRoot,
		testMDOpsPutPublicSuccess,
		testMDOpsPutPrivateSuccess,
		testMDOpsPutFailEncode,
		testMDOpsGetRangeFailFinal,
	}
	runTestsOverMetadataVers(t, "testMDOps", tests)
}
