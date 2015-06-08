package libkbfs

import "errors"

// KeyCacheNull is a placeholder, noop implementation of the KeyCache interface.
type KeyCacheNull struct{}

var _ KeyCache = (*KeyCacheNull)(nil)

// GetTLFCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) GetTLFCryptKey(DirID, KeyGen) (TLFCryptKey, error) {
	return TLFCryptKey{}, errors.New("NULL")
}

// PutTLFCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) PutTLFCryptKey(DirID, KeyGen, TLFCryptKey) error {
	return nil
}
