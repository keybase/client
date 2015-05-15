package libkbfs

import (
	"errors"
	"testing"

	"code.google.com/p/gomock/gomock"
	"github.com/keybase/client/go/libkb"
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

func expectCachedGetSecretKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetDirKey(rmd.Id, KeyVer(0)).Return(nil, nil)
}

func expectUncachedGetSecretKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetDirKey(rmd.Id, KeyVer(0)).
		Return(nil, errors.New("NONE"))

	subkey := NewFakeBoxPublicKeyOrBust("subkey")

	// get the xor'd key out of the metadata
	config.mockKbpki.EXPECT().GetDeviceSubkey().Return(subkey, nil)
	xbuf := []byte{42}
	config.mockCrypto.EXPECT().Unbox(nil, gomock.Any()).Return(xbuf, nil)
	config.mockCodec.EXPECT().Decode(xbuf, gomock.Any()).Return(nil)

	// get the server-side half and retrieve the real secret key
	config.mockKops.EXPECT().GetDirDeviceKey(
		rmd.Id, rmd.LatestKeyVersion(), KID(subkey.GetKid())).Return(nil, nil)
	config.mockCrypto.EXPECT().XOR(gomock.Any(), nil).Return(nil, nil)

	// now put the key into the cache
	config.mockKcache.EXPECT().PutDirKey(rmd.Id, rmd.LatestKeyVersion(), nil).
		Return(nil)
}

func expectUncachedGetSecretBlockKey(
	config *ConfigMock, id BlockId, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetBlockKey(id).
		Return(nil, errors.New("NONE"))

	expectCachedGetSecretKey(config, rmd)

	config.mockKops.EXPECT().GetBlockKey(id).Return(nil, nil)
	config.mockCrypto.EXPECT().XOR(nil, nil).Return(nil, nil)

	// now put the key into the cache
	config.mockKcache.EXPECT().PutBlockKey(id, nil).Return(nil)
}

func expectRekey(config *ConfigMock, rmd *RootMetadata, userId libkb.UID) {
	// generate new keys
	config.mockCrypto.EXPECT().GenRandomSecretKey().AnyTimes().Return(nil)
	config.mockCrypto.EXPECT().GenCurveKeyPair().Return(nil, nil)

	subkey := NewFakeBoxPublicKeyOrBust("subkey")
	config.mockKbpki.EXPECT().GetDeviceSubkeys(gomock.Any()).
		Return([]Key{subkey}, nil)

	// make keys for the one device
	config.mockCrypto.EXPECT().XOR(gomock.Any(), nil).Return(nil, nil)
	xbuf := []byte{42}
	config.mockCodec.EXPECT().Encode(nil).Return(xbuf, nil)
	config.mockCrypto.EXPECT().Box(nil, subkey, xbuf).Return(xbuf, nil)
	config.mockKops.EXPECT().PutDirDeviceKey(
		rmd.Id, KeyVer(1), userId, KID(subkey.GetKid()), nil).Return(nil)
	// now put the key into the cache
	config.mockKcache.EXPECT().PutDirKey(rmd.Id, KeyVer(1), nil).Return(nil)
}

func pathFromRMD(config *ConfigMock, rmd *RootMetadata) Path {
	return Path{rmd.Id, []PathNode{PathNode{
		BlockPointer{BlockId{}, rmd.data.Dir.KeyVer, 0, libkb.UID{0}, 0},
		rmd.GetDirHandle().ToString(config),
	}}}
}

func TestKeyManagerCachedSecretKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeyBundle{})

	expectCachedGetSecretKey(config, rmd)

	if _, err := config.KeyManager().GetSecretKey(
		pathFromRMD(config, rmd), rmd); err != nil {
		t.Errorf("Got error on GetSecretKey: %v", err)
	}
}

func TestKeyManagerUncachedSecretKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeyBundle{})

	expectUncachedGetSecretKey(config, rmd)

	if _, err := config.KeyManager().GetSecretKey(
		pathFromRMD(config, rmd), rmd); err != nil {
		t.Errorf("Got error on GetSecretKey: %v", err)
	}
}

func TestKeyManagerUncachedSecretBlockKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeyBundle{})
	rootId := BlockId{42}

	expectUncachedGetSecretBlockKey(config, rootId, rmd)

	if _, err := config.KeyManager().GetSecretBlockKey(
		pathFromRMD(config, rmd), rootId, rmd); err != nil {
		t.Errorf("Got error on getSecretBlockKey: %v", err)
	}
}

func TestKeyManagerGetUncachedBlockKeyFailNewKey(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	u, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)

	rmd.data.Dir.Type = Dir
	// Set the key id in the future.
	rmd.data.Dir.KeyVer = 1

	rootId := BlockId{42}
	node := PathNode{BlockPointer{rootId, 1, 0, u, 0}, ""}
	p := Path{id, []PathNode{node}}

	// we'll check the cache, but then fail before getting the read key
	expectedErr := &NewKeyVersionError{rmd.GetDirHandle().ToString(config), 1}
	config.mockKcache.EXPECT().GetBlockKey(rootId).Return(
		nil, errors.New("NOPE"))

	if _, err := config.KeyManager().GetSecretBlockKey(
		p, rootId, rmd); err == nil {
		t.Errorf("Got no expected error on GetSecretBlockKey")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on GetSecretBlockKey: %v", err)
	}
}

func TestKeyManagerRekeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer keyManagerShutdown(mockCtrl, config)

	u, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeyBundle{})

	expectRekey(config, rmd, u)

	if err := config.KeyManager().Rekey(rmd); err != nil {
		t.Errorf("Got error on rekey: %v", err)
	} else if rmd.LatestKeyVersion() != 1 {
		t.Errorf("Bad key version after rekey: %d", rmd.LatestKeyVersion())
	}
}
