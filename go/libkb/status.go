package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
)

type UserInfo struct {
	UID      keybase1.UID
	Username string
}

type CurrentStatus struct {
	Configured bool
	Registered bool
	LoggedIn   bool
	User       *User
}

func GetCurrentStatus(g *GlobalContext) (res CurrentStatus, err error) {
	cr := g.Env.GetConfig()
	if cr == nil {
		return
	}
	res.Configured = true
	if u := cr.GetUID(); u.Exists() {
		res.Registered = true
		res.User = NewUserThin(cr.GetUsername().String(), u)
	}
	res.LoggedIn, err = g.LoginState().LoggedInProvisionedLoad()
	return
}
