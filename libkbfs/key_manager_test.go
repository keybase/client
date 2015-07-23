package libkbfs

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

func keyManagerInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	keyman := &KeyManagerStandard{config}
	config.SetKeyManager(keyman)
	ctx = context.Background()
	return
}

func keyManagerShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func expectCachedGetTLFCryptKey(config *ConfigMock, rmd *RootMetadata, keyGen KeyGen) {
	config.mockKcache.EXPECT().GetTLFCryptKey(rmd.ID, keyGen).Return(TLFCryptKey{}, nil)
}

func expectUncachedGetTLFCryptKey(config *ConfigMock, rmd *RootMetadata, keyGen KeyGen, uid keybase1.UID, subkey CryptPublicKey) {
	config.mockKcache.EXPECT().GetTLFCryptKey(rmd.ID, keyGen).
		Return(TLFCryptKey{}, errors.New("NONE"))

	// get the xor'd key out of the metadata
	config.mockKbpki.EXPECT().GetCurrentCryptPublicKey(gomock.Any()).
		Return(subkey, nil)
	config.mockCrypto.EXPECT().DecryptTLFCryptKeyClientHalf(gomock.Any(),
		TLFEphemeralPublicKey{}, gomock.Any()).
		Return(TLFCryptKeyClientHalf{}, nil)

	// get the server-side half and retrieve the real secret key
	config.mockKops.EXPECT().GetTLFCryptKeyServerHalf(gomock.Any(),
		rmd.ID, keyGen, subkey).Return(TLFCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskTLFCryptKey(TLFCryptKeyServerHalf{}, TLFCryptKeyClientHalf{}).Return(TLFCryptKey{}, nil)

	// now put the key into the cache
	config.mockKcache.EXPECT().PutTLFCryptKey(rmd.ID, keyGen, TLFCryptKey{}).
		Return(nil)
}

func expectRekey(config *ConfigMock, rmd *RootMetadata) {
	// generate new keys
	config.mockCrypto.EXPECT().MakeRandomTLFKeys().Return(TLFPublicKey{}, TLFPrivateKey{}, TLFEphemeralPublicKey{}, TLFEphemeralPrivateKey{}, TLFCryptKey{}, nil)
	config.mockCrypto.EXPECT().MakeRandomTLFCryptKeyServerHalf().Return(TLFCryptKeyServerHalf{}, nil)

	subkey := MakeFakeCryptPublicKeyOrBust("crypt public key")
	config.mockKbpki.EXPECT().GetCryptPublicKeys(gomock.Any(), gomock.Any()).
		Return([]CryptPublicKey{subkey}, nil)

	// make keys for the one device
	config.mockCrypto.EXPECT().MaskTLFCryptKey(TLFCryptKeyServerHalf{}, TLFCryptKey{}).Return(TLFCryptKeyClientHalf{}, nil)
	config.mockCrypto.EXPECT().EncryptTLFCryptKeyClientHalf(TLFEphemeralPrivateKey{}, subkey, TLFCryptKeyClientHalf{}).Return(EncryptedTLFCryptKeyClientHalf{}, nil)
	newKeyGen := rmd.LatestKeyGeneration() + 1
	config.mockKops.EXPECT().PutTLFCryptKeyServerHalf(gomock.Any(),
		rmd.ID, newKeyGen, subkey, TLFCryptKeyServerHalf{}).Return(nil)
	// now put the key into the cache
	config.mockKcache.EXPECT().PutTLFCryptKey(rmd.ID, newKeyGen, TLFCryptKey{}).Return(nil)
}

func TestKeyManagerPublicTLFCryptKey(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	id, h, _ := newDir(t, config, 1, false, true)
	rmd := NewRootMetadataForTest(h, id)

	tlfCryptKey, err := config.KeyManager().
		GetTLFCryptKeyForEncryption(ctx, rmd)
	if err != nil {
		t.Error(err)
	}

	if tlfCryptKey != PublicTLFCryptKey {
		t.Errorf("got %v, expected %v", tlfCryptKey, PublicTLFCryptKey)
	}

	tlfCryptKey, err = config.KeyManager().
		GetTLFCryptKeyForMDDecryption(ctx, rmd)
	if err != nil {
		t.Error(err)
	}

	if tlfCryptKey != PublicTLFCryptKey {
		t.Errorf("got %v, expected %v", tlfCryptKey, PublicTLFCryptKey)
	}

	tlfCryptKey, err = config.KeyManager().
		GetTLFCryptKeyForBlockDecryption(ctx, rmd, BlockPointer{})
	if err != nil {
		t.Error(err)
	}

	if tlfCryptKey != PublicTLFCryptKey {
		t.Errorf("got %v, expected %v", tlfCryptKey, PublicTLFCryptKey)
	}
}

func TestKeyManagerCachedSecretKeyForEncryptionSuccess(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)
	AddNewKeysOrBust(t, rmd, DirKeyBundle{})

	expectCachedGetTLFCryptKey(config, rmd, rmd.LatestKeyGeneration())

	if _, err := config.KeyManager().
		GetTLFCryptKeyForEncryption(ctx, rmd); err != nil {
		t.Errorf("Got error on GetTLFCryptKeyForEncryption: %v", err)
	}
}

func TestKeyManagerCachedSecretKeyForMDDecryptionSuccess(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)
	AddNewKeysOrBust(t, rmd, DirKeyBundle{})

	expectCachedGetTLFCryptKey(config, rmd, rmd.LatestKeyGeneration())

	if _, err := config.KeyManager().
		GetTLFCryptKeyForMDDecryption(ctx, rmd); err != nil {
		t.Errorf("Got error on GetTLFCryptKeyForMDDecryption: %v", err)
	}
}

func TestKeyManagerCachedSecretKeyForBlockDecryptionSuccess(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)
	AddNewKeysOrBust(t, rmd, DirKeyBundle{})
	AddNewKeysOrBust(t, rmd, DirKeyBundle{})

	keyGen := rmd.LatestKeyGeneration() - 1
	expectCachedGetTLFCryptKey(config, rmd, keyGen)

	if _, err := config.KeyManager().GetTLFCryptKeyForBlockDecryption(
		ctx, rmd, BlockPointer{KeyGen: keyGen}); err != nil {
		t.Errorf("Got error on GetTLFCryptKeyForBlockDecryption: %v", err)
	}
}

func TestKeyManagerUncachedSecretKeyForEncryptionSuccess(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	uid, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)

	subkey := MakeFakeCryptPublicKeyOrBust("crypt public key")
	AddNewKeysOrBust(t, rmd, MakeDirRKeyBundle(uid, subkey))

	expectUncachedGetTLFCryptKey(config, rmd, rmd.LatestKeyGeneration(), uid, subkey)

	if _, err := config.KeyManager().
		GetTLFCryptKeyForEncryption(ctx, rmd); err != nil {
		t.Errorf("Got error on GetTLFCryptKeyForEncryption: %v", err)
	}
}

func TestKeyManagerUncachedSecretKeyForMDDecryptionSuccess(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	uid, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)

	subkey := MakeFakeCryptPublicKeyOrBust("crypt public key")
	AddNewKeysOrBust(t, rmd, MakeDirRKeyBundle(uid, subkey))

	expectUncachedGetTLFCryptKey(config, rmd, rmd.LatestKeyGeneration(), uid, subkey)

	if _, err := config.KeyManager().
		GetTLFCryptKeyForMDDecryption(ctx, rmd); err != nil {
		t.Errorf("Got error on GetTLFCryptKeyForMDDecryption: %v", err)
	}
}

func TestKeyManagerUncachedSecretKeyForBlockDecryptionSuccess(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	uid, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)

	subkey := MakeFakeCryptPublicKeyOrBust("crypt public key")
	AddNewKeysOrBust(t, rmd, MakeDirRKeyBundle(uid, subkey))
	AddNewKeysOrBust(t, rmd, MakeDirRKeyBundle(uid, subkey))

	keyGen := rmd.LatestKeyGeneration() - 1
	expectUncachedGetTLFCryptKey(config, rmd, keyGen, uid, subkey)

	if _, err := config.KeyManager().GetTLFCryptKeyForBlockDecryption(
		ctx, rmd, BlockPointer{KeyGen: keyGen}); err != nil {
		t.Errorf("Got error on GetTLFCryptKeyForBlockDecryption: %v", err)
	}
}

func TestKeyManagerRekeySuccessPublic(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(t, config, true)
	rmd := NewRootMetadataForTest(h, id)
	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected %d, got %d", rmd.LatestKeyGeneration(), PublicKeyGen)
	}

	if err := config.KeyManager().
		Rekey(ctx, rmd); err != (InvalidPublicTLFOperation{id, "rekey"}) {
		t.Errorf("Got unexpected error on rekey: %v", err)
	}

	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected %d, got %d", rmd.LatestKeyGeneration(), PublicKeyGen)
	}
}

func TestKeyManagerRekeySuccessPrivate(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(t, config, false)
	rmd := NewRootMetadataForTest(h, id)
	oldKeyGen := rmd.LatestKeyGeneration()

	expectRekey(config, rmd)

	if err := config.KeyManager().Rekey(ctx, rmd); err != nil {
		t.Errorf("Got error on rekey: %v", err)
	} else if rmd.LatestKeyGeneration() != oldKeyGen+1 {
		t.Errorf("Bad key generation after rekey: %d", rmd.LatestKeyGeneration())
	}
}
