package libkbfs

import (
	libkb "github.com/keybase/client/go/libkb"
	triplesec "github.com/keybase/go-triplesec"
)

const (
	KID_FAKE libkb.AlgoType = 0xff
)

type KeyFake struct {
	kid KID
}

func NewKeyFake(kid KID) *KeyFake {
	return &KeyFake{kid}
}

func (k KeyFake) GetKid() libkb.KID {
	return libkb.KID(k.kid)
}

func (k KeyFake) GetFingerprintP() *libkb.PgpFingerprint {
	return nil
}

func (k KeyFake) GetAlgoType() libkb.AlgoType {
	return KID_FAKE
}

func (k KeyFake) SignToString(buf []byte) (string, *libkb.SigId, error) {
	return string(buf), nil, nil
}

func (k KeyFake) Verify(s string, buf []byte) (*libkb.SigId, error) {
	return nil, nil
}

func (k KeyFake) VerifyAndExtract(s string) ([]byte, *libkb.SigId, error) {
	return []byte(s), nil, nil
}

func (k KeyFake) ToSKB(ts *triplesec.Cipher) (*libkb.SKB, error) {
	return nil, nil
}

func (k KeyFake) ToLksSKB(lks *libkb.LKSec) (*libkb.SKB, error) {
	return nil, nil
}

func (k KeyFake) VerboseDescription() string {
	return "Fake key with ID " + string(k.kid)
}

func (k KeyFake) CheckSecretKey() error {
	return nil
}

func (k KeyFake) CanSign() bool {
	return true
}

func (k KeyFake) HasSecretKey() bool {
	return true
}

func (k KeyFake) Encode() (string, error) {
	return "", nil
}
