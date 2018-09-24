package bundle

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
)

func NewInitialBundle(accountName string) (res stellar1.Bundle, err error) {
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
			Name:      accountName,
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

// AddAccount adds an account to the bundle. Mutates `bundle`.
func AddAccount(bundle *stellar1.Bundle, secretKey stellar1.SecretKey, name string, makePrimary bool) (err error) {
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
	bundle.Accounts = append(bundle.Accounts, stellar1.BundleEntry{
		AccountID: accountID,
		Mode:      stellar1.AccountMode_USER,
		IsPrimary: makePrimary,
		Signers:   []stellar1.SecretKey{secretKey},
		Name:      name,
	})
	return bundle.CheckInvariants()
}

// CreateNewAccount generates a Stellar key pair and adds it to the
// bundle. Mutates `bundle`.
func CreateNewAccount(bundle *stellar1.Bundle, name string, makePrimary bool) (pub stellar1.AccountID, err error) {
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
