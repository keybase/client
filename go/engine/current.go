package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func CurrentUID(g *libkb.GlobalContext) (keybase1.UID, error) {
	var loggedIn bool
	var err error
	var uid keybase1.UID
	aerr := g.LoginState().Account(func(a *libkb.Account) {
		loggedIn, err = a.LoggedInProvisionedLoad()
		if err != nil {
			return
		}
		if !loggedIn {
			return
		}
		uid = a.LocalSession().GetUID()
	}, "Service - SessionHandler - CurrentUID")
	if aerr != nil {
		return uid, aerr
	}
	if err != nil {
		return uid, err
	}
	if !loggedIn {
		return uid, libkb.LoginRequiredError{}
	}
	return uid, nil
}
