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
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("sender key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
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
			if !KIDEqual(skey, key.PublicKey()) {
				t.Errorf("sender key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
			}
			if !bytes.Equal(msg, in) {
				t.Errorf("verified msg '%x', expected '%x'", msg, in)
			}
			wg.Done()
		}()
	}
	wg.Wait()
}

/*
func TestVerifyFuzzCrash(t *testing.T) {
	b, err := hex.DecodeString(kid)
	if err != nil {
		panic(err)
	}
	var k [ed25519.PublicKeySize]byte
	copy(k[:], b)
	key := newSigPubKey(k)

	bmsg := []byte(fmsg)
	Verify(bmsg, singleKeyring{key})
}

type singleKeyring struct {
	*sigPubKey
}

func (k singleKeyring) LookupSigningPublicKey(kid []byte) SigningPublicKey {
	// for the sake of fuzzing, just return this key all the time
	return k
}
*/
