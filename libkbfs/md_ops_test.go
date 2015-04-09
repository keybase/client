package libkbfs

import (
	"errors"
	"testing"

	"code.google.com/p/gomock/gomock"
	libkb "github.com/keybase/client/go/libkb"
)

func mdOpsInit(t *testing.T) (mockCtrl *gomock.Controller, config *ConfigMock) {
	mockCtrl = gomock.NewController(t)
	config = NewConfigMock(mockCtrl)
	mdops := &MDOpsStandard{config}
	config.SetMDOps(mdops)
	return
}

func newDir(config *ConfigMock, x byte, share bool, public bool) (
	DirId, *DirHandle, *RootMetadataSigned) {
	id := DirId{0}
	id[0] = x
	id[DIRID_LEN-1] = DIRID_SUFFIX
	h := NewDirHandle()
	h.Writers = append(h.Writers, libkb.UID{15})
	if share {
		h.Writers = append(h.Writers, libkb.UID{16})
	}
	expectUserCalls(h, config)
	config.mockKbpki.EXPECT().GetLoggedInUser().AnyTimes().
		Return(h.Writers[0], nil)

	rmd := NewRootMetadata(h, id)
	rmd.data.LastWriter = h.Writers[0]
	rmd.AddNewKeys(DirKeys{})

	rmds := &RootMetadataSigned{}
	if public || !share {
		rmds.Sig = []byte{42}
	} else {
		rmds.Macs = make(map[libkb.UID][]byte)
		rmds.Macs[h.Writers[0]] = []byte{42}
		if share {
			rmds.Macs[h.Writers[1]] = []byte{43}
		}
	}
	rmds.MD = *rmd
	return id, h, rmds
}

func verifyMDForPrivateShare(config *ConfigMock, rmds *RootMetadataSigned,
	id DirId) {
	packedData := []byte{4, 3, 2, 1}

	expectGetSecretKey(config, &rmds.MD)
	config.mockCrypto.EXPECT().Decrypt(
		rmds.MD.SerializedPrivateMetadata, NullKey).Return(packedData, nil)
	config.mockCodec.EXPECT().Decode(packedData, gomock.Any()).
		Return(nil)
	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil)
	config.mockKops.EXPECT().GetPublicMacKey(rmds.MD.data.LastWriter, nil).
		Return(NullKey, nil)
	config.mockKops.EXPECT().GetMyPrivateMacKey(nil).Return(NullKey, nil)
	config.mockCrypto.EXPECT().SharedSecret(NullKey, NullKey).
		Return(NullKey, nil)
	config.mockCrypto.EXPECT().VerifyHMAC(
		NullKey, packedData, gomock.Any()).Return(nil)
}

func putMDForPrivateShare(config *ConfigMock, rmds *RootMetadataSigned,
	id DirId) {
	packedData := []byte{4, 3, 2, 1}
	rmds.MD.SerializedPrivateMetadata = packedData

	config.mockCodec.EXPECT().Encode(gomock.Any()).Return(packedData, nil).
		Times(2)
	expectGetSecretKey(config, &rmds.MD)
	config.mockCrypto.EXPECT().Encrypt(
		packedData, NullKey).Return(packedData, nil)
	config.mockKops.EXPECT().GetMyPrivateMacKey(nil).Return(NullKey, nil)

	// Make a MAC for each writer
	config.mockKops.EXPECT().GetPublicMacKey(gomock.Any(), nil).
		Times(2).Return(NullKey, nil)
	config.mockCrypto.EXPECT().SharedSecret(NullKey, NullKey).
		Times(2).Return(NullKey, nil)
	config.mockCrypto.EXPECT().HMAC(NullKey, packedData).
		Times(2).Return(packedData, nil)
	config.mockMdserv.EXPECT().Put(id, gomock.Any()).Return(nil)
}

func TestMDOpsGetAtHandleSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch MD, and one to verify it
	id, h, rmds := newDir(config, 1, true, false)

	config.mockMdserv.EXPECT().GetAtHandle(h).Return(rmds, nil)
	verifyMDForPrivateShare(config, rmds, id)

	if rmd2, err := config.MDOps().GetAtHandle(h); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if rmd2.Id != id {
		t.Errorf("Got back wrong id on get: %v (expected %v)", rmd2.Id, id)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetAtHandleFailGet(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

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
	defer mockCtrl.Finish()

	// expect one call to fetch MD, and one to verify it, and fail that one
	id, h, rmds := newDir(config, 1, true, false)
	rmds.MD.cachedDirHandle = NewDirHandle()

	// add a new writer after the MD was made, to force a failure
	newWriter := libkb.UID{100}
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
	defer mockCtrl.Finish()

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
	defer mockCtrl.Finish()

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
	defer mockCtrl.Finish()

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
	defer mockCtrl.Finish()

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

func TestMDOpsGetAtIdSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch MD, and one to verify it
	id, _, rmds := newDir(config, 1, true, false)
	blockId := BlockId{0}

	config.mockMdserv.EXPECT().GetAtId(id, blockId).Return(rmds, nil)

	if rmd2, err := config.MDOps().GetAtId(id, blockId); err != nil {
		t.Errorf("Got error on getAtId: %v", err)
	} else if rmd2 != &rmds.MD {
		t.Errorf("Got back wrong data on get: %v (expected %v)", rmd2, &rmds.MD)
	}
}

func TestMDOpsGetAtIdFail(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch MD, and fail it
	id, _, _ := newDir(config, 1, true, false)
	blockId := BlockId{0}

	err := errors.New("Fake fail")

	// only the get happens, no verify needed with a blank sig
	config.mockMdserv.EXPECT().GetAtId(id, blockId).Return(nil, err)

	if _, err2 := config.MDOps().GetAtId(id, blockId); err2 != err {
		t.Errorf("Got bad error on get: %v", err2)
	}
}

func TestMDOpsPutSuccess(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to sign MD, and one to put it
	id, _, rmds := newDir(config, 1, true, false)
	putMDForPrivateShare(config, rmds, id)

	if err := config.MDOps().Put(id, &rmds.MD); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestMDOpsPutFailEncode(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

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
	defer mockCtrl.Finish()

	// expect one call to fetch favorites
	id1, _, _ := newDir(config, 1, true, false)
	id2, _, _ := newDir(config, 2, true, false)
	ids := []DirId{id1, id2}

	config.mockMdserv.EXPECT().GetFavorites().Return(ids, nil)

	if ids2, err := config.MDOps().GetFavorites(); err != nil {
		t.Errorf("Got error on favorites: %v", err)
	} else if len(ids2) != len(ids) {
		t.Error("Got bad ids back: %v", ids2)
	}
}

func TestMDOpsGetFavoritesFail(t *testing.T) {
	mockCtrl, config := mdOpsInit(t)
	defer mockCtrl.Finish()

	err := errors.New("Fake fail")
	// expect one call to favorites, and fail it
	config.mockMdserv.EXPECT().GetFavorites().Return(nil, err)

	if _, err2 := config.MDOps().GetFavorites(); err2 != err {
		t.Errorf("Got bad error on favorites: %v", err2)
	}
}
