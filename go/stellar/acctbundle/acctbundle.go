package acctbundle

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/stellar/go/keypair"
	"golang.org/x/crypto/nacl/secretbox"
)

// New creates a BundleRestricted from an existing secret key.
func New(secret stellar1.SecretKey, name string) (*stellar1.BundleRestricted, error) {
	secretKey, accountID, _, err := libkb.ParseStellarSecretKey(string(secret))
	if err != nil {
		return nil, err
	}
	return &stellar1.BundleRestricted{
		Revision: 1,
		Accounts: []stellar1.BundleEntryRestricted{
			newEntry(accountID, name, false, stellar1.AccountMode_USER),
		},
		AccountBundles: map[stellar1.AccountID]stellar1.AccountBundle{
			accountID: newAccountBundle(accountID, secretKey),
		},
	}, nil
}

// NewInitial creates a BundleRestricted with a new random secret key.
func NewInitial(name string) (*stellar1.BundleRestricted, error) {
	full, err := keypair.Random()
	if err != nil {
		return nil, err
	}

	x, err := New(stellar1.SecretKey(full.Seed()), name)
	if err != nil {
		return nil, err
	}

	x.Accounts[0].IsPrimary = true

	return x, nil
}

// NewFromBundle creates a BundleRestricted from a Bundle.
func NewFromBundle(bundle stellar1.Bundle) (*stellar1.BundleRestricted, error) {
	r := &stellar1.BundleRestricted{
		Revision:       bundle.Revision,
		Prev:           bundle.Prev,
		AccountBundles: make(map[stellar1.AccountID]stellar1.AccountBundle),
		OwnHash:        bundle.OwnHash,
	}
	if r.Revision > 1 && (r.Prev == nil || len(r.Prev) == 0) {
		return nil, fmt.Errorf("NewFromBundle missing Prev: %+v", bundle)
	}
	r.Accounts = make([]stellar1.BundleEntryRestricted, len(bundle.Accounts))
	for i, acct := range bundle.Accounts {
		r.Accounts[i] = newEntry(acct.AccountID, acct.Name, acct.IsPrimary, acct.Mode)
		r.AccountBundles[acct.AccountID] = stellar1.AccountBundle{
			Revision:  1,
			AccountID: acct.AccountID,
			Signers:   acct.Signers,
		}
	}
	if err := r.CheckInvariants(); err != nil {
		return nil, err
	}
	return r, nil
}

func newEntry(accountID stellar1.AccountID, name string, isPrimary bool, mode stellar1.AccountMode) stellar1.BundleEntryRestricted {
	return stellar1.BundleEntryRestricted{
		AccountID:          accountID,
		Name:               name,
		Mode:               mode,
		IsPrimary:          isPrimary,
		AcctBundleRevision: 1,
	}
}

// BundleFromBundleRestricted is part of the migration strategy to move from Bundles to
// BundleRestricteds. This should only ever be used as close to the interface with the server
// as possible: i.e. methods that start with `Post` or `Fetch`.
func BundleFromBundleRestricted(br stellar1.BundleRestricted) (*stellar1.Bundle, error) {
	bundle := &stellar1.Bundle{
		Revision: br.Revision,
		Prev:     br.Prev,
		OwnHash:  br.OwnHash,
	}
	if bundle.Revision > 1 && (bundle.Prev == nil || len(bundle.Prev) == 0) {
		return nil, fmt.Errorf("BundleFromBundleRestricted missing Prev: %+v", br)
	}
	bundle.Accounts = make([]stellar1.BundleEntry, len(br.Accounts))
	for i, acct := range br.Accounts {
		signers := br.AccountBundles[acct.AccountID].Signers
		bundle.Accounts[i] = stellar1.BundleEntry{
			AccountID: acct.AccountID,
			Name:      acct.Name,
			Mode:      acct.Mode,
			IsPrimary: acct.IsPrimary,
			Signers:   signers,
		}
	}
	if err := bundle.CheckInvariants(); err != nil {
		return nil, err
	}
	return bundle, nil
}

func newAccountBundle(accountID stellar1.AccountID, secretKey stellar1.SecretKey) stellar1.AccountBundle {
	return stellar1.AccountBundle{
		Revision:  1,
		AccountID: accountID,
		Signers:   []stellar1.SecretKey{secretKey},
	}
}

// BoxedEncoded is the result of boxing and encoding a BundleRestricted object.
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

func newVisibleParent(a *stellar1.BundleRestricted, accountsVisible []stellar1.BundleVisibleEntryV2) stellar1.BundleVisibleV2 {
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
	FormatVersionParent stellar1.AccountBundleVersion `json:"version_parent"`
	AcctBundles         map[stellar1.AccountID]string `json:"account_bundles"`
}

// BoxAndEncode encrypts and encodes a BundleRestricted object.
func BoxAndEncode(a *stellar1.BundleRestricted, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (*BoxedEncoded, error) {
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
	visiblePack, err := libkb.MsgpackEncode(visibleV2)
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

func visibilitySplit(a *stellar1.BundleRestricted) ([]stellar1.BundleVisibleEntryV2, []stellar1.BundleSecretEntryV2) {
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
	clearpack, err := libkb.MsgpackEncode(bundle)
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
	secbox := secretbox.Seal(nil, clearpack[:], &nonce, (*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))

	// Annotate
	res := stellar1.EncryptedBundle{
		V:   2,
		E:   secbox,
		N:   nonce,
		Gen: pukGen,
	}

	// Msgpack (outer) + b64
	cipherpack, err := libkb.MsgpackEncode(res)
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

	encPack, err := libkb.MsgpackEncode(encBundle)
	if err != nil {
		return nil, err
	}
	encHash := sha256.Sum256(encPack)

	res := AcctBoxedEncoded{Enc: encBundle, EncHash: encHash[:], EncB64: b64, FormatVersion: 1}

	return &res, nil
}

// ErrNoChangeNecessary means that any proposed change to a bundle isn't
// actually necessary.
var ErrNoChangeNecessary = errors.New("no account mode change is necessary")

// MakeMobileOnly transforms a stellar1.AccountBundle into a mobile-only
// bundle.  This advances the revision.  If it's already mobile-only,
// this function will return ErrNoChangeNecessary.
func MakeMobileOnly(a *stellar1.BundleRestricted, accountID stellar1.AccountID) error {
	ws, err := AccountWithSecret(a, accountID)
	if err != nil {
		return err
	}
	if ws.Mode == stellar1.AccountMode_MOBILE {
		return ErrNoChangeNecessary
	}
	a.Revision++
	a.Prev = a.OwnHash
	a.OwnHash = nil

	for i, vis := range a.Accounts {
		if vis.AccountID == accountID {
			if vis.Mode == stellar1.AccountMode_MOBILE {
				return ErrNoChangeNecessary
			}
			vis.Mode = stellar1.AccountMode_MOBILE
			vis.AcctBundleRevision++
			a.Accounts[i] = vis
		}
	}

	return nil
}

// MakeAllDevices transforms a stellar1.AccountBundle into an all-device
// bundle.  This advances the revision.  If it's already all-device,
// this function will return ErrNoChangeNecessary.
func MakeAllDevices(a *stellar1.BundleRestricted, accountID stellar1.AccountID) error {
	ws, err := AccountWithSecret(a, accountID)
	if err != nil {
		return err
	}
	if ws.Mode == stellar1.AccountMode_USER {
		return ErrNoChangeNecessary
	}
	a.Revision++
	a.Prev = a.OwnHash
	a.OwnHash = nil

	for i, vis := range a.Accounts {
		if vis.AccountID == accountID {
			if vis.Mode == stellar1.AccountMode_USER {
				return ErrNoChangeNecessary
			}
			vis.Mode = stellar1.AccountMode_USER
			vis.AcctBundleRevision++
			a.Accounts[i] = vis
		}
	}

	return nil
}

// PukFinder helps this package find puks.
type PukFinder interface {
	SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error)
}

// DecodeAndUnbox decodes the encrypted and visible encoded bundles and unboxes
// the encrypted bundle using PukFinder to find the correct puk.  It combines
// the results into a stellar1.AccountBundle.
func DecodeAndUnbox(m libkb.MetaContext, finder PukFinder, encodedBundle BundleEncoded) (*stellar1.BundleRestricted, stellar1.BundleVersion, error) {
	encBundle, hash, err := decodeParent(encodedBundle.EncParent)
	if err != nil {
		return nil, 0, err
	}

	puk, err := finder.SeedByGeneration(m, encBundle.Gen)
	if err != nil {
		return nil, 0, err
	}

	parent, parentVersion, err := unboxParent(encBundle, hash, encodedBundle.VisParent, puk)
	if err != nil {
		return nil, 0, err
	}
	parent.AccountBundles = make(map[stellar1.AccountID]stellar1.AccountBundle)
	for _, parentEntry := range parent.Accounts {
		if acctEncB64, ok := encodedBundle.AcctBundles[parentEntry.AccountID]; ok {
			acctBundle, err := decodeAndUnboxAcctBundle(m, finder, acctEncB64, parentEntry)
			if err != nil {
				return nil, 0, err
			}
			if acctBundle == nil {
				return nil, 0, fmt.Errorf("error unboxing account bundle: missing for account %s", parentEntry.AccountID)
			}

			parent.AccountBundles[parentEntry.AccountID] = *acctBundle
		}
	}

	return parent, parentVersion, nil
}

func decodeAndUnboxAcctBundle(m libkb.MetaContext, finder PukFinder, encB64 string, parentEntry stellar1.BundleEntryRestricted) (*stellar1.AccountBundle, error) {
	eab, hash, err := decode(encB64)
	if err != nil {
		return nil, err
	}

	if !libkb.SecureByteArrayEq(hash, parentEntry.EncAcctBundleHash) {
		return nil, errors.New("account bundle and parent entry hash mismatch")
	}

	puk, err := finder.SeedByGeneration(m, eab.Gen)
	if err != nil {
		return nil, err
	}
	ab, _, err := unbox(eab, hash, puk)
	if err != nil {
		return nil, err
	}
	if ab.AccountID != parentEntry.AccountID {
		return nil, errors.New("account bundle and parent entry account ID mismatch")
	}
	ab.Revision = parentEntry.AcctBundleRevision

	return ab, nil
}

// accountEncrypt encrypts the stellar account key bundle for the PUK.
// Returns the encrypted struct and a base64 encoding for posting to the server.
// Does not check invariants.
func accountEncrypt(bundle stellar1.AccountBundleSecretVersioned, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (res stellar1.EncryptedAccountBundle, resB64 string, err error) {
	// Msgpack (inner)
	clearpack, err := libkb.MsgpackEncode(bundle)
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
	secbox := secretbox.Seal(nil, clearpack[:], &nonce, (*[libkb.NaclSecretBoxKeySize]byte)(&symmetricKey))

	// Annotate
	res = stellar1.EncryptedAccountBundle{
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

// decodeParent decodes a base64-encoded encrypted parent bundle.
func decodeParent(encryptedB64 string) (stellar1.EncryptedBundle, stellar1.Hash, error) {
	cipherpack, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return stellar1.EncryptedBundle{}, stellar1.Hash{}, err
	}
	encHash := sha256.Sum256(cipherpack)
	var enc stellar1.EncryptedBundle
	if err = libkb.MsgpackDecode(&enc, cipherpack); err != nil {
		return stellar1.EncryptedBundle{}, stellar1.Hash{}, err
	}
	return enc, encHash[:], nil
}

// unboxParent unboxes an encrypted parent bundle and decodes the visual portion of the bundle.
// It validates the visible hash in the secret portion.
func unboxParent(encBundle stellar1.EncryptedBundle, hash stellar1.Hash, visB64 string, puk libkb.PerUserKeySeed) (*stellar1.BundleRestricted, stellar1.BundleVersion, error) {
	versioned, err := decryptParent(encBundle, puk)
	if err != nil {
		return nil, 0, err
	}
	version, err := versioned.Version()
	if err != nil {
		return nil, 0, err
	}

	var bundleOut stellar1.BundleRestricted
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

func unboxParentV2(versioned stellar1.BundleSecretVersioned, visB64 string) (stellar1.BundleRestricted, error) {
	var empty stellar1.BundleRestricted
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
	err = libkb.MsgpackDecode(&visibleV2, visiblePack)
	if err != nil {
		return empty, err
	}
	return merge(secretV2, visibleV2)
}

// decryptParent decrypts an encrypted parent bundle with the provided puk.
func decryptParent(encBundle stellar1.EncryptedBundle, puk libkb.PerUserKeySeed) (stellar1.BundleSecretVersioned, error) {
	return bundle.Decrypt(encBundle, puk)
}

// decode decodes a base64-encoded encrypted account bundle.
func decode(encryptedB64 string) (stellar1.EncryptedAccountBundle, stellar1.Hash, error) {
	cipherpack, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return stellar1.EncryptedAccountBundle{}, stellar1.Hash{}, err
	}
	encHash := sha256.Sum256(cipherpack)
	var enc stellar1.EncryptedAccountBundle
	if err = libkb.MsgpackDecode(&enc, cipherpack); err != nil {
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
	err = libkb.MsgpackDecode(&bver, clearpack)
	if err != nil {
		return empty, err
	}
	return bver, nil
}

// WithSecret is a convenient summary of an individual account
// that includes the secret keys.
type WithSecret struct {
	AccountID stellar1.AccountID
	Mode      stellar1.AccountMode
	Name      string
	Revision  stellar1.BundleRevision
	Signers   []stellar1.SecretKey
}

// AccountWithSecret finds an account in bundle and its associated secret
// and extracts them into a convenience type acctbundle.WithSecret.
// It will return libkb.NotFoundError if it can't find the secret or the
// account in the bundle.
func AccountWithSecret(bundle *stellar1.BundleRestricted, accountID stellar1.AccountID) (*WithSecret, error) {
	secret, ok := bundle.AccountBundles[accountID]
	if !ok {
		return nil, libkb.NotFoundError{}
	}
	// ugh
	var found *stellar1.BundleEntryRestricted
	for _, a := range bundle.Accounts {
		if a.AccountID == accountID {
			found = &a
			break
		}
	}
	if found == nil {
		// this is bad: secret found but not visible portion
		return nil, libkb.NotFoundError{}
	}
	return &WithSecret{
		AccountID: found.AccountID,
		Mode:      found.Mode,
		Name:      found.Name,
		Revision:  found.AcctBundleRevision,
		Signers:   secret.Signers,
	}, nil
}

func convertVisibleAccounts(in []stellar1.BundleVisibleEntryV2) []stellar1.BundleEntryRestricted {
	out := make([]stellar1.BundleEntryRestricted, len(in))
	for i, e := range in {
		out[i] = stellar1.BundleEntryRestricted{
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
func merge(secret stellar1.BundleSecretV2, visible stellar1.BundleVisibleV2) (stellar1.BundleRestricted, error) {
	if len(secret.Accounts) != len(visible.Accounts) {
		return stellar1.BundleRestricted{}, errors.New("invalid bundle, mismatched number of visible and secret accounts")
	}
	accounts := convertVisibleAccounts(visible.Accounts)

	// these should be in the same order
	for i, secretAccount := range secret.Accounts {
		if accounts[i].AccountID != secretAccount.AccountID {
			return stellar1.BundleRestricted{}, errors.New("invalid bundle, mismatched order of visible and secret accounts")
		}
		accounts[i].Name = secretAccount.Name
	}
	return stellar1.BundleRestricted{
		Revision: visible.Revision,
		Prev:     visible.Prev,
		Accounts: accounts,
	}, nil
}

// AdvanceBundle only advances the revisions and hashes on the BundleRestricted
// and not on the accounts. This is useful for adding and removing accounts
// but not for changing them.
func AdvanceBundle(prevBundle stellar1.BundleRestricted) stellar1.BundleRestricted {
	nextBundle := prevBundle.DeepCopy()
	nextBundle.Prev = nextBundle.OwnHash
	nextBundle.OwnHash = nil
	nextBundle.Revision++
	return nextBundle
}

// advanceOneAccount mutates the passed in bundleRestricted in place
func advanceOneAccount(b *stellar1.BundleRestricted, accountID stellar1.AccountID) error {
	for _, account := range b.Accounts {
		if account.AccountID.Eq(accountID) {
			account.AcctBundleRevision++
			return nil
		}
	}
	return fmt.Errorf("account not found: %v", accountID)
}

// AdvanceAccounts advances the revisions and hashes on the BundleRestricted
// as well as on the specified Accounts. This is useful for mutating one or more
// of the accounts in the bundle, e.g. changing which one is Primary.
func AdvanceAccounts(prevBundle stellar1.BundleRestricted, accountIDs []stellar1.AccountID) (stellar1.BundleRestricted, error) {
	nextBundle := AdvanceBundle(prevBundle)
	for _, accountID := range accountIDs {
		err := advanceOneAccount(&nextBundle, accountID)
		if err != nil {
			return stellar1.BundleRestricted{}, err
		}
	}
	return nextBundle, nil
}

// AdvanceAll advances the revisions and hashes on the BundleRestricted
// as well as on all of the Accounts. This is useful for reencryption of
// everything, e.g. Upkeep.
func AdvanceAll(prevBundle stellar1.BundleRestricted) stellar1.BundleRestricted {
	nextBundle := AdvanceBundle(prevBundle)
	for _, account := range nextBundle.Accounts {
		account.AcctBundleRevision++
	}
	return nextBundle
}

// AddAccount adds an account to the bundle. Mutates `bundle`.
func AddAccount(bundle *stellar1.BundleRestricted, secretKey stellar1.SecretKey, name string, makePrimary bool) (err error) {
	if bundle == nil {
		return fmt.Errorf("nil bundle")
	}
	secretKey, accountID, _, err := libkb.ParseStellarSecretKey(string(secretKey))
	if err != nil {
		return err
	}
	if name == "" {
		return fmt.Errorf("Name required for new account")
	}
	if makePrimary {
		for i := range bundle.Accounts {
			bundle.Accounts[i].IsPrimary = false
		}
	}
	bundle.Accounts = append(bundle.Accounts, stellar1.BundleEntryRestricted{
		AccountID:          accountID,
		Mode:               stellar1.AccountMode_USER,
		IsPrimary:          makePrimary,
		AcctBundleRevision: 1,
		Name:               name,
	})
	bundle.AccountBundles[accountID] = stellar1.AccountBundle{
		Revision:  1,
		AccountID: accountID,
		Signers:   []stellar1.SecretKey{secretKey},
	}
	return bundle.CheckInvariants()
}

// CreateNewAccount generates a Stellar key pair and adds it to the
// bundle. Mutates `bundle`.
func CreateNewAccount(bundle *stellar1.BundleRestricted, name string, makePrimary bool) (pub stellar1.AccountID, err error) {
	accountID, masterKey, err := randomStellarKeypair()
	if err != nil {
		return pub, err
	}
	if err := AddAccount(bundle, masterKey, name, makePrimary); err != nil {
		return pub, err
	}
	return accountID, nil
}

func randomStellarKeypair() (pub stellar1.AccountID, sec stellar1.SecretKey, err error) {
	full, err := keypair.Random()
	if err != nil {
		return pub, sec, err
	}
	return stellar1.AccountID(full.Address()), stellar1.SecretKey(full.Seed()), nil
}
