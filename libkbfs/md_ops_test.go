package libkbfs

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func mdOpsInit(t *testing.T) (mockCtrl *gomock.Controller, config *ConfigMock) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	mdops := &MDOpsStandard{config}
	config.SetMDOps(mdops)
	return
}

func mdOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()

}

func newDir(config *ConfigMock, x byte, share bool, public bool) (
	DirID, *DirHandle, *RootMetadataSigned) {
	id := DirID{0}
	id[0] = x
	id[DirIDLen-1] = DirIDSuffix
	h := NewDirHandle()
	h.Writers = append(h.Writers, keybase1.MakeTestUID(15))
	if share {
		h.Writers = append(h.Writers, keybase1.MakeTestUID(16))
	}
	expectUserCalls(h, config)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().
		Return(h.Writers[0], nil)

	rmd := NewRootMetadata(h, id)
	rmd.data.LastWriter = h.Writers[0]
	rmd.AddNewKeys(DirKeyBundle{})

	rmds := &RootMetadataSigned{}
	if public || !share {
		rmds.SigInfo = SignatureInfo{
			Version:      SigED25519,
			Signature:    []byte{42},
			VerifyingKey: MakeFakeVerifyingKeyOrBust("fake key"),
		}
	} else {
		rmds.Macs = make(map[keybase1.UID][]byte)
		rmds.Macs[h.Writers[0]] = []byte{42}
		if share {
			rmds.Macs[h.Writers[1]] = []byte{43}
		}
	}
	rmds.MD = *rmd
	return id, h, rmds
}

func verifyMDForPrivateShare(config *ConfigMock, rmds *RootMetadataSigned,
	id DirID) {
	packedData := []byte{4, 3, 2, 1}

	expectGetTLFCryptKeyForMDDecryption(config, &rmds.MD)
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		rmds.MD.SerializedPrivateMetadata, TLFCryptKey{}).Return(packedData, nil)
	config.mockCodec.EXPECT().Decode(packedData, gomock.Any()).
		Return(nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil)
	config.mockKops.EXPECT().GetMacPublicKey(rmds.MD.data.LastWriter).
		Return(MacPublicKey{}, nil)
	config.mockCrypto.EXPECT().VerifyMAC(
		MacPublicKey{}, packedData, gomock.Any()).Return(nil)
}

func verifyMDForPublicShare(config *ConfigMock, rmds *RootMetadataSigned,
	id DirID, hasVerifyingKeyErr error, verifyErr error) {
	packedData := []byte{4, 3, 2, 1}

	expectGetTLFCryptKeyForMDDecryption(config, &rmds.MD)
	config.mockCrypto.EXPECT().DecryptPrivateMetadata(
		rmds.MD.SerializedPrivateMetadata, TLFCryptKey{}).Return(packedData, nil)
	config.mockCodec.EXPECT().Decode(packedData, gomock.Any()).
		Return(nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil)
	config.mockKbpki.EXPECT().HasVerifyingKey(gomock.Any(), gomock.Any()).AnyTimes().Return(hasVerifyingKeyErr)
	if hasVerifyingKeyErr == nil {
		config.mockCrypto.EXPECT().Verify(packedData, rmds.SigInfo).Return(verifyErr)
	}
}

func putMDForPrivateShare(config *ConfigMock, rmds *RootMetadataSigned,
	id DirID) {
	packedData := []byte{4, 3, 2, 1}
	rmds.MD.SerializedPrivateMetadata = packedData

	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil).
		Times(2)
	expectGetTLFCryptKeyForEncryption(config, &rmds.MD)
	config.mockCrypto.EXPECT().EncryptPrivateMetadata(
		packedData, TLFCryptKey{}).Return(packedData, nil)

	// Make a MAC for each writer
	config.mockKops.EXPECT().GetMacPublicKey(gomock.Any()).
		Times(2).Return(MacPublicKey{}, nil)
	config.mockCrypto.EXPECT().MAC(MacPublicKey{}, packedData).
		Times(2).Return(packedData, nil)

	// get the MD id, and test that it actually gets set in the metadata
	mdID := MdID{42}
	config.mockCodec.EXPECT().Encode(gomock.Any()).AnyTimes().
		Return([]byte{0}, nil)
	config.mockCrypto.EXPECT().Hash(gomock.Any()).AnyTimes().
		Return(libkb.NodeHashShort(mdID), nil)

	config.mockMdserv.EXPECT().Put(id, mdID, gomock.Any()).Return(nil)
}

func TestMDOpsGetAtHandlePrivateSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(config, 1, true, false)

	config.mockMdserv.EXPECT().GetAtHandle(h).Return(rmds, nil)
	verifyMDForPrivateShare(config, rmds, id)

	if rmd2, err := config.MDOps().GetAtHandle(h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.ID != id {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.ID, id)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetAtHandlePublicSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(config, 1, false, true)

	config.mockMdserv.EXPECT().GetAtHandle(h).Return(rmds, nil)
	verifyMDForPublicShare(config, rmds, id, nil, nil)

	if rmd2, err := config.MDOps().GetAtHandle(h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.ID != id {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.ID, id)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetAtHandlePublicFailFindKey(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(config, 1, false, true)

	config.mockMdserv.EXPECT().GetAtHandle(h).Return(rmds, nil)

	verifyMDForPublicShare(config, rmds, id, KeyNotFoundError{}, nil)

	_, err := config.MDOps().GetAtHandle(h)
	if _, ok := err.(KeyNotFoundError); !ok {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetAtHandlePublicFailVerify(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(config, 1, false, true)

	config.mockMdserv.EXPECT().GetAtHandle(h).Return(rmds, nil)

	expectedErr := libkb.VerificationError{}
	verifyMDForPublicShare(config, rmds, id, nil, expectedErr)

	if _, err := config.MDOps().GetAtHandle(h); err != expectedErr {
		t.Errorf("Got unexpected error on get: %v", err)
	}
}

func TestMDOpsGetAtHandleFailGet(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and fail it
	_, h, _ := newDir(config, 1, true, false)
	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetAtHandle(h).Return(nil, err)

	if _, err2 := config.MDOps().GetAtHandle(h); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsGetAtHandleFailHandleCheck(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it, and fail that one
	id, h, rmds := newDir(config, 1, true, false)
	rmds.MD.cachedDirHandle = NewDirHandle()

	// add a new writer after the MD was made, to force a failure
	newWriter := keybase1.MakeTestUID(100)
	h.Writers = append(h.Writers, newWriter)
	expectUserCall(newWriter, config)
	config.mockMdserv.EXPECT().GetAtHandle(h).Return(rmds, nil)
	verifyMDForPrivateShare(config, rmds, id)

	if _, err := config.MDOps().GetAtHandle(h); err == nil {
		t.Errorf("Got no error on bad handle check test")
	} else if _, ok := err.(*MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad handle check test: %v", err)
	}
}

func TestMDOpsGetSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, _, rmds := newDir(config, 1, true, false)

	config.mockMdserv.EXPECT().Get(id).Return(rmds, nil)
	verifyMDForPrivateShare(config, rmds, id)

	if rmd2, err := config.MDOps().Get(id); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetBlankSigSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, give back a blank sig that doesn't need
	// verification
	id, h, _ := newDir(config, 1, true, false)
	rmd := NewRootMetadata(h, id)
	rmds := &RootMetadataSigned{
		MD: *rmd,
	}

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().Get(id).Return(rmds, nil)

	if rmd2, err := config.MDOps().Get(id); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetFailGet(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and fail it
	id, _, _ := newDir(config, 1, true, false)
	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().Get(id).Return(nil, err)

	if _, err2 := config.MDOps().Get(id); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsGetFailIdCheck(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it, and fail that one
	_, _, rmds := newDir(config, 1, true, false)
	id2, _, _ := newDir(config, 2, true, false)

	config.mockMdserv.EXPECT().Get(id2).Return(rmds, nil)

	if _, err := config.MDOps().Get(id2); err == nil {
		t.Errorf("Got no error on bad id check test")
	} else if _, ok := err.(*MDMismatchError); !ok {
		t.Errorf("Got unexpected error on bad id check test: %v", err)
	}
}

func TestMDOpsGetAtIDSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and one to verify it
	id, _, rmds := newDir(config, 1, true, false)
	mdID := MdID{0}

	config.mockMdserv.EXPECT().GetAtID(id, mdID).Return(rmds, nil)

	if rmd2, err := config.MDOps().GetAtID(id, mdID); err != nil {
		t.Errorf("Got error on getAtId: %v", err)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetAtIDFail(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch MD, and fail it
	id, _, _ := newDir(config, 1, true, false)
	mdID := MdID{0}

	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetAtID(id, mdID).Return(nil, err)

	if _, err2 := config.MDOps().GetAtID(id, mdID); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsPutSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to sign MD, and one to put it
	id, _, rmds := newDir(config, 1, true, false)
	putMDForPrivateShare(config, rmds, id)

	if err := config.MDOps().Put(id, &rmds.MD); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestMDOpsPutFailEncode(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to sign MD, and fail it
	id, h, _ := newDir(config, 1, true, false)
	rmd := NewRootMetadata(h, id)

	err := errors.New("Fake fail")
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(nil, err)

	if err2 := config.MDOps().Put(id, rmd); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestMDOpsGetFavoritesSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	// expect one call to fetch favorites
	id1, _, _ := newDir(config, 1, true, false)
	id2, _, _ := newDir(config, 2, true, false)
	ids := []DirID{id1, id2}

	config.mockMdserv.EXPECT().GetFavorites().Return(ids, nil)

	if ids2, err := config.MDOps().GetFavorites(); err != nil {
		t.Errorf("Got error on favorites: %v", err)
	} else if len(ids2) != len(ids) {
		t.Errorf("Got bad ids back: %v", ids2)
	}
}

func TestMDOpsGetFavoritesFail(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mdOpsShutdown(mockCtrl, config)

	err := errors.New("Fake fail")
	// expect one call to favorites, and fail it
	config.mockMdserv.EXPECT().GetFavorites().Return(nil, err)

	if _, err2 := config.MDOps().GetFavorites(); err2 != err {
		t.Errorf("Got bad error on favorites: %v", err2)
	}
}
