package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
)

// FOKID is a "Fingerprint Or a KID" or both, or neither.
// We have different things in different sigchains, so we
// have this layer to abstract away the differences.
type FOKID struct {
	Kid keybase1.KID
	Fp  *PGPFingerprint
}

// Can be either a KIDMapKey or PGPFingerprintMapKey, or empty.
type FOKIDMapKey string

// EqKid checks if the KID portion of the FOKID is equal
// to the given KID
func (f FOKID) EqKid(k2 keybase1.KID) bool {
	return (f.Kid.IsNil() && k2.IsNil()) || (f.Kid.Exists() && k2.Exists() && f.Kid.Equal(k2))
}

// Eq checks that two FOKIDs are equal. Two FOKIDs are equal if
// (their KIDs match OR the Fingerprints match) AND they don't have
// any mismatches.
func (f FOKID) Eq(f2 FOKID) (ret bool) {
	if f.Kid.IsNil() || f2.Kid.IsNil() {
	} else if f.Kid.Equal(f2.Kid) {
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
	if f.Kid.Exists() {
		return f.Kid.String()
	} else if f.Fp != nil {
		return f.Fp.String()
	} else {
		return ""
	}
}

func (f FOKID) ToFirstMapKey() FOKIDMapKey {
	if f.Kid.Exists() {
		return KIDToFOKIDMapKey(f.Kid)
	} else if f.Fp != nil {
		return f.Fp.ToFOKIDMapKey()
	} else {
		return ""
	}
}

func (f FOKID) ToMapKeys() (ret []FOKIDMapKey) {
	if f.Kid.Exists() {
		ret = append(ret, KIDToFOKIDMapKey(f.Kid))
	}
	if f.Fp != nil {
		ret = append(ret, f.Fp.ToFOKIDMapKey())
	}
	return
}

func (f FOKID) P() *FOKID { return &f }

// Any valid FOKID matches the empty string.
func (f FOKID) matchQuery(s string, exact bool) bool {
	if f.Fp.Match(s, exact) {
		return true
	}
	return f.Kid.Match(s, exact)
}
