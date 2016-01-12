// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"testing"
)

func TestSignArmor62(t *testing.T) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	smsg, err := SignArmor62(msg, key, ourBrand)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("SignArmor62 returned no error and no output")
	}

	skey, vmsg, brand, err := Dearmor62Verify(smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	brandCheck(t, brand)
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
	}
	if !bytes.Equal(vmsg, msg) {
		t.Errorf("verified msg '%x', expected '%x'", vmsg, msg)
	}
}

func TestSignDetachedArmor62(t *testing.T) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	sig, err := SignDetachedArmor62(msg, key, ourBrand)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) == 0 {
		t.Fatal("empty sig and no error from SignDetachedArmor62")
	}

	skey, brand, err := Dearmor62VerifyDetached(msg, sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	brandCheck(t, brand)
	if !KIDEqual(skey, key.PublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.PublicKey().ToKID())
	}
}
