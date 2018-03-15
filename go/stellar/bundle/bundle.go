package bundle

import (
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
)

/*
The box posted to the server is base64(msgpack(EncryptedStellarSecretBundle)).
EncryptedStellarSecretBundle := is secretbox(key, bundlepack, randomnonce).
key := HMAC(PUKSeed[gen], "Derived-User-NaCl-SecretBox-StellarBundle-1")
bundlepack := msgpack(StellarSecretBundleVersioned)
*/

// Box encrypts the stellar key bundle for the PUK.
// Returns the encrypted struct and a base64 encoding for posting to the server.
func Box(bundle keybase1.StellarSecretBundle, pukGen keybase1.PerUserKeyGeneration,
	puk libkb.PerUserKeySeed) (res keybase1.EncryptedStellarSecretBundle, resB64 string, err error) {
	err = bundle.CheckInvariants()
	if err != nil {
		return res, resB64, err
	}
	versioned := keybase1.NewStellarSecretBundleVersionedWithV1(keybase1.StellarSecretBundleV1{
		Revision: bundle.Revision,
		Accounts: bundle.Accounts,
	})
	return Encrypt(versioned, pukGen, puk)
}

// Encrypt encrypts the stellar key bundle for the PUK.
// Returns the encrypted struct and a base64 encoding for posting to the server.
// Does not check invariants.
func Encrypt(bundle keybase1.StellarSecretBundleVersioned, pukGen keybase1.PerUserKeyGeneration,
	puk libkb.PerUserKeySeed) (res keybase1.EncryptedStellarSecretBundle, resB64 string, err error) {
	// Msgpack (inner)
	clearpack, err := libkb.MsgpackEncode(bundle)
	if err != nil {
		return res, resB64, err
	}

	// Derive key
	symmetricKey, err := puk.DeriveSymmetricKey(libkb.DeriveReasonPUKStellarBundle)
	if err != nil {
		return res, resB64, err
	}

	// Secretbox
	var nonce [libkb.NaclDHNonceSize]byte
	nonce, err = libkb.RandomNaclDHNonce()
	if err != nil {
		return res, resB64, err
	}
	secbox := secretbox.Seal(nil, clearpack[:], &nonce, (*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))

	// Annotate
	res = keybase1.EncryptedStellarSecretBundle{
		V:   1,
		E:   secbox,
		N:   nonce,
		Gen: pukGen,
	}

	// Msgpack (inner) + b64
	cipherpack, err := libkb.MsgpackEncode(res)
	if err != nil {
		return res, resB64, err
	}
	resB64 = base64.StdEncoding.EncodeToString(cipherpack)
	return res, resB64, nil
}

// Decode decodes but does not decrypt the bundle.
// Returns `res` which is need to decrypt and `res.Gen` specifies the decryption PUK.
func Decode(encryptedBundleB64 string) (res keybase1.EncryptedStellarSecretBundle, err error) {
	cipherpack, err := base64.StdEncoding.DecodeString(encryptedBundleB64)
	if err != nil {
		return res, err
	}
	err = libkb.MsgpackDecode(&res, cipherpack)
	return res, err
}

// Unbox decrypts the stellar key bundle.
func Unbox(encryptedBundle keybase1.EncryptedStellarSecretBundle,
	puk libkb.PerUserKeySeed) (res keybase1.StellarSecretBundle, version keybase1.StellarSecretBundleVersion, err error) {
	versioned, err := Decrypt(encryptedBundle, puk)
	if err != nil {
		return res, version, err
	}
	version, err = versioned.Version()
	if err != nil {
		return res, version, err
	}
	switch version {
	case keybase1.StellarSecretBundleVersion_V1:
		v1 := versioned.V1()
		res = keybase1.StellarSecretBundle{
			Revision: v1.Revision,
			Accounts: v1.Accounts,
		}
	default:
		return res, version, fmt.Errorf("unsupported stellar secret bundle version: %v", version)
	}
	err = res.CheckInvariants()
	return res, version, err
}

// Decrypt decrypts the stellar key bundle.
// Does not check invariants.
func Decrypt(encBundle keybase1.EncryptedStellarSecretBundle,
	puk libkb.PerUserKeySeed) (res keybase1.StellarSecretBundleVersioned, err error) {
	// Derive key
	symmetricKey, err := puk.DeriveSymmetricKey(libkb.DeriveReasonPUKStellarBundle)
	if err != nil {
		return res, err
	}

	// Secretbox
	if encBundle.V != 1 {
		return res, fmt.Errorf("unsupported stellar secret bundle encryption version: %v", encBundle.V)
	}
	clearpack, ok := secretbox.Open(nil, encBundle.E,
		(*[libkb.NaclDHNonceSize]byte)(&encBundle.N),
		(*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))
	if !ok {
		return res, errors.New("stellar bundle secret box open failed")
	}

	// Msgpack (inner)
	err = libkb.MsgpackDecode(&res, clearpack)
	return res, err
}
