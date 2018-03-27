package bundle

import (
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stellar/go/keypair"
)

func NewInitialBundle() (res keybase1.StellarBundle, err error) {
	accountID, masterKey, err := randomStellarKeypair()
	if err != nil {
		return res, err
	}
	return keybase1.StellarBundle{
		Revision: 1,
		Prev:     nil,
		OwnHash:  nil,
		Accounts: []keybase1.StellarEntry{{
			AccountID: accountID,
			Mode:      keybase1.StellarAccountMode_USER,
			IsPrimary: true,
			Signers:   []keybase1.StellarSecretKey{masterKey},
			Name:      "",
		}},
	}, nil
}

func randomStellarKeypair() (pub keybase1.StellarAccountID, sec keybase1.StellarSecretKey, err error) {
	full, err := keypair.Random()
	if err != nil {
		return pub, sec, err
	}
	return keybase1.StellarAccountID(full.Address()), keybase1.StellarSecretKey(full.Seed()), nil
}
