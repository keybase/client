// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
)

var ErrNoSession = errors.New("no current session")

// CurrentSession uses the global session to find the session.  If
// the user isn't logged in, it returns ErrNoSession.
func CurrentSession(g *libkb.GlobalContext, sessionID int) (keybase1.Session, error) {
	var s keybase1.Session
	var token string
	var username libkb.NormalizedUsername
	var uid keybase1.UID
	var deviceSubkey, deviceSibkey libkb.GenericKey
	var err error

	aerr := g.LoginState().Account(func(a *libkb.Account) {
		_, err = a.LoggedInProvisionedLoad()
		if err != nil {
			return
		}
		uid, username, token, deviceSubkey, deviceSibkey, err = a.UserInfo()
	}, "Service - SessionHandler - UserInfo")
	if aerr != nil {
		return s, aerr
	}
	if err != nil {
		if _, ok := err.(libkb.LoginRequiredError); ok {
			return s, ErrNoSession
		}
		return s, err
	}

	s.Uid = uid
	s.Username = username.String()
	s.Token = token
	s.DeviceSubkeyKid = deviceSubkey.GetKID()
	s.DeviceSibkeyKid = deviceSibkey.GetKID()

	return s, nil
}
