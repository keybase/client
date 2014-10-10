package libkb

import (
	"code.google.com/p/go.crypto/openpgp"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
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

func GetPgpFingerprint(w *jsonw.Wrapper) (PgpFingerprint, error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	ret, err := PgpFingerprintFromHex(s)
	return ret, err
}

func GetPgpFingerprintVoid(w *jsonw.Wrapper, p *PgpFingerprint, e *error) {
	ret, err := GetPgpFingerprint(w)
	if err != nil {
		*e = err
	} else {
		*p = ret
	}
}
