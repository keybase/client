package stellar1

import (
	"errors"
	"fmt"
)

func (t TransactionID) String() string {
	return string(t)
}

func (t TransactionID) Eq(b TransactionID) bool {
	return t == b
}

func (k KeybaseRequestID) String() string {
	return string(k)
}

func (k KeybaseRequestID) Eq(b KeybaseRequestID) bool {
	return k == b
}

func (a AccountID) String() string {
	return string(a)
}

func (a AccountID) Eq(b AccountID) bool {
	return a == b
}

func (a AccountID) IsNil() bool {
	return len(a) == 0
}

func (s SecretKey) String() string {
	return "[secret key redacted]"
}

func (s SecretKey) SecureNoLogString() string {
	return string(s)
}

// CheckInvariants checks that the Bundle satisfies
// 1. No duplicate account IDs
// 2. Exactly one primary account
// 3. Non-negative revision numbers
// 4. Account Bundle accountIDs are consistent
// 5. every account in AccountBundles is also in Accounts
func (r Bundle) CheckInvariants() error {
	accountIDs := make(map[AccountID]bool)
	var foundPrimary bool
	for _, entry := range r.Accounts {
		_, found := accountIDs[entry.AccountID]
		if found {
			return fmt.Errorf("duplicate account ID: %v", entry.AccountID)
		}
		accountIDs[entry.AccountID] = true
		if entry.IsPrimary {
			if foundPrimary {
				return errors.New("multiple primary accounts")
			}
			foundPrimary = true
		}
		if entry.Mode == AccountMode_NONE {
			return errors.New("account missing mode")
		}
		if entry.AcctBundleRevision < 1 {
			return fmt.Errorf("account bundle revision %v < 1 for %v", entry.AcctBundleRevision, entry.AccountID)
		}
	}
	if !foundPrimary {
		return errors.New("missing primary account")
	}
	if r.Revision < 1 {
		return fmt.Errorf("revision %v < 1", r.Revision)
	}
	for accID, accBundle := range r.AccountBundles {
		if accID != accBundle.AccountID {
			return fmt.Errorf("account ID mismatch in bundle for %v", accID)
		}
		var AccountBundleInAccounts bool
		for _, accountListAccount := range r.Accounts {
			if accountListAccount.AccountID == accID {
				AccountBundleInAccounts = true
			}
		}
		if !AccountBundleInAccounts {
			return fmt.Errorf("account in AccountBundles not in Accounts %v", accID)
		}
	}
	return nil
}

func (s Bundle) Lookup(acctID AccountID) (BundleEntry, error) {
	for _, entry := range s.Accounts {
		if entry.AccountID == acctID {
			return entry, nil
		}
	}
	return BundleEntry{}, errors.New("stellar account not found")
}

func (a *Asset) IsNativeXLM() bool {
	return a.Type == "native"
}

func (a *Asset) IsEmpty() bool {
	return (a == nil) || (*a == Asset{})
}

// String returns a display friendly form of the asset, compatible with
// xdr.Asset fomat: type/code/issuer or just "native" if asset is native XLM.
func (a Asset) String() string {
	if a.Type == "native" {
		return a.Type
	}
	return fmt.Sprintf("%s/%s/%s", a.Type, a.Code, a.Issuer)
}

func (p PaymentID) String() string {
	return string(p)
}

func (c OutsideCurrencyCode) String() string {
	return string(c)
}

func (a Asset) TypeString() string {
	return a.Type
}
