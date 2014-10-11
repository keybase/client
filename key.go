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

type PgpFingerprint [PGP_FINGERPRINT_LEN]byte

func PgpFingerprintFromHex(s string) (*PgpFingerprint, error) {
	bv, err := hex.DecodeString(s)
	if err == nil && len(bv) != PGP_FINGERPRINT_LEN {
		err = fmt.Errorf("Bad fingerprint; wrong length: %d", len(bv))
		bv = nil
	}
	var ret *PgpFingerprint
	if bv != nil {
		tmp := PgpFingerprint{}
		copy(tmp[:], bv[0:PGP_FINGERPRINT_LEN])
		ret = &tmp
	}
	return ret, err
}

func (p PgpFingerprint) ToString() string {
	return hex.EncodeToString(p[:])
}

func GetPgpFingerprint(w *jsonw.Wrapper) (*PgpFingerprint, error) {
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
		*p = *ret
	}
}

func (k PgpKeyBundle) toList() openpgp.EntityList {
	list := make(openpgp.EntityList, 1, 1)
	list[0] = (*openpgp.Entity)(&k)
	return list
}

func (k PgpKeyBundle) KeysById(id uint64) []openpgp.Key {
	return k.toList().KeysById(id)
}

func (k PgpKeyBundle) KeysByIdUsage(id uint64, usage byte) []openpgp.Key {
	return k.toList().KeysByIdUsage(id, usage)
}

func (k PgpKeyBundle) DecryptionKeys() []openpgp.Key {
	return k.toList().DecryptionKeys()
}

func (k PgpKeyBundle) MatchesKey(key *openpgp.Key) bool {
	return FastByteArrayEq(k.PrimaryKey.Fingerprint[:],
		key.PublicKey.Fingerprint[:])
}
