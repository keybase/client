// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"sync"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func mdOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	mdops := NewMDOpsStandard(config)
	config.SetMDOps(mdops)
	interposeDaemonKBPKI(config, "alice", "bob", "charlie")
	ctx = context.Background()
	return
}

func mdOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func addFakeRMDSData(rmds *RootMetadataSigned, h *TlfHandle) {
	rmds.MD.tlfHandle = h

	// Need to do this to avoid calls to the mocked-out MakeMdID.
	rmds.MD.mdID = fakeMdID(fakeTlfIDByte(rmds.MD.ID))

	rmds.MD.Revision = MetadataRevision(1)
	rmds.MD.LastModifyingWriter = h.FirstResolvedWriter()
	rmds.MD.LastModifyingUser = h.FirstResolvedWriter()
	rmds.SigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    []byte{42},
		VerifyingKey: MakeFakeVerifyingKeyOrBust("fake key"),
	}

	if !h.IsPublic() {
		FakeInitialRekey(&rmds.MD, h.ToBareHandleOrBust())
	}
}

func newRMDS(t *testing.T, config Config, public bool) *RootMetadataSigned {
	id := FakeTlfID(1, public)

	h := parseTlfHandleOrBust(t, config, "alice,bob", public)
	rmds := &RootMetadataSigned{}
	err := updateNewRootMetadata(&rmds.MD, id, h.ToBareHandleOrBust())
	if err != nil {
		t.Fatal(err)
	}

	addFakeRMDSData(rmds, h)

	return rmds
}

func verifyMDForPublic(config *ConfigMock, rmds *RootMetadataSigned,
	hasVerifyingKeyErr error, verifyErr error) {
	packedData := []byte{4, 3, 2, 1}
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil).AnyTimes()

	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(hasVerifyingKeyErr)
	if hasVerifyingKeyErr == nil {
		config.mockCrypto.EXPECT().Verify(packedData, rmds.MD.WriterMetadataSigInfo).Return(nil)
		config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).Return(verifyErr)
		if verifyErr == nil {
			config.mockCodec.EXPECT().Decode(
				rmds.MD.SerializedPrivateMetadata,
				&rmds.MD.data).Return(nil)
		}
	}
}

func verifyMDForPrivate(config *ConfigMock, rmds *RootMetadataSigned) {
	packedData := []byte{4, 3, 2, 1}
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil).AnyTimes()

	config.mockCodec.EXPECT().Decode(rmds.MD.SerializedPrivateMetadata, gomock.Any()).
		Return(nil)
	expectGetTLFCryptKeyForMDDecryption(config, &rmds.MD)
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		gomock.Any(), TLFCryptKey{}).Return(&rmds.MD.data, nil)

	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(nil)
	config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).Return(nil)
	config.mockCrypto.EXPECT().Verify(packedData, rmds.MD.WriterMetadataSigInfo).Return(nil)
}

func putMDForPrivate(config *ConfigMock, rmds *RootMetadataSigned) {
	expectGetTLFCryptKeyForEncryption(config, &rmds.MD)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		&rmds.MD.data, TLFCryptKey{}).Return(EncryptedPrivateMetadata{}, nil)

	packedData := []byte{4, 3, 2, 1}
	// TODO make these EXPECTs more specific.
	// Encodes:
	// 1) encrypted rmds.MD.data
	// 2) rmds.MD.WriterMetadata
	// 3) rmds.MD
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil).Times(3).Return([]byte{}, nil)

	config.mockCrypto.EXPECT().Sign(gomock.Any(), gomock.Any()).Times(2).Return(SignatureInfo{}, nil)

	config.mockCodec.EXPECT().Decode([]byte{}, gomock.Any()).Return(nil)

	config.mockMdserv.EXPECT().Put(gomock.Any(), gomock.Any()).Return(nil)
}

func TestMDOpsGetForHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil, nil)

	h := rmds.MD.GetTlfHandle()

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	if rmd2, err := config.MDOps().GetForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.ID != rmds.MD.ID {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.ID, rmds.MD.ID)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetForHandlePrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, false)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds)

	h := rmds.MD.GetTlfHandle()

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	if rmd2, err := config.MDOps().GetForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.ID != rmds.MD.ID {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.ID, rmds.MD.ID)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetForUnresolvedHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, nil, nil)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@twitter", true)
	if err != nil {
		t.Fatal(err)
	}

	config.mockMdserv.EXPECT().GetForHandle(ctx, hUnresolved.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil).Times(2)

	// First time should fail.
	_, err = config.MDOps().GetForHandle(ctx, hUnresolved)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseDaemon().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")

	// Second time should succeed.
	if _, err := config.MDOps().GetForHandle(ctx, hUnresolved); err != nil {
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

	rmds1 := &RootMetadataSigned{}
	err = updateNewRootMetadata(&rmds1.MD, id, mdHandle1.ToBareHandleOrBust())
	require.NoError(t, err)
	addFakeRMDSData(rmds1, mdHandle1)

	rmds2 := &RootMetadataSigned{}
	err = updateNewRootMetadata(&rmds2.MD, id, mdHandle2.ToBareHandleOrBust())
	require.NoError(t, err)
	addFakeRMDSData(rmds2, mdHandle2)

	rmds3 := &RootMetadataSigned{}
	err = updateNewRootMetadata(&rmds3.MD, id, mdHandle3.ToBareHandleOrBust())
	require.NoError(t, err)
	addFakeRMDSData(rmds3, mdHandle3)

	// Do this before setting tlfHandles to nil.
	verifyMDForPublic(config, rmds2, nil, nil)
	verifyMDForPublic(config, rmds3, nil, nil)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds1.MD.tlfHandle = nil
	rmds2.MD.tlfHandle = nil
	rmds3.MD.tlfHandle = nil

	h, err := ParseTlfHandle(
		ctx, config.KBPKI(), "alice,bob,charlie@twitter", true)
	if err != nil {
		t.Fatal(err)
	}

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds1, nil)

	// First time should fail.
	_, err = config.MDOps().GetForHandle(ctx, h)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}

	daemon := config.KeybaseDaemon().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")
	daemon.addNewAssertionForTestOrBust("charlie", "charlie@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds2, nil)

	// Second and time should succeed.
	if _, err := config.MDOps().GetForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	}

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds3, nil)

	if _, err := config.MDOps().GetForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	}
}

func TestMDOpsGetForUnresolvedHandlePublicFailure(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, true)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	hUnresolved, err := ParseTlfHandle(ctx, config.KBPKI(),
		"alice,bob@github,bob@twitter", true)
	if err != nil {
		t.Fatal(err)
	}

	daemon := config.KeybaseDaemon().(*KeybaseDaemonLocal)
	daemon.addNewAssertionForTestOrBust("bob", "bob@twitter")

	config.mockMdserv.EXPECT().GetForHandle(ctx, hUnresolved.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	// Should still fail.
	_, err = config.MDOps().GetForHandle(ctx, hUnresolved)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetForHandlePublicFailFindKey(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, KeyNotFoundError{}, nil)

	h := rmds.MD.GetTlfHandle()

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, err := config.MDOps().GetForHandle(ctx, h)
	if _, ok := err.(UnverifiableTlfUpdateError); !ok {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetForHandlePublicFailVerify(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, true)

	// Do this before setting tlfHandle to nil.
	expectedErr := libkb.VerificationError{}
	verifyMDForPublic(config, rmds, nil, expectedErr)

	h := rmds.MD.GetTlfHandle()

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	if _, err := config.MDOps().GetForHandle(ctx, h); err != expectedErr {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetForHandleFailGet(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	h := parseTlfHandleOrBust(t, config, "alice,bob", false)

	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForHandle(ctx, h.ToBareHandleOrBust(), Merged).Return(NullTlfID, nil, err)

	if _, err2 := config.MDOps().GetForHandle(ctx, h); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsGetForHandleFailHandleCheck(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, false)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	// Make a different handle.
	otherH := parseTlfHandleOrBust(t, config, "alice", false)
	config.mockMdserv.EXPECT().GetForHandle(ctx, otherH.ToBareHandleOrBust(), Merged).Return(NullTlfID, rmds, nil)

	_, err := config.MDOps().GetForHandle(ctx, otherH)
	if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, false)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.ID, NullBranchID, Merged).Return(rmds, nil)

	if rmd2, err := config.MDOps().GetForTLF(ctx, rmds.MD.ID); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetBlankSigFailure(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, false)
	rmds.SigInfo = SignatureInfo{}

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, rmds.MD.ID, NullBranchID, Merged).Return(rmds, nil)

	if _, err := config.MDOps().GetForTLF(ctx, rmds.MD.ID); err == nil {
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

	rmds := newRMDS(t, config, false)

	id2 := FakeTlfID(2, true)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForTLF(ctx, id2, NullBranchID, Merged).Return(rmds, nil)

	if _, err := config.MDOps().GetForTLF(ctx, id2); err == nil {
		t.Errorf("Got no error on bad id check test")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad id check test: %v", err)
	}
}

func testMDOpsGetRangeSuccess(t *testing.T, fromStart bool) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds1 := newRMDS(t, config, false)

	rmds2 := newRMDS(t, config, false)

	rmds2.MD.mdID = fakeMdID(42)
	rmds1.MD.PrevRoot = rmds2.MD.mdID
	rmds1.MD.Revision = 102

	rmds3 := newRMDS(t, config, false)

	rmds3.MD.mdID = fakeMdID(43)
	rmds2.MD.PrevRoot = rmds3.MD.mdID
	rmds2.MD.Revision = 101
	mdID4 := fakeMdID(44)
	rmds3.MD.PrevRoot = mdID4
	rmds3.MD.Revision = 100

	start, stop := MetadataRevision(100), MetadataRevision(102)
	if fromStart {
		start = 0
	}

	// Do this before setting tlfHandles to nil.
	verifyMDForPrivate(config, rmds3)
	verifyMDForPrivate(config, rmds2)
	verifyMDForPrivate(config, rmds1)

	// Set tlfHandles to nil so that the md server returns
	// 'deserialized' RMDSes.
	rmds1.MD.tlfHandle = nil
	rmds2.MD.tlfHandle = nil
	rmds3.MD.tlfHandle = nil

	allRMDSs := []*RootMetadataSigned{rmds3, rmds2, rmds1}

	config.mockMdserv.EXPECT().GetRange(ctx, rmds1.MD.ID, NullBranchID, Merged, start,
		stop).Return(allRMDSs, nil)

	allRMDs, err := config.MDOps().GetRange(ctx, rmds1.MD.ID, start, stop)
	if err != nil {
		t.Errorf("Got error on GetRange: %v", err)
	} else if len(allRMDs) != 3 {
		t.Errorf("Got back wrong number of RMDs: %d", len(allRMDs))
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

	rmds1 := newRMDS(t, config, false)

	rmds2 := newRMDS(t, config, false)

	rmds2.MD.mdID = fakeMdID(42)
	rmds1.MD.PrevRoot = fakeMdID(46) // points to some random ID
	rmds1.MD.Revision = 202

	rmds3 := newRMDS(t, config, false)

	rmds3.MD.mdID = fakeMdID(43)
	rmds2.MD.PrevRoot = rmds3.MD.mdID
	rmds2.MD.Revision = 201
	mdID4 := fakeMdID(44)
	rmds3.MD.PrevRoot = mdID4
	rmds3.MD.Revision = 200

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds3)
	verifyMDForPrivate(config, rmds2)

	// Set tlfHandle to nil so that the md server returns
	// 'deserialized' RMDSes.
	rmds1.MD.tlfHandle = nil
	rmds2.MD.tlfHandle = nil
	rmds3.MD.tlfHandle = nil

	allRMDSs := []*RootMetadataSigned{rmds3, rmds2, rmds1}

	start, stop := MetadataRevision(200), MetadataRevision(202)
	config.mockMdserv.EXPECT().GetRange(ctx, rmds1.MD.ID, NullBranchID, Merged, start,
		stop).Return(allRMDSs, nil)

	_, err := config.MDOps().GetRange(ctx, rmds1.MD.ID, start, stop)
	if err == nil {
		t.Errorf("Got no expected error on GetSince")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on GetSince with bad PrevRoot chain: %v",
			err)
	}
}

type fakeMDServerPut struct {
	MDServer

	lastRmdsLock sync.Mutex
	lastRmds     *RootMetadataSigned
}

func (s *fakeMDServerPut) Put(ctx context.Context, rmds *RootMetadataSigned) error {
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
	expectedRmd *RootMetadata, rmds *RootMetadataSigned) {
	// TODO: Handle private RMDS, too.

	// Verify LastModifying* fields.
	_, me, err := config.KBPKI().GetCurrentUserInfo(ctx)
	require.NoError(t, err)
	require.Equal(t, me, rmds.MD.LastModifyingWriter)
	require.Equal(t, me, rmds.MD.LastModifyingUser)

	// Verify signature of WriterMetadata.
	buf, err := config.Codec().Encode(rmds.MD.WriterMetadata)
	require.NoError(t, err)
	err = config.Crypto().Verify(buf, rmds.MD.WriterMetadataSigInfo)
	require.NoError(t, err)

	// Verify encoded PrivateMetadata.
	var data PrivateMetadata
	err = config.Codec().Decode(rmds.MD.SerializedPrivateMetadata, &data)
	require.NoError(t, err)

	// Verify signature of RootMetadata.
	buf, err = config.Codec().Encode(rmds.MD)
	require.NoError(t, err)
	err = config.Crypto().Verify(buf, rmds.SigInfo)
	require.NoError(t, err)

	// Copy expectedRmd to get rid of unexported fields.
	var expectedRmdCopy RootMetadata
	err = CodecUpdate(config.Codec(), &expectedRmdCopy, expectedRmd)
	require.NoError(t, err)

	// Overwrite written fields.
	expectedRmdCopy.LastModifyingWriter = rmds.MD.LastModifyingWriter
	expectedRmdCopy.LastModifyingUser = rmds.MD.LastModifyingUser
	expectedRmdCopy.WriterMetadataSigInfo = rmds.MD.WriterMetadataSigInfo
	expectedRmdCopy.SerializedPrivateMetadata = rmds.MD.SerializedPrivateMetadata

	require.Equal(t, expectedRmdCopy, rmds.MD)
}

func TestMDOpsPutPublicSuccess(t *testing.T) {
	config := MakeTestConfigOrBust(t, "alice", "bob")
	defer CheckConfigAndShutdown(t, config)

	config.MDServer().Shutdown()
	var mdServer fakeMDServerPut
	config.SetMDServer(&mdServer)

	id := FakeTlfID(1, true)
	h := parseTlfHandleOrBust(t, config, "alice,bob", true)

	var rmd RootMetadata
	err := updateNewRootMetadata(&rmd, id, h.ToBareHandleOrBust())
	require.NoError(t, err)
	rmd.data = makeFakePrivateMetadataFuture(t).toCurrent()
	rmd.tlfHandle = h

	ctx := context.Background()
	err = config.MDOps().Put(ctx, &rmd)

	rmds := mdServer.getLastRmds()
	validatePutPublicRMDS(ctx, t, config, &rmd, rmds)
}

func TestMDOpsPutPrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds := newRMDS(t, config, false)
	putMDForPrivate(config, rmds)

	if err := config.MDOps().PutUnmerged(ctx, &rmds.MD, NullBranchID); err != nil {
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

	err := errors.New("Fake fail")
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, err)

	if err2 := config.MDOps().Put(ctx, rmd); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestMDOpsGetRangeFailFinal(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	rmds1 := newRMDS(t, config, false)
	rmds2 := newRMDS(t, config, false)
	rmds3 := newRMDS(t, config, false)

	rmds3.MD.Revision = 200
	rmds3.MD.mdID = fakeMdID(40)
	rmds3.MD.PrevRoot = fakeMdID(39)

	rmds2.MD.Revision = 201
	rmds2.MD.mdID = fakeMdID(41)
	rmds2.MD.PrevRoot = rmds3.MD.mdID
	rmds2.MD.Flags |= MetadataFlagFinal

	rmds1.MD.Revision = 202
	rmds1.MD.mdID = fakeMdID(42)
	rmds1.MD.PrevRoot = rmds2.MD.mdID

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds3)
	verifyMDForPrivate(config, rmds2)

	// Set tlfHandle to nil so that the md server returns
	// 'deserialized' RMDSes.
	rmds1.MD.tlfHandle = nil
	rmds2.MD.tlfHandle = nil
	rmds3.MD.tlfHandle = nil

	allRMDSs := []*RootMetadataSigned{rmds3, rmds2, rmds1}

	start, stop := MetadataRevision(200), MetadataRevision(202)
	config.mockMdserv.EXPECT().GetRange(ctx, rmds1.MD.ID, NullBranchID, Merged, start,
		stop).Return(allRMDSs, nil)

	_, err := config.MDOps().GetRange(ctx, rmds1.MD.ID, start, stop)
	if err == nil {
		t.Errorf("Got no expected error on GetRange")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on GetRange with final non-head revision: %v",
			err)
	}
}
