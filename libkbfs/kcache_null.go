package libkbfs

import "errors"

type KeyCacheNull struct{}

func (k *KeyCacheNull) GetBlockKey(id BlockId) (Key, error) {
	return Key{}, errors.New("NULL")
}

func (k *KeyCacheNull) PutBlockKey(id BlockId, key Key) error {
	return nil
}

func (k *KeyCacheNull) GetDirKey(DirId, int) (Key, error) {
	return Key{}, errors.New("NULL")
}

func (k *KeyCacheNull) PutDirKey(DirId, int, Key) error {
	return nil
}
