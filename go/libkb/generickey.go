package libkb

import (
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
	triplesec "github.com/keybase/go-triplesec"
)

type AlgoType int

type GenericKey interface {
	GetKID() keybase1.KID
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

	// Encrypt to an ASCII armored encryption; optionally include a sender's
	// (private) key so that we can provably see who sent the message.
	EncryptToString(plaintext []byte, sender GenericKey) (ciphertext string, err error)

	// Decrypt the output of Encrypt above; provide the plaintext and also
	// the KID of the key that sent the message (if applicable).
	DecryptFromString(ciphertext string) (msg []byte, sender keybase1.KID, err error)

	ToServerSKB(gc *GlobalContext, ts *triplesec.Cipher, gen PassphraseGeneration) (*SKB, error)
	ToLksSKB(lks *LKSec) (*SKB, error)
	VerboseDescription() string
	CheckSecretKey() error
	CanSign() bool
	CanEncrypt() bool
	CanDecrypt() bool
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
	fmt.Printf("WriteLksSKBToKeyring\n")
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

// Any valid key matches the empty string.
func KeyMatchesQuery(key GenericKey, q string, exact bool) bool {
	if key.GetKID().Match(q, exact) {
		return true
	}
	return key.GetFingerprintP().Match(q, exact)
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
	return ImportKeypairFromKID(keybase1.KIDFromString(bundle))
}

func isPGPBundle(armored string) bool {
	return strings.HasPrefix(armored, "-----BEGIN PGP")
}
