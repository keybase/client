package libkb

import (
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
)

type AlgoType int

type GenericKey interface {
	GetKid() KID
	GetFingerprintP() *PGPFingerprint
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

	ToSKB(gc *GlobalContext, ts *triplesec.Cipher) (*SKB, error)
	ToLksSKB(lks *LKSec) (*SKB, error)
	VerboseDescription() string
	CheckSecretKey() error
	CanSign() bool
	HasSecretKey() bool
	Encode() (string, error) // encode public key to string
}

func CanEncrypt(key GenericKey) bool {
	switch key.(type) {
	case NaclDHKeyPair:
		return true
	case *PGPKeyBundle:
		return true
	default:
		return false
	}
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

func GenericKeyToFOKID(key GenericKey) FOKID {
	return FOKID{
		Kid: key.GetKid(),
		Fp:  key.GetFingerprintP(),
	}
}

// Any valid key matches the empty string.
func KeyMatchesQuery(key GenericKey, q string, exact bool) bool {
	return GenericKeyToFOKID(key).matchQuery(q, exact)
}

func IsPGP(key GenericKey) bool {
	_, ok := key.(*PGPKeyBundle)
	return ok
}

func ParseGenericKey(bundle string) (GenericKey, error) {
	if isPGPBundle(bundle) {
		// PGP key
		return ReadOneKeyFromString(bundle)
	}
	// NaCl key
	kid, err := ImportKID(bundle)
	if err != nil {
		return nil, err
	}
	return ImportKeypairFromKID(kid)
}

func isPGPBundle(armored string) bool {
	return strings.HasPrefix(armored, "-----BEGIN PGP")
}
