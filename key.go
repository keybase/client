package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"encoding/hex"
	"fmt"
)

type PgpKeyBundle openpgp.Entity

const (
	PGP_FINGERPRINT_LEN = 20
)

type PgpFingerprint []byte

func PgpFingerprintFromHex(s string) (PgpFingerprint, error) {
	bv, err := hex.DecodeString(s)
	if err == nil && len(bv) != PGP_FINGERPRINT_LEN {
		err = fmt.Errorf("Bad fingerprint; wrong length: %d", len(bv))
		bv = nil
	}
	var ret PgpFingerprint
	if bv != nil {
		ret = PgpFingerprint(bv)
	}
	return ret, err
}

func (p PgpFingerprint) ToString() string {
	return hex.EncodeToString(p)
}
