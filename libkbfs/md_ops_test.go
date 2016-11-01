// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type shimCrypto struct {
	Crypto
	pure cryptoPure
	key  kbfscrypto.SigningKey
}

func (c shimCrypto) MakeMdID(md BareRootMetadata) (MdID, error) {
	return c.pure.MakeMdID(md)
}

func (c shimCrypto) Sign(
	ctx context.Context, data []byte) (kbfscrypto.SignatureInfo, error) {
	return c.key.Sign(data), nil
}

func (c shimCrypto) Verify(
	msg []byte, sigInfo kbfscrypto.SignatureInfo) (err error) {
	return kbfscrypto.Verify(msg, sigInfo)
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

func mdOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	mdops := NewMDOpsStandard(config)
	config.SetMDOps(mdops)
	config.SetCodec(kbfscodec.NewMsgpack())
	config.mockMdserv.EXPECT().OffsetFromServerTime().
		Return(time.Duration(0), true).AnyTimes()
	h1, _ := kbfshash.DefaultHash([]byte{1})
	h2, _ := kbfshash.DefaultHash([]byte{2})
	config.mockCrypto.EXPECT().MakeTLFWriterKeyBundleID(gomock.Any()).
		Return(TLFWriterKeyBundleID{h1}, nil).AnyTimes()
	config.mockCrypto.EXPECT().MakeTLFReaderKeyBundleID(gomock.Any()).
		Return(TLFReaderKeyBundleID{h2}, nil).AnyTimes()
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
	rmd.SetRevision(MetadataRevision(1))
	pmd := PrivateMetadata{}
	// TODO: Will have to change this for private folders if we
	// un-mock out those tests.
	buf, err := codec.Encode(pmd)
	require.NoError(t, err)
	rmd.SetSerializedPrivateMetadata(buf)
	rmd.SetLastModifyingWriter(h.FirstResolvedWriter())
	rmd.SetLastModifyingUser(h.FirstResolvedWriter())
	if !h.IsPublic() {
		err = rmd.fakeInitialRekey(crypto)
		require.NoError(t, err)
	}
}

func newRMDS(t *testing.T, config Config, h *TlfHandle) (
	*RootMetadataSigned, ExtraMetadata) {
	id := FakeTlfID(1, h.IsPublic())

	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, id, h)
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
	verifyErr, hasVerifyingKeyErr error) {
	if verifyErr != nil {
		return
	}
	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(hasVerifyingKeyErr)

	if hasVerifyingKeyErr != nil {
		return
	}
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

	config.mockCrypto.EXPECT().Verify(gomock.Any(), rmds.SigInfo).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(nil)
	config.mockCrypto.EXPECT().
		Verify(gomock.Any(), rmds.GetWriterMetadataSigInfo()).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(nil)
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
}

func TestMDOpsGetForHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	verifyMDForPublic(config, rmds, nil, nil)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

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
			Return(extraV3.wkb, extraV3.rkb, nil)
	}
}

func TestMDOpsGetForHandlePrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	// Do this first, since rmds is consumed.
	expectedMD := rmds.MD
	_, rmd2, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, expectedMD, rmd2.bareMd)
}

func TestMDOpsGetForUnresolvedHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil, nil)

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@twitter", true)
	require.NoError(t, err)

	config.mockMdserv.EXPECT().GetForHandle(ctx, hUnresolved.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil).Times(2)

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

func TestMDOpsGetForUnresolvedMdHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
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
	verifyMDForPublic(config, rmds2, nil, nil)
	verifyMDForPublic(config, rmds3, nil, nil)

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), "alice,bob,charlie@twitter", true)
	require.NoError(t, err)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds1, nil)

	// First time should fail.
	_, _, err = config.MDOps().GetForHandle(ctx, h, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")
	daemon.addNewAssertionForTestOrBust("charlie", "charlie@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds2, nil)

	// Second and time should succeed.
	if _, _, err := config.MDOps().GetForHandle(ctx, h, Merged); err != nil {
		t.Errorf("Got error on get: %v", err)
	}

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds3, nil)

	if _, _, err := config.MDOps().GetForHandle(ctx, h, Merged); err != nil {
		t.Errorf("Got error on get: %v", err)
	}
}

func TestMDOpsGetForUnresolvedHandlePublicFailure(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@github,bob@twitter", true)
	require.NoError(t, err)

	daemon := config.KeybaseService().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, hUnresolved.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	// Should still fail.
	_, _, err = config.MDOps().GetForHandle(ctx, hUnresolved, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetForHandlePublicFailFindKey(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil, KeyNotFoundError{})

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

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

func TestMDOpsGetForHandlePublicFailVerify(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", true)
	rmds, _ := newRMDS(t, config, h)

	// Do this before setting tlfHandle to nil.
	expectedErr := libkb.VerificationError{}
	verifyMDForPublic(config, rmds, expectedErr, nil)

	config.SetCrypto(failVerifyCrypto{config.Crypto(), expectedErr})

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, _, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.IsType(t, MDMismatchError{}, err)
}

func TestMDOpsGetForHandleFailGet(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)

	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, nil, err)

	if _, _, err2 := config.MDOps().GetForHandle(ctx, h, Merged); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsGetForHandleFailHandleCheck(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	// Make a different handle.
	otherH := parseTlfHandleOrBust(t, config, "alice", false)
	config.mockMdserv.EXPECT().GetForHandle(ctx, otherH.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	_, _, err := config.MDOps().GetForHandle(ctx, otherH, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
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

func TestMDOpsGetBlankSigFailure(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
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

func TestMDOpsGetFailGet(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	id := FakeTlfID(1, true)
	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, id, NullBranchID, Merged).Return(nil, err)

	if _, err2 := config.MDOps().GetForTLF(ctx, id); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsGetFailIdCheck(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmds, extra := newRMDS(t, config, h)

	id2 := FakeTlfID(2, true)

	config.mockMdserv.EXPECT().GetForTLF(ctx, id2, NullBranchID, Merged).Return(rmds, nil)
	expectGetKeyBundles(ctx, config, extra)

	if _, err := config.MDOps().GetForTLF(ctx, id2); err == nil {
		t.Errorf("Got no error on bad id check test")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad id check test: %v", err)
	}
}

func makeRMDSRange(t *testing.T, config Config,
	start MetadataRevision, count int, prevID MdID) (
	rmdses []*RootMetadataSigned, extras []ExtraMetadata) {
	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	for i := 0; i < count; i++ {
		rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, id, h)
		if err != nil {
			t.Fatal(err)
		}

		addFakeRMDData(t, config.Codec(), config.Crypto(), rmd, h)
		rmd.SetPrevRoot(prevID)
		rmd.SetRevision(start + MetadataRevision(i))

		ctx := context.Background()

		// Encode and sign writer metadata.
		err = rmd.bareMd.SignWriterMetadataInternally(ctx, config.Codec(), config.Crypto())
		require.NoError(t, err)

		rmds, err := SignBareRootMetadata(
			ctx, config.Codec(), config.Crypto(), config.Crypto(),
			rmd.bareMd, time.Now())
		require.NoError(t, err)
		currID, err := config.Crypto().MakeMdID(rmds.MD)
		require.NoError(t, err)
		prevID = currID
		rmdses = append(rmdses, rmds)
		extras = append(extras, rmd.extra)
	}
	return rmdses, extras
}

func testMDOpsGetRangeSuccess(t *testing.T, fromStart bool) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, fakeMdID(1))

	start := MetadataRevision(100)
	stop := start + MetadataRevision(len(rmdses))
	if fromStart {
		start = 0
	}

	for _, rmds := range rmdses {
		verifyMDForPrivate(config, rmds)
	}

	config.mockMdserv.EXPECT().GetRange(ctx, rmdses[0].MD.TlfID(), NullBranchID, Merged, start,
		stop).Return(rmdses, nil)
	for _, e := range extras {
		expectGetKeyBundles(ctx, config, e)
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

func TestMDOpsGetRangeSuccess(t *testing.T) {
	testMDOpsGetRangeSuccess(t, false)
}

func TestMDOpsGetRangeFromStartSuccess(t *testing.T) {
	testMDOpsGetRangeSuccess(t, true)
}

func TestMDOpsGetRangeFailBadPrevRoot(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, fakeMdID(1))

	rmdses[2].MD.(MutableBareRootMetadata).SetPrevRoot(fakeMdID(1))

	start := MetadataRevision(100)
	stop := start + MetadataRevision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1)
	}

	config.mockMdserv.EXPECT().GetRange(ctx, rmdses[0].MD.TlfID(), NullBranchID, Merged, start,
		stop).Return(rmdses, nil)
	for _, e := range extras {
		expectGetKeyBundles(ctx, config, e)
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
	ctx context.Context, t *testing.T, config Config,
	inputRmd BareRootMetadata, rmds *RootMetadataSigned) {
	// TODO: Handle private RMDS, too.

	// Verify LastModifying* fields.
	_, me, err := config.KBPKI().GetCurrentUserInfo(ctx)
	require.NoError(t, err)
	require.Equal(t, me, rmds.MD.LastModifyingWriter())
	require.Equal(t, me, rmds.MD.GetLastModifyingUser())

	// Verify signature of WriterMetadata.
	buf, err := rmds.MD.GetSerializedWriterMetadata(config.Codec())
	require.NoError(t, err)
	err = config.Crypto().Verify(buf, rmds.GetWriterMetadataSigInfo())
	require.NoError(t, err)

	// Verify encoded PrivateMetadata.
	var data PrivateMetadata
	err = config.Codec().Decode(rmds.MD.GetSerializedPrivateMetadata(), &data)
	require.NoError(t, err)

	// Verify signature of RootMetadata.
	buf, err = config.Codec().Encode(rmds.MD)
	require.NoError(t, err)
	err = config.Crypto().Verify(buf, rmds.SigInfo)
	require.NoError(t, err)

	// MDv3 TODO: This should become a BareRootMetadataV3.
	var expectedRmd BareRootMetadataV2
	err = kbfscodec.Update(config.Codec(), &expectedRmd, inputRmd)
	require.NoError(t, err)

	// Overwrite written fields.
	expectedRmd.SetLastModifyingWriter(rmds.MD.LastModifyingWriter())
	expectedRmd.SetLastModifyingUser(rmds.MD.GetLastModifyingUser())
	expectedRmd.WriterMetadataSigInfo = rmds.MD.(*BareRootMetadataV2).WriterMetadataSigInfo
	expectedRmd.SetSerializedPrivateMetadata(rmds.MD.GetSerializedPrivateMetadata())

	require.Equal(t, &expectedRmd, rmds.MD)
}

func TestMDOpsPutPublicSuccess(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer CheckConfigAndShutdown(t, config)

	config.MDServer().Shutdown()
	var mdServer fakeMDServerPut
	config.SetMDServer(&mdServer)

	id := FakeTlfID(1, true)
	h := parseTlfHandleOrBust(t, config, "alice,bob", true)

	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	rmd.data = makeFakePrivateMetadataFuture(t).toCurrent()
	rmd.tlfHandle = h

	ctx := context.Background()
	_, err = config.MDOps().Put(ctx, rmd)

	rmds := mdServer.getLastRmds()
	validatePutPublicRMDS(ctx, t, config, rmd.bareMd, rmds)
}

func TestMDOpsPutPrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	config.SetCodec(kbfscodec.NewMsgpack())

	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd, err := makeInitialRootMetadata(defaultClientMetadataVer, id, h)
	require.NoError(t, err)
	addFakeRMDData(t, config.Codec(), config.Crypto(), rmd, h)

	putMDForPrivate(config, rmd)

	if _, err := config.MDOps().Put(ctx, rmd); err != nil {
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

func TestMDOpsPutFailEncode(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)

	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		rmd.data, kbfscrypto.TLFCryptKey{}).Return(
		EncryptedPrivateMetadata{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		Return(true)

	err = errors.New("Fake fail")
	config.SetCodec(failEncodeCodec{config.Codec(), err})

	if _, err2 := config.MDOps().Put(ctx, rmd); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestMDOpsGetRangeFailFinal(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses, extras := makeRMDSRange(t, config, 100, 5, fakeMdID(1))
	rmdses[2].MD.(MutableBareRootMetadata).SetFinalBit()
	rmdses[2].MD.(MutableBareRootMetadata).SetPrevRoot(rmdses[1].MD.GetPrevRoot())

	start := MetadataRevision(100)
	stop := start + MetadataRevision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1)
	}

	config.mockMdserv.EXPECT().GetRange(
		ctx, rmdses[0].MD.TlfID(), NullBranchID, Merged, start, stop).Return(
		rmdses, nil)
	for _, e := range extras {
		expectGetKeyBundles(ctx, config, e)
	}
	_, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop)
	require.IsType(t, MDMismatchError{}, err)
}
