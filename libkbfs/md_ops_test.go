package libkbfs

import (
	"errors"
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

func mdOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	mdops := &MDOpsStandard{config}
	config.SetMDOps(mdops)
	ctx = context.Background()
	return
}

func mdOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func newDir(t *testing.T, config *ConfigMock, x byte, share bool, public bool) (
	TlfID, *TlfHandle, *RootMetadataSigned) {
	revision := MetadataRevision(1)
	id, h, rmds := NewFolder(t, x, revision, share, public)
	expectUsernameCalls(h, config)
	name := libkb.NewNormalizedUsername(fmt.Sprintf("user_%s", h.Writers[0]))
	config.mockKbpki.EXPECT().GetCurrentUserInfo(gomock.Any()).AnyTimes().
		Return(name, h.Writers[0], nil)
	return id, h, rmds
}

func verifyMDForPublic(config *ConfigMock, rmds *RootMetadataSigned,
	id TlfID, hasVerifyingKeyErr error, verifyErr error) {
	packedData := []byte{4, 3, 2, 1}
	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(hasVerifyingKeyErr)
	if hasVerifyingKeyErr == nil {
		config.mockCodec.EXPECT().Encode(rmds.MD.WriterMetadata).Return(packedData, nil)
		config.mockCrypto.EXPECT().Verify(packedData, rmds.MD.WriterMetadataSigInfo).Return(nil)
		config.mockCodec.EXPECT().Encode(rmds.MD).AnyTimes().Return(packedData, nil)
		config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).Return(verifyErr)
		if verifyErr == nil {
			config.mockCodec.EXPECT().Decode(
				rmds.MD.SerializedPrivateMetadata,
				&rmds.MD.data).Return(nil)
		}
	}
}

func verifyMDForPrivate(config *ConfigMock, rmds *RootMetadataSigned,
	id TlfID) {
	config.mockCodec.EXPECT().Decode(rmds.MD.SerializedPrivateMetadata, gomock.Any()).
		Return(nil)
	expectGetTLFCryptKeyForMDDecryption(config, &rmds.MD)
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		gomock.Any(), TLFCryptKey{}).Return(&rmds.MD.data, nil)

	packedData := []byte{4, 3, 2, 1}
	config.mockCodec.EXPECT().Encode(rmds.MD).Return(packedData, nil)
	config.mockCodec.EXPECT().Encode(rmds.MD.WriterMetadata).Return(packedData, nil)
	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return(nil)
	config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).Return(nil)
	config.mockCrypto.EXPECT().Verify(packedData, rmds.MD.WriterMetadataSigInfo).Return(nil)
}

func putMDForPublic(config *ConfigMock, rmds *RootMetadataSigned,
	id TlfID) {
	// TODO make this more explicit. Currently can't because the `Put`
	// call mutates `rmds.MD`, which makes the EXPECT() not match.
	// Encodes:
	// 1) rmds.MD.data
	// 2) rmds.MD.WriterMetadata
	// 3) rmds.MD
	config.mockCodec.EXPECT().Encode(gomock.Any()).Times(3).Return([]byte{}, nil)
	config.mockCrypto.EXPECT().Sign(gomock.Any(), gomock.Any()).Times(2).Return(SignatureInfo{}, nil)

	config.mockCodec.EXPECT().Decode([]byte{}, gomock.Any()).Return(nil)

	config.mockMdserv.EXPECT().Put(gomock.Any(), gomock.Any()).Return(nil)
}

func putMDForPrivate(config *ConfigMock, rmds *RootMetadataSigned,
	id TlfID) {
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

// fakeInitialRekey fakes a rekey for the given RootMetadata. This is
// necessary since newly-created RootMetadata objects don't have
// enough data to build a TlfHandle from until the first rekey.
func fakeInitialRekey(h *TlfHandle, rmd *RootMetadata) {
	if rmd.ID.IsPublic() {
		writers := make([]keybase1.UID, len(h.Writers))
		for i, w := range h.Writers {
			writers[i] = w
		}
		rmd.Writers = writers
	} else {
		wkb := TLFWriterKeyBundle{
			WKeys: make(UserDeviceKeyInfoMap),
		}
		for _, w := range h.Writers {
			wkb.WKeys[w] = make(DeviceKeyInfoMap)
		}
		rmd.WKeys = TLFWriterKeyGenerations{wkb}

		rkb := TLFReaderKeyBundle{
			RKeys: make(UserDeviceKeyInfoMap),
		}
		for _, r := range h.Readers {
			rkb.RKeys[r] = make(DeviceKeyInfoMap)
		}
		rmd.RKeys = TLFReaderKeyGenerations{rkb}
	}
}

func TestMDOpsGetForHandlePublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(t, config, 1, false, true)
	fakeInitialRekey(h, &rmds.MD)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, id, nil, nil)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h, Merged).Return(NullTlfID, rmds, nil)

	if rmd2, err := config.MDOps().GetForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.ID != id {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.ID, id)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetForHandlePrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(t, config, 1, true, false)
	fakeInitialRekey(h, &rmds.MD)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds, id)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h, Merged).Return(NullTlfID, rmds, nil)

	if rmd2, err := config.MDOps().GetForHandle(ctx, h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.ID != id {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.ID, id)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetForHandlePublicFailFindKey(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(t, config, 1, false, true)
	fakeInitialRekey(h, &rmds.MD)

	// Do this before setting tlfHandle to nil.
	verifyMDForPublic(config, rmds, id, KeyNotFoundError{}, nil)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h, Merged).Return(NullTlfID, rmds, nil)

	_, err := config.MDOps().GetForHandle(ctx, h)
	if _, ok := err.(UnverifiableTlfUpdateError); !ok {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetForHandlePublicFailVerify(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(t, config, 1, false, true)
	fakeInitialRekey(h, &rmds.MD)

	// Do this before setting tlfHandle to nil.
	expectedErr := libkb.VerificationError{}
	verifyMDForPublic(config, rmds, id, nil, expectedErr)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForHandle(ctx, h, Merged).Return(NullTlfID, rmds, nil)

	if _, err := config.MDOps().GetForHandle(ctx, h); err != expectedErr {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetForHandleFailGet(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and fail it
	_, h, _ := newDir(t, config, 1, true, false)
	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForHandle(ctx, h, Merged).Return(NullTlfID, nil, err)

	if _, err2 := config.MDOps().GetForHandle(ctx, h); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsGetForHandleFailHandleCheck(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it, and fail that one
	_, h, rmds := newDir(t, config, 1, true, false)
	fakeInitialRekey(h, &rmds.MD)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	// Make a different handle.
	otherH := makeTestTlfHandle(t, 32, false)
	config.mockMdserv.EXPECT().GetForHandle(ctx, otherH, Merged).Return(NullTlfID, rmds, nil)

	if _, err := config.MDOps().GetForHandle(ctx, otherH); err == nil {
		t.Errorf("Got no error on bad handle check test")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(t, config, 1, true, false)
	fakeInitialRekey(h, &rmds.MD)

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds, id)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	config.mockMdserv.EXPECT().GetForTLF(ctx, id, NullBranchID, Merged).Return(rmds, nil)

	if rmd2, err := config.MDOps().GetForTLF(ctx, id); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetBlankSigFailure(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, give back a blank sig that
	// should fail verification
	id, h, rmds := newDir(t, config, 1, true, false)
	rmds.SigInfo = SignatureInfo{}
	fakeInitialRekey(h, &rmds.MD)

	// Set tlfHandle to nil so that the md server returns a
	// 'deserialized' RMDS.
	rmds.MD.tlfHandle = nil

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetForTLF(ctx, id, NullBranchID, Merged).Return(rmds, nil)

	if _, err := config.MDOps().GetForTLF(ctx, id); err == nil {
		t.Error("Got no error on get")
	}
}

func TestMDOpsGetFailGet(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and fail it
	id, _, _ := newDir(t, config, 1, true, false)
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

	// expect one call to fetch MD, and one to verify it, and fail that one
	_, h, rmds := newDir(t, config, 1, true, false)
	fakeInitialRekey(h, &rmds.MD)

	id2, _, _ := newDir(t, config, 2, true, false)

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

	// expect one call to fetch MD, and one to verify it
	id, h1, rmds1 := newDir(t, config, 1, true, false)
	fakeInitialRekey(h1, &rmds1.MD)

	_, h2, rmds2 := newDir(t, config, 1, true, false)
	fakeInitialRekey(h2, &rmds2.MD)

	rmds2.MD.mdID = fakeMdID(42)
	rmds1.MD.PrevRoot = rmds2.MD.mdID
	rmds1.MD.Revision = 102

	_, h3, rmds3 := newDir(t, config, 1, true, false)
	fakeInitialRekey(h3, &rmds3.MD)

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
	verifyMDForPrivate(config, rmds3, id)
	verifyMDForPrivate(config, rmds2, id)
	verifyMDForPrivate(config, rmds1, id)

	// Set tlfHandles to nil so that the md server returns
	// 'deserialized' RMDSes.
	rmds1.MD.tlfHandle = nil
	rmds2.MD.tlfHandle = nil
	rmds3.MD.tlfHandle = nil

	allRMDSs := []*RootMetadataSigned{rmds3, rmds2, rmds1}

	config.mockMdserv.EXPECT().GetRange(ctx, id, NullBranchID, Merged, start,
		stop).Return(allRMDSs, nil)

	allRMDs, err := config.MDOps().GetRange(ctx, id, start, stop)
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

	// expect one call to fetch MD, and one to verify it
	id, h1, rmds1 := newDir(t, config, 1, true, false)
	fakeInitialRekey(h1, &rmds1.MD)

	_, h2, rmds2 := newDir(t, config, 1, true, false)
	fakeInitialRekey(h2, &rmds2.MD)

	rmds2.MD.mdID = fakeMdID(42)
	rmds1.MD.PrevRoot = fakeMdID(46) // points to some random ID
	rmds1.MD.Revision = 202

	_, h3, rmds3 := newDir(t, config, 1, true, false)
	fakeInitialRekey(h3, &rmds3.MD)

	rmds3.MD.mdID = fakeMdID(43)
	rmds2.MD.PrevRoot = rmds3.MD.mdID
	rmds2.MD.Revision = 201
	mdID4 := fakeMdID(44)
	rmds3.MD.PrevRoot = mdID4
	rmds3.MD.Revision = 200

	// Do this before setting tlfHandle to nil.
	verifyMDForPrivate(config, rmds3, id)
	verifyMDForPrivate(config, rmds2, id)

	// Set tlfHandle to nil so that the md server returns
	// 'deserialized' RMDSes.
	rmds1.MD.tlfHandle = nil
	rmds2.MD.tlfHandle = nil
	rmds3.MD.tlfHandle = nil

	allRMDSs := []*RootMetadataSigned{rmds3, rmds2, rmds1}

	start, stop := MetadataRevision(200), MetadataRevision(202)
	config.mockMdserv.EXPECT().GetRange(ctx, id, NullBranchID, Merged, start,
		stop).Return(allRMDSs, nil)

	_, err := config.MDOps().GetRange(ctx, id, start, stop)
	if err == nil {
		t.Errorf("Got no expected error on GetSince")
	} else if _, ok := err.(MDMismatchError); !ok {
		t.Errorf("Got unexpected error on GetSince with bad PrevRoot chain: %v",
			err)
	}
}

func TestMDOpsPutPublicSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to sign MD, and one to put it
	id, _, rmds := newDir(t, config, 1, false, true)
	putMDForPublic(config, rmds, id)

	if err := config.MDOps().Put(ctx, &rmds.MD); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestMDOpsPutPrivateSuccess(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to sign MD, and one to put it
	id, _, rmds := newDir(t, config, 1, true, false)
	putMDForPrivate(config, rmds, id)

	if err := config.MDOps().PutUnmerged(ctx, &rmds.MD, NullBranchID); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestMDOpsPutFailEncode(t *testing.T) {
	mockCtrl, config, ctx := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to sign MD, and fail it
	id, h, _ := newDir(t, config, 1, true, false)
	rmd := NewRootMetadataForTest(h, id)

	expectGetTLFCryptKeyForEncryption(config, rmd)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		&rmd.data, TLFCryptKey{}).Return(EncryptedPrivateMetadata{}, nil)

	err := errors.New("Fake fail")
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, err)

	if err2 := config.MDOps().Put(ctx, rmd); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}
