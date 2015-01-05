package libkb

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-jsonw"
	"github.com/keybase/go-triplesec"
	"github.com/keybase/protocol/go"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"golang.org/x/crypto/openpgp/packet"
	"golang.org/x/crypto/sha3"
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

func PgpFingerprintFromHexNoError(s string) *PgpFingerprint {
	if len(s) == 0 {
		return nil
	} else if f, e := PgpFingerprintFromHex(s); e == nil {
		return f
	} else {
		return nil
	}
}

func (p PgpFingerprint) ToString() string {
	return hex.EncodeToString(p[:])
}

func (p PgpFingerprint) ToQuads() string {
	x := []byte(strings.ToUpper(p.ToString()))
	totlen := len(x)*5/4 - 1
	ret := make([]byte, totlen)
	j := 0
	for i, b := range x {
		ret[j] = b
		j++
		if (i%4) == 3 && j < totlen {
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
	err = k.EncodeToStream(noOpCloser{&buf})
	if err == nil {
		ret = string(buf.Bytes())
	}
	return
}

func (k *PgpKeyBundle) EncodeToStream(wc io.WriteCloser) (err error) {

	// See Issue #32
	empty_headers := make(map[string]string)
	var writer io.WriteCloser
	writer, err = armor.Encode(wc, "PGP PUBLIC KEY BLOCK", empty_headers)

	if err != nil {
		return
	}

	if err = ((*openpgp.Entity)(k)).Serialize(writer); err != nil {
		return
	}

	if err = writer.Close(); err != nil {
		return
	}
	return
}

func ReadOneKeyFromString(s string) (*PgpKeyBundle, error) {
	reader := strings.NewReader(s)
	el, err := openpgp.ReadArmoredKeyRing(reader)
	return finishReadOne(el, err)
}

func finishReadOne(el []*openpgp.Entity, err error) (*PgpKeyBundle, error) {
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

func ReadOneKeyFromBytes(b []byte) (*PgpKeyBundle, error) {
	reader := bytes.NewBuffer(b)
	el, err := openpgp.ReadKeyRing(reader)
	return finishReadOne(el, err)
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
	var pri string
	if len(k.Identities) == 0 {
		return []string{}
	}
	var first *openpgp.Identity
	for _, id := range k.Identities {
		if first == nil {
			first = id
		}
		if id.SelfSignature != nil && id.SelfSignature.IsPrimaryId != nil && *id.SelfSignature.IsPrimaryId {
			pri = id.Name
			break
		}
	}
	if len(pri) == 0 {
		pri = first.Name
	}
	return []string{"user: " + pri}
}

type KID []byte
type KID2 []byte

type GenericKey interface {
	GetKid() KID
	SignToString([]byte) (string, *SigId, error)
	ToP3SKB(ts *triplesec.Cipher) (*P3SKB, error)
}

func (k KID) ToString() string {
	return hex.EncodeToString(k)
}

func (k KID) ToBytes() []byte {
	return []byte(k)
}

func (k *PgpKeyBundle) GetKid() KID {

	prefix := []byte{
		byte(KEYBASE_KID_V1),
		byte(k.PrimaryKey.PubKeyAlgo),
	}

	// XXX Hack;  Because PublicKey.serializeWithoutHeaders is off-limits
	// to us, we need to do a full serialize and then strip off the header.
	// The further annoyance is that the size of the header varies with the
	// bitlen of the key.  Small keys (<191 bytes total) yield 8 bytes of header
	// material --- for instance, 1024-bit test keys.  For longer keys, we
	// have 9 bytes of header material, to encode a 2-byte frame, rather than
	// a 1-byte frame.
	buf := bytes.Buffer{}
	k.PrimaryKey.Serialize(&buf)
	byts := buf.Bytes()
	hdr_bytes := 8
	if len(byts) >= 193 {
		hdr_bytes++
	}
	sum := sha256.Sum256(buf.Bytes()[hdr_bytes:])

	out := append(prefix, sum[:]...)
	out = append(out, byte(ID_SUFFIX_KID))

	return KID(out)
}

func (k PgpKeyBundle) GetKid2() KID2 {

	prefix := []byte{
		byte(KEYBASE_KID_V2),
		byte(k.PrimaryKey.PubKeyAlgo),
	}

	buf := bytes.Buffer{}
	k.PrimaryKey.Serialize(&buf)
	sum := make([]byte, 64)
	sha3.ShakeSum256(sum, buf.Bytes()[9:])

	out := append(prefix, sum...)
	out = append(out, byte(ID_SUFFIX_KID))

	return KID2(out)
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

	unlocker := func(pw string) (ret *PgpKeyBundle, err error) {

		if err = p.PrivateKey.Decrypt([]byte(pw)); err == nil {

			// Also decrypt all subkeys (with the same password)
			for _, subkey := range p.Subkeys {
				if priv := subkey.PrivateKey; priv == nil {
				} else if err = priv.Decrypt([]byte(pw)); err != nil {
					break
				}
			}
			ret = p

			// XXX this is gross, the openpgp library should return a better
			// error if the PW was incorrectly specified
		} else if strings.HasSuffix(err.Error(), "private key checksum failure") {
			err = PassphraseError{}
		}
		return
	}

	_, err := KeyUnlocker{
		Tries:    5,
		Reason:   reason,
		KeyDesc:  p.VerboseDescription(),
		Unlocker: unlocker,
	}.Run()
	return err
}

func (p *PgpKeyBundle) CheckFingerprint(fp *PgpFingerprint) (err error) {
	if (fp == nil) != (p == nil) {
		err = UnexpectedKeyError{}
	} else if p != nil {
		fp2 := p.GetFingerprint()
		if !fp2.Eq(*fp) {
			err = BadFingerprintError{fp2, *fp}
		}
	}
	return
}

func (key *PgpKeyBundle) SignToString(payload []byte) (out string, id *SigId, err error) {
	return SimpleSign(payload, *key)
}

func WriteP3SKBToKeyring(k GenericKey, tsec *triplesec.Cipher) (p3skb *P3SKB, err error) {
	if G.Keyrings == nil {
		err = NoKeyringsError{}
	} else if p3skb, err = k.ToP3SKB(tsec); err == nil {
		err = G.Keyrings.P3SKB.PushAndSave(p3skb)
	}
	return
}

func ExportAsFOKID(fp *PgpFingerprint, kid KID) (ret keybase_1.FOKID) {
	if fp != nil {
		b := (*fp)[:]
		ret.PgpFingerprint = &b
	}
	if kid != nil {
		b := []byte(kid)
		ret.Kid = &b
	}
	return

}
