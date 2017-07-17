// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build gofuzz

package libkb

import (
	"bytes"

	"github.com/keybase/client/go/libkb"
)

var kp1, kp2 libkb.NaclDHKeyPair

func init() {
	var err error
	kp1, err = libkb.GenerateNaclDHKeyPair()
	if err != nil {
		panic(err)
	}
	kp2, err = libkb.GenerateNaclDHKeyPair()
	if err != nil {
		panic(err)
	}
}

func Fuzz(data []byte) int {
	ctext, err := kp1.EncryptToString(data, nil)
	if err != nil {
		panic(err)
	}
	out, kid, err := kp1.DecryptFromString(ctext)
	if err != nil {
		panic(err)
	}
	if !bytes.Equal(out, data) {
		panic("message mismatch")
	}
	if kid.Equal(kp1.GetKID()) {
		panic("kid should be ephemeral")
	}

	ctext, err = kp2.EncryptToString(data, &kp1)
	if err != nil {
		panic(err)
	}
	out, kid, err = kp2.DecryptFromString(ctext)
	if err != nil {
		panic(err)
	}
	if !bytes.Equal(out, data) {
		panic("message mismatch")
	}
	if kid.NotEqual(kp1.GetKID()) {
		panic("KID mismatch for sender")
	}

	return 0
}
