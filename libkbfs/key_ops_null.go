package libkbfs

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

// KeyOpsNull is a placeholder for a proper KeyOps implements in the future.
type KeyOpsNull struct {
}

var _ KeyOps = (*KeyOpsNull)(nil)

// GetBlockCryptKeyServerHalf implements the KeyOps interface for KeyOpsNull.
func (ko *KeyOpsNull) GetBlockCryptKeyServerHalf(id BlockID) (BlockCryptKeyServerHalf, error) {
	return BlockCryptKeyServerHalf{}, nil
}

// PutBlockCryptKeyServerHalf implements the KeyOps interface for KeyOpsNull.
func (ko *KeyOpsNull) PutBlockCryptKeyServerHalf(id BlockID, serverHalf BlockCryptKeyServerHalf) error {
	return nil
}

// DeleteBlockCryptKeyServerHalf implements the KeyOps interface for KeyOpsNull.
func (ko *KeyOpsNull) DeleteBlockCryptKeyServerHalf(id BlockID) error {
	return nil
}

// GetTLFCryptKeyServerHalf implements the KeyOps interface for KeyOpsNull.
func (ko *KeyOpsNull) GetTLFCryptKeyServerHalf(
	id DirID, keyVer KeyVer, cryptPublicKey CryptPublicKey) (TLFCryptKeyServerHalf, error) {
	return TLFCryptKeyServerHalf{}, nil
}

// PutTLFCryptKeyServerHalf implements the KeyOps interface for KeyOpsNull.
func (ko *KeyOpsNull) PutTLFCryptKeyServerHalf(
	id DirID, keyVer KeyVer, user keybase1.UID, cryptPublicKey CryptPublicKey, serverHalf TLFCryptKeyServerHalf) error {
	return nil
}

// GetMacPublicKey implements the KeyOps interface for KeyOpsNull.
func (ko *KeyOpsNull) GetMacPublicKey(uid keybase1.UID) (MacPublicKey, error) {
	return MacPublicKey{}, nil
}
