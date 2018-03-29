package stellar1

import (
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

const (
	KeybaseTransactionIDLen       = 16
	KeybaseTransactionIDSuffix    = 0x30
	KeybaseTransactionIDSuffixHex = "30"
)

func KeybaseTransactionIDFromString(s string) (KeybaseTransactionID, error) {
	if len(s) != hex.EncodedLen(KeybaseTransactionIDLen) {
		return "", fmt.Errorf("bad KeybaseTransactionID %q: must be %d bytes long", s, KeybaseTransactionIDLen)
	}
	suffix := s[len(s)-2:]
	if suffix != KeybaseTransactionIDSuffixHex {
		return "", fmt.Errorf("bad KeybaseTransactionID %q: must end in 0x%x", s, KeybaseTransactionIDSuffix)
	}
	return KeybaseTransactionID(s), nil
}

func (k KeybaseTransactionID) String() string {
	return string(k)
}

func ToTimeMs(t time.Time) TimeMs {
	return TimeMs(t.UnixNano() / 1000000)
}

func (a AccountID) String() string {
	return string(a)
}

func (s SecretKey) SecureNoLogString() string {
	return string(s)
}

// CheckInvariants checks that the bundle satisfies
// 1. No duplicate account IDs
// 2. At most one primary account
func (s Bundle) CheckInvariants() error {
	accountIDs := make(map[AccountID]bool)
	var foundPrimary bool
	for _, entry := range s.Accounts {
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
	}
	if s.Revision < 1 {
		return fmt.Errorf("revision %v < 1", s.Revision)
	}
	return nil
}
