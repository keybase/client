package libkbfs

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
)

type TestBlock struct {
	A int
}

func blockOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	bops := &BlockOpsStandard{config}
	config.SetBlockOps(bops)
	return
}

func blockOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func expectBlockDecrypt(config *ConfigMock, encData []byte, key BlockCryptKey,
	block TestBlock, err error) {
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(gomock.Any(), gomock.Any()).
		Return(BlockCryptKey{}, nil)
	config.mockCrypto.EXPECT().DecryptBlock(encData, key, gomock.Any()).
		Do(func(buf []byte, key BlockCryptKey, b Block) {
		if b != nil {
			tb := b.(*TestBlock)
			*tb = block
		}
	}).Return(err)
}

func makeContext(encData []byte) BlockContext {
	return &BlockPointer{QuotaSize: uint32(len(encData))}
}

func TestBlockOpsGetSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to fetch a block, and one to decrypt it
	id := BlockID{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(
		encData, BlockCryptKeyServerHalf{}, nil)
	decData := TestBlock{42}
	var key BlockCryptKey
	expectBlockDecrypt(config, encData, key, decData, nil)

	var gotBlock TestBlock
	err := config.BlockOps().Get(id, ctxt, TLFCryptKey{}, &gotBlock)
	if err != nil {
		t.Fatalf("Got error on get: %v", err)
	}

	if gotBlock != decData {
		t.Errorf("Got back wrong block data on get: %v", gotBlock)
	}
}

func TestBlockOpsGetFailInconsistentByteCount(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect just one call to fetch a block
	id := BlockID{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData[:3])
	config.mockBserv.EXPECT().Get(id, ctxt).Return(
		encData, BlockCryptKeyServerHalf{}, nil)

	err := config.BlockOps().Get(id, ctxt, TLFCryptKey{}, nil)
	if _, ok := err.(*InconsistentByteCountError); !ok {
		t.Errorf("Unexpectedly did not get InconsistentByteCountError; "+
			"instead got %v", err)
	}
}

func TestBlockOpsGetFailGet(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// fail the fetch call
	id := BlockID{1}
	err := errors.New("Fake fail")
	ctxt := makeContext(nil)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(
		nil, BlockCryptKeyServerHalf{}, err)

	if err2 := config.BlockOps().Get(
		id, ctxt, TLFCryptKey{}, nil); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailDecryptBlockData(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to fetch a block, then fail to decrypt i
	id := BlockID{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	config.mockBserv.EXPECT().Get(id, ctxt).Return(
		encData, BlockCryptKeyServerHalf{}, nil)
	err := errors.New("Fake fail")
	var key BlockCryptKey
	expectBlockDecrypt(config, encData, key, TestBlock{}, err)

	if err2 := config.BlockOps().Get(
		id, ctxt, TLFCryptKey{}, nil); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsReadySuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	encData := []byte{1, 2, 3, 4}
	var key BlockCryptKey
	id := BlockID{1}

	expectedPlainSize := 4
	config.mockCrypto.EXPECT().EncryptBlock(decData, key).
		Return(expectedPlainSize, encData, nil)
	config.mockCrypto.EXPECT().Hash(encData).Return(
		libkb.NodeHashShort(id), nil)

	id2, plainSize, data, err := config.BlockOps().Ready(decData, key)
	if err != nil {
		t.Errorf("Got error on ready: %v", err)
	} else if id2 != id {
		t.Errorf("Got back wrong id on ready: %v", id)
	} else if plainSize != expectedPlainSize {
		t.Errorf("Expected plainSize %d, got %d", expectedPlainSize, plainSize)
	} else if string(data) != string(encData) {
		t.Errorf("Got back wrong data on get: %v", data)
	}
}

func TestBlockOpsReadyFailTooLowByteCount(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect just one call to encrypt a block
	decData := TestBlock{42}
	encData := []byte{1, 2, 3}
	var key BlockCryptKey

	config.mockCrypto.EXPECT().EncryptBlock(decData, key).
		Return(4, encData, nil)

	_, _, _, err := config.BlockOps().Ready(decData, key)
	if _, ok := err.(*TooLowByteCountError); !ok {
		t.Errorf("Unexpectedly did not get TooLowByteCountError; "+
			"instead got %v", err)
	}
}

func TestBlockOpsReadyFailEncryptBlockData(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	err := errors.New("Fake fail")
	var key BlockCryptKey

	config.mockCrypto.EXPECT().EncryptBlock(decData, key).Return(0, nil, err)

	if _, _, _, err2 := config.BlockOps().Ready(decData, key); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsReadyFailHash(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	encData := []byte{1, 2, 3, 4}
	var key BlockCryptKey
	err := errors.New("Fake fail")

	config.mockCrypto.EXPECT().EncryptBlock(decData, key).
		Return(4, encData, nil)
	config.mockCrypto.EXPECT().Hash(encData).Return(nil, err)

	if _, _, _, err2 := config.BlockOps().Ready(decData, key); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsReadyFailCast(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	encData := []byte{1, 2, 3, 4}
	var key BlockCryptKey
	badID := libkb.NodeHashLong{0}

	config.mockCrypto.EXPECT().EncryptBlock(decData, key).
		Return(4, encData, nil)
	config.mockCrypto.EXPECT().Hash(encData).Return(badID, nil)

	err := &BadCryptoError{BlockID{0}}
	if _, _, _, err2 :=
		config.BlockOps().Ready(decData, key); err2.Error() != err.Error() {
		t.Errorf("Got bad error on ready: %v (expected %v)", err2, err)
	}
}

func TestBlockOpsPutSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to put a block
	id := BlockID{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	k := BlockCryptKeyServerHalf{}
	tlfID := DirID{2}
	config.mockBserv.EXPECT().Put(id, tlfID, ctxt, encData, k).Return(nil)

	if err := config.BlockOps().Put(id, tlfID, ctxt, encData, k); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockOpsPutFailInconsistentByteCountError(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to put a block
	id := BlockID{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData[:3])
	k := BlockCryptKeyServerHalf{}
	tlfID := DirID{2}
	err := config.BlockOps().Put(id, tlfID, ctxt, encData, k)
	if _, ok := err.(*InconsistentByteCountError); !ok {
		t.Errorf("Unexpectedly did not get InconsistentByteCountError;"+
			" instead got %v", err)
	}
}

func TestBlockOpsPutFail(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// fail the put call
	id := BlockID{1}
	encData := []byte{1, 2, 3, 4}
	ctxt := makeContext(encData)
	err := errors.New("Fake fail")
	k := BlockCryptKeyServerHalf{}
	tlfID := DirID{2}
	config.mockBserv.EXPECT().Put(id, tlfID, ctxt, encData, k).Return(err)

	if err2 := config.BlockOps().Put(id, tlfID, ctxt, encData, k); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}

func TestBlockOpsDeleteSuccess(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to delete a block
	id := BlockID{1}
	ctxt := makeContext(nil)
	config.mockBserv.EXPECT().Delete(id, ctxt).Return(nil)

	if err := config.BlockOps().Delete(id, ctxt); err != nil {
		t.Errorf("Got error on put: %v", err)
	}
}

func TestBlockOpsDeleteFail(t *testing.T) {
	mockCtrl, config := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// fail the delete call
	id := BlockID{1}
	err := errors.New("Fake fail")
	ctxt := makeContext(nil)
	config.mockBserv.EXPECT().Delete(id, ctxt).Return(err)

	if err2 := config.BlockOps().Delete(id, ctxt); err2 != err {
		t.Errorf("Got bad error on put: %v", err2)
	}
}
