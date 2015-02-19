package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"strings"

	jsonw "github.com/keybase/go-jsonw"
	triplesec "github.com/keybase/go-triplesec"
)

type KID []byte
type KID2 []byte

type GenericKey interface {
	GetKid() KID
	GetFingerprintP() *PgpFingerprint
	GetAlgoType() int
	SignToString([]byte) (string, *SigId, error)
	Verify(string, []byte) (*SigId, error)
	VerifyAndExtract(string) ([]byte, *SigId, error)
	ToSKB(ts *triplesec.Cipher) (*SKB, error)
	ToLksSKB(lks *LKSec) (*SKB, error)
	VerboseDescription() string
	CheckSecretKey() error
	CanSign() bool
	Encode() (string, error) // encode public key to string
}

func (k KID) ToMapKey() string {
	return k.String()
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

func WriteLksSKBToKeyring(username string, k GenericKey, lks *LKSec, lui LogUI) (skb *SKB, err error) {
	if ring, err := G.LoadSKBKeyring(username); err != nil {
	} else if skb, err = k.ToLksSKB(lks); err != nil {
	} else {
		err = ring.PushAndSave(skb, lui)
	}
	return
}

func WriteTsecSKBToKeyring(username string, k GenericKey, tsec *triplesec.Cipher, lui LogUI) (p3skb *SKB, err error) {
	if ring, err := G.LoadSKBKeyring(username); err != nil {
	} else if p3skb, err = k.ToSKB(tsec); err != nil {
		err = ring.PushAndSave(p3skb, lui)
	}
	return
}

// FOKID is a "Fingerprint Or a KID" or both, or neither.
// We have different things in different sigchains, so we
// have this layer to abstract away the differences.
type FOKID struct {
	Kid KID
	Fp  *PgpFingerprint
}

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

func (f FOKID) ToStrings() (ret []string) {
	if f.Kid != nil {
		ret = append(ret, f.Kid.String())
	}
	if f.Fp != nil {
		ret = append(ret, f.Fp.String())
	}
	return
}

func GenericKeyToFOKID(key GenericKey) FOKID {
	return FOKID{
		Kid: key.GetKid(),
		Fp:  key.GetFingerprintP(),
	}
}
