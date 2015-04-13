package libkbfs

import (
	"errors"
	"testing"

	"code.google.com/p/gomock/gomock"
	libkb "github.com/keybase/client/go/libkb"
)

func keyManagerInit(t *testing.T) (mockCtrl *gomock.Controller,
	config *ConfigMock) {
	mockCtrl = gomock.NewController(t)
	config = NewConfigMock(mockCtrl)
	keyman := &KeyManagerStandard{config}
	config.SetKeyManager(keyman)
	return
}

func expectCachedGetSecretKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetDirKey(rmd.Id, 0).Return(NullKey, nil)
}

func expectUncachedGetSecretKey(config *ConfigMock, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetDirKey(rmd.Id, 0).
		Return(NullKey, errors.New("NONE"))

	// get the xor'd key out of the metadata
	config.mockKbpki.EXPECT().GetActiveDeviceId().Return(DeviceId(0), nil)
	xbuf := []byte{42}
	config.mockCrypto.EXPECT().Unbox(NullKey, gomock.Any()).Return(xbuf, nil)
	config.mockCodec.EXPECT().Decode(xbuf, gomock.Any()).Return(nil)

	// get the server-side half and retrieve the real secret key
	config.mockKops.EXPECT().GetDirDeviceKey(
		rmd.Id, rmd.LatestKeyId(), DeviceId(0)).Return(NullKey, nil)
	config.mockCrypto.EXPECT().XOR(gomock.Any(), NullKey).Return(NullKey, nil)

	// now put the key into the cache
	config.mockKcache.EXPECT().PutDirKey(rmd.Id, rmd.LatestKeyId(), NullKey).
		Return(nil)
}

func expectUncachedGetSecretBlockKey(
	config *ConfigMock, id BlockId, rmd *RootMetadata) {
	config.mockKcache.EXPECT().GetBlockKey(id).
		Return(NullKey, errors.New("NONE"))

	expectCachedGetSecretKey(config, rmd)

	config.mockKops.EXPECT().GetBlockKey(id).Return(NullKey, nil)
	config.mockCrypto.EXPECT().XOR(NullKey, NullKey).Return(NullKey, nil)

	// now put the key into the cache
	config.mockKcache.EXPECT().PutBlockKey(id, NullKey).Return(nil)
}

func expectRekey(config *ConfigMock, rmd *RootMetadata, userId libkb.UID) {
	// generate new keys
	config.mockCrypto.EXPECT().GenRandomSecretKey().AnyTimes().Return(NullKey)
	config.mockCrypto.EXPECT().GenCurveKeyPair().Return(NullKey, NullKey)

	subkeys := make(map[DeviceId]Key)
	subkeys[0] = NullKey
	config.mockKbpki.EXPECT().GetDeviceSubKeys(gomock.Any()).
		Return(subkeys, nil)

	// make keys for the one device
	config.mockCrypto.EXPECT().XOR(gomock.Any(), NullKey).Return(NullKey, nil)
	xbuf := []byte{42}
	config.mockCodec.EXPECT().Encode(NullKey).Return(xbuf, nil)
	config.mockCrypto.EXPECT().Box(NullKey, NullKey, xbuf).Return(xbuf, nil)
	config.mockKops.EXPECT().PutDirDeviceKey(
		rmd.Id, 1, userId, DeviceId(0), NullKey).Return(nil)
	// now put the key into the cache
	config.mockKcache.EXPECT().PutDirKey(rmd.Id, 1, NullKey).Return(nil)
}

func pathFromRMD(config *ConfigMock, rmd *RootMetadata) Path {
	return Path{rmd.Id, []*PathNode{&PathNode{
		BlockPointer{BlockId{}, rmd.data.Dir.KeyId, 0, libkb.UID{0}, 0},
		rmd.GetDirHandle().ToString(config),
	}}}
}

func TestKeyManagerCachedSecretKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer mockCtrl.Finish()

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeys{})

	expectCachedGetSecretKey(config, rmd)

	if _, err := config.KeyManager().GetSecretKey(
		pathFromRMD(config, rmd), rmd); err != nil {
		t.Errorf("Got error on GetSecretKey: %v", err)
	}
}

func TestKeyManagerUncachedSecretKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer mockCtrl.Finish()

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeys{})

	expectUncachedGetSecretKey(config, rmd)

	if _, err := config.KeyManager().GetSecretKey(
		pathFromRMD(config, rmd), rmd); err != nil {
		t.Errorf("Got error on GetSecretKey: %v", err)
	}
}

func TestKeyManagerUncachedSecretBlockKeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer mockCtrl.Finish()

	_, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeys{})
	rootId := BlockId{42}

	expectUncachedGetSecretBlockKey(config, rootId, rmd)

	if _, err := config.KeyManager().GetSecretBlockKey(
		pathFromRMD(config, rmd), rootId, rmd); err != nil {
		t.Errorf("Got error on getSecretBlockKey: %v", err)
	}
}

func TestKeyManagerGetUncachedBlockKeyFailNewKey(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer mockCtrl.Finish()

	u, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)

	rmd.data.Dir.IsDir = true
	// Set the key id in the future.
	rmd.data.Dir.KeyId = 1

	rootId := BlockId{42}
	node := &PathNode{BlockPointer{rootId, 1, 0, u, 0}, ""}
	p := Path{id, []*PathNode{node}}

	// we'll check the cache, but then fail before getting the read key
	expectedErr := &NewKeyError{rmd.GetDirHandle().ToString(config), 1}
	config.mockKcache.EXPECT().GetBlockKey(rootId).Return(
		NullKey, errors.New("NOPE"))

	if _, err := config.KeyManager().GetSecretBlockKey(
		p, rootId, rmd); err == nil {
		t.Errorf("Got no expected error on GetSecretBlockKey")
	} else if err.Error() != expectedErr.Error() {
		t.Errorf("Got unexpected error on GetSecretBlockKey: %v", err)
	}
}

func TestKeyManagerRekeySuccess(t *testing.T) {
	mockCtrl, config := keyManagerInit(t)
	defer mockCtrl.Finish()

	u, id, h := makeId(config)
	rmd := NewRootMetadata(h, id)
	rmd.AddNewKeys(DirKeys{})

	expectRekey(config, rmd, u)

	if err := config.KeyManager().Rekey(rmd); err != nil {
		t.Errorf("Got error on rekey: %v", err)
	} else if rmd.LatestKeyId() != 1 {
		t.Errorf("Bad key version after rekey: %d", rmd.LatestKeyId())
	}
}
