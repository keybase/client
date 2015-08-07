package libkb

import (
	keybase1 "github.com/keybase/client/protocol/go"
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

func GetCurrentStatus() (res CurrentStatus, err error) {
	cr := G.Env.GetConfig()
	if cr == nil {
		return
	}
	res.Configured = true
	if u := cr.GetUID(); u.Exists() {
		res.Registered = true
		res.User = NewUserThin(cr.GetUsername().String(), u)
	}
	res.LoggedIn, err = G.LoginState().LoggedInProvisionedLoad()
	return
}
