package acctbundle

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
	"golang.org/x/crypto/nacl/secretbox"
)

// New creates an AccountBundle from an existing secret key.
func New(secret stellar1.SecretKey, name string) (*stellar1.AccountBundle, error) {
	secretKey, accountID, _, err := libkb.ParseStellarSecretKey(string(secret))
	if err != nil {
		return nil, err
	}
	return &stellar1.AccountBundle{
		Name:      name,
		Revision:  1,
		AccountID: accountID,
		Signers:   []stellar1.SecretKey{secretKey},
		Mode:      stellar1.AccountMode_USER,
	}, nil
}

// NewInitial creates an AccountBundle with a new random secret key.
func NewInitial(name string) (*stellar1.AccountBundle, error) {
	full, err := keypair.Random()
	if err != nil {
		return nil, err
	}
	masterKey := stellar1.SecretKey(full.Seed())
	return New(masterKey, name)
}

// AccountBoxResult is the result of boxing an AccountBundle.
type AccountBoxResult struct {
	Enc           stellar1.EncryptedAccountBundle
	EncB64        string // base64 msgpack'd Enc
	VisB64        string // base64 msgpack'd Vis
	FormatVersion stellar1.AccountBundleVersion
}

// Box splits AccountBundle into visible and secret parts.  The visible
// part is packed and encoded, the secret part is encrypted, packed, and
// encoded.
func Box(a *stellar1.AccountBundle, pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (*AccountBoxResult, error) {
	boxed := &AccountBoxResult{
		FormatVersion: stellar1.AccountBundleVersion_V1,
	}

	// visible portion
	visible := stellar1.AccountBundleVisibleV1{
		Revision: a.Revision,
		// XXX Hash prev
		AccountID: a.AccountID,
		Mode:      a.Mode,
	}
	visiblePack, err := libkb.MsgpackEncode(visible)
	if err != nil {
		return nil, err
	}
	boxed.VisB64 = base64.StdEncoding.EncodeToString(visiblePack)
	visibleHash := sha256.Sum256(visiblePack)

	versionedSecret := stellar1.NewAccountBundleSecretVersionedWithV1(stellar1.AccountBundleSecretV1{
		VisibleHash: visibleHash[:],
		AccountID:   a.AccountID,
		Signers:     a.Signers,
		Name:        a.Name,
	})
	boxed.Enc, boxed.EncB64, err = accountEncrypt(versionedSecret, pukGen, puk)
	if err != nil {
		return nil, err
	}

	return boxed, nil
}

type PukFinder interface {
	SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error)
}

func Unbox(m libkb.MetaContext, finder PukFinder, encB64, visB64 string) (*stellar1.AccountBundle, stellar1.AccountBundleVersion, error) {
	encBundle, hash, err := decode(encB64)
	if err != nil {
		return nil, 0, err
	}

	puk, err := finder.SeedByGeneration(m, encBundle.Gen)
	if err != nil {
		return nil, 0, err
	}

	return unbox(encBundle, hash, visB64, puk)
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

func unbox(encBundle stellar1.EncryptedAccountBundle, hash stellar1.Hash, visB64 string, puk libkb.PerUserKeySeed) (*stellar1.AccountBundle, stellar1.AccountBundleVersion, error) {
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
		visiblePack, err := base64.StdEncoding.DecodeString(visB64)
		if err != nil {
			return nil, 0, err
		}
		visibleHash := sha256.Sum256(visiblePack)
		secretV1 := versioned.V1()
		if !hmac.Equal(visibleHash[:], secretV1.VisibleHash) {
			return nil, 0, errors.New("corrupted bundle: visible hash mismatch")
		}
		var visibleV1 stellar1.AccountBundleVisibleV1
		err = libkb.MsgpackDecode(&visibleV1, visiblePack)
		if err != nil {
			return nil, 0, err
		}
		bundleOut, err = merge(secretV1, visibleV1)
		if err != nil {
			return nil, 0, err
		}
	default:
		return nil, 0, err
	}

	bundleOut.OwnHash = hash
	if len(bundleOut.OwnHash) == 0 {
		return nil, 0, errors.New("stellar account bundle missing own hash")
	}

	// XXX
	// if err = bundleOut.CheckInvariants(); err != nil {
	//	return stellar1.AccountBundle{}, 0, err
	// }

	return &bundleOut, version, nil
}

func decrypt(encBundle stellar1.EncryptedAccountBundle, puk libkb.PerUserKeySeed) (stellar1.AccountBundleSecretVersioned, error) {
	var empty stellar1.AccountBundleSecretVersioned
	if encBundle.V != 1 {
		return empty, errors.New("invalid stellar secret account bundle encryption version")
	}

	// Derive key
	reason := libkb.DeriveReasonPUKStellarBundle
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

func merge(secret stellar1.AccountBundleSecretV1, visible stellar1.AccountBundleVisibleV1) (stellar1.AccountBundle, error) {
	return stellar1.AccountBundle{
		Revision:  visible.Revision,
		Prev:      visible.Prev,
		AccountID: visible.AccountID,
		Mode:      visible.Mode,
		Signers:   secret.Signers,
		Name:      secret.Name,
	}, nil
}
