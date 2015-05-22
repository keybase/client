package libkbfs

import "errors"

type KeyCacheNull struct{}

var _ KeyCache = (*KeyCacheNull)(nil)

func (k *KeyCacheNull) GetTLFCryptKey(DirId, KeyVer) (TLFCryptKey, error) {
	return TLFCryptKey{}, errors.New("NULL")
}

func (k *KeyCacheNull) PutTLFCryptKey(DirId, KeyVer, TLFCryptKey) error {
	return nil
}

func (k *KeyCacheNull) GetBlockCryptKey(id BlockId) (BlockCryptKey, error) {
	return BlockCryptKey{}, errors.New("NULL")
}

func (k *KeyCacheNull) PutBlockCryptKey(id BlockId, key BlockCryptKey) error {
	return nil
}
