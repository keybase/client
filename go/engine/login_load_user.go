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
	user            *libkb.User
	usernameOrEmail string
}

// newLoginLoadUser creates a loginLoadUser engine.
// usernameOrEmail is optional.
func newLoginLoadUser(g *libkb.GlobalContext, usernameOrEmail string) *loginLoadUser {
	return &loginLoadUser{
		Contextified:    libkb.NewContextified(g),
		usernameOrEmail: strings.TrimSpace(usernameOrEmail),
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
func (e *loginLoadUser) Run(ctx *Context) error {
	username, err := e.findUsername(ctx)
	if err != nil {
		return err
	}

	e.G().Log.Debug("loginLoadUser: found username %q", username)

	arg := libkb.NewLoadUserByNameArg(e.G(), username)
	arg.PublicKeyOptional = true
	user, err := libkb.LoadUser(arg)
	if err != nil {
		return err
	}
	e.user = user

	e.G().Log.Debug("loginLoadUser: found user %s for username %q", e.user.GetUID(), username)

	return nil
}

func (e *loginLoadUser) User() *libkb.User {
	return e.user
}

func (e *loginLoadUser) findUsername(ctx *Context) (string, error) {
	if len(e.usernameOrEmail) == 0 {
		if err := e.prompt(ctx); err != nil {
			return "", err
		}
	}

	if len(e.usernameOrEmail) == 0 {
		return "", libkb.NoUsernameError{}
	}

	if libkb.CheckUsername.F(e.usernameOrEmail) {
		return e.usernameOrEmail, nil
	}

	if !libkb.CheckEmail.F(e.usernameOrEmail) {
		return "", libkb.BadNameError(e.usernameOrEmail)
	}

	// looks like an email address
	e.G().Log.Debug("%q looks like an email address, must get login session to get user", e.usernameOrEmail)
	// need to login with it in order to get the username
	var username string
	var afterLogin = func(lctx libkb.LoginContext) error {
		username = lctx.LocalSession().GetUsername().String()
		return nil
	}
	if err := e.G().LoginState().VerifyEmailAddress(e.usernameOrEmail, ctx.SecretUI, afterLogin); err != nil {
		return "", err
	}

	e.G().Log.Debug("VerifyEmailAddress %q => %q", e.usernameOrEmail, username)

	return username, nil
}

func (e *loginLoadUser) prompt(ctx *Context) error {
	res, err := ctx.LoginUI.GetEmailOrUsername(ctx.GetNetContext(), 0)
	if err != nil {
		return err
	}
	e.usernameOrEmail = res
	return nil
}
