// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
	"golang.org/x/crypto/ed25519"
	"golang.org/x/crypto/nacl/box"
)

// Wrap types from naclwrap.go in saltpack interfaces.

type naclBoxPublicKey NaclDHKeyPublic

var _ saltpack.BoxPublicKey = naclBoxPublicKey{}

func (b naclBoxPublicKey) ToKID() []byte {
	return b[:]
}

func (b naclBoxPublicKey) ToRawBoxKeyPointer() *saltpack.RawBoxKey {
	return (*saltpack.RawBoxKey)(&b)
}

func (b naclBoxPublicKey) CreateEphemeralKey() (saltpack.BoxSecretKey, error) {
	kp, err := GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}

	return naclBoxSecretKey(kp), nil
}

func (b naclBoxPublicKey) HideIdentity() bool {
	return false
}

type hiddenNaclBoxPublicKey NaclDHKeyPublic

func (b hiddenNaclBoxPublicKey) ToKID() []byte {
	return b[:]
}

func (b hiddenNaclBoxPublicKey) ToRawBoxKeyPointer() *saltpack.RawBoxKey {
	return (*saltpack.RawBoxKey)(&b)
}

func (b hiddenNaclBoxPublicKey) CreateEphemeralKey() (saltpack.BoxSecretKey, error) {
	kp, err := GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}

	return naclBoxSecretKey(kp), nil
}

func (b hiddenNaclBoxPublicKey) HideIdentity() bool {
	return true
}

type naclBoxPrecomputedSharedKey [32]byte

var _ saltpack.BoxPrecomputedSharedKey = naclBoxPrecomputedSharedKey{}

func (k naclBoxPrecomputedSharedKey) Unbox(nonce saltpack.Nonce, msg []byte) (
	[]byte, error) {
	ret, ok := box.OpenAfterPrecomputation(
		[]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(&k))
	if !ok {
		return nil, DecryptionError{}
	}
	return ret, nil
}

func (k naclBoxPrecomputedSharedKey) Box(nonce saltpack.Nonce, msg []byte) []byte {
	ret := box.SealAfterPrecomputation([]byte{}, msg, (*[24]byte)(&nonce), (*[32]byte)(&k))
	return ret
}

type naclBoxSecretKey NaclDHKeyPair

var _ saltpack.BoxSecretKey = naclBoxSecretKey{}

func (n naclBoxSecretKey) Box(
	receiver saltpack.BoxPublicKey, nonce saltpack.Nonce, msg []byte) []byte {
	ret := box.Seal([]byte{}, msg, (*[24]byte)(&nonce),
		(*[32]byte)(receiver.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	return ret
}

func (n naclBoxSecretKey) Unbox(
	sender saltpack.BoxPublicKey, nonce saltpack.Nonce, msg []byte) (
	[]byte, error) {
	ret, ok := box.Open([]byte{}, msg, (*[24]byte)(&nonce),
		(*[32]byte)(sender.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	if !ok {
		return nil, DecryptionError{}
	}
	return ret, nil
}

func (n naclBoxSecretKey) GetPublicKey() saltpack.BoxPublicKey {
	return naclBoxPublicKey(n.Public)
}

func (n naclBoxSecretKey) Precompute(
	sender saltpack.BoxPublicKey) saltpack.BoxPrecomputedSharedKey {
	var res naclBoxPrecomputedSharedKey
	box.Precompute((*[32]byte)(&res),
		(*[32]byte)(sender.ToRawBoxKeyPointer()),
		(*[32]byte)(n.Private))
	return res
}

// A secret key also functions as a keyring with a single key.
type naclKeyring naclBoxSecretKey

var _ saltpack.Keyring = naclKeyring{}

func (n naclKeyring) LookupBoxSecretKey(
	kids [][]byte) (int, saltpack.BoxSecretKey) {
	sk := (naclBoxSecretKey)(n)
	pkKid := sk.GetPublicKey().ToKID()
	for i, kid := range kids {
		if bytes.Equal(pkKid, kid) {
			return i, sk
		}
	}

	return -1, nil
}

func (n naclKeyring) LookupBoxPublicKey(kid []byte) saltpack.BoxPublicKey {
	var pk naclBoxPublicKey
	if len(kid) != len(pk) {
		return nil
	}
	copy(pk[:], kid)
	return pk
}

func (n naclKeyring) GetAllBoxSecretKeys() []saltpack.BoxSecretKey {
	return []saltpack.BoxSecretKey{naclBoxSecretKey(n)}
}

func (n naclKeyring) ImportBoxEphemeralKey(kid []byte) saltpack.BoxPublicKey {
	return n.LookupBoxPublicKey(kid)
}

func (n naclKeyring) CreateEphemeralKey() (saltpack.BoxSecretKey, error) {
	kp, err := GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}

	return naclBoxSecretKey(kp), nil
}

func (n naclKeyring) LookupSigningPublicKey(kid []byte) saltpack.SigningPublicKey {
	if len(kid) != ed25519.PublicKeySize {
		return nil
	}
	keyBytes := [ed25519.PublicKeySize]byte{}
	copy(keyBytes[:], kid)
	return saltSignerPublic{NaclSigningKeyPublic(keyBytes)}
}

// An empty keyring just for generating ephemeral keys.
type emptyKeyring struct{}

var _ saltpack.Keyring = emptyKeyring{}

func (e emptyKeyring) LookupBoxSecretKey(kids [][]byte) (int, saltpack.BoxSecretKey) {
	panic("unimplemented")
}

func (e emptyKeyring) LookupBoxPublicKey(kid []byte) saltpack.BoxPublicKey {
	panic("unimplemented")
}

func (e emptyKeyring) GetAllBoxSecretKeys() []saltpack.BoxSecretKey {
	panic("unimplemented")
}

func (e emptyKeyring) ImportBoxEphemeralKey(kid []byte) saltpack.BoxPublicKey {
	panic("unimplemented")
}

func (e emptyKeyring) CreateEphemeralKey() (saltpack.BoxSecretKey, error) {
	kp, err := GenerateNaclDHKeyPair()
	if err != nil {
		return nil, err
	}

	return naclBoxSecretKey(kp), nil
}

func BoxPublicKeyToKeybaseKID(k saltpack.BoxPublicKey) (ret keybase1.KID) {
	if k == nil {
		return ret
	}
	p := k.ToKID()
	return keybase1.KIDFromRawKey(p, KIDNaclDH)
}

func checkSaltpackBrand(b string) error {
	// Everything is awesome!
	return nil
}

func SaltpackVersionFromArg(saltpackVersionArg int) (saltpack.Version, error) {
	if saltpackVersionArg == 0 {
		return CurrentSaltpackVersion(), nil
	}

	// The arg specifies the major version we want, and the minor version is
	// assumed to be the latest available. Make a map to accomplish that.
	majorVersionMap := map[int]saltpack.Version{}
	for _, v := range saltpack.KnownVersions() {
		latestPair, found := majorVersionMap[v.Major]
		if !found || (v.Minor > latestPair.Minor) {
			majorVersionMap[v.Major] = v
		}
	}

	ret, found := majorVersionMap[saltpackVersionArg]
	if !found {
		return saltpack.Version{}, fmt.Errorf("failed to find saltpack major version %d", saltpackVersionArg)
	}
	return ret, nil
}
