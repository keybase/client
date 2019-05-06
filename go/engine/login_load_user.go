// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// loginLoadUser is an engine that will get a username or email
// address from the user and load that user, for the purposes of
// preparing for provisioning a new device.
//
// It is only meant to be used by the Login engine.

package engine

import (
	"strings"

	"github.com/keybase/client/go/libkb"
)

// loginLoadUser is an engine.
type loginLoadUser struct {
	libkb.Contextified
	user     *libkb.User
	username string
}

// newLoginLoadUser creates a loginLoadUser engine. `username` argument is
// optional.
func newLoginLoadUser(g *libkb.GlobalContext, username string) *loginLoadUser {
	return &loginLoadUser{
		Contextified: libkb.NewContextified(g),
		username:     strings.TrimSpace(username),
	}
}

// Name is the unique engine name.
func (e *loginLoadUser) Name() string {
	return "loginLoadUser"
}

// GetPrereqs returns the engine prereqs.
func (e *loginLoadUser) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *loginLoadUser) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *loginLoadUser) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *loginLoadUser) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("loginLoadUser#Run", func() error { return err })()

	var username string
	username, err = e.findUsername(m)
	if err != nil {
		return err
	}

	m.Debug("loginLoadUser: found username %q", username)

	// NOTE(max) 2018-05-09: ForceReload since older versions of cached users don't
	// have salt stored, ad we need it in DeviceWrap to write out the config file.
	arg := libkb.NewLoadUserArgWithMetaContext(m).WithName(username).WithPublicKeyOptional().WithForceReload()
	user, err := libkb.LoadUser(arg)
	if err != nil {
		return err
	}
	e.user = user

	m.Debug("loginLoadUser: found user %s for username %q", e.user.GetUID(), username)

	return nil
}

func (e *loginLoadUser) User() *libkb.User {
	return e.user
}

func (e *loginLoadUser) findUsername(m libkb.MetaContext) (string, error) {
	if len(e.username) == 0 {
		if err := e.prompt(m); err != nil {
			return "", err
		}
	}

	if len(e.username) == 0 {
		return "", libkb.NoUsernameError{}
	}

	if !libkb.CheckUsername.F(e.username) {
		// Username is not valid:
		if libkb.CheckEmail.F(e.username) {
			// It's an e-mail, that we don't support anymore (CORE-10470).
			return "", libkb.NewBadUsernameErrorWithFullMessage("Logging in with e-mail address is not supported")
		}
		return "", libkb.NewBadUsernameError(e.username)
	}

	return e.username, nil
}

func (e *loginLoadUser) prompt(m libkb.MetaContext) error {
	res, err := m.UIs().LoginUI.GetEmailOrUsername(m.Ctx(), 0)
	if err != nil {
		return err
	}
	e.username = res
	return nil
}
