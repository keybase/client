package service

import (
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type fakeUIRouter struct {
	secretUI    libkb.SecretUI
	secretUIErr error
}

var _ libkb.UIRouter = fakeUIRouter{}

func (f fakeUIRouter) SetUI(libkb.ConnectionID, libkb.UIKind) {}

func (f fakeUIRouter) GetIdentifyUI() (libkb.IdentifyUI, error) {
	return nil, errors.New("Unexpected GetIdentifyUI call")
}

func (f fakeUIRouter) GetSecretUI() (libkb.SecretUI, error) {
	return f.secretUI, f.secretUIErr
}

func (f fakeUIRouter) GetUpdateUI() (libkb.UpdateUI, error) {
	return nil, errors.New("Unexpected GetUpdateUI call")
}

func (f fakeUIRouter) Shutdown() {}

type nullSecretUI struct{}

func (nullSecretUI) GetSecret(keybase1.SecretEntryArg, *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	return nil, nil
}

func (nullSecretUI) GetNewPassphrase(keybase1.GetNewPassphraseArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, nil
}

func (nullSecretUI) GetPaperKeyPassphrase(keybase1.GetPaperKeyPassphraseArg) (string, error) {
	return "", nil
}

func (nullSecretUI) GetPassphrase(keybase1.GUIEntryArg, *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	return keybase1.GetPassphraseRes{}, nil
}

func TestCryptoSecretUI(t *testing.T) {
	tc := libkb.SetupTest(t, "crypto")
	defer tc.Cleanup()

	c := NewCryptoHandler(tc.G)

	// Should return errorSecretUI because UIRouter returned an
	// error.
	tc.G.SetUIRouter(fakeUIRouter{secretUIErr: errors.New("fake error")})
	secretUI := c.getSecretUI("")
	if _, ok := secretUI.(errorSecretUI); !ok {
		t.Errorf("secretUI %v is not an errorSecretUI", secretUI)
	}

	// Should return errorSecretUI because UIRouter returned nil.
	tc.G.SetUIRouter(fakeUIRouter{})
	secretUI = c.getSecretUI("")
	if _, ok := secretUI.(errorSecretUI); !ok {
		t.Errorf("secretUI %v is not an errorSecretUI", secretUI)
	}

	// Should return nullSecretUI..
	tc.G.SetUIRouter(fakeUIRouter{secretUI: nullSecretUI{}})
	secretUI = c.getSecretUI("")
	if _, ok := secretUI.(nullSecretUI); !ok {
		t.Errorf("secretUI %v is not a nullSecretUI", secretUI)
	}
}
