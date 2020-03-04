// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbcrypto

import (
	"encoding/base64"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/ed25519"
)

type NaclSignature [ed25519.SignatureSize]byte

type NaclSigningKeyPublic [ed25519.PublicKeySize]byte

func (k NaclSigningKeyPublic) Verify(msg []byte, sig NaclSignature) bool {
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

type NaclSigningKeyPrivate [ed25519.PrivateKeySize]byte

func (k NaclSigningKeyPrivate) Sign(msg []byte) NaclSignature {
	var sig NaclSignature
	copy(sig[:], ed25519.Sign(k[:], msg))
	return sig
}

func (k NaclSigningKeyPrivate) SignInfoV0(msg []byte, public NaclSigningKeyPublic) NaclSigInfo {
	// Version 0 is just over the unprefixed message (assume version 0 if no version present)
	// Version 1 is the same.
	return NaclSigInfo{
		Kid:      public.GetBinaryKID(),
		Payload:  msg,
		Sig:      k.Sign(msg),
		SigType:  SigKbEddsa,
		HashType: HashPGPSha512,
		Detached: true,
		Version:  0,
	}
}

func (k NaclSigningKeyPrivate) SignToStringV0(msg []byte, public NaclSigningKeyPublic) (string, keybase1.SigIDBase, error) {
	naclSig := k.SignInfoV0(msg, public)

	body, err := EncodePacketToBytes(&naclSig)
	if err != nil {
		return "", "", err
	}

	sig := base64.StdEncoding.EncodeToString(body)
	id := ComputeSigIDFromSigBody(body)
	return sig, id, nil
}

type BadSignaturePrefixError struct{}

func (e BadSignaturePrefixError) Error() string { return "bad signature prefix" }

func (k NaclSigningKeyPrivate) SignInfoV2(msg []byte, public NaclSigningKeyPublic, prefix SignaturePrefix) (NaclSigInfo, error) {
	if prefix.HasNullByte() || len(prefix) == 0 {
		return NaclSigInfo{}, BadSignaturePrefixError{}
	}

	// Version 0 is just over the unprefixed message (assume version 0 if no version present)
	// Version 1 is the same.
	return NaclSigInfo{
		Kid:      public.GetBinaryKID(),
		Payload:  msg,
		Sig:      k.Sign(prefix.Prefix(msg)),
		SigType:  SigKbEddsa,
		HashType: HashPGPSha512,
		Detached: true,
		Version:  2,
		Prefix:   prefix,
	}, nil
}
