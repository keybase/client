package bundle

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stellar/go/keypair"
)

// New creates a Bundle from an existing secret key.
func New(secret stellar1.SecretKey, name string) (*stellar1.Bundle, error) {
	secretKey, accountID, _, err := libkb.ParseStellarSecretKey(string(secret))
	if err != nil {
		return nil, err
	}
	return &stellar1.Bundle{
		Revision: 1,
		Accounts: []stellar1.BundleEntry{
			newEntry(accountID, name, false, stellar1.AccountMode_USER),
		},
		AccountBundles: map[stellar1.AccountID]stellar1.AccountBundle{
			accountID: newAccountBundle(accountID, secretKey),
		},
	}, nil
}

// NewInitial creates a Bundle with a new random secret key.
func NewInitial(name string) (*stellar1.Bundle, error) {
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

func newEntry(accountID stellar1.AccountID, name string, isPrimary bool, mode stellar1.AccountMode) stellar1.BundleEntry {
	return stellar1.BundleEntry{
		AccountID:          accountID,
		Name:               name,
		Mode:               mode,
		IsPrimary:          isPrimary,
		AcctBundleRevision: 1,
	}
}

func newAccountBundle(accountID stellar1.AccountID, secretKey stellar1.SecretKey) stellar1.AccountBundle {
	return stellar1.AccountBundle{
		AccountID: accountID,
		Signers:   []stellar1.SecretKey{secretKey},
	}
}

// ErrNoChangeNecessary means that any proposed change to a bundle isn't
// actually necessary.
var ErrNoChangeNecessary = errors.New("no account mode change is necessary")

// MakeMobileOnly transforms an account in a stellar1.Bundle into a mobile-only
// account. This advances the revision of the Bundle.  If it's already mobile-only,
// this function will return ErrNoChangeNecessary.
func MakeMobileOnly(a *stellar1.Bundle, accountID stellar1.AccountID) error {
	var found bool
	for i, account := range a.Accounts {
		if account.AccountID == accountID {
			if account.Mode == stellar1.AccountMode_MOBILE {
				return ErrNoChangeNecessary
			}
			account.Mode = stellar1.AccountMode_MOBILE
			a.Accounts[i] = account
			found = true
			break
		}
	}
	if !found {
		return libkb.NotFoundError{}
	}
	return nil
}

// MakeAllDevices transforms an account in a stellar1.Bundle into an all-devices
// account. This advances the revision of the Bundle.  If it's already all-devices,
// this function will return ErrNoChangeNecessary.
func MakeAllDevices(a *stellar1.Bundle, accountID stellar1.AccountID) error {
	var found bool
	for i, account := range a.Accounts {
		if account.AccountID == accountID {
			if account.Mode == stellar1.AccountMode_USER {
				return ErrNoChangeNecessary
			}
			account.Mode = stellar1.AccountMode_USER
			a.Accounts[i] = account
			found = true
			break
		}
	}
	if !found {
		return libkb.NotFoundError{}
	}
	return nil
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
// and extracts them into a convenience type bundle.WithSecret.
// It will return libkb.NotFoundError if it can't find the secret or the
// account in the bundle.
func AccountWithSecret(bundle *stellar1.Bundle, accountID stellar1.AccountID) (*WithSecret, error) {
	secret, ok := bundle.AccountBundles[accountID]
	if !ok {
		return nil, libkb.NotFoundError{}
	}
	// ugh
	var found *stellar1.BundleEntry
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

// AdvanceBundle only advances the revisions and hashes on the Bundle
// and not on the accounts. This is useful for adding and removing accounts
// but not for changing them.
func AdvanceBundle(prevBundle stellar1.Bundle) stellar1.Bundle {
	nextBundle := prevBundle.DeepCopy()
	nextBundle.Prev = nextBundle.OwnHash
	nextBundle.OwnHash = nil
	nextBundle.Revision++
	return nextBundle
}

// AdvanceAccounts advances the revisions and hashes on the Bundle
// as well as on the specified Accounts. This is useful for mutating one or more
// of the accounts in the bundle, e.g. changing which one is Primary.
func AdvanceAccounts(prevBundle stellar1.Bundle, accountIDs []stellar1.AccountID) stellar1.Bundle {
	nextBundle := prevBundle.DeepCopy()
	nextBundle.Prev = nextBundle.OwnHash
	nextBundle.OwnHash = nil
	nextBundle.Revision++

	var nextAccounts []stellar1.BundleEntry
	for _, acct := range nextBundle.Accounts {
		copiedAcct := acct.DeepCopy()
		for _, accountID := range accountIDs {
			if copiedAcct.AccountID == accountID {
				copiedAcct.AcctBundleRevision++
			}
		}
		nextAccounts = append(nextAccounts, copiedAcct)
	}
	nextBundle.Accounts = nextAccounts

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
		AccountID:          accountID,
		Mode:               stellar1.AccountMode_USER,
		IsPrimary:          makePrimary,
		AcctBundleRevision: 1,
		Name:               name,
	})
	bundle.AccountBundles[accountID] = stellar1.AccountBundle{
		AccountID: accountID,
		Signers:   []stellar1.SecretKey{secretKey},
	}
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
