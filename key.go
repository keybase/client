package libkb

import (
	"bytes"
	"code.google.com/p/go.crypto/openpgp"
	"code.google.com/p/go.crypto/openpgp/armor"
	"code.google.com/p/go.crypto/openpgp/packet"
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

func (k PgpKeyBundle) VerboseDescription() string {
	lines := k.UsersDescription()
	lines = append(lines, k.KeyDescription())
	return strings.Join(lines, "\n")
}

func (k PgpKeyBundle) UsersDescription() []string {
	lines := []string{}
	for _, id := range k.Identities {
		lines = append(lines, "user: "+id.Name)
	}
	return lines
}

func (k PgpKeyBundle) KeyDescription() string {
	pubkey := k.PrimaryKey

	var typ string
	switch pubkey.PubKeyAlgo {
	case packet.PubKeyAlgoRSA, packet.PubKeyAlgoRSAEncryptOnly, packet.PubKeyAlgoRSASignOnly:
		typ = "RSA"
	case packet.PubKeyAlgoDSA:
		typ = "DSA"
	case packet.PubKeyAlgoECDSA:
		typ = "ECDSA"
	default:
		typ = "<UNKONWN TYPE>"
	}

	layout := "2006-01-02"

	bl, err := pubkey.BitLength()
	if err != nil {
		bl = 0
	}

	desc := fmt.Sprintf("%d-bit %s key, ID %s, created %s",
		bl, typ, pubkey.KeyIdString(), pubkey.CreationTime.Format(layout))
	return desc
}

func (p *PgpKeyBundle) Unlock(reason string) error {
	if !p.PrivateKey.Encrypted {
		return nil
	}
	var err error
	var emsg string

	retry := true

	desc := "You need a passphrase to unlock the secret key for:\n" +
		p.VerboseDescription() + "\n"
	if len(reason) > 0 {
		desc = desc + "\n" + reason
	}

	for retry && err == nil {
		var res *SecretEntryRes
		res, err = G.SecretEntry.Get(SecretEntryArg{
			Error:  emsg,
			Desc:   desc,
			Prompt: "Your key passphrase",
		}, nil)

		if err == nil && res.Canceled {
			err = fmt.Errorf("Attempt to unlock secret key entry canceled")
		} else if err != nil {
			// noop
		} else if perr := p.PrivateKey.Decrypt([]byte(res.Text)); perr == nil {

			// Also decrypt all subkeys (with the same password)
			for _, subkey := range p.Subkeys {
				if priv := subkey.PrivateKey; priv != nil {
					if err = priv.Decrypt([]byte(res.Text)); err != nil {
						break
					}
				}
			}
			retry = false

			// XXX this is gross, the openpgp library should return a better
			// error if the PW was incorrectly specified
		} else if strings.HasSuffix(perr.Error(), "private key checksum failure") {
			emsg = "Failed to unlock key; bad passphrase."
		} else {
			err = perr
		}
	}

	return err
}
