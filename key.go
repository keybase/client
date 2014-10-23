package libkb

import (
	"bytes"
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
	"io"
	"regexp"
	"strings"
)

type PgpKeyBundle openpgp.Entity

const (
	PGP_FINGERPRINT_LEN = 20
)

type PgpFingerprint [PGP_FINGERPRINT_LEN]byte

func PgpFingerprintFromHex(s string) (*PgpFingerprint, error) {
	var fp PgpFingerprint
	n, err := hex.Decode([]byte(fp[:]), []byte(s))
	var ret *PgpFingerprint
	if err != nil {
		// Noop
	} else if n != PGP_FINGERPRINT_LEN {
		err = fmt.Errorf("Bad fingerprint; wrong length: %d", n)
	} else {
		ret = &fp
	}
	return ret, err
}

func (p PgpFingerprint) ToString() string {
	return hex.EncodeToString(p[:])
}

func (p PgpFingerprint) ToQuads() string {
	x := []byte(strings.ToUpper(p.ToString()))
	ret := make([]byte, len(x)*5/4-1)
	j := 0
	for i, b := range x {
		ret[j] = b
		j++
		if (i%4) == 0 && i > 0 {
			ret[j] = ' '
			j++
		}
	}
	return string(ret)
}

func (p PgpFingerprint) ToKeyId() string {
	return strings.ToUpper(hex.EncodeToString(p[12:20]))
}

func (p PgpFingerprint) ToDisplayString(verbose bool) string {
	if verbose {
		return p.ToString()
	} else {
		return p.ToKeyId()
	}
}

func (p PgpFingerprint) LoadFromLocalDb() (*PgpKeyBundle, error) {
	dbobj, err := G.LocalDb.Get(DbKey{
		Typ: DB_PGP_KEY,
		Key: p.ToString(),
	})
	if err != nil {
		return nil, err
	}
	if dbobj == nil {
		return nil, nil
	}
	return GetOneKey(dbobj)
}

func (p *PgpKeyBundle) StoreToLocalDb() error {
	if s, err := p.Encode(); err != nil {
		return err
	} else {
		val := jsonw.NewString(s)
		G.Log.Debug("| Storing Key (fp=%s) to Local DB", p.GetFingerprint().ToString())
		err = G.LocalDb.Put(DbKey{
			Typ: DB_PGP_KEY,
			Key: p.GetFingerprint().ToString(),
		}, []DbKey{}, val)
		return err
	}
}

func (p1 PgpFingerprint) Eq(p2 PgpFingerprint) bool {
	return FastByteArrayEq(p1[:], p2[:])
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

func (k PgpKeyBundle) GetFingerprint() PgpFingerprint {
	return PgpFingerprint(k.PrimaryKey.Fingerprint)
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
		key.Entity.PrimaryKey.Fingerprint[:])
}

func (k *PgpKeyBundle) Encode() (ret string, err error) {
	buf := bytes.Buffer{}

	// See Issue #32
	empty_headers := make(map[string]string)
	var writer io.WriteCloser
	writer, err = armor.Encode(&buf, "PGP PUBLIC KEY BLOCK", empty_headers)

	if err != nil {
		return
	}

	if err = ((*openpgp.Entity)(k)).Serialize(writer); err != nil {
		return
	}

	if err = writer.Close(); err != nil {
		return
	}

	ret = string(buf.Bytes())

	return
}

func ReadOneKeyFromString(s string) (*PgpKeyBundle, error) {
	reader := strings.NewReader(s)
	el, err := openpgp.ReadArmoredKeyRing(reader)
	if err != nil {
		return nil, err
	}
	if len(el) == 0 {
		return nil, fmt.Errorf("No keys found in primary bundle")
	} else if len(el) != 1 {
		return nil, fmt.Errorf("Found multiple keys; wanted just one")
	} else {
		return (*PgpKeyBundle)(el[0]), nil
	}
}

func GetOneKey(jw *jsonw.Wrapper) (*PgpKeyBundle, error) {
	s, err := jw.GetString()
	if err != nil {
		return nil, err
	}
	return ReadOneKeyFromString(s)
}

// XXX for now this is OK but probably we need a PGP uid parser
// as in pgp-utils
func (k *PgpKeyBundle) FindKeybaseUsername(un string) bool {

	rxx := regexp.MustCompile("(?i)< " + un + "@keybase.io>$")

	for _, id := range k.Identities {
		if rxx.MatchString(id.Name) {
			return true
		}
	}

	return false
}
