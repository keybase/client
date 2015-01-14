package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"github.com/keybase/go-jsonw"
	"github.com/keybase/go-triplesec"
)

type KID []byte
type KID2 []byte

type GenericKey interface {
	GetKid() KID
	GetFingerprintP() *PgpFingerprint
	GetAlgoType() int
	SignToString([]byte) (string, *SigId, error)
	Verify(string, []byte) (*SigId, error)
	ToP3SKB(ts *triplesec.Cipher) (*P3SKB, error)
	VerboseDescription() string
	CheckSecretKey() error
	Encode() (string, error) // encode public key to string
}

func (k KID) ToMapKey() string {
	return k.ToString()
}

func (k KID) ToShortIdString() string {
	return base64.StdEncoding.EncodeToString(k[0:12])
}

func (k KID) ToString() string {
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

func (k KID) ToBytes() []byte {
	return []byte(k)
}

func (k KID) Eq(k2 KID) bool {
	return SecureByteArrayEq([]byte(k), []byte(k2))
}

func WriteP3SKBToKeyring(k GenericKey, tsec *triplesec.Cipher, lui LogUI) (p3skb *P3SKB, err error) {
	if G.Keyrings == nil {
		err = NoKeyringsError{}
	} else if p3skb, err = k.ToP3SKB(tsec); err == nil {
		err = G.Keyrings.P3SKB.PushAndSave(p3skb, lui)
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

func (f FOKID) ToString() string {
	if f.Kid != nil {
		return f.Kid.ToString()
	} else if f.Fp != nil {
		return f.Fp.ToString()
	} else {
		return ""
	}
}

func (f FOKID) ToStrings() (ret []string) {
	if f.Kid != nil {
		ret = append(ret, f.Kid.ToString())
	}
	if f.Fp != nil {
		ret = append(ret, f.Fp.ToString())
	}
	return
}

func GenericKeyToFOKID(key GenericKey) FOKID {
	return FOKID{
		Kid: key.GetKid(),
		Fp:  key.GetFingerprintP(),
	}
}
