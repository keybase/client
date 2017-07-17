// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type AlgoType int

type VerifyContext interface {
	Debug(format string, args ...interface{})
}

type RawPublicKey []byte
type RawPrivateKey []byte

type GenericKey interface {
	GetKID() keybase1.KID
	GetBinaryKID() keybase1.BinaryKID
	GetAlgoType() AlgoType

	// Sign to an ASCII signature (which includes the message
	// itself) and return it, along with a derived ID.
	SignToString(msg []byte) (sig string, id keybase1.SigID, err error)

	// Verify that the given signature is valid and extracts the
	// embedded message from it. Also returns the signature ID.
	VerifyStringAndExtract(ctx VerifyContext, sig string) (msg []byte, id keybase1.SigID, err error)

	// Verify that the given signature is valid and that its
	// embedded message matches the given one. Also returns the
	// signature ID.
	VerifyString(ctx VerifyContext, sig string, msg []byte) (id keybase1.SigID, err error)

	// Encrypt to an ASCII armored encryption; optionally include a sender's
	// (private) key so that we can provably see who sent the message.
	EncryptToString(plaintext []byte, sender GenericKey) (ciphertext string, err error)

	// Decrypt the output of Encrypt above; provide the plaintext and also
	// the KID of the key that sent the message (if applicable).
	DecryptFromString(ciphertext string) (msg []byte, sender keybase1.KID, err error)

	// Derive a secret key from a DH secret key
	SecretSymmetricKey(reason EncryptionReason) (NaclSecretBoxKey, error)

	VerboseDescription() string
	CheckSecretKey() error
	CanSign() bool
	CanEncrypt() bool
	CanDecrypt() bool
	HasSecretKey() bool
	Encode() (string, error) // encode public key to string

	// ExportPublicAndPrivate to special-purpose types so there is no way we can
	// accidentally reverse them.
	ExportPublicAndPrivate() (public RawPublicKey, private RawPrivateKey, err error)
}

func CanEncrypt(key GenericKey) bool {
	switch key.(type) {
	case NaclDHKeyPair:
		return true
	case *PGPKeyBundle:
		return true
	default:
		return false
	}
}

func skbPushAndSave(g *GlobalContext, skb *SKB, lctx LoginContext) error {
	if lctx != nil {
		kr, err := lctx.Keyring()
		if err != nil {
			return err
		}
		return kr.PushAndSave(skb)
	}
	var err error
	kerr := g.LoginState().Keyring(func(ring *SKBKeyringFile) {
		err = ring.PushAndSave(skb)
	}, "PushAndSave")
	if kerr != nil {
		return kerr
	}
	if err != nil {
		return err
	}
	return nil
}

// Any valid key matches the empty string.
func KeyMatchesQuery(key GenericKey, q string, exact bool) bool {
	if key.GetKID().Match(q, exact) {
		return true
	}
	return GetPGPFingerprintFromGenericKey(key).Match(q, exact)
}

func IsPGP(key GenericKey) bool {
	_, ok := key.(*PGPKeyBundle)
	return ok
}

func ParseGenericKey(bundle string) (GenericKey, *Warnings, error) {
	if isPGPBundle(bundle) {
		// PGP key
		return ReadOneKeyFromString(bundle)
	}
	// NaCl key
	key, err := ImportKeypairFromKID(keybase1.KIDFromString(bundle))
	return key, &Warnings{}, err
}

func isPGPBundle(armored string) bool {
	return strings.HasPrefix(armored, "-----BEGIN PGP")
}

func GenericKeyEqual(k1, k2 GenericKey) bool {
	return k1.GetKID().Equal(k2.GetKID())
}
