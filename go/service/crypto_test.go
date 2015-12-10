package service

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestCryptoErrorSecretUI(t *testing.T) {
	tc := libkb.SetupTest(t, "crypto")
	defer tc.Cleanup()

	c := NewCryptoHandler(tc.G)
	secretUI := c.getSecretUI("")
	if _, ok := secretUI.(errorSecretUI); !ok {
		t.Error("secretUI %v is not an errorSecretUI", secretUI)
	}
}
