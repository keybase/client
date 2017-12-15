// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package saltpack

import (
	"bytes"
	"testing"
)

func testSignArmor62(t *testing.T, version Version) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	smsg, err := SignArmor62(version, msg, key, ourBrand)
	if err != nil {
		t.Fatal(err)
	}
	if len(smsg) == 0 {
		t.Fatal("SignArmor62 returned no error and no output")
	}

	skey, vmsg, brand, err := Dearmor62Verify(SingleVersionValidator(version), smsg, kr)
	if err != nil {
		t.Fatal(err)
	}
	brandCheck(t, brand)
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
	if !bytes.Equal(vmsg, msg) {
		t.Errorf("verified msg '%x', expected '%x'", vmsg, msg)
	}
}

func testSignDetachedArmor62(t *testing.T, version Version) {
	msg := randomMsg(t, 128)
	key := newSigPrivKey(t)
	sig, err := SignDetachedArmor62(version, msg, key, ourBrand)
	if err != nil {
		t.Fatal(err)
	}
	if len(sig) == 0 {
		t.Fatal("empty sig and no error from SignDetachedArmor62")
	}

	skey, brand, err := Dearmor62VerifyDetached(SingleVersionValidator(version), msg, sig, kr)
	if err != nil {
		t.Fatal(err)
	}
	brandCheck(t, brand)
	if !PublicKeyEqual(skey, key.GetPublicKey()) {
		t.Errorf("signer key %x, expected %x", skey.ToKID(), key.GetPublicKey().ToKID())
	}
}

func TestArmor62Sign(t *testing.T) {
	tests := []func(*testing.T, Version){
		testSignArmor62,
		testSignDetachedArmor62,
	}
	runTestsOverVersions(t, "test", tests)
}
