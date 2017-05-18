// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfsblock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfshash"
	"github.com/keybase/kbfs/tlf"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// fakeKeyMetadata is an implementation of KeyMetadata that just
// stores TLFCryptKeys directly. It's meant to be used with
// fakeBlockKeyGetter.
type fakeKeyMetadata struct {
	// Embed a KeyMetadata that's always empty, so that all
	// methods besides TlfID() panic.
	KeyMetadata
	tlfID tlf.ID
	keys  []kbfscrypto.TLFCryptKey
}

var _ KeyMetadata = fakeKeyMetadata{}

// makeFakeKeyMetadata returns a fakeKeyMetadata with keys for each
// KeyGen up to latestKeyGen. The key for KeyGen i is a deterministic
// function of i, so multiple calls to this function will have the
// same keys.
func makeFakeKeyMetadata(tlfID tlf.ID, latestKeyGen KeyGen) fakeKeyMetadata {
	keys := make([]kbfscrypto.TLFCryptKey, 0,
		latestKeyGen-FirstValidKeyGen+1)
	for keyGen := FirstValidKeyGen; keyGen <= latestKeyGen; keyGen++ {
		keys = append(keys,
			kbfscrypto.MakeTLFCryptKey([32]byte{byte(keyGen)}))
	}
	return fakeKeyMetadata{nil, tlfID, keys}
}

func (kmd fakeKeyMetadata) TlfID() tlf.ID {
	return kmd.tlfID
}

type fakeBlockKeyGetter struct{}

func (kg fakeBlockKeyGetter) GetTLFCryptKeyForEncryption(
	ctx context.Context, kmd KeyMetadata) (kbfscrypto.TLFCryptKey, error) {
	fkmd := kmd.(fakeKeyMetadata)
	if len(fkmd.keys) == 0 {
		return kbfscrypto.TLFCryptKey{}, errors.New(
			"no keys for encryption")
	}
	return fkmd.keys[len(fkmd.keys)-1], nil
}

func (kg fakeBlockKeyGetter) GetTLFCryptKeyForBlockDecryption(
	ctx context.Context, kmd KeyMetadata, blockPtr BlockPointer) (
	kbfscrypto.TLFCryptKey, error) {
	fkmd := kmd.(fakeKeyMetadata)
	i := int(blockPtr.KeyGen - FirstValidKeyGen)
	if i >= len(fkmd.keys) {
		return kbfscrypto.TLFCryptKey{}, errors.Errorf(
			"no key for block decryption (keygen=%d)",
			blockPtr.KeyGen)
	}
	return fkmd.keys[i], nil
}

type testBlockOpsConfig struct {
	testCodecGetter
	logMaker
	bserver BlockServer
	cp      cryptoPure
	cache   BlockCache
	diskBlockCacheGetter
}

var _ blockOpsConfig = (*testBlockOpsConfig)(nil)

func (config testBlockOpsConfig) BlockServer() BlockServer {
	return config.bserver
}

func (config testBlockOpsConfig) cryptoPure() cryptoPure {
	return config.cp
}

func (config testBlockOpsConfig) keyGetter() blockKeyGetter {
	return fakeBlockKeyGetter{}
}

func (config testBlockOpsConfig) BlockCache() BlockCache {
	return config.cache
}

func (config testBlockOpsConfig) DataVersion() DataVer {
	return ChildHolesDataVer
}

func makeTestBlockOpsConfig(t *testing.T) testBlockOpsConfig {
	lm := newTestLogMaker(t)
	codecGetter := newTestCodecGetter()
	bserver := NewBlockServerMemory(lm.MakeLogger(""))
	crypto := MakeCryptoCommon(codecGetter.Codec())
	cache := NewBlockCacheStandard(10, getDefaultCleanBlockCacheCapacity())
	dbcg := newTestDiskBlockCacheGetter(t, nil)
	return testBlockOpsConfig{codecGetter, lm, bserver, crypto, cache, dbcg}
}

// TestBlockOpsReadySuccess checks that BlockOpsStandard.Ready()
// encrypts its given block properly.
func TestBlockOpsReadySuccess(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var latestKeyGen KeyGen = 5
	kmd := makeFakeKeyMetadata(tlfID, latestKeyGen)

	block := &FileBlock{
		Contents: []byte{1, 2, 3, 4, 5},
	}

	encodedBlock, err := config.Codec().Encode(block)
	require.NoError(t, err)

	ctx := context.Background()
	id, plainSize, readyBlockData, err := bops.Ready(ctx, kmd, block)
	require.NoError(t, err)

	require.Equal(t, len(encodedBlock), plainSize)

	err = kbfsblock.VerifyID(readyBlockData.buf, id)
	require.NoError(t, err)

	var encryptedBlock EncryptedBlock
	err = config.Codec().Decode(readyBlockData.buf, &encryptedBlock)
	require.NoError(t, err)

	blockCryptKey := kbfscrypto.UnmaskBlockCryptKey(
		readyBlockData.serverHalf,
		kmd.keys[latestKeyGen-FirstValidKeyGen])

	decryptedBlock := &FileBlock{}
	err = config.cryptoPure().DecryptBlock(
		encryptedBlock, blockCryptKey, decryptedBlock)
	require.NoError(t, err)
	decryptedBlock.SetEncodedSize(uint32(readyBlockData.GetEncodedSize()))
	require.Equal(t, block, decryptedBlock)
}

// TestBlockOpsReadyFailKeyGet checks that BlockOpsStandard.Ready()
// fails properly if we fail to retrieve the key.
func TestBlockOpsReadyFailKeyGet(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	kmd := makeFakeKeyMetadata(tlfID, 0)

	ctx := context.Background()
	_, _, _, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.EqualError(t, err, "no keys for encryption")
}

type badServerHalfMaker struct {
	cryptoPure
}

func (c badServerHalfMaker) MakeRandomBlockCryptKeyServerHalf() (
	kbfscrypto.BlockCryptKeyServerHalf, error) {
	return kbfscrypto.BlockCryptKeyServerHalf{}, errors.New(
		"could not make server half")
}

// TestBlockOpsReadyFailServerHalfGet checks that BlockOpsStandard.Ready()
// fails properly if we fail to generate a  server half.
func TestBlockOpsReadyFailServerHalfGet(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	config.cp = badServerHalfMaker{config.cryptoPure()}
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	kmd := makeFakeKeyMetadata(tlfID, FirstValidKeyGen)

	ctx := context.Background()
	_, _, _, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.EqualError(t, err, "could not make server half")
}

type badBlockEncryptor struct {
	cryptoPure
}

func (c badBlockEncryptor) EncryptBlock(
	block Block, key kbfscrypto.BlockCryptKey) (
	plainSize int, encryptedBlock EncryptedBlock, err error) {
	return 0, EncryptedBlock{}, errors.New("could not encrypt block")
}

// TestBlockOpsReadyFailEncryption checks that BlockOpsStandard.Ready()
// fails properly if we fail to encrypt the block.
func TestBlockOpsReadyFailEncryption(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	config.cp = badBlockEncryptor{config.cryptoPure()}
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	kmd := makeFakeKeyMetadata(tlfID, FirstValidKeyGen)

	ctx := context.Background()
	_, _, _, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.EqualError(t, err, "could not encrypt block")
}

type tooSmallBlockEncryptor struct {
	CryptoCommon
}

func (c tooSmallBlockEncryptor) EncryptBlock(
	block Block, key kbfscrypto.BlockCryptKey) (
	plainSize int, encryptedBlock EncryptedBlock, err error) {
	plainSize, encryptedBlock, err = c.CryptoCommon.EncryptBlock(block, key)
	if err != nil {
		return 0, EncryptedBlock{}, err
	}
	encryptedBlock.EncryptedData = nil
	return plainSize, encryptedBlock, nil
}

type badEncoder struct {
	kbfscodec.Codec
}

func (c badEncoder) Encode(o interface{}) ([]byte, error) {
	return nil, errors.New("could not encode")
}

// TestBlockOpsReadyFailEncode checks that BlockOpsStandard.Ready()
// fails properly if we fail to encode the encrypted block.
func TestBlockOpsReadyFailEncode(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	config.testCodecGetter.codec = badEncoder{config.codec}
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	kmd := makeFakeKeyMetadata(tlfID, FirstValidKeyGen)

	ctx := context.Background()
	_, _, _, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.EqualError(t, err, "could not encode")
}

type tooSmallEncoder struct {
	kbfscodec.Codec
}

func (c tooSmallEncoder) Encode(o interface{}) ([]byte, error) {
	return []byte{0x1}, nil
}

// TestBlockOpsReadyTooSmallEncode checks that
// BlockOpsStandard.Ready() fails properly if the encrypted block
// encodes to a too-small buffer.
func TestBlockOpsReadyTooSmallEncode(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	config.codec = tooSmallEncoder{config.codec}
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	kmd := makeFakeKeyMetadata(tlfID, FirstValidKeyGen)

	ctx := context.Background()
	_, _, _, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.IsType(t, TooLowByteCountError{}, err)
}

// TestBlockOpsReadySuccess checks that BlockOpsStandard.Get()
// retrieves a block properly, even if that block was encoded for a
// previous key generation.
func TestBlockOpsGetSuccess(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var keyGen KeyGen = 3
	kmd1 := makeFakeKeyMetadata(tlfID, keyGen)

	block := &FileBlock{
		Contents: []byte{1, 2, 3, 4, 5},
	}

	ctx := context.Background()
	id, _, readyBlockData, err := bops.Ready(ctx, kmd1, block)
	require.NoError(t, err)

	bCtx := kbfsblock.MakeFirstContext(
		keybase1.MakeTestUID(1).AsUserOrTeam(), keybase1.BlockType_DATA)
	err = config.bserver.Put(ctx, tlfID, id, bCtx,
		readyBlockData.buf, readyBlockData.serverHalf)
	require.NoError(t, err)

	kmd2 := makeFakeKeyMetadata(tlfID, keyGen+3)
	decryptedBlock := &FileBlock{}
	err = bops.Get(ctx, kmd2,
		BlockPointer{ID: id, KeyGen: keyGen, Context: bCtx},
		decryptedBlock, NoCacheEntry)
	require.NoError(t, err)
	require.Equal(t, block, decryptedBlock)
}

// TestBlockOpsReadySuccess checks that BlockOpsStandard.Get() fails
// if it can't retrieve the block from the server.
func TestBlockOpsGetFailServerGet(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var latestKeyGen KeyGen = 5
	kmd := makeFakeKeyMetadata(tlfID, latestKeyGen)

	ctx := context.Background()
	id, _, _, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.NoError(t, err)

	bCtx := kbfsblock.MakeFirstContext(
		keybase1.MakeTestUID(1).AsUserOrTeam(), keybase1.BlockType_DATA)
	var decryptedBlock FileBlock
	err = bops.Get(ctx, kmd,
		BlockPointer{ID: id, KeyGen: latestKeyGen, Context: bCtx},
		&decryptedBlock, NoCacheEntry)
	require.IsType(t, kbfsblock.BServerErrorBlockNonExistent{}, err)
}

type badGetBlockServer struct {
	BlockServer
}

func (bserver badGetBlockServer) Get(
	ctx context.Context, tlfID tlf.ID, id kbfsblock.ID,
	context kbfsblock.Context) (
	[]byte, kbfscrypto.BlockCryptKeyServerHalf, error) {
	buf, serverHalf, err := bserver.BlockServer.Get(ctx, tlfID, id, context)
	if err != nil {
		return nil, kbfscrypto.BlockCryptKeyServerHalf{}, nil
	}

	return append(buf, 0x1), serverHalf, nil
}

// TestBlockOpsReadyFailVerify checks that BlockOpsStandard.Get()
// fails if it can't verify the block retrieved from the server.
func TestBlockOpsGetFailVerify(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	config.bserver = badGetBlockServer{config.bserver}
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var latestKeyGen KeyGen = 5
	kmd := makeFakeKeyMetadata(tlfID, latestKeyGen)

	ctx := context.Background()
	id, _, readyBlockData, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.NoError(t, err)

	bCtx := kbfsblock.MakeFirstContext(
		keybase1.MakeTestUID(1).AsUserOrTeam(), keybase1.BlockType_DATA)
	err = config.bserver.Put(ctx, tlfID, id, bCtx,
		readyBlockData.buf, readyBlockData.serverHalf)
	require.NoError(t, err)

	var decryptedBlock FileBlock
	err = bops.Get(ctx, kmd,
		BlockPointer{ID: id, KeyGen: latestKeyGen, Context: bCtx},
		&decryptedBlock, NoCacheEntry)
	require.IsType(t, kbfshash.HashMismatchError{}, errors.Cause(err))
}

// TestBlockOpsReadyFailKeyGet checks that BlockOpsStandard.Get()
// fails if it can't get the decryption key.
func TestBlockOpsGetFailKeyGet(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var latestKeyGen KeyGen = 5
	kmd := makeFakeKeyMetadata(tlfID, latestKeyGen)

	ctx := context.Background()
	id, _, readyBlockData, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.NoError(t, err)

	bCtx := kbfsblock.MakeFirstContext(
		keybase1.MakeTestUID(1).AsUserOrTeam(), keybase1.BlockType_DATA)
	err = config.bserver.Put(ctx, tlfID, id, bCtx,
		readyBlockData.buf, readyBlockData.serverHalf)
	require.NoError(t, err)

	var decryptedBlock FileBlock
	err = bops.Get(ctx, kmd,
		BlockPointer{ID: id, KeyGen: latestKeyGen + 1, Context: bCtx},
		&decryptedBlock, NoCacheEntry)
	require.EqualError(t, err, fmt.Sprintf(
		"no key for block decryption (keygen=%d)", latestKeyGen+1))
}

// badDecoder maintains a map from stringified byte buffers to
// error. If Decode is called with a buffer that matches anything in
// the map, the corresponding error is returned.
//
// This is necessary because codec functions are used everywhere.
type badDecoder struct {
	kbfscodec.Codec

	errorsLock sync.RWMutex
	errors     map[string]error
}

func (c *badDecoder) putError(buf []byte, err error) {
	k := string(buf)
	c.errorsLock.Lock()
	c.errorsLock.Unlock()
	c.errors[k] = err
}

func (c *badDecoder) Decode(buf []byte, o interface{}) error {
	k := string(buf)
	err := func() error {
		c.errorsLock.RLock()
		defer c.errorsLock.RUnlock()
		return c.errors[k]
	}()
	if err != nil {
		return err
	}
	return c.Codec.Decode(buf, o)
}

// TestBlockOpsReadyFailDecode checks that BlockOpsStandard.Get()
// fails if it can't decode the encrypted block.
func TestBlockOpsGetFailDecode(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	badDecoder := badDecoder{
		Codec:  config.Codec(),
		errors: make(map[string]error),
	}
	config.codec = &badDecoder
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var latestKeyGen KeyGen = 5
	kmd := makeFakeKeyMetadata(tlfID, latestKeyGen)

	ctx := context.Background()
	id, _, readyBlockData, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.NoError(t, err)

	decodeErr := errors.New("could not decode")
	badDecoder.putError(readyBlockData.buf, decodeErr)

	bCtx := kbfsblock.MakeFirstContext(
		keybase1.MakeTestUID(1).AsUserOrTeam(), keybase1.BlockType_DATA)
	err = config.bserver.Put(ctx, tlfID, id, bCtx,
		readyBlockData.buf, readyBlockData.serverHalf)
	require.NoError(t, err)

	var decryptedBlock FileBlock
	err = bops.Get(ctx, kmd,
		BlockPointer{ID: id, KeyGen: latestKeyGen, Context: bCtx},
		&decryptedBlock, NoCacheEntry)
	require.Equal(t, decodeErr, err)
}

type badBlockDecryptor struct {
	cryptoPure
}

func (c badBlockDecryptor) DecryptBlock(encryptedBlock EncryptedBlock,
	key kbfscrypto.BlockCryptKey, block Block) error {
	return errors.New("could not decrypt block")
}

// TestBlockOpsReadyFailDecrypt checks that BlockOpsStandard.Get()
// fails if it can't decrypt the encrypted block.
func TestBlockOpsGetFailDecrypt(t *testing.T) {
	config := makeTestBlockOpsConfig(t)
	config.cp = badBlockDecryptor{config.cryptoPure()}
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	tlfID := tlf.FakeID(0, tlf.Private)
	var latestKeyGen KeyGen = 5
	kmd := makeFakeKeyMetadata(tlfID, latestKeyGen)

	ctx := context.Background()
	id, _, readyBlockData, err := bops.Ready(ctx, kmd, &FileBlock{})
	require.NoError(t, err)

	bCtx := kbfsblock.MakeFirstContext(
		keybase1.MakeTestUID(1).AsUserOrTeam(), keybase1.BlockType_DATA)
	err = config.bserver.Put(ctx, tlfID, id, bCtx,
		readyBlockData.buf, readyBlockData.serverHalf)
	require.NoError(t, err)

	var decryptedBlock FileBlock
	err = bops.Get(ctx, kmd,
		BlockPointer{ID: id, KeyGen: latestKeyGen, Context: bCtx},
		&decryptedBlock, NoCacheEntry)
	require.EqualError(t, err, "could not decrypt block")
}

func TestBlockOpsDeleteSuccess(t *testing.T) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	defer mockCtrl.Finish()

	bserver := NewMockBlockServer(mockCtrl)
	config := makeTestBlockOpsConfig(t)
	config.bserver = bserver
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	// Expect one call to delete several blocks.

	b1 := BlockPointer{ID: kbfsblock.FakeID(1)}
	b2 := BlockPointer{ID: kbfsblock.FakeID(2)}

	contexts := kbfsblock.ContextMap{
		b1.ID: {b1.Context},
		b2.ID: {b2.Context},
	}

	expectedLiveCounts := map[kbfsblock.ID]int{
		b1.ID: 5,
		b2.ID: 3,
	}

	ctx := context.Background()
	tlfID := tlf.FakeID(1, tlf.Private)
	bserver.EXPECT().RemoveBlockReferences(ctx, tlfID, contexts).
		Return(expectedLiveCounts, nil)

	liveCounts, err := bops.Delete(ctx, tlfID, []BlockPointer{b1, b2})
	require.NoError(t, err)
	require.Equal(t, expectedLiveCounts, liveCounts)
}

func TestBlockOpsDeleteFail(t *testing.T) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	defer mockCtrl.Finish()

	bserver := NewMockBlockServer(mockCtrl)
	config := makeTestBlockOpsConfig(t)
	config.bserver = bserver
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	b1 := BlockPointer{ID: kbfsblock.FakeID(1)}
	b2 := BlockPointer{ID: kbfsblock.FakeID(2)}

	contexts := kbfsblock.ContextMap{
		b1.ID: {b1.Context},
		b2.ID: {b2.Context},
	}

	// Fail the delete call.

	ctx := context.Background()
	tlfID := tlf.FakeID(1, tlf.Private)
	expectedErr := errors.New("Fake fail")
	bserver.EXPECT().RemoveBlockReferences(ctx, tlfID, contexts).
		Return(nil, expectedErr)

	_, err := bops.Delete(ctx, tlfID, []BlockPointer{b1, b2})
	require.Equal(t, expectedErr, err)
}

func TestBlockOpsArchiveSuccess(t *testing.T) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	defer func() {
		ctr.CheckForFailures()
		mockCtrl.Finish()
	}()

	bserver := NewMockBlockServer(mockCtrl)
	config := makeTestBlockOpsConfig(t)
	config.bserver = bserver
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	// Expect one call to archive several blocks.

	b1 := BlockPointer{ID: kbfsblock.FakeID(1)}
	b2 := BlockPointer{ID: kbfsblock.FakeID(2)}

	contexts := kbfsblock.ContextMap{
		b1.ID: {b1.Context},
		b2.ID: {b2.Context},
	}

	ctx := context.Background()
	tlfID := tlf.FakeID(1, tlf.Private)
	bserver.EXPECT().ArchiveBlockReferences(ctx, tlfID, contexts).
		Return(nil)

	err := bops.Archive(ctx, tlfID, []BlockPointer{b1, b2})
	require.NoError(t, err)
}

func TestBlockOpsArchiveFail(t *testing.T) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	defer func() {
		ctr.CheckForFailures()
		mockCtrl.Finish()
	}()

	bserver := NewMockBlockServer(mockCtrl)
	config := makeTestBlockOpsConfig(t)
	config.bserver = bserver
	bops := NewBlockOpsStandard(config, testBlockRetrievalWorkerQueueSize)
	defer bops.Shutdown()

	b1 := BlockPointer{ID: kbfsblock.FakeID(1)}
	b2 := BlockPointer{ID: kbfsblock.FakeID(2)}

	contexts := kbfsblock.ContextMap{
		b1.ID: {b1.Context},
		b2.ID: {b2.Context},
	}

	// Fail the archive call.

	ctx := context.Background()
	tlfID := tlf.FakeID(1, tlf.Private)
	expectedErr := errors.New("Fake fail")
	bserver.EXPECT().ArchiveBlockReferences(ctx, tlfID, contexts).
		Return(expectedErr)

	err := bops.Archive(ctx, tlfID, []BlockPointer{b1, b2})
	require.Equal(t, expectedErr, err)
}
