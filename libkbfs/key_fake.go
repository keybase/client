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

func (k KeyFake) SignToString(msg []byte) (sig string, id *libkb.SigId, err error) {
	return string(msg), nil, nil
}

func (k KeyFake) VerifyStringAndExtract(sig string) (msg []byte, id *libkb.SigId, err error) {
	return []byte(sig), nil, nil
}

func (k KeyFake) VerifyString(sig string, msg []byte) (id *libkb.SigId, err error) {
	return nil, nil
}

func (k KeyFake) SignToBytes(msg []byte) (sig []byte, err error) {
	sig = make([]byte, len(msg))
	copy(sig[:], msg[:])
	return
}

func (k KeyFake) VerifyBytes(sig, msg []byte) (err error) {
	return
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
