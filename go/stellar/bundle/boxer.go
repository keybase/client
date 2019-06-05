package bundle

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/crypto/nacl/secretbox"
)

// BoxedEncoded is the result of boxing and encoding a Bundle object.
type BoxedEncoded struct {
	EncParent           stellar1.EncryptedBundle
	EncParentB64        string // base64 msgpacked Enc
	VisParentB64        string
	FormatVersionParent stellar1.BundleVersion
	AcctBundles         map[stellar1.AccountID]AcctBoxedEncoded
}

func newBoxedEncoded() *BoxedEncoded {
	return &BoxedEncoded{
		FormatVersionParent: stellar1.BundleVersion_V2,
		AcctBundles:         make(map[stellar1.AccountID]AcctBoxedEncoded),
	}
}

func newVisibleParent(a *stellar1.Bundle, accountsVisible []stellar1.BundleVisibleEntryV2) stellar1.BundleVisibleV2 {
	return stellar1.BundleVisibleV2{
		Revision: a.Revision,
		Prev:     a.Prev,
		Accounts: accountsVisible,
	}
}

func (b BoxedEncoded) toBundleEncodedB64() BundleEncoded {
	benc := BundleEncoded{
		EncParent:   b.EncParentB64,
		VisParent:   b.VisParentB64,
		AcctBundles: make(map[stellar1.AccountID]string),
	}

	for acctID, acctBundle := range b.AcctBundles {
		benc.AcctBundles[acctID] = acctBundle.EncB64
	}

	return benc
}

// BundleEncoded contains all the encoded fields for communicating
// with the api server to post and get account bundles.
type BundleEncoded struct {
	EncParent           string                        `json:"encrypted_parent"` // base64 msgpacked Enc
	VisParent           string                        `json:"visible_parent"`
	FormatVersionParent stellar1.BundleVersion        `json:"version_parent"`
	AcctBundles         map[stellar1.AccountID]string `json:"account_bundles"`
}

// BoxAndEncode encrypts and encodes a Bundle object.
func BoxAndEncode(a *stellar1.Bundle, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (*BoxedEncoded, error) {
	err := a.CheckInvariants()
	if err != nil {
		return nil, err
	}

	accountsVisible, accountsSecret := visibilitySplit(a)

	// visible portion parent
	visibleV2 := newVisibleParent(a, accountsVisible)

	boxed := newBoxedEncoded()

	// encrypted account bundles
	for i, acctEntry := range visibleV2.Accounts {
		secret, ok := a.AccountBundles[acctEntry.AccountID]
		if !ok {
			continue
		}
		ab, err := accountBoxAndEncode(acctEntry.AccountID, secret, pukGen, puk)
		if err != nil {
			return nil, err
		}
		boxed.AcctBundles[acctEntry.AccountID] = *ab

		visibleV2.Accounts[i].EncAcctBundleHash = ab.EncHash
	}

	// have to do this after to get hashes of encrypted account bundles
	visiblePack, err := msgpack.Encode(visibleV2)
	if err != nil {
		return nil, err
	}
	visibleHash := sha256.Sum256(visiblePack)
	boxed.VisParentB64 = base64.StdEncoding.EncodeToString(visiblePack)

	// secret portion parent
	versionedSecret := stellar1.NewBundleSecretVersionedWithV2(stellar1.BundleSecretV2{
		VisibleHash: visibleHash[:],
		Accounts:    accountsSecret,
	})
	boxed.EncParent, boxed.EncParentB64, err = parentBoxAndEncode(versionedSecret, pukGen, puk)
	if err != nil {
		return nil, err
	}

	return boxed, nil
}

func visibilitySplit(a *stellar1.Bundle) ([]stellar1.BundleVisibleEntryV2, []stellar1.BundleSecretEntryV2) {
	vis := make([]stellar1.BundleVisibleEntryV2, len(a.Accounts))
	sec := make([]stellar1.BundleSecretEntryV2, len(a.Accounts))
	for i, acct := range a.Accounts {
		vis[i] = stellar1.BundleVisibleEntryV2{
			AccountID:          acct.AccountID,
			Mode:               acct.Mode,
			IsPrimary:          acct.IsPrimary,
			AcctBundleRevision: acct.AcctBundleRevision,
			EncAcctBundleHash:  acct.EncAcctBundleHash,
		}
		sec[i] = stellar1.BundleSecretEntryV2{
			AccountID: acct.AccountID,
			Name:      acct.Name,
		}
	}
	return vis, sec
}

func parentBoxAndEncode(bundle stellar1.BundleSecretVersioned, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (stellar1.EncryptedBundle, string, error) {
	// Msgpack (inner)
	clearpack, err := msgpack.Encode(bundle)
	if err != nil {
		return stellar1.EncryptedBundle{}, "", err
	}

	// Derive key
	symmetricKey, err := puk.DeriveSymmetricKey(libkb.DeriveReasonPUKStellarBundle)
	if err != nil {
		return stellar1.EncryptedBundle{}, "", err
	}

	// Secretbox
	var nonce [libkb.NaclDHNonceSize]byte
	nonce, err = libkb.RandomNaclDHNonce()
	if err != nil {
		return stellar1.EncryptedBundle{}, "", err
	}
	secbox := secretbox.Seal(nil, clearpack, &nonce, (*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))

	// Annotate
	res := stellar1.EncryptedBundle{
		V:   2,
		E:   secbox,
		N:   nonce,
		Gen: pukGen,
	}

	// Msgpack (outer) + b64
	cipherpack, err := msgpack.Encode(res)
	if err != nil {
		return stellar1.EncryptedBundle{}, "", err
	}
	resB64 := base64.StdEncoding.EncodeToString(cipherpack)
	return res, resB64, nil
}

// AcctBoxedEncoded is the result of boxing and encoding the per-account secrets.
type AcctBoxedEncoded struct {
	Enc           stellar1.EncryptedAccountBundle
	EncHash       stellar1.Hash
	EncB64        string // base64 msgpacked Enc
	FormatVersion stellar1.AccountBundleVersion
}

func accountBoxAndEncode(accountID stellar1.AccountID, accountBundle stellar1.AccountBundle, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (*AcctBoxedEncoded, error) {
	versionedSecret := stellar1.NewAccountBundleSecretVersionedWithV1(stellar1.AccountBundleSecretV1{
		AccountID: accountID,
		Signers:   accountBundle.Signers,
	})

	encBundle, b64, err := accountEncrypt(versionedSecret, pukGen, puk)
	if err != nil {
		return nil, err
	}

	encPack, err := msgpack.Encode(encBundle)
	if err != nil {
		return nil, err
	}
	encHash := sha256.Sum256(encPack)

	res := AcctBoxedEncoded{Enc: encBundle, EncHash: encHash[:], EncB64: b64, FormatVersion: 1}

	return &res, nil
}

// PukFinder helps this package find puks.
type PukFinder interface {
	SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error)
}

type AccountPukGens map[stellar1.AccountID](keybase1.PerUserKeyGeneration)

// DecodeAndUnbox decodes the encrypted and visible encoded bundles and unboxes
// the encrypted bundle using PukFinder to find the correct puk. It combines
// the results into a stellar1.Bundle and also returns additional information
// about the bundle: its version, pukGen, and the pukGens of each of the
// decrypted account secrets.
func DecodeAndUnbox(m libkb.MetaContext, finder PukFinder, encodedBundle BundleEncoded) (*stellar1.Bundle, stellar1.BundleVersion, keybase1.PerUserKeyGeneration, AccountPukGens, error) {
	accountPukGens := make(AccountPukGens)
	encBundle, hash, err := decodeParent(encodedBundle.EncParent)
	if err != nil {
		return nil, 0, 0, accountPukGens, err
	}

	puk, err := finder.SeedByGeneration(m, encBundle.Gen)
	if err != nil {
		return nil, 0, 0, accountPukGens, err
	}

	parent, parentVersion, err := unboxParent(encBundle, hash, encodedBundle.VisParent, puk)
	if err != nil {
		return nil, 0, 0, accountPukGens, err
	}
	parent.AccountBundles = make(map[stellar1.AccountID]stellar1.AccountBundle)
	for _, parentEntry := range parent.Accounts {
		if acctEncB64, ok := encodedBundle.AcctBundles[parentEntry.AccountID]; ok {
			acctBundle, acctGen, err := decodeAndUnboxAcctBundle(m, finder, acctEncB64, parentEntry)
			accountPukGens[parentEntry.AccountID] = acctGen
			if err != nil {
				return nil, 0, 0, accountPukGens, err
			}
			if acctBundle == nil {
				return nil, 0, 0, accountPukGens, fmt.Errorf("error unboxing account bundle: missing for account %s", parentEntry.AccountID)
			}

			parent.AccountBundles[parentEntry.AccountID] = *acctBundle
		}
	}
	if err = parent.CheckInvariants(); err != nil {
		return nil, 0, 0, accountPukGens, err
	}
	return parent, parentVersion, encBundle.Gen, accountPukGens, nil
}

func decodeAndUnboxAcctBundle(m libkb.MetaContext, finder PukFinder, encB64 string, parentEntry stellar1.BundleEntry) (*stellar1.AccountBundle, keybase1.PerUserKeyGeneration, error) {
	eab, hash, err := decode(encB64)
	if err != nil {
		return nil, 0, err
	}

	if !libkb.SecureByteArrayEq(hash, parentEntry.EncAcctBundleHash) {
		return nil, 0, errors.New("account bundle and parent entry hash mismatch")
	}

	puk, err := finder.SeedByGeneration(m, eab.Gen)
	if err != nil {
		return nil, 0, err
	}
	ab, _, err := unbox(eab, hash, puk)
	if err != nil {
		return nil, 0, err
	}
	if ab.AccountID != parentEntry.AccountID {
		return nil, 0, errors.New("account bundle and parent entry account ID mismatch")
	}
	return ab, eab.Gen, nil
}

// accountEncrypt encrypts the stellar account key bundle for the PUK.
// Returns the encrypted struct and a base64 encoding for posting to the server.
// Does not check invariants.
func accountEncrypt(bundle stellar1.AccountBundleSecretVersioned, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (res stellar1.EncryptedAccountBundle, resB64 string, err error) {
	// Msgpack (inner)
	clearpack, err := msgpack.Encode(bundle)
	if err != nil {
		return res, resB64, err
	}

	// Derive key
	symmetricKey, err := puk.DeriveSymmetricKey(libkb.DeriveReasonPUKStellarAcctBundle)
	if err != nil {
		return res, resB64, err
	}

	// Secretbox
	var nonce [libkb.NaclDHNonceSize]byte
	nonce, err = libkb.RandomNaclDHNonce()
	if err != nil {
		return res, resB64, err
	}
	secbox := secretbox.Seal(nil, clearpack, &nonce, (*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))

	// Annotate
	res = stellar1.EncryptedAccountBundle{
		V:   1,
		E:   secbox,
		N:   nonce,
		Gen: pukGen,
	}

	// Msgpack (outer) + b64
	cipherpack, err := msgpack.Encode(res)
	if err != nil {
		return res, resB64, err
	}
	resB64 = base64.StdEncoding.EncodeToString(cipherpack)
	return res, resB64, nil
}

// decodeParent decodes a base64-encoded encrypted parent bundle.
func decodeParent(encryptedB64 string) (stellar1.EncryptedBundle, stellar1.Hash, error) {
	cipherpack, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return stellar1.EncryptedBundle{}, stellar1.Hash{}, err
	}
	encHash := sha256.Sum256(cipherpack)
	var enc stellar1.EncryptedBundle
	if err = msgpack.Decode(&enc, cipherpack); err != nil {
		return stellar1.EncryptedBundle{}, stellar1.Hash{}, err
	}
	return enc, encHash[:], nil
}

// unboxParent unboxes an encrypted parent bundle and decodes the visual portion of the bundle.
// It validates the visible hash in the secret portion.
func unboxParent(encBundle stellar1.EncryptedBundle, hash stellar1.Hash, visB64 string, puk libkb.PerUserKeySeed) (*stellar1.Bundle, stellar1.BundleVersion, error) {
	versioned, err := decryptParent(encBundle, puk)
	if err != nil {
		return nil, 0, err
	}
	version, err := versioned.Version()
	if err != nil {
		return nil, 0, err
	}

	var bundleOut stellar1.Bundle
	switch version {
	case stellar1.BundleVersion_V2:
		bundleOut, err = unboxParentV2(versioned, visB64)
		if err != nil {
			return nil, 0, err
		}
	default:
		return nil, 0, fmt.Errorf("unsupported parent bundle version: %d", version)
	}

	bundleOut.OwnHash = hash
	if len(bundleOut.OwnHash) == 0 {
		return nil, 0, errors.New("stellar account bundle missing own hash")
	}

	return &bundleOut, version, nil
}

func unboxParentV2(versioned stellar1.BundleSecretVersioned, visB64 string) (stellar1.Bundle, error) {
	var empty stellar1.Bundle
	visiblePack, err := base64.StdEncoding.DecodeString(visB64)
	if err != nil {
		return empty, err
	}
	visibleHash := sha256.Sum256(visiblePack)
	secretV2 := versioned.V2()
	if !hmac.Equal(visibleHash[:], secretV2.VisibleHash) {
		return empty, errors.New("corrupted bundle: visible hash mismatch")
	}
	var visibleV2 stellar1.BundleVisibleV2
	err = msgpack.Decode(&visibleV2, visiblePack)
	if err != nil {
		return empty, err
	}
	return merge(secretV2, visibleV2)
}

// decryptParent decrypts an encrypted parent bundle with the provided puk.
func decryptParent(encBundle stellar1.EncryptedBundle, puk libkb.PerUserKeySeed) (res stellar1.BundleSecretVersioned, err error) {
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
	err = msgpack.Decode(&res, clearpack)
	return res, err
}

// decode decodes a base64-encoded encrypted account bundle.
func decode(encryptedB64 string) (stellar1.EncryptedAccountBundle, stellar1.Hash, error) {
	cipherpack, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return stellar1.EncryptedAccountBundle{}, stellar1.Hash{}, err
	}
	encHash := sha256.Sum256(cipherpack)
	var enc stellar1.EncryptedAccountBundle
	if err = msgpack.Decode(&enc, cipherpack); err != nil {
		return stellar1.EncryptedAccountBundle{}, stellar1.Hash{}, err
	}
	return enc, encHash[:], nil
}

// unbox unboxes an encrypted account bundle and decodes the visual portion of the bundle.
// It validates the visible hash in the secret portion.
func unbox(encBundle stellar1.EncryptedAccountBundle, hash stellar1.Hash /* visB64 string, */, puk libkb.PerUserKeySeed) (*stellar1.AccountBundle, stellar1.AccountBundleVersion, error) {
	versioned, err := decrypt(encBundle, puk)
	if err != nil {
		return nil, 0, err
	}
	version, err := versioned.Version()
	if err != nil {
		return nil, 0, err
	}

	var bundleOut stellar1.AccountBundle
	switch version {
	case stellar1.AccountBundleVersion_V1:
		secretV1 := versioned.V1()
		bundleOut = stellar1.AccountBundle{
			AccountID: secretV1.AccountID,
			Signers:   secretV1.Signers,
		}
	case stellar1.AccountBundleVersion_V2,
		stellar1.AccountBundleVersion_V3,
		stellar1.AccountBundleVersion_V4,
		stellar1.AccountBundleVersion_V5,
		stellar1.AccountBundleVersion_V6,
		stellar1.AccountBundleVersion_V7,
		stellar1.AccountBundleVersion_V8,
		stellar1.AccountBundleVersion_V9,
		stellar1.AccountBundleVersion_V10:
		return nil, 0, errors.New("unsupported AccountBundleSecret version")
	default:
		return nil, 0, errors.New("invalid AccountBundle version")
	}

	bundleOut.OwnHash = hash
	if len(bundleOut.OwnHash) == 0 {
		return nil, 0, errors.New("stellar account bundle missing own hash")
	}

	return &bundleOut, version, nil
}

// decrypt decrypts an encrypted account bundle with the provided puk.
func decrypt(encBundle stellar1.EncryptedAccountBundle, puk libkb.PerUserKeySeed) (stellar1.AccountBundleSecretVersioned, error) {
	var empty stellar1.AccountBundleSecretVersioned
	if encBundle.V != 1 {
		return empty, errors.New("invalid stellar secret account bundle encryption version")
	}

	// Derive key
	reason := libkb.DeriveReasonPUKStellarAcctBundle
	symmetricKey, err := puk.DeriveSymmetricKey(reason)
	if err != nil {
		return empty, err
	}

	// Secretbox
	clearpack, ok := secretbox.Open(nil, encBundle.E,
		(*[libkb.NaclDHNonceSize]byte)(&encBundle.N),
		(*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))
	if !ok {
		return empty, errors.New("stellar bundle secret box open failed")
	}

	// Msgpack (inner)
	var bver stellar1.AccountBundleSecretVersioned
	err = msgpack.Decode(&bver, clearpack)
	if err != nil {
		return empty, err
	}
	return bver, nil
}
func convertVisibleAccounts(in []stellar1.BundleVisibleEntryV2) []stellar1.BundleEntry {
	out := make([]stellar1.BundleEntry, len(in))
	for i, e := range in {
		out[i] = stellar1.BundleEntry{
			AccountID:          e.AccountID,
			Mode:               e.Mode,
			IsPrimary:          e.IsPrimary,
			AcctBundleRevision: e.AcctBundleRevision,
			EncAcctBundleHash:  e.EncAcctBundleHash,
		}
	}
	return out
}

// merge combines the versioned secret account bundle and the visible account bundle into
// a stellar1.AccountBundle for local use.
func merge(secret stellar1.BundleSecretV2, visible stellar1.BundleVisibleV2) (stellar1.Bundle, error) {
	if len(secret.Accounts) != len(visible.Accounts) {
		return stellar1.Bundle{}, errors.New("invalid bundle, mismatched number of visible and secret accounts")
	}
	accounts := convertVisibleAccounts(visible.Accounts)

	// these should be in the same order
	for i, secretAccount := range secret.Accounts {
		if accounts[i].AccountID != secretAccount.AccountID {
			return stellar1.Bundle{}, errors.New("invalid bundle, mismatched order of visible and secret accounts")
		}
		accounts[i].Name = secretAccount.Name
	}
	return stellar1.Bundle{
		Revision: visible.Revision,
		Prev:     visible.Prev,
		Accounts: accounts,
	}, nil
}
