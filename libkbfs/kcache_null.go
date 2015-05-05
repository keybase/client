package libkbfs

import "errors"

type KeyCacheNull struct{}

func (k *KeyCacheNull) GetBlockKey(id BlockId) (Key, error) {
	return nil, errors.New("NULL")
}

func (k *KeyCacheNull) PutBlockKey(id BlockId, key Key) error {
	return nil
}

func (k *KeyCacheNull) GetDirKey(DirId, KeyVer) (Key, error) {
	return nil, errors.New("NULL")
}

func (k *KeyCacheNull) PutDirKey(DirId, KeyVer, Key) error {
	return nil
}
