// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"sync"
	"testing"
)

func TestVerify(t *testing.T) {
	in := randomMsg(t, 128)
	key := newSigPrivKey(t)
	smsg, err := Sign(in, key)
	if err != nil {
		t.Fatal(err)
	}
	skey, msg, err := Verify(smsg, kr)
	if err != nil {
		t.Logf("input:      %x", in)
		t.Logf("signed msg: %x", smsg)
		t.Fatal(err)
	}
	if !kidEqual(skey, key.GetPublicKey()) {
		t.Errorf("sender key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
	if !bytes.Equal(msg, in) {
		t.Errorf("verified msg '%x', expected '%x'", msg, in)
	}
}

func TestVerifyConcurrent(t *testing.T) {
	in := randomMsg(t, 128)
	key := newSigPrivKey(t)
	smsg, err := Sign(in, key)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			skey, msg, err := Verify(smsg, kr)
			if err != nil {
				t.Logf("input:      %x", in)
				t.Logf("signed msg: %x", smsg)
				t.Error(err)
			}
			if !kidEqual(skey, key.GetPublicKey()) {
				t.Errorf("sender key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
			}
			if !bytes.Equal(msg, in) {
				t.Errorf("verified msg '%x', expected '%x'", msg, in)
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

func TestVerifyEmptyKeyring(t *testing.T) {
	in := randomMsg(t, 128)
	key := newSigPrivKey(t)
	smsg, err := Sign(in, key)
	if err != nil {
		t.Fatal(err)
	}

	_, _, err = Verify(smsg, emptySigKeyring{})
	if err == nil {
		t.Fatal("Verify worked with empty keyring")
	}
	if err != ErrNoSenderKey {
		t.Errorf("error: %v, expected ErrNoSenderKey", err)
	}
}

func TestVerifyDetachedEmptyKeyring(t *testing.T) {
	key := newSigPrivKey(t)
	msg := randomMsg(t, 128)
	sig, err := SignDetached(msg, key)
	if err != nil {
		t.Fatal(err)
	}

	_, err = VerifyDetached(msg, sig, emptySigKeyring{})
	if err == nil {
		t.Fatal("VerifyDetached worked with empty keyring")
	}
	if err != ErrNoSenderKey {
		t.Errorf("error: %v, expected ErrNoSenderKey", err)
	}
}

type emptySigKeyring struct{}

func (k emptySigKeyring) LookupSigningPublicKey(kid []byte) SigningPublicKey { return nil }
