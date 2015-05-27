package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
)

type KID []byte
type KID2 []byte

// Remove the need for the KIDMapKey type. See
// https://github.com/keybase/client/issues/413 .
type KIDMapKey string

func (key KIDMapKey) ToKID() (KID, error) {
	return ImportKID(string(key))
}

type AlgoType int

type GenericKey interface {
	GetKid() KID
	GetFingerprintP() *PgpFingerprint
	GetAlgoType() AlgoType

	// Sign to an ASCII signature (which includes the message
	// itself) and return it, along with a derived ID.
	SignToString(msg []byte) (sig string, id keybase1.SigID, err error)

	// Verify that the given signature is valid and extracts the
	// embedded message from it. Also returns the signature ID.
	VerifyStringAndExtract(sig string) (msg []byte, id keybase1.SigID, err error)

	// Verify that the given signature is valid and that its
	// embedded message matches the given one. Also returns the
	// signature ID.
	VerifyString(sig string, msg []byte) (id keybase1.SigID, err error)

	// Sign to a binary signature (which doesn't include the
	// message) and return it.
	SignToBytes(msg []byte) (sig []byte, err error)

	// Verify that the given signature is valid and is for the
	// given message.
	VerifyBytes(sig, msg []byte) (err error)

	ToSKB(ts *triplesec.Cipher) (*SKB, error)
	ToLksSKB(lks *LKSec) (*SKB, error)
	VerboseDescription() string
	CheckSecretKey() error
	CanSign() bool
	HasSecretKey() bool
	Encode() (string, error) // encode public key to string
}

func (k KID) ToFOKID() FOKID {
	return FOKID{Kid: k}
}

func (k KID) ToMapKey() KIDMapKey {
	return KIDMapKey(k.String())
}

func (k KID) ToFOKIDMapKey() FOKIDMapKey {
	return FOKIDMapKey(k.ToMapKey())
}

func (k KID) ToShortIdString() string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(k[0:12]), "=")
}

func (k KID) String() string {
	return hex.EncodeToString(k)
}

func (k KID) IsValid() bool {
	return k != nil && len(k) > 0
}

func ImportKID(s string) (ret KID, err error) {
	var tmp []byte
	if tmp, err = hex.DecodeString(s); err == nil && len(tmp) > 0 {
		ret = KID(tmp)
	}
	return
}

func GetKID(w *jsonw.Wrapper) (kid KID, err error) {
	var s string
	if s, err = w.GetString(); err == nil && len(s) > 0 {
		kid, err = ImportKID(s)
	}
	return
}

func (k KID) MarshalJSON() ([]byte, error) {
	return json.Marshal(k.String())
}

func (k *KID) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	kid, err := ImportKID(s)
	if err != nil {
		return err
	}
	*k = kid
	return nil
}

func (k KID) ToJsonw() *jsonw.Wrapper {
	if k == nil {
		return jsonw.NewNil()
	}
	return jsonw.NewString(k.String())
}

func CanEncrypt(key GenericKey) bool {
	switch key.(type) {
	case NaclDHKeyPair:
		return true
	case *PgpKeyBundle:
		return true
	default:
		return false
	}
}

func (k KID) ToBytes() []byte {
	return []byte(k)
}

func (k KID) Eq(k2 KID) bool {
	return SecureByteArrayEq([]byte(k), []byte(k2))
}

func WriteLksSKBToKeyring(k GenericKey, lks *LKSec, lui LogUI, lctx LoginContext) (*SKB, error) {
	skb, err := k.ToLksSKB(lks)
	if err != nil {
		return nil, fmt.Errorf("k.ToLksSKB() error: %s", err)
	}
	if err := skbPushAndSave(skb, lui, lctx); err != nil {
		return nil, err
	}
	return skb, nil
}

func skbPushAndSave(skb *SKB, lui LogUI, lctx LoginContext) error {
	if lctx != nil {
		kr, err := lctx.Keyring()
		if err != nil {
			return err
		}
		return kr.PushAndSave(skb, lui)
	}
	var err error
	kerr := G.LoginState().Keyring(func(ring *SKBKeyringFile) {
		err = ring.PushAndSave(skb, lui)
	}, "PushAndSave")
	if kerr != nil {
		return kerr
	}
	if err != nil {
		return err
	}
	return nil
}

// FOKID is a "Fingerprint Or a KID" or both, or neither.
// We have different things in different sigchains, so we
// have this layer to abstract away the differences.
type FOKID struct {
	Kid KID
	Fp  *PgpFingerprint
}

// Can be either a KIDMapKey or PgpFingerprintMapKey, or empty.
type FOKIDMapKey string

// EqKid checks if the KID portion of the FOKID is equal
// to the given KID
func (f FOKID) EqKid(k2 KID) bool {
	return (f.Kid == nil && k2 == nil) || (f.Kid != nil && k2 != nil && f.Kid.Eq(k2))
}

// Eq checks that two FOKIDs are equal. Two FOKIDs are equal if
// (their KIDs match OR the Fingerprints match) AND they don't have
// any mismatches.
func (f FOKID) Eq(f2 FOKID) (ret bool) {
	if f.Kid == nil || f2.Kid == nil {
	} else if f.Kid.Eq(f2.Kid) {
		ret = true
	} else {
		return false
	}

	if f.Fp == nil || f2.Fp == nil {
	} else if f.Fp.Eq(*f2.Fp) {
		ret = true
	} else {
		return false
	}
	return ret
}

func (f FOKID) String() string {
	if f.Kid != nil {
		return f.Kid.String()
	} else if f.Fp != nil {
		return f.Fp.String()
	} else {
		return ""
	}
}

func (f FOKID) ToFirstMapKey() FOKIDMapKey {
	if f.Kid != nil {
		return f.Kid.ToFOKIDMapKey()
	} else if f.Fp != nil {
		return f.Fp.ToFOKIDMapKey()
	} else {
		return ""
	}
}

func (f FOKID) ToMapKeys() (ret []FOKIDMapKey) {
	if f.Kid != nil {
		ret = append(ret, f.Kid.ToFOKIDMapKey())
	}
	if f.Fp != nil {
		ret = append(ret, f.Fp.ToFOKIDMapKey())
	}
	return
}

func (f FOKID) P() *FOKID { return &f }

// Any valid FOKID matches the empty string.
func (f FOKID) matchQuery(s string) bool {
	if f.Fp != nil && strings.HasSuffix(strings.ToLower(f.Fp.String()), strings.ToLower(s)) {
		return true
	}
	if f.Kid != nil {
		if strings.HasPrefix(f.Kid.String(), strings.ToLower(s)) {
			return true
		}
		if strings.HasPrefix(f.Kid.ToShortIdString(), s) {
			return true
		}
	}
	return false
}

func GenericKeyToFOKID(key GenericKey) FOKID {
	return FOKID{
		Kid: key.GetKid(),
		Fp:  key.GetFingerprintP(),
	}
}

// Any valid key matches the empty string.
func KeyMatchesQuery(key GenericKey, q string) bool {
	return GenericKeyToFOKID(key).matchQuery(q)
}

func IsPGP(key GenericKey) bool {
	_, ok := key.(*PgpKeyBundle)
	return ok
}

func ParseGenericKey(bundle string, gc *GlobalContext) (GenericKey, error) {
	if isPgpBundle(bundle) {
		// PGP key
		return ReadOneKeyFromString(bundle)
	}
	// NaCl key
	kid, err := ImportKID(bundle)
	if err != nil {
		return nil, err
	}
	return ImportKeypairFromKID(kid, gc)
}

func isPgpBundle(armored string) bool {
	return strings.HasPrefix(armored, "-----BEGIN PGP")
}
