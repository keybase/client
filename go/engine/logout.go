package engine

import (
	"context"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type LogoutEngine struct {
	options libkb.LogoutOptions
}

func NewLogout(options libkb.LogoutOptions) *LogoutEngine {
	return &LogoutEngine{options: options}
}
func (e *LogoutEngine) Name() string                     { return "Logout" }
func (e *LogoutEngine) Prereqs() Prereqs                 { return Prereqs{} }
func (e *LogoutEngine) RequiredUIs() []libkb.UIKind      { return []libkb.UIKind{} }
func (e *LogoutEngine) SubConsumers() []libkb.UIConsumer { return []libkb.UIConsumer{} }

func (e *LogoutEngine) filterLoggedIn(accounts []keybase1.
	ConfiguredAccount) (ret []libkb.NormalizedUsername) {
	for _, acct := range accounts {
		if acct.HasStoredSecret {
			ret = append(ret, libkb.NewNormalizedUsername(acct.Username))
		}
	}
	return ret
}

// Tell the user what accounts they still have secrets stored for,
// so they don't think they are fully logged out of everything.
func (e *LogoutEngine) printSwitchInfo(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("Logout#printSwitchInfo", &err)()
	ctx, cancel := context.WithTimeout(mctx.Ctx(), time.Second*3)
	defer cancel()
	accounts, err := mctx.G().GetConfiguredAccounts(ctx)
	if err != nil {
		return err
	}
	loggedInAccounts := e.filterLoggedIn(accounts)

	if len(loggedInAccounts) > 0 {
		maybePlural := ""
		if len(loggedInAccounts) > 1 {
			maybePlural = "s"
		}
		accountsList := ""
		for idx, acct := range loggedInAccounts {
			accountsList += string(acct)
			if idx < len(loggedInAccounts)-2 {
				accountsList += ", "
			}
			if idx == len(loggedInAccounts)-2 {
				accountsList += " and "
			}

		}
		mctx.Info(
			"You can still sign in to keybase account%s %s"+
				" without a password.", maybePlural, accountsList)
	}
	return nil
}

func (e *LogoutEngine) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("Logout#Run", &err)()
	err = mctx.LogoutWithOptions(e.options)
	if err != nil {
		return err
	}

	if e.options.KeepSecrets {
		err = mctx.G().Env.GetConfigWriter().SetStayLoggedOut(true)
		if err != nil {
			mctx.Warning("Could not save logged out state to config.json: %v", err)
		}
	}

	if err := e.printSwitchInfo(mctx); err != nil {
		// We don't care if this doesn't work here - user is logged
		// out at this point. LogoutEngine is considered successful.
		mctx.Info("You may still have secrets stored for one or more accounts"+
			": %s", err)
	}
	return nil
}

var _ Engine2 = (*LogoutEngine)(nil)
