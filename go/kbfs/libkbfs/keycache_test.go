// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfscrypto"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
)

func TestKeyCacheBasic(t *testing.T) {
	cache := NewKeyCacheStandard(10)
	id := tlf.FakeID(100, tlf.Public)
	key := kbfscrypto.MakeTLFCryptKey([32]byte{0xf})
	keyGen := kbfsmd.FirstValidKeyGen
	_, err := cache.GetTLFCryptKey(id, keyGen)
	if _, ok := err.(KeyCacheMissError); !ok {
		require.True(t, ok,
			errors.New("expected KeyCacheMissError"))
	}
	err = cache.PutTLFCryptKey(id, keyGen, key)
	require.NoError(t, err)
	// add the same key twice
	err = cache.PutTLFCryptKey(id, keyGen, key)
	require.NoError(t, err)
	key2, err := cache.GetTLFCryptKey(id, keyGen)
	require.NoError(t, err)
	require.Equal(t, key2, key,
		"keys are unequal")
	for i := range 11 {
		id = tlf.FakeID(byte(i), tlf.Public)
		key = kbfscrypto.MakeTLFCryptKey([32]byte{byte(i)})
		err = cache.PutTLFCryptKey(id, keyGen, key)
		require.NoError(t, err)
	}
	for i := range 11 {
		id = tlf.FakeID(byte(i), tlf.Public)
		_, err = cache.GetTLFCryptKey(id, keyGen)
		if i > 0 {
			require.NoError(t, err)
		} else {
			require.Error(t, err, "key not expected")
		}
	}
}
