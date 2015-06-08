package libkbfs

import (
	"errors"
	"testing"

	"code.google.com/p/gomock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func keyManagerInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	keyman := &KeyManagerStandard{config}
	config.SetKeyManager(keyman)
	return
}

func keyManagerShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func expectCachedGetTLFCryptKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetTLFCryptKey(rmd.ID, rmd.LatestKeyGeneration()).Return(TLFCryptKey{}, nil)
}

func expectUncachedGetTLFCryptKey(config *ConfigMock, rmd *RootMetadata, uid keybase1.UID, subkey CryptPublicKey) {
	config.mockKcache.EXPECT().GetTLFCryptKey(rmd.ID, rmd.LatestKeyGeneration()).
		Return(TLFCryptKey{}, errors.New("NONE"))

	// get the xor'd key out of the metadata
	config.mockKbpki.EXPECT().GetCurrentCryptPublicKey().Return(subkey, nil)
	config.mockCrypto.EXPECT().DecryptTLFCryptKeyClientHalf(TLFEphemeralPublicKey{}, gomock.Any()).Return(TLFCryptKeyClientHalf{}, nil)

	// get the server-side half and retrieve the real secret key
	config.mockKops.EXPECT().GetTLFCryptKeyServerHalf(
		rmd.ID, rmd.LatestKeyGeneration(), subkey).Return(TLFCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskTLFCryptKey(TLFCryptKeyServerHalf{}, TLFCryptKeyClientHalf{}).Return(TLFCryptKey{}, nil)

	// now put the key into the cache
	config.mockKcache.EXPECT().PutTLFCryptKey(rmd.ID, rmd.LatestKeyGeneration(), TLFCryptKey{}).
		Return(nil)
}

func expectRekey(config *ConfigMock, rmd *RootMetadata) {
	// generate new keys
	config.mockCrypto.EXPECT().MakeRandomTLFKeys().Return(TLFPublicKey{}, TLFPrivateKey{}, TLFEphemeralPublicKey{}, TLFEphemeralPrivateKey{}, TLFCryptKey{}, nil)
	config.mockCrypto.EXPECT().MakeRandomTLFCryptKeyServerHalf().Return(TLFCryptKeyServerHalf{}, nil)

	subkey := MakeFakeCryptPublicKeyOrBust("crypt public key")
	config.mockKbpki.EXPECT().GetCryptPublicKeys(gomock.Any()).
		Return([]CryptPublicKey{subkey}, nil)

	// make keys for the one device
	config.mockCrypto.EXPECT().MaskTLFCryptKey(TLFCryptKeyServerHalf{}, TLFCryptKey{}).Return(TLFCryptKeyClientHalf{}, nil)
	config.mockCrypto.EXPECT().EncryptTLFCryptKeyClientHalf(TLFEphemeralPrivateKey{}, subkey, TLFCryptKeyClientHalf{}).Return(EncryptedTLFCryptKeyClientHalf{}, nil)
	newKeyGen := rmd.LatestKeyGeneration() + 1
	config.mockKops.EXPECT().PutTLFCryptKeyServerHalf(
		rmd.ID, newKeyGen, subkey, TLFCryptKeyServerHalf{}).Return(nil)
	// now put the key into the cache
	config.mockKcache.EXPECT().PutTLFCryptKey(rmd.ID, newKeyGen, TLFCryptKey{}).Return(nil)
}

func pathFromRMD(config *ConfigMock, rmd *RootMetadata) Path {
	return Path{rmd.ID, []PathNode{PathNode{
		BlockPointer{BlockID{}, rmd.Data().Dir.GetKeyGen(), 0, keybase1.MakeTestUID(0), 0},
		rmd.GetDirHandle().ToString(config),
	}}}
}

func TestKeyManagerCachedSecretKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(config)
	rmd := newRootMetadataForTest(h, id)
	rmd.AddNewKeys(DirKeyBundle{})

	expectCachedGetTLFCryptKey(config, rmd)

	if _, err := config.KeyManager().GetTLFCryptKey(
		pathFromRMD(config, rmd), rmd); err != nil {
		t.Errorf("Got error on GetTLFCryptKey: %v", err)
	}
}

func TestKeyManagerUncachedSecretKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	uid, id, h := makeID(config)
	rmd := newRootMetadataForTest(h, id)

	subkey := MakeFakeCryptPublicKeyOrBust("crypt public key")
	dirKeyBundle := DirKeyBundle{
		RKeys: map[keybase1.UID]map[libkb.KIDMapKey]EncryptedTLFCryptKeyClientHalf{
			uid: map[libkb.KIDMapKey]EncryptedTLFCryptKeyClientHalf{
				subkey.KID.ToMapKey(): EncryptedTLFCryptKeyClientHalf{},
			},
		},
	}
	rmd.AddNewKeys(dirKeyBundle)

	expectUncachedGetTLFCryptKey(config, rmd, uid, subkey)

	if _, err := config.KeyManager().GetTLFCryptKey(
		pathFromRMD(config, rmd), rmd); err != nil {
		t.Errorf("Got error on GetTLFCryptKey: %v", err)
	}
}

func TestKeyManagerRekeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(config)
	rmd := newRootMetadataForTest(h, id)
	oldKeyGen := rmd.LatestKeyGeneration()

	expectRekey(config, rmd)

	if err := config.KeyManager().Rekey(rmd); err != nil {
		t.Errorf("Got error on rekey: %v", err)
	} else if rmd.LatestKeyGeneration() != oldKeyGen+1 {
		t.Errorf("Bad key generation after rekey: %d", rmd.LatestKeyGeneration())
	}
}
