// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// LoginLoadUser is an engine that will get a username or email
// address from the user and load that user, for the purposes of
// preparing for provisioning a new device.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// LoginLoadUser is an engine.
type LoginLoadUser struct {
	libkb.Contextified
	user            *libkb.User
	usernameOrEmail string
}

// NewLoginLoadUser creates a LoginLoadUser engine.
// usernameOrEmail is optional.
func NewLoginLoadUser(g *libkb.GlobalContext, usernameOrEmail string) *LoginLoadUser {
	return &LoginLoadUser{
		Contextified:    libkb.NewContextified(g),
		usernameOrEmail: usernameOrEmail,
	}
}

// Name is the unique engine name.
func (e *LoginLoadUser) Name() string {
	return "LoginLoadUser"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginLoadUser) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginLoadUser) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginLoadUser) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *LoginLoadUser) Run(ctx *Context) error {
	username, err := e.findUsername(ctx)
	if err != nil {
		return err
	}

	e.G().Log.Debug("LoginLoadUser: found username %q", username)

	arg := libkb.NewLoadUserByNameArg(e.G(), username)
	arg.PublicKeyOptional = true
	user, err := libkb.LoadUser(arg)
	if err != nil {
		return e.convertNotFound(err)
	}
	e.user = user

	e.G().Log.Debug("LoginLoadUser: found user %s for username %q", e.user.GetUID(), username)

	return nil
}

func (e *LoginLoadUser) User() *libkb.User {
	return e.user
}

func (e *LoginLoadUser) findUsername(ctx *Context) (string, error) {
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
		return "", e.convertNotFound(err)
	}

	e.G().Log.Debug("VerifyEmailAddress %q => %q", e.usernameOrEmail, username)

	return username, nil
}

func (e *LoginLoadUser) prompt(ctx *Context) error {
	res, err := ctx.LoginUI.GetEmailOrUsername(ctx.GetNetContext(), 0)
	if err != nil {
		return err
	}
	e.usernameOrEmail = res
	return nil
}

// LoadUser and VerifyEmailAddress can return an AppStatusError when a user isn't found.
// Convert that to a libkb.NotFoundError.
func (e *LoginLoadUser) convertNotFound(in error) error {
	if aerr, ok := in.(libkb.AppStatusError); ok {
		if aerr.Code == libkb.SCNotFound || aerr.Code == libkb.SCBadLoginUserNotFound {
			return libkb.NotFoundError{}
		}
	}
	return in
}
