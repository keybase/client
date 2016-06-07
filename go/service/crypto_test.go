package service

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type nullSecretUI struct{}

func (nullSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, nil
}

func TestCryptoSecretUI(t *testing.T) {
	tc := libkb.SetupTest(t, "crypto", 2)
	defer tc.Cleanup()

	c := NewCryptoHandler(tc.G)

	// Should return errorSecretUI because UIRouter returned an
	// error.
	tc.G.SetUIRouter(fakeUIRouter{secretUIErr: errors.New("fake error")})
	secretUI := c.getSecretUI(0, "")
	if _, ok := secretUI.(errorSecretUI); !ok {
		t.Errorf("secretUI %v is not an errorSecretUI", secretUI)
	}

	// Should return errorSecretUI because UIRouter returned nil.
	tc.G.SetUIRouter(fakeUIRouter{})
	secretUI = c.getSecretUI(0, "")
	if _, ok := secretUI.(errorSecretUI); !ok {
		t.Errorf("secretUI %v is not an errorSecretUI", secretUI)
	}

	// Should return nullSecretUI..
	tc.G.SetUIRouter(fakeUIRouter{secretUI: nullSecretUI{}})
	secretUI = c.getSecretUI(0, "")
	if _, ok := secretUI.(nullSecretUI); !ok {
		t.Errorf("secretUI %v is not a nullSecretUI", secretUI)
	}
}
