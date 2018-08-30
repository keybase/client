// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
)

type NaclSignature [ed25519.SignatureSize]byte

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte

func (k NaclSigningKeyPublic) Verify(msg []byte, sig *NaclSignature) bool {
	return ed25519.Verify(k[:], msg, sig[:])
}

const (
	KeybaseKIDV1 = 1 // Uses SHA-256
)

const (
	IDSuffixKID = 0x0a
)

func (k NaclSigningKeyPublic) GetBinaryKID() keybase1.BinaryKID {
	prefix := []byte{
		byte(KeybaseKIDV1),
		byte(KIDNaclEddsa),
	}
	suffix := byte(IDSuffixKID)
	out := append(prefix, k[:]...)
	out = append(out, suffix)
	return keybase1.BinaryKID(out)
}

func (k NaclSigningKeyPublic) GetKID() keybase1.KID {
	return k.GetBinaryKID().ToKID()
}

func KIDToNaclSigningKeyPublic(bk []byte) *NaclSigningKeyPublic {
	if len(bk) != 3+ed25519.PublicKeySize {
		return nil
	}
	if bk[0] != byte(KeybaseKIDV1) || bk[1] != byte(KIDNaclEddsa) || bk[len(bk)-1] != byte(IDSuffixKID) {
		return nil
	}
	var ret NaclSigningKeyPublic
	copy(ret[:], bk[2:len(bk)-1])
	return &ret
}
