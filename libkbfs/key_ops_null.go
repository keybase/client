package libkbfs

import (
	libkb "github.com/keybase/client/go/libkb"
)

type KeyOpsNull struct {
}

// Get the server-side key half for a block
func (ko *KeyOpsNull) GetBlockKey(id BlockId) (Key, error) {
	return NullKey, nil
}

// Put the server-side key half for a block
func (ko *KeyOpsNull) PutBlockKey(id BlockId, key Key) error {
	return nil
}

// Delete the server-side key half for a block
func (ko *KeyOpsNull) DeleteBlockKey(id BlockId) error {
	return nil
}

// Get the server-side key half for a device for a given folder
func (ko *KeyOpsNull) GetDirDeviceKey(
	id DirId, keyVer int, device DeviceId) (Key, error) {
	return NullKey, nil
}

// Put the server-side key half for a device for a given folder
func (ko *KeyOpsNull) PutDirDeviceKey(
	id DirId, keyVer int, user libkb.UID, device DeviceId, key Key) error {
	return nil
}

// Get the public DH key for a given user.
// If "kid" is empty, fetch the current DH key.
func (ko *KeyOpsNull) GetPublicMacKey(user libkb.UID, kid libkb.KID) (
	Key, error) {
	return NullKey, nil
}

// Get the private DH key for the logged-in user.
// If "kid" is empty, fetch the current DH key.
func (ko *KeyOpsNull) GetMyPrivateMacKey(kid libkb.KID) (Key, error) {
	return NullKey, nil
}
