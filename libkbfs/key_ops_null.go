package libkbfs

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

type KeyOpsNull struct {
}

var _ KeyOps = (*KeyOpsNull)(nil)

func (ko *KeyOpsNull) GetBlockCryptKeyServerHalf(id BlockId) (BlockCryptKeyServerHalf, error) {
	return BlockCryptKeyServerHalf{}, nil
}

func (ko *KeyOpsNull) PutBlockCryptKeyServerHalf(id BlockId, serverHalf BlockCryptKeyServerHalf) error {
	return nil
}

func (ko *KeyOpsNull) DeleteBlockCryptKeyServerHalf(id BlockId) error {
	return nil
}

func (ko *KeyOpsNull) GetTLFCryptKeyServerHalf(
	id DirId, keyVer KeyVer, cryptPublicKey CryptPublicKey) (TLFCryptKeyServerHalf, error) {
	return TLFCryptKeyServerHalf{}, nil
}

func (ko *KeyOpsNull) PutTLFCryptKeyServerHalf(
	id DirId, keyVer KeyVer, user keybase1.UID, cryptPublicKey CryptPublicKey, serverHalf TLFCryptKeyServerHalf) error {
	return nil
}

func (k *KeyOpsNull) GetMacPublicKey(uid keybase1.UID) (MacPublicKey, error) {
	return MacPublicKey{}, nil
}
