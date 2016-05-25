package service

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type fakeUIRouter struct {
	secretUI    libkb.SecretUI
	identifyUI  libkb.IdentifyUI
	secretUIErr error
}

var _ libkb.UIRouter = fakeUIRouter{}

func (f fakeUIRouter) SetUI(libkb.ConnectionID, libkb.UIKind) {}

func (f fakeUIRouter) GetIdentifyUI() (libkb.IdentifyUI, error) {
	return f.identifyUI, nil
}

func (f fakeUIRouter) GetSecretUI(int) (libkb.SecretUI, error) {
	return f.secretUI, f.secretUIErr
}

func (f fakeUIRouter) GetUpdateUI() (libkb.UpdateUI, error) {
	return nil, errors.New("Unexpected GetUpdateUI call")
}

func (f fakeUIRouter) GetRekeyUI() (keybase1.RekeyUIInterface, error) {
	return nil, errors.New("Unexpected GetRekeyUI call")
}

func (f fakeUIRouter) Shutdown() {}
