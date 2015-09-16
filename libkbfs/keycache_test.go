package libkbfs

import (
	"errors"
	"testing"
)

func TestKeyCacheBasic(t *testing.T) {
	cache := NewKeyCacheStandard(10)
	tlf := TlfID{id: [TlfIDByteLen]byte{0xf}}
	key := TLFCryptKey{Key: [32]byte{0xf}}
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
		key = TLFCryptKey{Key: [32]byte{byte(i)}}
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
