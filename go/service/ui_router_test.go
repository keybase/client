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
	rekeyUI     *fakeRekeyUI
	gregorUI    keybase1.GregorUIInterface
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

func (f fakeUIRouter) GetRekeyUI() (keybase1.RekeyUIInterface, int, error) {
	return f.rekeyUI, f.rekeyUI.sessionID, nil
}

func (f fakeUIRouter) GetRekeyUINoSessionID() (keybase1.RekeyUIInterface, error) {
	return f.rekeyUI, nil
}

func (f fakeUIRouter) GetGregorUI() (keybase1.GregorUIInterface, error) {
	return f.gregorUI, nil
}

func (f fakeUIRouter) Shutdown() {}
