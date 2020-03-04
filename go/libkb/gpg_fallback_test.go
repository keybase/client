package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type TestGenericKey struct {
	GenericKey
}

func (k *TestGenericKey) SignToString(msg []byte) (sig string, id keybase1.SigIDBase, err error) {
	sig = "TestSignature"
	return
}

func InitTestKey(k *PGPKeyBundle) {
	k.GPGFallbackKey = &TestGenericKey{k}
}

var gpgDummyKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----
Version: GnuPG v2

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
=jcas
-----END PGP PRIVATE KEY BLOCK-----
`

var msg = []byte("test")

func TestSignWithTestKey(t *testing.T) {
	k, _, err := ReadOneKeyFromString(gpgDummyKey)
	if err != nil {
		t.Fatal(err)
	}

	if _, _, err := k.SignToString(msg); err == nil {
		t.Fatal("was able to sign with dummy skey")
	}

	// Set a fallback key to use when SimpleSign fails.
	InitTestKey(k)
	if _, _, err := k.SignToString(msg); err != nil {
		t.Fatal(err)
	}
}
