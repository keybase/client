package libkbfs

import (
	"errors"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

func keyManagerInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock, ctx context.Context) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	keyman := NewKeyManagerStandard(config)
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
		gomock.Any()).Return(TLFCryptKeyServerHalf{}, nil)
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
	config.mockKops.EXPECT().PutTLFCryptKeyServerHalves(gomock.Any(), gomock.Any()).Return(nil)
	config.mockCrypto.EXPECT().GetTLFCryptKeyServerHalfID(gomock.Any(), gomock.Any(), gomock.Any()).Return(TLFCryptKeyServerHalfID{}, nil)
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
	AddNewKeysOrBust(t, rmd, TLFKeyBundle{})

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
	AddNewKeysOrBust(t, rmd, TLFKeyBundle{})

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
	AddNewKeysOrBust(t, rmd, TLFKeyBundle{})
	AddNewKeysOrBust(t, rmd, TLFKeyBundle{})

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

func TestKeyManagerRekeyFailurePublic(t *testing.T) {
	mockCtrl, config, ctx := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeID(t, config, true)
	rmd := NewRootMetadataForTest(h, id)
	if rmd.LatestKeyGeneration() != PublicKeyGen {
		t.Errorf("Expected %d, got %d", rmd.LatestKeyGeneration(), PublicKeyGen)
	}

	if _, err := config.KeyManager().
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

	if done, err := config.KeyManager().Rekey(ctx, rmd); !done || err != nil {
		t.Errorf("Got error on rekey: %t, %v", done, err)
	} else if rmd.LatestKeyGeneration() != oldKeyGen+1 {
		t.Errorf("Bad key generation after rekey: %d", rmd.LatestKeyGeneration())
	}
}

func TestKeyManagerRekeyAddDevice(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer config1.Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer config2.Shutdown()
	uid2, err := config2.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// Create a shared folder
	h := NewTlfHandle()
	h.Writers = append(h.Writers, uid1)
	h.Writers = append(h.Writers, uid2)

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer config2Dev2.Shutdown()

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _, err =
		kbfsOps2Dev2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if _, ok := err.(ReadAccessError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// now user 1 should rekey
	err = kbfsOps1.RekeyForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// this device should be able to read now
	_, _, err = kbfsOps2Dev2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	// add a third device for user 2
	config2Dev3 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer config2Dev3.Shutdown()
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	devIndex = AddDeviceForLocalUserOrBust(t, config2Dev3, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev3, devIndex)

	// Now revoke the original user 2 device
	RevokeDeviceForLocalUserOrBust(t, config1, uid2, 0)
	RevokeDeviceForLocalUserOrBust(t, config2Dev2, uid2, 0)
	RevokeDeviceForLocalUserOrBust(t, config2Dev3, uid2, 0)

	c := make(chan struct{})
	config2Dev2.Notifier().RegisterForChanges(
		[]FolderBranch{rootNode1.GetFolderBranch()}, &testCRObserver{c, nil})

	// rekey again
	err = kbfsOps1.RekeyForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// force re-encryption of the root dir
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "b", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// wait for device 2 to see the file
	<-c

	// device 2 should still work
	rootNode2, _, err :=
		kbfsOps2Dev2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	children, err := kbfsOps2Dev2.GetDirChildren(ctx, rootNode2)
	if _, ok := children["b"]; !ok {
		t.Fatalf("Device 2 couldn't see the new dir entry")
	}

	// but device 1 should now fail
	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if _, ok := err.(ReadAccessError); !ok {
		t.Fatalf("Got unexpected error when reading with revoked key: %v", err)
	}

	// meanwhile, device 3 should be able to read both the new and the
	// old files
	kbfsOps2Dev3 := config2Dev3.KBFSOps()
	rootNode2Dev3, _, err :=
		kbfsOps2Dev3.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Fatalf("Device 3 couldn't read root: %v", err)
	}

	aNode, _, err := kbfsOps2Dev3.Lookup(ctx, rootNode2Dev3, "a")
	if err != nil {
		t.Fatalf("Device 3 couldn't lookup a: %v", err)
	}

	buf := []byte{0}
	_, err = kbfsOps2Dev3.Read(ctx, aNode, buf, 0)
	if err != nil {
		t.Fatalf("Device 3 couldn't read a: %v", err)
	}

	bNode, _, err := kbfsOps2Dev3.Lookup(ctx, rootNode2Dev3, "b")
	if err != nil {
		t.Fatalf("Device 3 couldn't lookup b: %v", err)
	}

	_, err = kbfsOps2Dev3.Read(ctx, bNode, buf, 0)
	if err != nil {
		t.Fatalf("Device 3 couldn't read b: %v", err)
	}
}
