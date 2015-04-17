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

func makeContext(encData []byte) BlockContext {
	return &BlockPointer{QuotaSize: uint32(len(encData))}
}

func TestBlockOpsGetSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, and one to decrypt it
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(encData, nil)
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(packedData, nil)
	var gotData TestBlock
	expectBlockDecode(config, packedData, &gotData, decData, nil)

	if err := config.BlockOps().Get(
		id, ctxt, NullKey, &gotData); err != nil {
		t.Errorf("Got error on get: %v", err)
	} else if gotData != decData {
		t.Errorf("Got back wrong data on get: %v", gotData)
	}
}

func TestBlockOpsGetFailInconsistentByteCount(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect just one call to fetch a block
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData[:3])
	config.mockBserv.EXPECT().Get(id, ctxt).Return(encData, nil)

	err := config.BlockOps().Get(id, ctxt, NullKey, nil)
	if _, ok := err.(*InconsistentByteCountError); !ok {
		t.Errorf("Unexpectedly did not get InconsistentByteCountError; instead got %v", err)
	}
}

func TestBlockOpsGetFailTooHighByteCount(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, and one to decrypt it
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(encData, nil)
	packedData := []byte{4, 3, 2, 1, 0}
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(packedData, nil)

	err := config.BlockOps().Get(id, ctxt, NullKey, nil)
	if _, ok := err.(*TooHighByteCountError); !ok {
		t.Errorf("Unexpectedly did not get TooHighByteCountError; instead got %v", err)
	}
}

func TestBlockOpsGetFailGet(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// fail the fetch call
	id := BlockId{1}
	err := errors.New("Fake fail")
	ctxt := makeContext(nil)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(nil, err)

	var gotData TestBlock
	if err2 := config.BlockOps().Get(
		id, ctxt, NullKey, &gotData); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailDecrypt(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, then fail to decrypt i
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(encData, nil)
	err := errors.New("Fake fail")
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(nil, err)

	var gotData TestBlock
	if err2 := config.BlockOps().Get(
		id, ctxt, NullKey, &gotData); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailDecode(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to fetch a block, and one to decrypt it
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(encData, nil)
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	key := NullKey
	config.mockCrypto.EXPECT().Decrypt(encData, key).Return(packedData, nil)
	var gotData TestBlock
	err := errors.New("Fake fail")
	expectBlockDecode(config, packedData, &gotData, decData, err)

	if err2 := config.BlockOps().Get(
		id, ctxt, NullKey, &gotData); err2 != err {
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

func TestBlockOpsReadyFailTooLowByteCount(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect just one call to encrypt a block
	decData := TestBlock{42}
	packedData := []byte{4, 3, 2, 1}
	encData := []byte{1, 2, 3}
	key := NullKey

	config.mockCodec.EXPECT().Encode(decData).Return(packedData, nil)
	config.mockCrypto.EXPECT().Encrypt(packedData, key).Return(encData, nil)

	_, _, err := config.BlockOps().Ready(decData, key)
	if _, ok := err.(*TooLowByteCountError); !ok {
		t.Errorf("Unexpectedly did not get TooLowByteCountError; instead got %v", err)
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
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Put(id, ctxt, encData).Return(nil)

	if err := config.BlockOps().Put(id, ctxt, encData); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockOpsPutFailInconsistentByteCountError(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to put a block
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData[:3])
	err := config.BlockOps().Put(id, ctxt, encData)
	if _, ok := err.(*InconsistentByteCountError); !ok {
		t.Errorf("Unexpectedly did not get InconsistentByteCountError; instead got %v", err)
	}
}

func TestBlockOpsPutFail(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// fail the put call
	id := BlockId{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	err := errors.New("Fake fail")
	config.mockBserv.EXPECT().Put(id, ctxt, encData).Return(err)

	if err2 := config.BlockOps().Put(id, ctxt, encData); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestBlockOpsDeleteSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// expect one call to delete a block
	id := BlockId{1}
	ctxt := makeContext(nil)
	config.mockBserv.EXPECT().Delete(id, ctxt).Return(nil)

	if err := config.BlockOps().Delete(id, ctxt); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockOpsDeleteFail(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer mockCtrl.Finish()

	// fail the delete call
	id := BlockId{1}
	err := errors.New("Fake fail")
	ctxt := makeContext(nil)
	config.mockBserv.EXPECT().Delete(id, ctxt).Return(err)

	if err2 := config.BlockOps().Delete(id, ctxt); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}
