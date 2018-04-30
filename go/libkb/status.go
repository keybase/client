// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
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

func GetCurrentStatus(ctx context.Context, g *GlobalContext) (res CurrentStatus, err error) {
	cr := g.Env.GetConfig()
	if cr == nil {
		return
	}
	res.Configured = true
	if uid := cr.GetUID(); uid.Exists() {
		res.Registered = true
		res.User = NewUserThin(cr.GetUsername().String(), uid)
	}
	res.SessionIsValid, err = g.LoginState().LoggedInProvisioned(ctx)
	res.LoggedIn = res.SessionIsValid
	return
}
