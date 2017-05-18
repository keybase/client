// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"testing"

	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/tlf"
)

func TestKeyCacheBasic(t *testing.T) {
	cache := NewKeyCacheStandard(10)
	id := tlf.FakeID(100, tlf.Public)
	key := kbfscrypto.MakeTLFCryptKey([32]byte{0xf})
	keyGen := FirstValidKeyGen
	_, err := cache.GetTLFCryptKey(id, keyGen)
	if _, ok := err.(KeyCacheMissError); !ok {
		t.Fatal(errors.New("expected KeyCacheMissError"))
	}
	err = cache.PutTLFCryptKey(id, keyGen, key)
	if err != nil {
		t.Fatal(err)
	}
	// add the same key twice
	err = cache.PutTLFCryptKey(id, keyGen, key)
	if err != nil {
		t.Fatal(err)
	}
	key2, err := cache.GetTLFCryptKey(id, keyGen)
	if err != nil {
		t.Fatal(err)
	}
	if key != key2 {
		t.Fatal("keys are unequal")
	}
	for i := 0; i < 11; i++ {
		id = tlf.FakeID(byte(i), tlf.Public)
		key = kbfscrypto.MakeTLFCryptKey([32]byte{byte(i)})
		err = cache.PutTLFCryptKey(id, keyGen, key)
		if err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 11; i++ {
		id = tlf.FakeID(byte(i), tlf.Public)
		key, err = cache.GetTLFCryptKey(id, keyGen)
		if i > 0 && err != nil {
			t.Fatal(err)
		}
		if i == 0 && err == nil {
			t.Fatal(errors.New("key not expected"))
		}
	}
}
