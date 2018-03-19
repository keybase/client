package bundle

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
)

/*
The client posts to the server the bundle in 3 parts:
1. bundle_encrypted = b64(msgpack(EncryptedStellarBundle))
2. bundle_visible = b64(msgpack(StellarBundleVisibleV1))
3. format_version = StellarBundleSecretVersioned.Version

EncryptedStellarBundle := secretbox(key, bundlepack, randomnonce).
key := HMAC(PUKSeed[gen], "Derived-User-NaCl-SecretBox-StellarBundle-1")
bundlepack := msgpack(StellarBundleSecretVersioned)
*/

type BoxResult struct {
	Enc           keybase1.EncryptedStellarBundle
	EncB64        string // base64 msgpack'd Enc
	VisB64        string // base64 msgpack'd Vis
	FormatVersion keybase1.StellarBundleVersion
}

// Box encrypts a stellar key bundle for a PUK.
func Box(bundle keybase1.StellarBundle, pukGen keybase1.PerUserKeyGeneration,
	puk libkb.PerUserKeySeed) (res BoxResult, err error) {
	err = bundle.CheckInvariants()
	if err != nil {
		return res, err
	}
	accountsVisible, accountsSecret := accountsSplit(bundle.Accounts)
	res.FormatVersion = keybase1.StellarBundleVersion_V1
	visibleV1 := keybase1.StellarBundleVisibleV1{
		Revision: bundle.Revision,
		Prev:     bundle.Prev,
		Accounts: accountsVisible,
	}
	visiblePack, err := libkb.MsgpackEncode(visibleV1)
	if err != nil {
		return res, err
	}
	res.VisB64 = base64.StdEncoding.EncodeToString(visiblePack)
	visibleHash := sha256.Sum256(visiblePack)
	versionedSecret := keybase1.NewStellarBundleSecretVersionedWithV1(keybase1.StellarBundleSecretV1{
		VisibleHash: visibleHash[:],
		Accounts:    accountsSecret,
	})
	res.Enc, res.EncB64, err = Encrypt(versionedSecret, pukGen, puk)
	return res, err
}

// Encrypt encrypts the stellar key bundle for the PUK.
// Returns the encrypted struct and a base64 encoding for posting to the server.
// Does not check invariants.
func Encrypt(bundle keybase1.StellarBundleSecretVersioned, pukGen keybase1.PerUserKeyGeneration,
	puk libkb.PerUserKeySeed) (res keybase1.EncryptedStellarBundle, resB64 string, err error) {
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
	res = keybase1.EncryptedStellarBundle{
		V:   1,
		E:   secbox,
		N:   nonce,
		Gen: pukGen,
	}

	// Msgpack (outer) + b64
	cipherpack, err := libkb.MsgpackEncode(res)
	if err != nil {
		return res, resB64, err
	}
	resB64 = base64.StdEncoding.EncodeToString(cipherpack)
	return res, resB64, nil
}

type DecodeResult struct {
	Enc     keybase1.EncryptedStellarBundle
	EncHash keybase1.Hash
}

// Decode decodes but does not decrypt the bundle.
// Returns `res` which is needed to decrypt and `res.Gen` specifies the decryption PUK.
func Decode(encryptedBundleB64 string) (res DecodeResult, err error) {
	cipherpack, err := base64.StdEncoding.DecodeString(encryptedBundleB64)
	if err != nil {
		return res, err
	}
	encHash := sha256.Sum256(cipherpack)
	res.EncHash = encHash[:]
	err = libkb.MsgpackDecode(&res.Enc, cipherpack)
	if err != nil {
		return res, fmt.Errorf("error unpacking encrypted bundle: %v", err)
	}
	return res, nil
}

// Unbox decrypts the stellar key bundle.
// And decodes and verifies the visible bundle.
// Does not check the prev hash.
func Unbox(decodeRes DecodeResult, visibleBundleB64 string,
	puk libkb.PerUserKeySeed) (res keybase1.StellarBundle, version keybase1.StellarBundleVersion, err error) {
	versioned, err := Decrypt(decodeRes.Enc, puk)
	if err != nil {
		return res, version, err
	}
	version, err = versioned.Version()
	if err != nil {
		return res, version, err
	}
	switch version {
	case keybase1.StellarBundleVersion_V1:
		visiblePack, err := base64.StdEncoding.DecodeString(visibleBundleB64)
		if err != nil {
			return res, version, err
		}
		visibleHash := sha256.Sum256(visiblePack)
		secretV1 := versioned.V1()
		if !hmac.Equal(visibleHash[:], secretV1.VisibleHash) {
			return res, version, errors.New("corrupted bundle: visible hash mismatch")
		}
		var visibleV1 keybase1.StellarBundleVisibleV1
		err = libkb.MsgpackDecode(&visibleV1, visiblePack)
		if err != nil {
			return res, version, fmt.Errorf("error unpacking visible bundle: %v", err)
		}
		res, err = merge(secretV1, visibleV1)
		if err != nil {
			return res, version, err
		}
	default:
		return res, version, fmt.Errorf("unsupported stellar secret bundle version: %v", version)
	}
	res.OwnHash = decodeRes.EncHash
	if len(res.OwnHash) == 0 {
		return res, version, fmt.Errorf("stellar bundle missing own hash")
	}
	err = res.CheckInvariants()
	return res, version, err
}

// Decrypt decrypts the stellar key bundle.
// Does not check invariants.
func Decrypt(encBundle keybase1.EncryptedStellarBundle,
	puk libkb.PerUserKeySeed) (res keybase1.StellarBundleSecretVersioned, err error) {
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

func accountsSplit(accounts []keybase1.StellarEntry) (vis []keybase1.StellarVisibleEntry, sec []keybase1.StellarSecretEntry) {
	for _, acc := range accounts {
		vis = append(vis, keybase1.StellarVisibleEntry{
			AccountID: acc.AccountID,
			Mode:      acc.Mode,
			IsPrimary: acc.IsPrimary,
		})
		sec = append(sec, keybase1.StellarSecretEntry{
			AccountID: acc.AccountID,
			Signers:   acc.Signers,
			Name:      acc.Name,
		})
	}
	return vis, sec
}

func merge(secret keybase1.StellarBundleSecretV1, visible keybase1.StellarBundleVisibleV1) (res keybase1.StellarBundle, err error) {
	if len(secret.Accounts) != len(visible.Accounts) {
		return res, fmt.Errorf("corrupted bundle: secret and visible have different counts")
	}
	var accounts []keybase1.StellarEntry
	for i, sec := range secret.Accounts {
		vis := visible.Accounts[i]
		if sec.AccountID != vis.AccountID {
			return res, fmt.Errorf("corrupted bundle: mismatched account ID")
		}
		accounts = append(accounts, keybase1.StellarEntry{
			AccountID: vis.AccountID,
			Mode:      vis.Mode,
			IsPrimary: vis.IsPrimary,
			Signers:   sec.Signers,
			Name:      sec.Name,
		})
	}
	return keybase1.StellarBundle{
		Revision: visible.Revision,
		Prev:     visible.Prev,
		Accounts: accounts,
	}, nil
}
