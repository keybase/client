// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"testing"

	"github.com/keybase/kbfs/kbfscrypto"
)

func TestKeyCacheBasic(t *testing.T) {
	cache := NewKeyCacheStandard(10)
	tlf := TlfID{id: [TlfIDByteLen]byte{0xf}}
	key := kbfscrypto.MakeTLFCryptKey([32]byte{0xf})
	keyGen := KeyGen(1)
	_, err := cache.GetTLFCryptKey(tlf, keyGen)
	if _, ok := err.(KeyCacheMissError); !ok {
		t.Fatal(errors.New("expected KeyCacheMissError"))
	}
	err = cache.PutTLFCryptKey(tlf, keyGen, key)
	if err != nil {
		t.Fatal(err)
	}
	// add the same key twice
	err = cache.PutTLFCryptKey(tlf, keyGen, key)
	if err != nil {
		t.Fatal(err)
	}
	key2, err := cache.GetTLFCryptKey(tlf, keyGen)
	if err != nil {
		t.Fatal(err)
	}
	if key != key2 {
		t.Fatal("keys are unequal")
	}
	for i := 0; i < 11; i++ {
		tlf = TlfID{id: [TlfIDByteLen]byte{byte(i)}}
		key = kbfscrypto.MakeTLFCryptKey([32]byte{byte(i)})
		err = cache.PutTLFCryptKey(tlf, keyGen, key)
		if err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 11; i++ {
		tlf = TlfID{id: [TlfIDByteLen]byte{byte(i)}}
		key, err = cache.GetTLFCryptKey(tlf, keyGen)
		if i > 0 && err != nil {
			t.Fatal(err)
		}
		if i == 0 && err == nil {
			t.Fatal(errors.New("key not expected"))
		}
	}
}
