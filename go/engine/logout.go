package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type LogoutEngine struct{}

func NewLogout() *LogoutEngine                           { return &LogoutEngine{} }
func (e *LogoutEngine) Name() string                     { return "Logout" }
func (e *LogoutEngine) Prereqs() Prereqs                 { return Prereqs{} }
func (e *LogoutEngine) RequiredUIs() []libkb.UIKind      { return []libkb.UIKind{} }
func (e *LogoutEngine) SubConsumers() []libkb.UIConsumer { return []libkb.UIConsumer{} }

func (e *LogoutEngine) findLoggedInAccount(mctx libkb.MetaContext, accounts []keybase1.ConfiguredAccount) (ret libkb.NormalizedUsername) {
	for _, acct := range accounts {
		if acct.HasStoredSecret {
			return libkb.NewNormalizedUsername(acct.Username)
		}
	}
	return ret
}

func (e *LogoutEngine) doSwitch(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("Logout#doSwitch", func() error { return err })()
	accounts, err := mctx.G().GetConfiguredAccounts(mctx.Ctx())
	if err != nil {
		return err
	}
	acct := e.findLoggedInAccount(mctx, accounts)
	if acct.IsNil() {
		mctx.Debug("Failed to find a logged in account")
		return nil
	}
	mctx.Debug("Switching to another logged in account: %s", acct)

	eng := NewLoginProvisionedDevice(mctx.G(), acct.String())
	eng.SecretStoreOnly = true
	return RunEngine2(mctx, eng)
}

func (e *LogoutEngine) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("Logout#Run", func() error { return err })()
	err = mctx.G().Logout(mctx.Ctx())
	if err != nil {
		return err
	}
	e.doSwitch(mctx)
	return nil
}

var _ Engine2 = (*LogoutEngine)(nil)
