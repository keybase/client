package libkb

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"golang.org/x/crypto/openpgp/packet"
	"golang.org/x/crypto/sha3"
)

type PgpKeyBundle openpgp.Entity

const (
	PGP_FINGERPRINT_LEN = 20
)

type PgpFingerprint [PGP_FINGERPRINT_LEN]byte

// Remove the need for the PgpFingerprintMapKey type. See
// https://github.com/keybase/client/issues/413 .
type PgpFingerprintMapKey string

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

func (p PgpFingerprint) String() string {
	return hex.EncodeToString(p[:])
}

func (p PgpFingerprint) ToMapKey() PgpFingerprintMapKey {
	return PgpFingerprintMapKey(p.String())
}

func (p PgpFingerprint) ToFOKIDMapKey() FOKIDMapKey {
	return FOKIDMapKey(p.ToMapKey())
}

func (p PgpFingerprint) ToQuads() string {
	x := []byte(strings.ToUpper(p.String()))
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
		return p.String()
	}
	return p.ToKeyId()
}

func (p PgpFingerprint) LoadFromLocalDb() (*PgpKeyBundle, error) {
	dbobj, err := G.LocalDb.Get(DbKey{
		Typ: DB_PGP_KEY,
		Key: p.String(),
	})
	if err != nil {
		return nil, err
	}
	if dbobj == nil {
		return nil, nil
	}
	return GetOneKey(dbobj)
}

func (k *PgpKeyBundle) StoreToLocalDb() error {
	s, err := k.Encode()
	if err != nil {
		return err
	}
	val := jsonw.NewString(s)
	G.Log.Debug("| Storing Key (fp=%s) to Local DB", k.GetFingerprint())
	return G.LocalDb.Put(DbKey{Typ: DB_PGP_KEY, Key: k.GetFingerprint().String()}, []DbKey{}, val)
}

func (p PgpFingerprint) Eq(p2 PgpFingerprint) bool {
	return FastByteArrayEq(p[:], p2[:])
}

func GetPgpFingerprint(w *jsonw.Wrapper) (*PgpFingerprint, error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	return PgpFingerprintFromHex(s)
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

func (k PgpKeyBundle) GetFingerprintP() *PgpFingerprint {
	fp := k.GetFingerprint()
	return &fp
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
	err = k.EncodeToStream(NopWriteCloser{&buf})
	if err == nil {
		ret = string(buf.Bytes())
	}
	return
}

func PgpKeyRawToArmored(raw []byte, priv bool) (ret string, err error) {

	var writer io.WriteCloser
	var out bytes.Buffer
	var which string

	if priv {
		which = "PRIVATE"
	} else {
		which = "PUBLIC"
	}
	hdr := fmt.Sprintf("PGP %s KEY BLOCK", which)

	writer, err = armor.Encode(&out, hdr, PgpArmorHeaders)

	if err != nil {
		return
	}
	if _, err = writer.Write(raw); err != nil {
		return
	}
	writer.Close()
	ret = out.String()
	return
}

func (k *PgpKeyBundle) EncodeToStream(wc io.WriteCloser) (err error) {

	// See Issue #32
	var writer io.WriteCloser
	writer, err = armor.Encode(wc, "PGP PUBLIC KEY BLOCK", PgpArmorHeaders)

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
	id := k.GetPrimaryUID()
	if len(id) == 0 {
		return nil
	}
	return []string{"user: " + id}
}

// GetPrimaryUID gets the primary UID in the given key bundle, returned
// in the 'Max K (foo) <bar@baz.com>' convention.
func (k PgpKeyBundle) GetPrimaryUID() string {

	var pri *openpgp.Identity
	var s string
	if len(k.Identities) == 0 {
		return ""
	}
	var first *openpgp.Identity
	for _, id := range k.Identities {
		if first == nil {
			first = id
		}
		if id.SelfSignature != nil && id.SelfSignature.IsPrimaryId != nil && *id.SelfSignature.IsPrimaryId {
			pri = id
			break
		}
	}
	if pri == nil {
		pri = first
	}
	if pri.UserId != nil {
		s = pri.UserId.Id
	} else {
		s = pri.Name
	}
	return s
}

func (k *PgpKeyBundle) HasSecretKey() bool {
	return k.PrivateKey != nil
}

func (k *PgpKeyBundle) CheckSecretKey() (err error) {
	if k.PrivateKey == nil {
		err = NoSecretKeyError{}
	} else if k.PrivateKey.Encrypted {
		err = BadKeyError{"PGP key material should be unencrypted"}
	}
	return
}

func (k *PgpKeyBundle) CanSign() bool {
	return k.PrivateKey != nil && !k.PrivateKey.Encrypted
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

func (k PgpKeyBundle) GetAlgoType() AlgoType {
	return AlgoType(k.PrimaryKey.PubKeyAlgo)
}

func (k PgpKeyBundle) KeyDescription() string {
	algo, kid, creation := k.KeyInfo()
	return fmt.Sprintf("%s, ID %s, created %s", algo, kid, creation)
}

func (k PgpKeyBundle) KeyInfo() (algorithm, kid, creation string) {
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

	bl, err := pubkey.BitLength()
	if err != nil {
		bl = 0
	}

	algorithm = fmt.Sprintf("%d-bit %s key", bl, typ)
	kid = pubkey.KeyIdString()
	creation = pubkey.CreationTime.Format("2006-01-02")

	return
}

func (k *PgpKeyBundle) Unlock(reason string, secretUI SecretUI) error {
	if !k.PrivateKey.Encrypted {
		return nil
	}

	unlocker := func(pw string, _ bool) (ret GenericKey, err error) {

		if err = k.PrivateKey.Decrypt([]byte(pw)); err == nil {

			// Also decrypt all subkeys (with the same password)
			for _, subkey := range k.Subkeys {
				if priv := subkey.PrivateKey; priv == nil {
				} else if err = priv.Decrypt([]byte(pw)); err != nil {
					break
				}
			}
			ret = k

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
		KeyDesc:  k.VerboseDescription(),
		Unlocker: unlocker,
		Ui:       secretUI,
	}.Run()
	return err
}

func (k *PgpKeyBundle) CheckFingerprint(fp *PgpFingerprint) error {
	if k == nil {
		return UnexpectedKeyError{}
	}
	if fp == nil {
		return UnexpectedKeyError{}
	}
	fp2 := k.GetFingerprint()
	if !fp2.Eq(*fp) {
		return BadFingerprintError{fp2, *fp}
	}
	return nil
}

func (k *PgpKeyBundle) SignToString(msg []byte) (sig string, id keybase1.SigID, err error) {
	return SimpleSign(msg, *k)
}

func (k PgpKeyBundle) VerifyStringAndExtract(sig string) (msg []byte, id keybase1.SigID, err error) {
	var ps *ParsedSig
	if ps, err = PgpOpenSig(sig); err != nil {
		return
	} else if err = ps.Verify(k); err != nil {
		return
	}
	msg = ps.LiteralData
	id = ps.ID()
	return
}

func (k PgpKeyBundle) VerifyString(sig string, msg []byte) (id keybase1.SigID, err error) {
	extractedMsg, resId, err := k.VerifyStringAndExtract(sig)
	if err != nil {
		return
	}
	if !FastByteArrayEq(extractedMsg, msg) {
		err = BadSigError{"wrong payload"}
		return
	}
	id = resId
	return
}

func ExportAsFOKID(fp *PgpFingerprint, kid KID) (ret keybase1.FOKID) {
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

func IsPgpAlgo(algo AlgoType) bool {
	switch algo {
	case KID_PGP_RSA, KID_PGP_ELGAMAL,
		KID_PGP_DSA, KID_PGP_ECDH, KID_PGP_ECDSA:
		return true
	}
	return false
}

func (k *PgpKeyBundle) FindEmail(em string) bool {
	for _, ident := range k.Identities {
		if i, e := ParseIdentity(ident.Name); e == nil && i.Email == em {
			return true
		}
	}
	return false
}

func (k *PgpKeyBundle) IdentityNames() []string {
	var names []string
	for _, ident := range k.Identities {
		names = append(names, ident.Name)
	}
	return names
}

func (k *PgpKeyBundle) CheckIdentity(kbid Identity) (match bool, ctime int64, etime int64) {
	ctime, etime = -1, -1
	for _, pgpIdentity := range k.Identities {
		if Cicmp(pgpIdentity.UserId.Email, kbid.Email) {
			match = true
			ctime = pgpIdentity.SelfSignature.CreationTime.Unix()
			// This is a special case in OpenPGP, so we used KeyLifetimeSecs
			lifeSeconds := pgpIdentity.SelfSignature.KeyLifetimeSecs
			if lifeSeconds == nil {
				// No expiration time is OK, it just means it never expires.
				etime = 0
			} else {
				etime = ctime + int64(*lifeSeconds)
			}
			break
		}
	}
	return
}

//===================================================

// Fulfill the TrackIdComponent interface

func (p PgpFingerprint) ToIdString() string {
	return p.String()
}

func (p PgpFingerprint) ToKeyValuePair() (string, string) {
	return "fingerprint", p.ToIdString()
}

func (p PgpFingerprint) GetProofState() keybase1.ProofState {
	return keybase1.ProofState_OK
}

func (p PgpFingerprint) LastWriterWins() bool {
	return false
}

//===================================================
