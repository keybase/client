package acctbundle

import (
	"crypto/sha256"
	"encoding/base64"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
	"golang.org/x/crypto/nacl/secretbox"
)

// AccountBundle contains the secret key for a stellar account.
type AccountBundle struct {
	revision stellar1.BundleRevision
	signers  []stellar1.SecretKey
}

// NewAccountBundle creates an AccountBundle from an existing secret key.
func NewAccountBundle(secret stellar1.SecretKey) *AccountBundle {
	return &AccountBundle{signers: []stellar1.SecretKey{secret}}
}

// NewInitialAccountBundle creates an AccountBundle with a new random secret key.
func NewInitialAccountBundle() (*AccountBundle, error) {
	full, err := keypair.Random()
	if err != nil {
		return nil, err
	}
	masterKey := stellar1.SecretKey(full.Seed())
	return NewAccountBundle(masterKey), nil
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
func (a *AccountBundle) Box(pukGen keybase1.PerUserKeyGeneration, puk libkb.PerUserKeySeed) (*AccountBoxResult, error) {
	boxed := &AccountBoxResult{
		FormatVersion: stellar1.AccountBundleVersion_V1,
	}

	// visible portion
	visible := stellar1.AccountBundleVisibleV1{
		Revision: a.revision,
		// XXX Hash prev
		// XXX AccountID
		// XXX AccountMode mode
	}
	visiblePack, err := libkb.MsgpackEncode(visible)
	if err != nil {
		return nil, err
	}
	boxed.VisB64 = base64.StdEncoding.EncodeToString(visiblePack)
	visibleHash := sha256.Sum256(visiblePack)

	versionedSecret := stellar1.NewAccountBundleSecretVersionedWithV1(stellar1.AccountBundleSecretV1{
		VisibleHash: visibleHash[:],
		AccountID:   "xxx",
		Signers:     a.signers,
		Name:        "xxx",
	})
	boxed.Enc, boxed.EncB64, err = accountEncrypt(versionedSecret, pukGen, puk)
	if err != nil {
		return nil, err
	}

	return boxed, nil
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

func accountDecrypt(encryptedB64 string) {}
