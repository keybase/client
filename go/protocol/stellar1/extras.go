package stellar1

import (
	"encoding/hex"
	"fmt"
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
