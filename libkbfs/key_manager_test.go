package libkbfs

import (
	"errors"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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

func expectUncachedGetTLFCryptKey(config *ConfigMock, rmd *RootMetadata, keyGen KeyGen, uid keybase1.UID, subkey CryptPublicKey, encrypt bool) {
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
		gomock.Any(), gomock.Any()).Return(TLFCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskTLFCryptKey(TLFCryptKeyServerHalf{}, TLFCryptKeyClientHalf{}).Return(TLFCryptKey{}, nil)

	// now put the key into the cache
	if !encrypt {
		config.mockKcache.EXPECT().PutTLFCryptKey(rmd.ID, keyGen, TLFCryptKey{}).
			Return(nil)
	}
}

func expectUncachedGetTLFCryptKeyAnyDevice(config *ConfigMock, rmd *RootMetadata, keyGen KeyGen, uid keybase1.UID, subkey CryptPublicKey, encrypt bool) {
	config.mockKcache.EXPECT().GetTLFCryptKey(rmd.ID, keyGen).
		Return(TLFCryptKey{}, errors.New("NONE"))

	// get the xor'd key out of the metadata
	config.mockKbpki.EXPECT().GetCryptPublicKeys(gomock.Any(), uid).
		Return([]CryptPublicKey{subkey}, nil)
	config.mockCrypto.EXPECT().DecryptTLFCryptKeyClientHalfAny(gomock.Any(),
		gomock.Any(), false).Return(TLFCryptKeyClientHalf{}, 0, nil)

	// get the server-side half and retrieve the real secret key
	config.mockKops.EXPECT().GetTLFCryptKeyServerHalf(gomock.Any(),
		gomock.Any(), gomock.Any()).Return(TLFCryptKeyServerHalf{}, nil)
	config.mockCrypto.EXPECT().UnmaskTLFCryptKey(TLFCryptKeyServerHalf{}, TLFCryptKeyClientHalf{}).Return(TLFCryptKey{}, nil)

	// now put the key into the cache
	if !encrypt {
		config.mockKcache.EXPECT().PutTLFCryptKey(rmd.ID, keyGen, TLFCryptKey{}).
			Return(nil)
	}
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
	config.mockKops.EXPECT().PutTLFCryptKeyServerHalves(gomock.Any(), gomock.Any()).Return(nil)
	config.mockCrypto.EXPECT().GetTLFCryptKeyServerHalfID(gomock.Any(), gomock.Any(), gomock.Any()).Return(TLFCryptKeyServerHalfID{}, nil)

	// Ignore Notify and Flush calls for now
	config.mockRep.EXPECT().Notify(gomock.Any(), gomock.Any()).AnyTimes()
	config.mockKbd.EXPECT().FlushUserFromLocalCache(gomock.Any(),
		gomock.Any()).AnyTimes()
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
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())

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
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())

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
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())
	AddNewKeysOrBust(t, rmd, *NewTLFKeyBundle())

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

	expectUncachedGetTLFCryptKey(config, rmd, rmd.LatestKeyGeneration(), uid, subkey, true)

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

	expectUncachedGetTLFCryptKeyAnyDevice(config, rmd, rmd.LatestKeyGeneration(), uid, subkey, false)

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
	expectUncachedGetTLFCryptKey(config, rmd, keyGen, uid, subkey, false)

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

	if _, _, err := config.KeyManager().
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

	if done, _, err := config.KeyManager().Rekey(ctx, rmd); !done || err != nil {
		t.Errorf("Got error on rekey: %t, %v", done, err)
	} else if rmd.LatestKeyGeneration() != oldKeyGen+1 {
		t.Errorf("Bad key generation after rekey: %d", rmd.LatestKeyGeneration())
	}
}

func TestKeyManagerRekeyAddAndRevokeDevice(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)
	clock := newTestClockNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// Create a shared folder
	name := u1.String() + "," + u2.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	kbfsOps2 := config2.KBFSOps()
	rootNode2, _, err :=
		kbfsOps2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 2 creates a file
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2Dev2)

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
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// Set the KBPKI so we can count the identify calls
	countKBPKI := &daemonKBPKI{
		KBPKI:  config1.KBPKI(),
		daemon: config1.KeybaseDaemon(),
	}
	config1.SetKBPKI(countKBPKI)
	// Force the FBO to forget about its previous identify, so that we
	// can make sure the rekey doesn't trigger a full identify.
	kbfsOps1.(*KBFSOpsStandard).getOpsNoAdd(
		rootNode1.GetFolderBranch()).identifyDone = false

	// now user 1 should rekey
	err = kbfsOps1.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// Only u2 should be identified as part of the rekey.
	if g, e := countKBPKI.getIdentifyCalls(), 1; g != e {
		t.Errorf("Expected %d identify calls, but got %d", e, g)
	}

	// this device should be able to read now
	root2Dev2, _, err :=
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	// user 2 creates another file
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "c", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// add a third device for user 2
	config2Dev3 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2Dev3)
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	devIndex = AddDeviceForLocalUserOrBust(t, config2Dev3, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev3, devIndex)

	// Now revoke the original user 2 device (the last writer)
	clock.Add(1 * time.Minute)
	RevokeDeviceForLocalUserOrBust(t, config1, uid2, 0)
	RevokeDeviceForLocalUserOrBust(t, config2Dev2, uid2, 0)
	RevokeDeviceForLocalUserOrBust(t, config2Dev3, uid2, 0)

	// First request a rekey from the new device, which will only be
	// able to set the rekey bit (copying the root MD).
	err = config2Dev3.KBFSOps().Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// rekey again
	err = kbfsOps1.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// Only u2 should be identified again as part of the rekey.
	if g, e := countKBPKI.getIdentifyCalls(), 2; g != e {
		t.Errorf("Expected %d identify calls, but got %d", e, g)
	}

	// force re-encryption of the root dir
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "d", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx, root2Dev2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// device 2 should still work
	rootNode2Dev2, _, err :=
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	children, err := kbfsOps2Dev2.GetDirChildren(ctx, rootNode2Dev2)
	if _, ok := children["d"]; !ok {
		t.Fatalf("Device 2 couldn't see the new dir entry")
	}

	// But device 1 should now fail to see any updates.  TODO: when a
	// device sees it has been revoked from the TLF, we should delete
	// all its cached data and refuse to serve any more.  (However, in
	// production the device's session would likely be revoked,
	// probably leading to NoCurrentSession errors anyway.)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		// This is expected to succeed; the node will be unable to
		// deserialize the private MD, but it will still set the HEAD
		// (which lists the new set of keys) and return a nil error.
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	// Should still be seeing the old children, since the updates from
	// the latest revision were never applied.
	children, err = kbfsOps2.GetDirChildren(ctx, rootNode2)
	if _, ok := children["d"]; ok {
		t.Fatalf("Found c unexpectedly: %v", children)
	}

	// meanwhile, device 3 should be able to read both the new and the
	// old files
	kbfsOps2Dev3 := config2Dev3.KBFSOps()
	rootNode2Dev3, _, err :=
		kbfsOps2Dev3.GetOrCreateRootNode(ctx, name, false, MasterBranch)
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

	// Make sure the server-side keys for the revoked device are gone
	// for all keygens.
	rmd, err := config1.MDOps().GetForTLF(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get latest md: %v", err)
	}
	currKeyGen := rmd.LatestKeyGeneration()
	// clear the key cache
	config2.SetKeyCache(NewKeyCacheStandard(5000))
	km2, ok := config2.KeyManager().(*KeyManagerStandard)
	if !ok {
		t.Fatal("Wrong kind of key manager for config2")
	}
	for keyGen := KeyGen(FirstValidKeyGen); keyGen <= currKeyGen; keyGen++ {
		_, err = km2.getTLFCryptKeyUsingCurrentDevice(ctx, rmd, keyGen, true)
		if err == nil {
			t.Errorf("User 2 could still fetch a key for keygen %d", keyGen)
		}
	}
}

func TestKeyManagerRekeyAddWriterAndReaderDevice(t *testing.T) {
	var u1, u2, u3 libkb.NormalizedUsername = "u1", "u2", "u3"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2, u3)
	defer CheckConfigAndShutdown(t, config1)

	// Revoke user 3's device for now, to test the "other" rekey error.
	_, uid3, err := config1.KBPKI().Resolve(ctx, u3.String())
	if err != nil {
		t.Fatalf("Couldn't resolve u3: %v", err)
	}
	RevokeDeviceForLocalUserOrBust(t, config1, uid3, 0)

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// Create a shared folder
	name := u1.String() + "," + u2.String() + ReaderSep + u3.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2Dev2)

	config3 := ConfigAsUser(config1.(*ConfigLocal), u3)
	defer CheckConfigAndShutdown(t, config3)

	// Now give u2 and u3 new devices.  The configs don't share a
	// Keybase Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)
	AddDeviceForLocalUserOrBust(t, config1, uid3)
	AddDeviceForLocalUserOrBust(t, config2, uid3)
	devIndex = AddDeviceForLocalUserOrBust(t, config3, uid3)
	t.Logf("Switching to device %d", devIndex)
	SwitchDeviceForLocalUserOrBust(t, config3, devIndex)

	// Users 2 and 3 should be unable to read the data now since its
	// device wasn't registered when the folder was originally
	// created.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _, err =
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}
	kbfsOps3 := config3.KBFSOps()
	_, _, err = kbfsOps3.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedOtherRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// Set the KBPKI so we can count the identify calls
	countKBPKI := &daemonKBPKI{
		KBPKI:  config1.KBPKI(),
		daemon: config1.KeybaseDaemon(),
	}
	config1.SetKBPKI(countKBPKI)
	// Force the FBO to forget about its previous identify, so that we
	// can make sure the rekey doesn't trigger a full identify.
	kbfsOps1.(*KBFSOpsStandard).getOpsNoAdd(
		rootNode1.GetFolderBranch()).identifyDone = false

	// now user 1 should rekey
	err = kbfsOps1.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// u2 and u3 should be identified as part of the rekey.
	if g, e := countKBPKI.getIdentifyCalls(), 2; g != e {
		t.Errorf("Expected %d identify calls, but got %d", e, g)
	}

	// The new devices should be able to read now.
	_, _, err =
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	_, _, err =
		kbfsOps3.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}
}

func TestKeyManagerSelfRekeyAcrossDevices(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	t.Log("Create a shared folder")
	name := u1.String() + "," + u2.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	t.Log("User 1 creates a file")
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	t.Log("User 2 adds a device")
	// The configs don't share a Keybase Daemon so we have to do it in all
	// places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2, uid2)

	config2Dev2 := ConfigAsUser(config2, u2)
	defer CheckConfigAndShutdown(t, config2Dev2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	t.Log("Check that user 2 device 2 is unable to read the file")
	// user 2 device 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _, err =
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	t.Log("User 2 rekeys from device 1")
	kbfsOps2 := config2.KBFSOps()
	root2dev1, _, err := kbfsOps2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't obtain folder: %#v", err)
	}

	err = kbfsOps2.Rekey(ctx, root2dev1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	t.Log("User 2 device 2 should be able to read now")
	root2dev2, _, err :=
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	t.Log("User 2 device 2 reads user 1's file")
	children2, err := kbfsOps2Dev2.GetDirChildren(ctx, root2dev2)
	if _, ok := children2["a"]; !ok {
		t.Fatalf("Device 2 couldn't see user 1's dir entry")
	}

	t.Log("User 2 device 2 creates a file")
	_, _, err = kbfsOps2Dev2.CreateFile(ctx, root2dev2, "b", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	t.Log("User 1 syncs from the server")
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	t.Log("User 1 should be able to read the file that user 2 device 2 created")
	children1, err := kbfsOps1.GetDirChildren(ctx, rootNode1)
	if _, ok := children1["b"]; !ok {
		t.Fatalf("Device 1 couldn't see the new dir entry")
	}
}

func TestKeyManagerReaderRekey(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)
	_, uid1, err := config1.KBPKI().GetCurrentUserInfo(context.Background())

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	t.Log("Create a shared folder")
	name := u1.String() + ReaderSep + u2.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	t.Log("User 1 creates a file")
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	t.Log("User 1 adds a device")
	// The configs don't share a Keybase Daemon so we have to do it in all
	// places.
	AddDeviceForLocalUserOrBust(t, config1, uid1)
	devIndex := AddDeviceForLocalUserOrBust(t, config2, uid1)

	config1Dev2 := ConfigAsUser(config2, u1)
	defer CheckConfigAndShutdown(t, config1Dev2)
	SwitchDeviceForLocalUserOrBust(t, config1Dev2, devIndex)

	t.Log("User 2 adds a device")
	// The configs don't share a Keybase Daemon so we have to do it in all
	// places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config1Dev2, uid2)
	devIndex = AddDeviceForLocalUserOrBust(t, config2, uid2)

	config2Dev2 := ConfigAsUser(config2, u2)
	defer CheckConfigAndShutdown(t, config2Dev2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	t.Log("Check that user 2 device 2 is unable to read the file")
	// user 2 device 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _, err =
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	t.Log("User 2 rekeys from device 1")
	kbfsOps2 := config2.KBFSOps()
	root2dev1, _, err := kbfsOps2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't obtain folder: %#v", err)
	}

	err = kbfsOps2.Rekey(ctx, root2dev1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Expected reader rekey to partially complete. Actual error: %#v", err)
	}

	t.Log("User 2 device 2 should be able to read now")
	root2dev2, _, err :=
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	t.Log("User 1 device 2 should still be unable to read")
	kbfsOps1Dev2 := config1Dev2.KBFSOps()
	_, _, err =
		kbfsOps1Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	t.Log("User 2 device 2 reads user 1's file")
	children2, err := kbfsOps2Dev2.GetDirChildren(ctx, root2dev2)
	if _, ok := children2["a"]; !ok {
		t.Fatalf("Device 2 couldn't see user 1's dir entry")
	}
}

// This tests 2 variations of the situation where clients w/o the folder key set the rekey bit.
// In one case the client is a writer and in the other a reader. They both blindly copy the existing
// metadata and simply set the rekey bit. Then another participant rekeys the folder and they try to read.
func TestKeyManagerRekeyBit(t *testing.T) {
	var u1, u2, u3 libkb.NormalizedUsername = "u1", "u2", "u3"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2, u3)
	doShutdown1 := true
	defer func() {
		if doShutdown1 {
			CheckConfigAndShutdown(t, config1)
		}
	}()
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config3 := ConfigAsUser(config1.(*ConfigLocal), u3)
	defer CheckConfigAndShutdown(t, config3)
	_, uid3, err := config3.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	config3.MDServer().DisableRekeyUpdatesForTesting()

	// 2 writers 1 reader
	name := u1.String() + "," + u2.String() + "#" + u3.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	// we don't check the config because this device can't read all of the md blocks.
	defer config2Dev2.Shutdown()
	config2Dev2.MDServer().DisableRekeyUpdatesForTesting()

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	AddDeviceForLocalUserOrBust(t, config3, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _, err =
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// now user 2 should set the rekey bit
	err = kbfsOps2Dev2.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// user 1 syncs from server
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// user 1 should try to rekey
	err = kbfsOps1.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// user 2 syncs from server
	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// this device should be able to read now
	rootNode2Dev2, _, err := kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	// look for the file
	aNode, _, err := kbfsOps2Dev2.Lookup(ctx, rootNode2Dev2, "a")
	if err != nil {
		t.Fatalf("Device 2 couldn't lookup a: %v", err)
	}

	// read it
	buf := []byte{0}
	_, err = kbfsOps2Dev2.Read(ctx, aNode, buf, 0)
	if err != nil {
		t.Fatalf("Device 2 couldn't read a: %v", err)
	}

	config3Dev2 := ConfigAsUser(config1.(*ConfigLocal), u3)
	// we don't check the config because this device can't read all of the md blocks.
	defer config3Dev2.Shutdown()
	config3Dev2.MDServer().DisableRekeyUpdatesForTesting()

	// Now give u3 a new device.
	AddDeviceForLocalUserOrBust(t, config1, uid3)
	AddDeviceForLocalUserOrBust(t, config2, uid3)
	AddDeviceForLocalUserOrBust(t, config2Dev2, uid3)
	AddDeviceForLocalUserOrBust(t, config3, uid3)
	devIndex = AddDeviceForLocalUserOrBust(t, config3Dev2, uid3)
	SwitchDeviceForLocalUserOrBust(t, config3Dev2, devIndex)

	// user 3 dev 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	kbfsOps3Dev2 := config3Dev2.KBFSOps()
	_, _, err =
		kbfsOps3Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// now user 3 dev 2 should set the rekey bit
	err = kbfsOps3Dev2.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// user 2 dev 2 syncs from server
	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// user 2 dev 2 should try to rekey
	err = kbfsOps2Dev2.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// user 3 dev 2 syncs from server
	err = kbfsOps3Dev2.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// this device should be able to read now
	rootNode3Dev2, _, err := kbfsOps3Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	// look for the file
	a2Node, _, err := kbfsOps3Dev2.Lookup(ctx, rootNode3Dev2, "a")
	if err != nil {
		t.Fatalf("Device 3 couldn't lookup a: %v", err)
	}

	// read it
	buf = []byte{0}
	_, err = kbfsOps3Dev2.Read(ctx, a2Node, buf, 0)
	if err != nil {
		t.Fatalf("Device 3 couldn't read a: %v", err)
	}

	// Explicitly run the checks with config1 before the deferred shutdowns begin.
	// This way the shared mdserver hasn't been shutdown.
	CheckConfigAndShutdown(t, config1)
	doShutdown1 = false
}

// Two devices conflict when revoking a 3rd device.
// Test that after this both can still read the latest version of the folder.
func TestKeyManagerRekeyAddAndRevokeDeviceWithConflict(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// create a shared folder
	name := u1.String() + "," + u2.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2Dev2)

	// give user 2 a new device
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	root2Dev2, _, err :=
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// now user 1 should rekey
	err = kbfsOps1.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// this device should be able to read now
	root2Dev2, _, err =
		kbfsOps2Dev2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	// Now revoke the original user 2 device
	RevokeDeviceForLocalUserOrBust(t, config1, uid2, 0)
	RevokeDeviceForLocalUserOrBust(t, config2Dev2, uid2, 0)

	// Stall user 1's rekey, to ensure a conflict.
	onPutStalledCh, putUnstallCh, putCtx := setStallingMDOpsForPut(ctx, config1)

	// Have user 1 also try to rekey but fail due to conflict
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps1.Rekey(putCtx, rootNode1.GetFolderBranch().Tlf)
	}()
	<-onPutStalledCh

	// rekey again but with user 2 device 2
	err = kbfsOps2Dev2.Rekey(ctx, root2Dev2.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// Make sure user 1's rekey failed.
	putUnstallCh <- struct{}{}
	err = <-errChan
	if _, isConflict := err.(MDServerErrorConflictRevision); !isConflict {
		t.Fatalf("Expected failure due to conflict")
	}

	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx, root2Dev2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// force re-encryption of the root dir
	_, _, err = kbfsOps2Dev2.CreateFile(ctx, root2Dev2, "b", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// device 1 should still work
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	rootNode1, _, err =
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Got unexpected error after rekey: %v", err)
	}

	children, err := kbfsOps1.GetDirChildren(ctx, rootNode1)
	if _, ok := children["b"]; !ok {
		t.Fatalf("Device 1 couldn't see the new dir entry")
	}
}

// cryptoLocalTrapAny traps every DecryptTLFCryptKeyClientHalfAny
// call, and sends on the given channel whether each call had
// promptPaper set or not.
type cryptoLocalTrapAny struct {
	Crypto
	promptCh    chan<- bool
	cryptoToUse Crypto
}

func (clta *cryptoLocalTrapAny) DecryptTLFCryptKeyClientHalfAny(
	ctx context.Context,
	keys []EncryptedTLFCryptKeyClientAndEphemeral, promptPaper bool) (
	TLFCryptKeyClientHalf, int, error) {
	clta.promptCh <- promptPaper
	// Decrypt the key half with the given config object
	return clta.cryptoToUse.DecryptTLFCryptKeyClientHalfAny(
		ctx, keys, promptPaper)
}

func TestKeyManagerRekeyAddDeviceWithPrompt(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// Create a shared folder
	name := u1.String() + "," + u2.String()

	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	// user 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2Dev2)

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// The new device should be unable to rekey on its own, and will
	// just set the rekey bit.
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	err = kbfsOps2Dev2.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("First rekey failed %v", err)
	}

	ops := getOps(config2Dev2, rootNode1.GetFolderBranch().Tlf)
	rev1 := ops.head.Revision

	// Do it again, to simulate the mdserver sending back this node's
	// own rekey request.  This shouldn't increase the MD version.
	err = kbfsOps2Dev2.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Second rekey failed %v", err)
	}
	rev2 := ops.head.Revision

	if rev1 != rev2 {
		t.Errorf("Revision changed after second rekey: %v vs %v", rev1, rev2)
	}

	// Make sure just the rekey bit is set
	if !ops.head.IsRekeySet() {
		t.Fatalf("Couldn't set rekey bit")
	}

	c := make(chan bool)
	// Use our other device as a standin for the paper key.
	clta := &cryptoLocalTrapAny{config2Dev2.Crypto(), c, config2.Crypto()}
	config2Dev2.SetCrypto(clta)

	ops.rekeyWithPromptTimer.Reset(1 * time.Millisecond)
	promptPaper := <-c
	if !promptPaper {
		t.Fatalf("Didn't prompt paper")
	}
	<-c // called a second time for decrypting the private data

	// Take the mdWriterLock to ensure that the rekeyWithPrompt finishes.
	lState := makeFBOLockState()
	ops.mdWriterLock.Lock(lState)
	ops.mdWriterLock.Unlock(lState)

	config2Dev2.SetCrypto(clta.Crypto)
	kbfsOps2 := config2Dev2.KBFSOps()
	rootNode2, _, err :=
		kbfsOps2.GetOrCreateRootNode(ctx, name, false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}

	children, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	if _, ok := children["a"]; !ok {
		t.Fatalf("Device 2 couldn't see the dir entry after rekey")
	}
	// user 2 creates another file to make a new revision
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// device 1 should be able to read the new file
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	children, err = kbfsOps1.GetDirChildren(ctx, rootNode1)
	if _, ok := children["b"]; !ok {
		t.Fatalf("Device 2 couldn't see the dir entry after rekey")
	}
}
