package libkb

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"golang.org/x/crypto/openpgp/packet"
)

type PGPKeyBundle struct {
	*openpgp.Entity

	// We make the (fairly dangerous) assumption that the key will never be
	// modified. This avoids the issue that encoding an openpgp.Entity is
	// nondeterministic due to Go's randomized iteration order (so different
	// exports of the same key may hash differently).
	//
	// If you're *sure* that you're creating a PGPKeyBundle from an armored
	// *public* key, you can prefill this field and Export() will use it.
	ArmoredPublicKey string
}

func NewPGPKeyBundle(entity *openpgp.Entity) *PGPKeyBundle {
	return &PGPKeyBundle{Entity: entity}
}

const (
	PGPFingerprintLen = 20
)

type PGPFingerprint [PGPFingerprintLen]byte

func PGPFingerprintFromHex(s string) (*PGPFingerprint, error) {
	var fp PGPFingerprint
	n, err := hex.Decode([]byte(fp[:]), []byte(s))
	var ret *PGPFingerprint
	if err != nil {
		// Noop
	} else if n != PGPFingerprintLen {
		err = fmt.Errorf("Bad fingerprint; wrong length: %d", n)
	} else {
		ret = &fp
	}
	return ret, err
}

func PGPFingerprintFromHexNoError(s string) *PGPFingerprint {
	if len(s) == 0 {
		return nil
	} else if f, e := PGPFingerprintFromHex(s); e == nil {
		return f
	} else {
		return nil
	}
}

func (p PGPFingerprint) String() string {
	return hex.EncodeToString(p[:])
}

func (p PGPFingerprint) ToQuads() string {
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

func (p PGPFingerprint) ToKeyID() string {
	return strings.ToUpper(hex.EncodeToString(p[12:20]))
}

func (p PGPFingerprint) ToDisplayString(verbose bool) string {
	if verbose {
		return p.String()
	}
	return p.ToKeyID()
}

func (p *PGPFingerprint) Match(q string, exact bool) bool {
	if p == nil {
		return false
	}
	if exact {
		return strings.ToLower(p.String()) == strings.ToLower(q)
	}
	return strings.HasSuffix(strings.ToLower(p.String()), strings.ToLower(q))
}

func (k *PGPKeyBundle) FullHash() (string, error) {
	keyBlob, err := k.Encode()
	if err != nil {
		return "", err
	}

	keySum := sha256.Sum256([]byte(strings.TrimSpace(keyBlob)))
	return hex.EncodeToString(keySum[:]), nil
}

func (k *PGPKeyBundle) StripRevocations() {
	k.Revocations = nil

	oldSubkeys := k.Subkeys
	k.Subkeys = nil
	for _, subkey := range oldSubkeys {
		// Skip revoked subkeys
		if subkey.Sig.SigType == packet.SigTypeSubkeyBinding {
			k.Subkeys = append(k.Subkeys, subkey)
		}
	}
}

func (k *PGPKeyBundle) StoreToLocalDb() error {
	s, err := k.Encode()
	if err != nil {
		return err
	}
	val := jsonw.NewString(s)
	G.Log.Debug("| Storing Key (fp=%s, kid=%s) to Local DB", k.GetFingerprint(), k.GetKID())
	return G.LocalDb.Put(DbKey{Typ: DBPGPKey, Key: k.GetFingerprint().String()}, []DbKey{}, val)
}

func (p PGPFingerprint) Eq(p2 PGPFingerprint) bool {
	return FastByteArrayEq(p[:], p2[:])
}

func GetPGPFingerprint(w *jsonw.Wrapper) (*PGPFingerprint, error) {
	s, err := w.GetString()
	if err != nil {
		return nil, err
	}
	return PGPFingerprintFromHex(s)
}

func GetPGPFingerprintVoid(w *jsonw.Wrapper, p *PGPFingerprint, e *error) {
	ret, err := GetPGPFingerprint(w)
	if err != nil {
		*e = err
	} else {
		*p = *ret
	}
}

func (k PGPKeyBundle) toList() openpgp.EntityList {
	list := make(openpgp.EntityList, 1, 1)
	list[0] = k.Entity
	return list
}

func (k PGPKeyBundle) GetFingerprint() PGPFingerprint {
	return PGPFingerprint(k.PrimaryKey.Fingerprint)
}

func (k PGPKeyBundle) GetFingerprintP() *PGPFingerprint {
	fp := k.GetFingerprint()
	return &fp
}

func (k PGPKeyBundle) KeysById(id uint64) []openpgp.Key {
	return k.toList().KeysById(id)
}

func (k PGPKeyBundle) KeysByIdUsage(id uint64, usage byte) []openpgp.Key {
	return k.toList().KeysByIdUsage(id, usage)
}

func (k PGPKeyBundle) DecryptionKeys() []openpgp.Key {
	return k.toList().DecryptionKeys()
}

func (k PGPKeyBundle) MatchesKey(key *openpgp.Key) bool {
	return FastByteArrayEq(k.PrimaryKey.Fingerprint[:],
		key.Entity.PrimaryKey.Fingerprint[:])
}

func (k *PGPKeyBundle) Encode() (ret string, err error) {
	if k.ArmoredPublicKey != "" {
		return k.ArmoredPublicKey, nil
	}
	buf := bytes.Buffer{}
	err = k.EncodeToStream(NopWriteCloser{&buf})
	if err == nil {
		ret = string(buf.Bytes())
		k.ArmoredPublicKey = ret
	}
	return
}

func PGPKeyRawToArmored(raw []byte, priv bool) (ret string, err error) {

	var writer io.WriteCloser
	var out bytes.Buffer
	var which string

	if priv {
		which = "PRIVATE"
	} else {
		which = "PUBLIC"
	}
	hdr := fmt.Sprintf("PGP %s KEY BLOCK", which)

	writer, err = armor.Encode(&out, hdr, PGPArmorHeaders)

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

func (k *PGPKeyBundle) EncodeToStream(wc io.WriteCloser) (err error) {

	// See Issue #32
	var writer io.WriteCloser
	writer, err = armor.Encode(wc, "PGP PUBLIC KEY BLOCK", PGPArmorHeaders)

	if err != nil {
		return
	}

	if err = k.Entity.Serialize(writer); err != nil {
		return
	}
	if err = writer.Close(); err != nil {
		return
	}
	return
}

// note:  openpgp.ReadArmoredKeyRing only returns the first block.
// It will never return multiple entities.
func ReadOneKeyFromString(s string) (*PGPKeyBundle, error) {
	reader := strings.NewReader(s)
	el, err := openpgp.ReadArmoredKeyRing(reader)
	return finishReadOne(el, s, err)
}

// firstPrivateKey scans s for a private key block.
func firstPrivateKey(s string) (string, error) {
	scanner := bufio.NewScanner(strings.NewReader(s))
	var lines []string
	looking := true
	complete := false
	for scanner.Scan() {
		line := scanner.Text()
		if looking && strings.HasPrefix(line, "-----BEGIN PGP PRIVATE KEY BLOCK-----") {
			looking = false

		}
		if looking {
			continue
		}
		lines = append(lines, line)
		if strings.HasPrefix(line, "-----END PGP PRIVATE KEY BLOCK-----") {
			complete = true
			break
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	if looking {
		// never found a private key block
		return "", NoSecretKeyError{}
	}
	if !complete {
		// string ended without the end tag
		return "", errors.New("never found end block line")
	}
	return strings.Join(lines, "\n"), nil
}

// ReadPrivateKeyFromString finds the first private key block in s
// and decodes it into a PGPKeyBundle.  It is useful in the case
// where s contains multiple key blocks and you want the private
// key block.  For example, the result of gpg export.
func ReadPrivateKeyFromString(s string) (*PGPKeyBundle, error) {
	priv, err := firstPrivateKey(s)
	if err != nil {
		return nil, err
	}
	return ReadOneKeyFromString(priv)
}

func finishReadOne(el []*openpgp.Entity, armored string, err error) (*PGPKeyBundle, error) {
	if err != nil {
		return nil, err
	}
	if len(el) == 0 {
		return nil, fmt.Errorf("No keys found in primary bundle")
	} else if len(el) != 1 {
		return nil, fmt.Errorf("Found multiple keys; wanted just one")
	} else {
		return NewPGPKeyBundle(el[0]), nil
	}
}

func ReadOneKeyFromBytes(b []byte) (*PGPKeyBundle, error) {
	reader := bytes.NewBuffer(b)
	el, err := openpgp.ReadKeyRing(reader)
	return finishReadOne(el, "", err)
}

func GetOneKey(jw *jsonw.Wrapper) (*PGPKeyBundle, error) {
	s, err := jw.GetString()
	if err != nil {
		return nil, err
	}
	return ReadOneKeyFromString(s)
}

// XXX for now this is OK but probably we need a PGP uid parser
// as in pgp-utils
func (k *PGPKeyBundle) FindKeybaseUsername(un string) bool {

	rxx := regexp.MustCompile("(?i)< " + un + "@keybase.io>$")

	for _, id := range k.Identities {
		if rxx.MatchString(id.Name) {
			return true
		}
	}
	return false
}

func (k PGPKeyBundle) VerboseDescription() string {
	lines := k.UsersDescription()
	lines = append(lines, k.KeyDescription())
	return strings.Join(lines, "\n")
}

func (k PGPKeyBundle) UsersDescription() []string {
	id := k.GetPrimaryUID()
	if len(id) == 0 {
		return nil
	}
	return []string{"user: " + id}
}

// GetPrimaryUID gets the primary UID in the given key bundle, returned
// in the 'Max K (foo) <bar@baz.com>' convention.
func (k PGPKeyBundle) GetPrimaryUID() string {

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

func (k *PGPKeyBundle) HasSecretKey() bool {
	return k.PrivateKey != nil
}

func (k *PGPKeyBundle) CheckSecretKey() (err error) {
	if k.PrivateKey == nil {
		err = NoSecretKeyError{}
	} else if k.PrivateKey.Encrypted {
		err = BadKeyError{"PGP key material should be unencrypted"}
	}
	return
}

func (k *PGPKeyBundle) CanSign() bool {
	return k.PrivateKey != nil && !k.PrivateKey.Encrypted
}

func (k *PGPKeyBundle) GetKID() keybase1.KID {

	prefix := []byte{
		byte(KeybaseKIDV1),
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
	hdrBytes := 8
	if len(byts) >= 193 {
		hdrBytes++
	}
	sum := sha256.Sum256(buf.Bytes()[hdrBytes:])

	out := append(prefix, sum[:]...)
	out = append(out, byte(IDSuffixKID))

	return keybase1.KIDFromSlice(out)
}

func (k PGPKeyBundle) GetAlgoType() AlgoType {
	return AlgoType(k.PrimaryKey.PubKeyAlgo)
}

func (k PGPKeyBundle) KeyDescription() string {
	algo, kid, creation := k.KeyInfo()
	return fmt.Sprintf("%s, ID %s, created %s", algo, kid, creation)
}

func (k PGPKeyBundle) KeyInfo() (algorithm, kid, creation string) {
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

func (k *PGPKeyBundle) Unlock(reason string, secretUI SecretUI) error {
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
		UI:       secretUI,
	}.Run()
	return err
}

func (k *PGPKeyBundle) CheckFingerprint(fp *PGPFingerprint) error {
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

func (k *PGPKeyBundle) SignToString(msg []byte) (sig string, id keybase1.SigID, err error) {
	return SimpleSign(msg, *k)
}

func (k PGPKeyBundle) VerifyStringAndExtract(sig string) (msg []byte, id keybase1.SigID, err error) {
	var ps *ParsedSig
	if ps, err = PGPOpenSig(sig); err != nil {
		return
	} else if err = ps.Verify(k); err != nil {
		return
	}
	msg = ps.LiteralData
	id = ps.ID()
	return
}

func (k PGPKeyBundle) VerifyString(sig string, msg []byte) (id keybase1.SigID, err error) {
	extractedMsg, resID, err := k.VerifyStringAndExtract(sig)
	if err != nil {
		return
	}
	if !FastByteArrayEq(extractedMsg, msg) {
		err = BadSigError{"wrong payload"}
		return
	}
	id = resID
	return
}

func IsPGPAlgo(algo AlgoType) bool {
	switch algo {
	case KIDPGPRsa, KIDPGPElgamal,
		KIDPGPDsa, KIDPGPEcdh, KIDPGPEcdsa:
		return true
	}
	return false
}

func (k *PGPKeyBundle) FindEmail(em string) bool {
	for _, ident := range k.Identities {
		if i, e := ParseIdentity(ident.Name); e == nil && i.Email == em {
			return true
		}
	}
	return false
}

func (k *PGPKeyBundle) IdentityNames() []string {
	var names []string
	for _, ident := range k.Identities {
		names = append(names, ident.Name)
	}
	return names
}

func (k *PGPKeyBundle) GetPGPIdentities() []keybase1.PGPIdentity {
	ret := make([]keybase1.PGPIdentity, len(k.Identities))
	for _, pgpIdentity := range k.Identities {
		ret = append(ret, ExportPGPIdentity(pgpIdentity))
	}
	return ret
}

func (k *PGPKeyBundle) CheckIdentity(kbid Identity) (match bool, ctime int64, etime int64) {
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

// EncryptToString fails for this type of key, since we haven't implemented it yet
func (k *PGPKeyBundle) EncryptToString(plaintext []byte, sender GenericKey) (ciphertext string, err error) {
	err = KeyCannotEncryptError{}
	return
}

// DecryptFromString fails for this type of key, since we haven't implemented it yet
func (k *PGPKeyBundle) DecryptFromString(ciphertext string) (msg []byte, sender keybase1.KID, err error) {
	err = KeyCannotDecryptError{}
	return
}

// CanEncrypt returns false for now, since we haven't implemented PGP encryption of packets
// for metadata operations
func (k *PGPKeyBundle) CanEncrypt() bool { return false }

// CanDecrypt returns false for now, since we haven't implemented PGP encryption of packets
// for metadata operations
func (k *PGPKeyBundle) CanDecrypt() bool { return false }

//===================================================

// Fulfill the TrackIdComponent interface

func (p PGPFingerprint) ToIDString() string {
	return p.String()
}

func (p PGPFingerprint) ToKeyValuePair() (string, string) {
	return "fingerprint", p.ToIDString()
}

func (p PGPFingerprint) GetProofState() keybase1.ProofState {
	return keybase1.ProofState_OK
}

func (p PGPFingerprint) LastWriterWins() bool {
	return false
}

//===================================================
