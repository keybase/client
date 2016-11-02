// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

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

// TODO: Add test coverage for decryption of blocks with an old key
// generation.

func expectGetTLFCryptKeyForBlockDecryption(
	config *ConfigMock, kmd KeyMetadata, blockPtr BlockPointer) {
	config.mockKeyman.EXPECT().GetTLFCryptKeyForBlockDecryption(gomock.Any(),
		kmdMatcher{kmd}, blockPtr).Return(kbfscrypto.TLFCryptKey{}, nil)
}

type TestBlock struct {
	A int
}

func (TestBlock) DataVersion() DataVer {
	return FirstValidDataVer
}

func (tb TestBlock) GetEncodedSize() uint32 {
	return 0
}

func (tb TestBlock) SetEncodedSize(size uint32) {
}

func blockOpsInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	bops := &BlockOpsStandard{config}
	config.SetBlockOps(bops)
	ctx = context.Background()
	return
}

func blockOpsShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func expectBlockEncrypt(config *ConfigMock, kmd KeyMetadata, decData Block, plainSize int, encData []byte, err error) {
	expectGetTLFCryptKeyForEncryption(config, kmd)
	config.mockCrypto.EXPECT().MakeRandomBlockCryptKeyServerHalf().
		Return(kbfscrypto.BlockCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(
		kbfscrypto.BlockCryptKeyServerHalf{},
		kbfscrypto.TLFCryptKey{}).Return(
		kbfscrypto.BlockCryptKey{}, nil)
	encryptedBlock := EncryptedBlock{
		EncryptedData: encData,
	}
	config.mockCrypto.EXPECT().EncryptBlock(decData,
		kbfscrypto.BlockCryptKey{}).
		Return(plainSize, encryptedBlock, err)
	if err == nil {
		config.mockCodec.EXPECT().Encode(encryptedBlock).Return(encData, nil)
	}
}

func expectBlockDecrypt(config *ConfigMock, kmd KeyMetadata, blockPtr BlockPointer, encData []byte, block TestBlock, err error) {
	config.mockCrypto.EXPECT().VerifyBlockID(encData, blockPtr.ID).Return(nil)
	expectGetTLFCryptKeyForBlockDecryption(config, kmd, blockPtr)
	config.mockCrypto.EXPECT().UnmaskBlockCryptKey(gomock.Any(), gomock.Any()).
		Return(kbfscrypto.BlockCryptKey{}, nil)
	config.mockCodec.EXPECT().Decode(encData, gomock.Any()).Return(nil)
	config.mockCrypto.EXPECT().DecryptBlock(
		gomock.Any(), kbfscrypto.BlockCryptKey{}, gomock.Any()).
		Do(func(encryptedBlock EncryptedBlock,
			key kbfscrypto.BlockCryptKey, b Block) {
			if b != nil {
				tb := b.(*TestBlock)
				*tb = block
			}
		}).Return(err)
}

type emptyKeyMetadata struct {
	tlfID  tlf.ID
	keyGen KeyGen
}

var _ KeyMetadata = emptyKeyMetadata{}

func (kmd emptyKeyMetadata) TlfID() tlf.ID {
	return kmd.tlfID
}

// GetTlfHandle just returns nil. This contradicts the requirements
// for KeyMetadata, but emptyKeyMetadata shouldn't be used in contexts
// that actually use GetTlfHandle().
func (kmd emptyKeyMetadata) GetTlfHandle() *TlfHandle {
	return nil
}

func (kmd emptyKeyMetadata) LatestKeyGeneration() KeyGen {
	return kmd.keyGen
}

func (kmd emptyKeyMetadata) HasKeyForUser(
	keyGen KeyGen, user keybase1.UID) bool {
	return false
}

func (kmd emptyKeyMetadata) GetTLFCryptKeyParams(
	keyGen KeyGen, user keybase1.UID, key kbfscrypto.CryptPublicKey) (
	kbfscrypto.TLFEphemeralPublicKey, EncryptedTLFCryptKeyClientHalf,
	TLFCryptKeyServerHalfID, bool, error) {
	return kbfscrypto.TLFEphemeralPublicKey{},
		EncryptedTLFCryptKeyClientHalf{},
		TLFCryptKeyServerHalfID{}, false, nil
}

func (kmd emptyKeyMetadata) StoresHistoricTLFCryptKeys() bool {
	return false
}

func (kmd emptyKeyMetadata) GetHistoricTLFCryptKey(
	crypto cryptoPure, keyGen KeyGen, key kbfscrypto.TLFCryptKey) (
	kbfscrypto.TLFCryptKey, error) {
	return kbfscrypto.TLFCryptKey{}, nil
}

func makeKMD() KeyMetadata {
	return emptyKeyMetadata{tlf.FakeID(0, false), 1}
}

func TestBlockOpsGetSuccess(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	kmd := makeKMD()

	// expect one call to fetch a block, and one to decrypt it
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}
	config.mockBserv.EXPECT().Get(ctx, kmd.TlfID(), id, blockPtr.BlockContext).Return(
		encData, kbfscrypto.BlockCryptKeyServerHalf{}, nil)
	decData := TestBlock{42}

	expectBlockDecrypt(config, kmd, blockPtr, encData, decData, nil)

	var gotBlock TestBlock
	err := config.BlockOps().Get(ctx, kmd, blockPtr, &gotBlock)
	if err != nil {
		t.Fatalf("Got error on get: %v", err)
	}

	if gotBlock != decData {
		t.Errorf("Got back wrong block data on get: %v", gotBlock)
	}
}

func TestBlockOpsGetFailGet(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	kmd := makeKMD()
	// fail the fetch call
	id := fakeBlockID(1)
	err := errors.New("Fake fail")
	blockPtr := BlockPointer{ID: id}
	config.mockBserv.EXPECT().Get(ctx, kmd.TlfID(), id, blockPtr.BlockContext).Return(
		nil, kbfscrypto.BlockCryptKeyServerHalf{}, err)

	if err2 := config.BlockOps().Get(
		ctx, kmd, blockPtr, nil); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailVerify(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	kmd := makeKMD()
	// fail the fetch call
	id := fakeBlockID(1)
	err := errors.New("Fake verification fail")
	blockPtr := BlockPointer{ID: id}
	encData := []byte{1, 2, 3}
	config.mockBserv.EXPECT().Get(ctx, kmd.TlfID(), id, blockPtr.BlockContext).Return(
		encData, kbfscrypto.BlockCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().VerifyBlockID(encData, id).Return(err)

	if err2 := config.BlockOps().Get(
		ctx, kmd, blockPtr, nil); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsGetFailDecryptBlockData(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	kmd := makeKMD()
	// expect one call to fetch a block, then fail to decrypt
	id := fakeBlockID(1)
	encData := []byte{1, 2, 3, 4}
	blockPtr := BlockPointer{ID: id}
	config.mockBserv.EXPECT().Get(ctx, kmd.TlfID(), id, blockPtr.BlockContext).Return(
		encData, kbfscrypto.BlockCryptKeyServerHalf{}, nil)
	err := errors.New("Fake fail")

	expectBlockDecrypt(config, kmd, blockPtr, encData, TestBlock{}, err)

	if err2 := config.BlockOps().Get(
		ctx, kmd, blockPtr, nil); err2 != err {
		t.Errorf("Got bad error: %v", err2)
	}
}

func TestBlockOpsReadySuccess(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	encData := []byte{1, 2, 3, 4}
	id := fakeBlockID(1)

	kmd := makeKMD()

	expectedPlainSize := 4
	expectBlockEncrypt(config, kmd, decData, expectedPlainSize, encData, nil)
	config.mockCrypto.EXPECT().MakePermanentBlockID(encData).Return(id, nil)

	id2, plainSize, readyBlockData, err :=
		config.BlockOps().Ready(ctx, kmd, decData)
	if err != nil {
		t.Errorf("Got error on ready: %v", err)
	} else if id2 != id {
		t.Errorf("Got back wrong id on ready: %v", id)
	} else if plainSize != expectedPlainSize {
		t.Errorf("Expected plainSize %d, got %d", expectedPlainSize, plainSize)
	} else if string(readyBlockData.buf) != string(encData) {
		t.Errorf("Got back wrong data on get: %v", readyBlockData.buf)
	}
}

func TestBlockOpsReadyFailTooLowByteCount(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect just one call to encrypt a block
	decData := TestBlock{42}
	encData := []byte{1, 2, 3}

	kmd := makeKMD()

	expectBlockEncrypt(config, kmd, decData, 4, encData, nil)

	_, _, _, err := config.BlockOps().Ready(ctx, kmd, decData)
	if _, ok := err.(TooLowByteCountError); !ok {
		t.Errorf("Unexpectedly did not get TooLowByteCountError; "+
			"instead got %v", err)
	}
}

func TestBlockOpsReadyFailEncryptBlockData(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	err := errors.New("Fake fail")

	kmd := makeKMD()

	expectBlockEncrypt(config, kmd, decData, 0, nil, err)

	if _, _, _, err2 := config.BlockOps().Ready(
		ctx, kmd, decData); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsReadyFailMakePermanentBlockID(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to encrypt a block, one to hash it
	decData := TestBlock{42}
	encData := []byte{1, 2, 3, 4}
	err := errors.New("Fake fail")

	kmd := makeKMD()

	expectBlockEncrypt(config, kmd, decData, 4, encData, nil)

	config.mockCrypto.EXPECT().MakePermanentBlockID(encData).Return(fakeBlockID(0), err)

	if _, _, _, err2 := config.BlockOps().Ready(
		ctx, kmd, decData); err2 != err {
		t.Errorf("Got bad error on ready: %v", err2)
	}
}

func TestBlockOpsDeleteSuccess(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// expect one call to delete several blocks

	contexts := make(map[BlockID][]BlockContext)
	b1 := BlockPointer{ID: fakeBlockID(1)}
	contexts[b1.ID] = []BlockContext{b1.BlockContext}
	b2 := BlockPointer{ID: fakeBlockID(2)}
	contexts[b2.ID] = []BlockContext{b2.BlockContext}
	blockPtrs := []BlockPointer{b1, b2}
	var liveCounts map[BlockID]int
	tlfID := tlf.FakeID(1, false)
	config.mockBserv.EXPECT().RemoveBlockReferences(ctx, tlfID, contexts).
		Return(liveCounts, nil)

	if _, err := config.BlockOps().Delete(
		ctx, tlfID, blockPtrs); err != nil {
		t.Errorf("Got error on delete: %v", err)
	}
}

func TestBlockOpsDeleteFail(t *testing.T) {
	mockCtrl, config, ctx := blockOpsInit(t)
	defer blockOpsShutdown(mockCtrl, config)

	// fail the delete call

	contexts := make(map[BlockID][]BlockContext)
	b1 := BlockPointer{ID: fakeBlockID(1)}
	contexts[b1.ID] = []BlockContext{b1.BlockContext}
	b2 := BlockPointer{ID: fakeBlockID(2)}
	contexts[b2.ID] = []BlockContext{b2.BlockContext}
	blockPtrs := []BlockPointer{b1, b2}
	err := errors.New("Fake fail")
	var liveCounts map[BlockID]int
	tlfID := tlf.FakeID(1, false)
	config.mockBserv.EXPECT().RemoveBlockReferences(ctx, tlfID, contexts).
		Return(liveCounts, err)

	if _, err2 := config.BlockOps().Delete(
		ctx, tlfID, blockPtrs); err2 != err {
		t.Errorf("Got bad error on delete: %v", err2)
	}
}
