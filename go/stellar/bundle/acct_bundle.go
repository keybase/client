package bundle

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
)

// AccountBundle contains the secret key for a stellar account.
type AccountBundle struct {
	signers []stellar1.SecretKey
}

// NewAccountBundle creates an AccountBundle from an existing secret key.
func NewAccountBundle(secret stellar1.SecretKey) *AccountBundle {
	return &AccountBundle{signers: []stellar1.SecretKey{secret}}
}

// NewInitialAccountBundle creates an AccountBundle with a new random secret key.
func NewInitialAccountBundle() (*AccountBundle, error) {
	_, masterKey, err := randomStellarKeypair()
	if err != nil {
		return nil, err
	}
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
	return &AccountBoxResult{}, nil
}
