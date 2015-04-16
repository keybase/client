package libkbfs

import (
	"errors"
	"testing"

	"code.google.com/p/gomock/gomock"
	libkb "github.com/keybase/client/go/libkb"
)

type TestBlock struct {
	A int
}

var NullCtxt BlockContext = &BlockPointer{QuotaSize: 4}

func blockOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock) {
	mockCtrl = gomock.NewController(t)
	config = NewConfigMock(mockCtrl)
	bops := &BlockOpsStandard{config}
	config.SetBlockOps(bops)
	return
}

func expectBlockDecode(config *ConfigMock, packedData []byte,
	gotData *TestBlock, block TestBlock, err error) {
	config.mockCodec.EXPECT().Decode(packedData, gotData).
		Do(func(buf []byte, obj interface{}) {
		v := obj.(*TestBlock)
		*v = block
	}).Return(err)
}

func TestBlockOpsGetSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, and one to decrypt it
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	config.mockBserv.EXPECT().Get(id, NullCtxt).Return(encData, nil)
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(packedData, nil)
	var gotData TestBlock
	expectBlockDecode(config, packedData, &gotData, decData, nil)

	if err := config.BlockOps().Get(
		id, NullCtxt, NullKey, &gotData); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if gotData != decData {
		t.Errorf("Got back wrong data on get: %v", gotData)
	}
}

func TestBlockOpsGetFailGet(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// fail the fetch call
	id := BlockId{1}
	err := errors.New("Fake fail")
	config.mockBserv.EXPECT().Get(id, NullCtxt).Return(nil, err)

	var gotData TestBlock
	if err2 := config.BlockOps().Get(
		id, NullCtxt, NullKey, &gotData); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailDecrypt(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, then fail to decrypt i
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	config.mockBserv.EXPECT().Get(id, NullCtxt).Return(encData, nil)
	err := errors.New("Fake fail")
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(nil, err)

	var gotData TestBlock
	if err2 := config.BlockOps().Get(
		id, NullCtxt, NullKey, &gotData); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailDecode(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, and one to decrypt it
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	config.mockBserv.EXPECT().Get(id, NullCtxt).Return(encData, nil)
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(packedData, nil)
	var gotData TestBlock
	err := errors.New("Fake fail")
	expectBlockDecode(config, packedData, &gotData, decData, err)

	if err2 := config.BlockOps().Get(
		id, NullCtxt, NullKey, &gotData); err2 != err {
		t.Errorf("Got unexpected error on get: %v", err2)
	}
}

func TestBlockOpsReadySuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	encData := []byte{1, 2, 3, 4}
	key := NullKey
	id := BlockId{1}

	config.mockCodec.EXPECT().Encode(decData).Return(packedData, nil)
	config.mockCrypto.EXPECT().Encrypt(packedData, key).Return(encData, nil)
	config.mockCrypto.EXPECT().Hash(encData).Return(
		libkb.NodeHashShort(id), nil)

	//var data []byte
	if id2, _, err := config.BlockOps().Ready(decData, key); err != nil {
		t.Errorf("Got error on ready: %v", err)
	} else if id2 != id {
		t.Errorf("Got back wrong id on ready: %v", id)
		//	} else if data != encData {
		//		t.Errorf("Got back wrong data on get: %v", data)
	}
}

func TestBlockOpsReadyFailEncode(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	err := errors.New("Fake fail")
	key := NullKey

	config.mockCodec.EXPECT().Encode(decData).Return(nil, err)

	if _, _, err2 := config.BlockOps().Ready(decData, key); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsReadyFailEncrypt(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	err := errors.New("Fake fail")
	key := NullKey

	config.mockCodec.EXPECT().Encode(decData).Return(packedData, nil)
	config.mockCrypto.EXPECT().Encrypt(packedData, key).Return(nil, err)

	if _, _, err2 := config.BlockOps().Ready(decData, key); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsReadyFailHash(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	encData := []byte{1, 2, 3, 4}
	key := NullKey
	err := errors.New("Fake fail")

	config.mockCodec.EXPECT().Encode(decData).Return(packedData, nil)
	config.mockCrypto.EXPECT().Encrypt(packedData, key).Return(encData, nil)
	config.mockCrypto.EXPECT().Hash(encData).Return(nil, err)

	if _, _, err2 := config.BlockOps().Ready(decData, key); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsReadyFailCast(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	encData := []byte{1, 2, 3, 4}
	key := NullKey
	badId := libkb.NodeHashLong{0}

	config.mockCodec.EXPECT().Encode(decData).Return(packedData, nil)
	config.mockCrypto.EXPECT().Encrypt(packedData, key).Return(encData, nil)
	config.mockCrypto.EXPECT().Hash(encData).Return(badId, nil)

	err := &BadCryptoError{BlockId{0}}
	if _, _, err2 :=
		config.BlockOps().Ready(decData, key); err2.Error() != err.Error() {
		t.Errorf("Got bad error on ready: %v (expected %v)", err2, err)
	}
}

func TestBlockOpsPutSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to put a block
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	config.mockBserv.EXPECT().Put(id, NullCtxt, encData).Return(nil)

	if err := config.BlockOps().Put(id, NullCtxt, encData); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockOpsPutFail(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// fail the put call
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	err := errors.New("Fake fail")
	config.mockBserv.EXPECT().Put(id, NullCtxt, encData).Return(err)

	if err2 := config.BlockOps().Put(id, NullCtxt, encData); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestBlockOpsDeleteSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to delete a block
	id := BlockId{1}
	config.mockBserv.EXPECT().Delete(id, NullCtxt).Return(nil)

	if err := config.BlockOps().Delete(id, NullCtxt); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockOpsDeleteFail(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// fail the delete call
	id := BlockId{1}
	err := errors.New("Fake fail")
	config.mockBserv.EXPECT().Delete(id, NullCtxt).Return(err)

	if err2 := config.BlockOps().Delete(id, NullCtxt); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}
