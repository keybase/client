// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol"
)

type UserInfo struct {
	UID      keybase1.UID
	Username string
}

type CurrentStatus struct {
	Configured     bool
	Registered     bool
	LoggedIn       bool
	SessionIsValid bool
	User           *User
}

func GetCurrentStatus(g *GlobalContext) (res CurrentStatus, err error) {
	cr := g.Env.GetConfig()
	if cr == nil {
		return
	}
	res.Configured = true
	if uid := cr.GetUID(); uid.Exists() {
		res.Registered = true
		res.User = NewUserThin(cr.GetUsername().String(), uid)
	}
	res.SessionIsValid, err = g.LoginState().LoggedInProvisionedLoad()
	if err == nil {
		if pps, err := g.LoginState().PassphraseStream(); err == nil {
			res.LoggedIn = res.SessionIsValid && (pps != nil)
		}
	}
	return
}
