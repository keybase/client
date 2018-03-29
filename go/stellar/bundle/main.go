package bundle

import (
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

func randomStellarKeypair() (pub stellar1.AccountID, sec stellar1.SecretKey, err error) {
	full, err := keypair.Random()
	if err != nil {
		return pub, sec, err
	}
	return stellar1.AccountID(full.Address()), stellar1.SecretKey(full.Seed()), nil
}
