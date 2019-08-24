package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type fakeUIRouter struct {
	secretUI    libkb.SecretUI
	identifyUI  libkb.IdentifyUI
	secretUIErr error
	gregorUI    keybase1.GregorUIInterface
}

var _ libkb.UIRouter = fakeUIRouter{}

func (f fakeUIRouter) SetUI(libkb.ConnectionID, libkb.UIKind) {}

func (f fakeUIRouter) GetIdentifyUI() (libkb.IdentifyUI, error) {
	return f.identifyUI, nil
}

func (f fakeUIRouter) GetIdentifyUICtx(context.Context) (int, libkb.IdentifyUI, error) {
	return 0, f.identifyUI, nil
}

func (f fakeUIRouter) GetSecretUI(int) (libkb.SecretUI, error) {
	return f.secretUI, f.secretUIErr
}

func (f fakeUIRouter) GetRekeyUI() (keybase1.RekeyUIInterface, int, error) {
	return nil, 0, nil
}

func (f fakeUIRouter) GetRekeyUINoSessionID() (keybase1.RekeyUIInterface, error) {
	return nil, nil
}

func (f fakeUIRouter) GetGregorUI() (keybase1.GregorUIInterface, error) {
	return f.gregorUI, nil
}

func (f fakeUIRouter) GetHomeUI() (keybase1.HomeUIInterface, error) {
	return nil, nil
}

func (f fakeUIRouter) GetIdentify3UIAdapter(_ libkb.MetaContext) (libkb.IdentifyUI, error) {
	return nil, nil
}

func (f fakeUIRouter) GetIdentify3UI(libkb.MetaContext) (keybase1.Identify3UiInterface, error) {
	return nil, nil
}

func (f fakeUIRouter) GetChatUI() (libkb.ChatUI, error) {
	return nil, nil
}

func (f fakeUIRouter) DumpUIs() map[libkb.UIKind]libkb.ConnectionID {
	return nil
}

func (f fakeUIRouter) Shutdown() {}
