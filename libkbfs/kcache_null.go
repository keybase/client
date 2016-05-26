// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import "errors"

// KeyCacheNull is a placeholder, noop implementation of the KeyCache interface.
type KeyCacheNull struct{}

var _ KeyCache = (*KeyCacheNull)(nil)

// GetTLFCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) GetTLFCryptKey(TlfID, KeyGen) (TLFCryptKey, error) {
	return TLFCryptKey{}, errors.New("NULL")
}

// PutTLFCryptKey implements the KeyCache interface for KeyCacheNull.
func (k *KeyCacheNull) PutTLFCryptKey(TlfID, KeyGen, TLFCryptKey) error {
	return nil
}
