package bundle

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
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
	Enc           stellar1.EncryptedBundle
	EncB64        string // base64 msgpack'd Enc
	VisB64        string // base64 msgpack'd Vis
	FormatVersion stellar1.BundleVersion
}

// Box encrypts a stellar key bundle for a PUK.
func Box(bundle stellar1.Bundle, pukGen keybase1.PerUserKeyGeneration,
	puk libkb.PerUserKeySeed) (res BoxResult, err error) {
	err = bundle.CheckInvariants()
	if err != nil {
		return res, err
	}
	accountsVisible, accountsSecret := accountsSplit(bundle.Accounts)
	res.FormatVersion = stellar1.BundleVersion_V1
	visibleV1 := stellar1.BundleVisibleV1{
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
	versionedSecret := stellar1.NewBundleSecretVersionedWithV1(stellar1.BundleSecretV1{
		VisibleHash: visibleHash[:],
		Accounts:    accountsSecret,
	})
	res.Enc, res.EncB64, err = Encrypt(versionedSecret, pukGen, puk)
	return res, err
}

// Encrypt encrypts the stellar key bundle for the PUK.
// Returns the encrypted struct and a base64 encoding for posting to the server.
// Does not check invariants.
func Encrypt(bundle stellar1.BundleSecretVersioned, pukGen keybase1.PerUserKeyGeneration,
	puk libkb.PerUserKeySeed) (res stellar1.EncryptedBundle, resB64 string, err error) {
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
	res = stellar1.EncryptedBundle{
		V:   2,
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
	Enc     stellar1.EncryptedBundle
	EncHash stellar1.Hash
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
func Unbox(g *libkb.GlobalContext, decodeRes DecodeResult, visibleBundleB64 string,
	puk libkb.PerUserKeySeed) (res stellar1.Bundle, version stellar1.BundleVersion, err error) {
	versioned, err := Decrypt(decodeRes.Enc, puk)
	if err != nil {
		return res, version, err
	}
	version, err = versioned.Version()
	if err != nil {
		return res, version, err
	}
	switch version {
	case stellar1.BundleVersion_V1:
		visiblePack, err := base64.StdEncoding.DecodeString(visibleBundleB64)
		if err != nil {
			return res, version, err
		}
		visibleHash := sha256.Sum256(visiblePack)
		secretV1 := versioned.V1()
		if !hmac.Equal(visibleHash[:], secretV1.VisibleHash) {
			return res, version, errors.New("corrupted bundle: visible hash mismatch")
		}
		var visibleV1 stellar1.BundleVisibleV1
		err = libkb.MsgpackDecode(&visibleV1, visiblePack)
		if err != nil {
			return res, version, fmt.Errorf("error unpacking visible bundle: %v", err)
		}
		res, err = merge(secretV1, visibleV1)
		if err != nil {
			return res, version, err
		}
	case stellar1.BundleVersion_V2:
		if g == nil || g.GetRunMode() == libkb.ProductionRunMode {
			return res, version, fmt.Errorf("unsupported stellar secret bundle version: %v", version)
		}
		visiblePack, err := base64.StdEncoding.DecodeString(visibleBundleB64)
		if err != nil {
			return res, version, err
		}
		visibleHash := sha256.Sum256(visiblePack)
		secretV2 := versioned.V2()
		if !hmac.Equal(visibleHash[:], secretV2.VisibleHash) {
			return res, version, errors.New("corrupted bundle: visible hash mismatch")
		}
		var visibleV2 stellar1.BundleVisibleV2
		err = libkb.MsgpackDecode(&visibleV2, visiblePack)
		if err != nil {
			return res, version, fmt.Errorf("error unpacking visible bundle: %v", err)
		}
		res, err = mergeV2(secretV2, visibleV2)
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
func Decrypt(encBundle stellar1.EncryptedBundle,
	puk libkb.PerUserKeySeed) (res stellar1.BundleSecretVersioned, err error) {
	switch encBundle.V {
	case 1:
		// CORE-8135
		return res, fmt.Errorf("stellar secret bundle encryption version 1 has been retired")
	case 2:
	default:
		return res, fmt.Errorf("unsupported stellar secret bundle encryption version: %v", encBundle.V)
	}

	// Derive key
	reason := libkb.DeriveReasonPUKStellarBundle
	symmetricKey, err := puk.DeriveSymmetricKey(reason)
	if err != nil {
		return res, err
	}

	// Secretbox
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

func accountsSplit(accounts []stellar1.BundleEntry) (vis []stellar1.BundleVisibleEntryV1, sec []stellar1.BundleSecretEntryV1) {
	for _, acc := range accounts {
		vis = append(vis, stellar1.BundleVisibleEntryV1{
			AccountID: acc.AccountID,
			Mode:      acc.Mode,
			IsPrimary: acc.IsPrimary,
		})
		sec = append(sec, stellar1.BundleSecretEntryV1{
			AccountID: acc.AccountID,
			Signers:   acc.Signers,
			Name:      acc.Name,
		})
	}
	return vis, sec
}

func merge(secret stellar1.BundleSecretV1, visible stellar1.BundleVisibleV1) (res stellar1.Bundle, err error) {
	if len(secret.Accounts) != len(visible.Accounts) {
		return res, fmt.Errorf("corrupted bundle: secret and visible have different counts")
	}
	var accounts []stellar1.BundleEntry
	for i, sec := range secret.Accounts {
		vis := visible.Accounts[i]
		if sec.AccountID != vis.AccountID {
			return res, fmt.Errorf("corrupted bundle: mismatched account ID")
		}
		accounts = append(accounts, stellar1.BundleEntry{
			AccountID: vis.AccountID,
			Mode:      vis.Mode,
			IsPrimary: vis.IsPrimary,
			Signers:   sec.Signers,
			Name:      sec.Name,
		})
	}
	return stellar1.Bundle{
		Revision: visible.Revision,
		Prev:     visible.Prev,
		Accounts: accounts,
	}, nil
}

func mergeV2(secret stellar1.BundleSecretV2, visible stellar1.BundleVisibleV2) (res stellar1.Bundle, err error) {
	if len(secret.Accounts) != len(visible.Accounts) {
		return res, errors.New("corrupted bundle: secret and visible have different counts")
	}
	accounts := make([]stellar1.BundleEntry, len(secret.Accounts))
	for i, sec := range secret.Accounts {
		vis := visible.Accounts[i]
		if sec.AccountID != vis.AccountID {
			return res, errors.New("corrupted bundle: mismatched account ID")
		}
		accounts[i] = stellar1.BundleEntry{
			AccountID: vis.AccountID,
			Mode:      vis.Mode,
			IsPrimary: vis.IsPrimary,
			Name:      sec.Name,
		}
	}
	return stellar1.Bundle{
		Revision: visible.Revision,
		Prev:     visible.Prev,
		Accounts: accounts,
	}, nil
}
