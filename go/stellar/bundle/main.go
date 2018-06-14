package bundle

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
)

func NewInitialBundle() (res stellar1.Bundle, err error) {
	accountID, masterKey, err := randomStellarKeypair()
	if err != nil {
		return res, err
	}
	return stellar1.Bundle{
		Revision: 1,
		Prev:     nil,
		OwnHash:  nil,
		Accounts: []stellar1.BundleEntry{{
			AccountID: accountID,
			Mode:      stellar1.AccountMode_USER,
			IsPrimary: true,
			Signers:   []stellar1.SecretKey{masterKey},
			Name:      "",
		}},
	}, nil
}

// Create the next bundle given a decrypted bundle.
func Advance(prevBundle stellar1.Bundle) stellar1.Bundle {
	nextBundle := prevBundle.DeepCopy()
	nextBundle.Prev = nextBundle.OwnHash
	nextBundle.OwnHash = nil
	nextBundle.Revision++
	return nextBundle
}

// AddAccount adds an account to the bundle.
// Mutates `bundle`.
func AddAccount(bundle *stellar1.Bundle, secretKey stellar1.SecretKey, name string, makePrimary bool) (pub stellar1.AccountID, err error) {
	if bundle == nil {
		return pub, fmt.Errorf("nil bundle")
	}
	secretKey, accountID, _, err := libkb.ParseStellarSecretKey(string(secretKey))
	if err != nil {
		return pub, err
	}
	if makePrimary {
		for i := range bundle.Accounts {
			bundle.Accounts[i].IsPrimary = false
		}
	}
	bundle.Accounts = append(bundle.Accounts, stellar1.BundleEntry{
		AccountID: accountID,
		Mode:      stellar1.AccountMode_USER,
		IsPrimary: makePrimary,
		Signers:   []stellar1.SecretKey{secretKey},
		Name:      name,
	})
	return accountID, bundle.CheckInvariants()
}

func CreateNewAccount(bundle *stellar1.Bundle, name string, makePrimary bool) (pub stellar1.AccountID, err error) {
	accountID, masterKey, err := randomStellarKeypair()
	if err != nil {
		return pub, err
	}
	pub, err = AddAccount(bundle, masterKey, name, makePrimary)
	if err != nil {
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
