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
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type shimCrypto struct {
	Crypto
	pure cryptoPure
}

func (c shimCrypto) MakeMdID(md BareRootMetadata) (MdID, error) {
	return c.pure.MakeMdID(md)
}

func injectShimCrypto(config Config) {
	crypto := shimCrypto{
		config.Crypto(),
		MakeCryptoCommon(kbfscodec.NewMsgpack()),
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
	config.mockMdserv.EXPECT().OffsetFromServerTime().
		Return(time.Duration(0), true).AnyTimes()
	injectShimCrypto(config)
	interposeDaemonKBPKI(config, "alice", "bob", "charlie")
	ctx = context.Background()
	return
}

func mdOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func addFakeRMDData(rmd *RootMetadata, h *TlfHandle) {
	rmd.SetRevision(MetadataRevision(1))
	rmd.SetLastModifyingWriter(h.FirstResolvedWriter())
	rmd.SetLastModifyingUser(h.FirstResolvedWriter())
	fakeVerifyingKey := MakeFakeVerifyingKeyOrBust("fake key")
	rmd.SetWriterMetadataSigInfo(SignatureInfo{
		Version:      SigED25519,
		Signature:    []byte{41},
		VerifyingKey: fakeVerifyingKey,
	})

	if !h.IsPublic() {
		rmd.FakeInitialRekey(
			kbfscodec.NewMsgpack(), h.ToBareHandleOrBust())
	}
}

func newRMD(t *testing.T, config Config, public bool) (
	*RootMetadata, *TlfHandle) {
	id := FakeTlfID(1, public)

	h := parseTlfHandleOrBust(t, config, "alice,bob", public)
	rmd := NewRootMetadata()
	err := rmd.Update(id, h.ToBareHandleOrBust())
	if err != nil {
		t.Fatal(err)
	}

	addFakeRMDData(rmd, h)

	return rmd, h
}

func addFakeRMDSData(rmds *RootMetadataSigned, h *TlfHandle) {
	rmds.MD.SetRevision(MetadataRevision(1))
	rmds.MD.SetSerializedPrivateMetadata([]byte{1})
	rmds.MD.SetLastModifyingWriter(h.FirstResolvedWriter())
	rmds.MD.SetLastModifyingUser(h.FirstResolvedWriter())
	fakeVerifyingKey := MakeFakeVerifyingKeyOrBust("fake key")
	rmds.MD.SetWriterMetadataSigInfo(SignatureInfo{
		Version:      SigED25519,
		Signature:    []byte{41},
		VerifyingKey: fakeVerifyingKey,
	})
	rmds.SigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    []byte{42},
		VerifyingKey: fakeVerifyingKey,
	}
	rmds.untrustedServerTimestamp = time.Now()

	if !h.IsPublic() {
		rmds.MD.FakeInitialRekey(
			kbfscodec.NewMsgpack(), h.ToBareHandleOrBust())
	}
}

func newRMDS(t *testing.T, config Config, public bool) (
	*RootMetadataSigned, *TlfHandle) {
	id := FakeTlfID(1, public)

	h := parseTlfHandleOrBust(t, config, "alice,bob", public)
	rmds := NewRootMetadataSigned()
	err := rmds.MD.Update(id, h.ToBareHandleOrBust())
	if err != nil {
		t.Fatal(err)
	}
	addFakeRMDSData(rmds, h)

	return rmds, h
}

func verifyMDForPublic(config *ConfigMock, rmds *RootMetadataSigned,
	verifyErr, hasVerifyingKeyErr error) {
	packedData := []byte{4, 3, 2, 1}
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil).AnyTimes()

	config.mockCrypto.EXPECT().Verify(packedData, rmds.MD.GetWriterMetadataSigInfo()).Return(nil)
	config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).Return(verifyErr)
	if verifyErr != nil {
		return
	}
	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(hasVerifyingKeyErr)

	if hasVerifyingKeyErr != nil {
		return
	}

	config.mockCodec.EXPECT().Decode(
		rmds.MD.GetSerializedPrivateMetadata(), gomock.Any()).Return(nil)
}

func verifyMDForPrivateHelper(
	config *ConfigMock, rmds *RootMetadataSigned, minTimes int, maxTimes int) {
	packedData := []byte{4, 3, 2, 1}
	config.mockCodec.EXPECT().Encode(gomock.Any()).
		Return(packedData, nil).AnyTimes()

	config.mockCodec.EXPECT().
		Decode(rmds.MD.GetSerializedPrivateMetadata(), gomock.Any()).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(nil)
	fakeRMD := RootMetadata{
		bareMd: rmds.MD,
	}
	expectGetTLFCryptKeyForMDDecryptionAtMostOnce(config, &fakeRMD)
	var pmd PrivateMetadata
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		gomock.Any(), TLFCryptKey{}).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(&pmd, nil)

	if rmds.MD.IsFinal() {
		config.mockKbpki.EXPECT().HasUnverifiedVerifyingKey(gomock.Any(), gomock.Any(),
			gomock.Any()).AnyTimes().Return(nil)
		config.mockCodec.EXPECT().
			Decode(gomock.Any(), gomock.Any()).AnyTimes().Return(nil)
	} else {
		config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
			gomock.Any(), gomock.Any()).AnyTimes().Return(nil)
	}

	config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(nil)
	config.mockCrypto.EXPECT().
		Verify(packedData, rmds.MD.GetWriterMetadataSigInfo()).
		MinTimes(minTimes).MaxTimes(maxTimes).Return(nil)
}

func verifyMDForPrivate(
	config *ConfigMock, rmds *RootMetadataSigned) {
	verifyMDForPrivateHelper(config, rmds, 1, 1)
}

func putMDForPrivate(config *ConfigMock, rmd *RootMetadata) {
	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		&rmd.data, TLFCryptKey{}).Return(EncryptedPrivateMetadata{}, nil)
	config.mockCrypto.EXPECT().Sign(gomock.Any(), gomock.Any()).Times(2).Return(SignatureInfo{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		Return(true)
	config.mockMdserv.EXPECT().Put(gomock.Any(), gomock.Any(), gomock.Any()).Return(nil)
}

func TestMDOpsGetForHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds, h := newRMDS(t, config, true)

	verifyMDForPublic(config, rmds, nil, nil)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, rmd2, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, rmds.MD, rmd2.bareMd)
}

func TestMDOpsGetForHandlePrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds, h := newRMDS(t, config, false)

	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, rmd2, err := config.MDOps().GetForHandle(ctx, h, Merged)
	require.NoError(t, err)
	require.Equal(t, rmds.MD, rmd2.bareMd)
}

func TestMDOpsGetForUnresolvedHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds, _ := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil, nil)

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@twitter", true)
	if err != nil {
		t.Fatal(err)
	}

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

	id := FakeTlfID(1, true)

	mdHandle1, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,dave@twitter", true)
	require.NoError(t, err)

	mdHandle2, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob,charlie", true)
	require.NoError(t, err)

	mdHandle3, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@twitter,charlie@twitter", true)
	require.NoError(t, err)

	rmds1 := NewRootMetadataSigned()
	err = rmds1.MD.Update(id, mdHandle1.ToBareHandleOrBust())
	require.NoError(t, err)
	addFakeRMDSData(rmds1, mdHandle1)

	rmds2 := NewRootMetadataSigned()
	err = rmds2.MD.Update(id, mdHandle2.ToBareHandleOrBust())
	require.NoError(t, err)
	addFakeRMDSData(rmds2, mdHandle2)

	rmds3 := NewRootMetadataSigned()
	err = rmds3.MD.Update(id, mdHandle3.ToBareHandleOrBust())
	require.NoError(t, err)
	addFakeRMDSData(rmds3, mdHandle3)

	// Do this before setting tlfHandles to nil.
	verifyMDForPublic(config, rmds2, nil, nil)
	verifyMDForPublic(config, rmds3, nil, nil)

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), "alice,bob,charlie@twitter", true)
	if err != nil {
		t.Fatal(err)
	}

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

	rmds, _ := newRMDS(t, config, true)

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@github,bob@twitter", true)
	if err != nil {
		t.Fatal(err)
	}

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

	rmds, h := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil, KeyNotFoundError{})

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, _, err := config.MDOps().GetForHandle(ctx, h, Merged)
	if _, ok := err.(UnverifiableTlfUpdateError); !ok {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetForHandlePublicFailVerify(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds, h := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	expectedErr := libkb.VerificationError{}
	verifyMDForPublic(config, rmds, expectedErr, nil)

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

	rmds, _ := newRMDS(t, config, false)

	// Make a different handle.
	otherH := parseTlfHandleOrBust(t, config, "alice", false)
	config.mockMdserv.EXPECT().GetForHandle(ctx, otherH.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, _, err := config.MDOps().GetForHandle(ctx, otherH, Merged)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds, _ := newRMDS(t, config, false)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds)

	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.TlfID(), NullBranchID, Merged).Return(rmds, nil)

	rmd2, err := config.MDOps().GetForTLF(ctx, rmds.MD.TlfID())
	require.NoError(t, err)
	require.Equal(t, rmds.MD, rmd2.bareMd)
}

func TestMDOpsGetBlankSigFailure(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds, _ := newRMDS(t, config, false)
	rmds.SigInfo = SignatureInfo{}

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.TlfID(), NullBranchID, Merged).Return(rmds, nil)

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

	rmds, _ := newRMDS(t, config, false)

	id2 := FakeTlfID(2, true)

	config.mockMdserv.EXPECT().GetForTLF(ctx, id2, NullBranchID, Merged).Return(rmds, nil)

	if _, err := config.MDOps().GetForTLF(ctx, id2); err == nil {
		t.Errorf("Got no error on bad id check test")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad id check test: %v", err)
	}
}

func makeRMDSRange(t *testing.T, config Config,
	start MetadataRevision, count int, prevID MdID) []*RootMetadataSigned {
	var rmdses []*RootMetadataSigned
	for i := 0; i < count; i++ {
		rmds, _ := newRMDS(t, config, false)
		rmds.MD.SetPrevRoot(prevID)
		rmds.MD.SetRevision(start + MetadataRevision(i))
		currID, err := config.Crypto().MakeMdID(rmds.MD)
		require.NoError(t, err)
		prevID = currID
		rmdses = append(rmdses, rmds)
	}
	return rmdses
}

func testMDOpsGetRangeSuccess(t *testing.T, fromStart bool) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses := makeRMDSRange(t, config, 100, 5, fakeMdID(1))

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

	rmds, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop)
	require.NoError(t, err)
	require.Equal(t, len(rmdses), len(rmds))
	for i := 0; i < len(rmdses); i++ {
		require.Equal(t, rmdses[i].MD, rmds[i].bareMd)
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

	rmdses := makeRMDSRange(t, config, 100, 5, fakeMdID(1))

	rmdses[2].MD.SetPrevRoot(fakeMdID(1))

	start := MetadataRevision(100)
	stop := start + MetadataRevision(len(rmdses))

	// Verification is parallelized, so we have to expect at most one
	// verification for each rmds.
	for _, rmds := range rmdses {
		verifyMDForPrivateHelper(config, rmds, 0, 1)
	}

	config.mockMdserv.EXPECT().GetRange(ctx, rmdses[0].MD.TlfID(), NullBranchID, Merged, start,
		stop).Return(rmdses, nil)

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
	err = config.Crypto().Verify(buf, rmds.MD.GetWriterMetadataSigInfo())
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

	var expectedRmd BareRootMetadataV2
	err = kbfscodec.Update(config.Codec(), &expectedRmd, inputRmd)
	require.NoError(t, err)

	// Overwrite written fields.
	expectedRmd.SetLastModifyingWriter(rmds.MD.LastModifyingWriter())
	expectedRmd.SetLastModifyingUser(rmds.MD.GetLastModifyingUser())
	expectedRmd.SetWriterMetadataSigInfo(rmds.MD.GetWriterMetadataSigInfo())
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

	rmd := NewRootMetadata()
	err := rmd.Update(id, h.ToBareHandleOrBust())
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

	rmd, _ := newRMD(t, config, false)
	putMDForPrivate(config, rmd)

	if _, err := config.MDOps().Put(ctx, rmd); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestMDOpsPutFailEncode(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	id := FakeTlfID(1, false)
	h := parseTlfHandleOrBust(t, config, "alice,bob", false)
	rmd := newRootMetadataOrBust(t, id, h)

	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		&rmd.data, TLFCryptKey{}).Return(EncryptedPrivateMetadata{}, nil)
	config.mockBsplit.EXPECT().ShouldEmbedBlockChanges(gomock.Any()).
		Return(true)

	err := errors.New("Fake fail")
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, err)

	if _, err2 := config.MDOps().Put(ctx, rmd); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestMDOpsGetRangeFailFinal(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmdses := makeRMDSRange(t, config, 100, 5, fakeMdID(1))
	rmdses[2].MD.SetFinalBit()
	rmdses[2].MD.SetPrevRoot(rmdses[1].MD.GetPrevRoot())

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

	_, err := config.MDOps().GetRange(ctx, rmdses[0].MD.TlfID(), start, stop)
	require.IsType(t, MDMismatchError{}, err)
}
