package libkbfs

import "errors"

// KeyCacheNull is a placeholder, noop implementation of the KeyCache interface.
type KeyCacheNull struct{}

var _ KeyCache = (*KeyCacheNull)(nil)

// GetTLFCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) GetTLFCryptKey(DirID, KeyVer) (TLFCryptKey, error) {
	return TLFCryptKey{}, errors.New("NULL")
}

// PutTLFCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) PutTLFCryptKey(DirID, KeyVer, TLFCryptKey) error {
	return nil
}

// GetBlockCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) GetBlockCryptKey(id BlockID) (BlockCryptKey, error) {
	return BlockCryptKey{}, errors.New("NULL")
}

// PutBlockCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) PutBlockCryptKey(id BlockID, key BlockCryptKey) error {
	return nil
}
