// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// LoginUsername is an engine that will get a username or email
// address from the user and load that user, for the purposes of
// preparing for provisioning a new device.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// LoginUsername is an engine.
type LoginUsername struct {
	libkb.Contextified
	user            *libkb.User
	usernameOrEmail string
}

// NewLoginUsername creates a LoginUsername engine.
// usernameOrEmail is optional.
func NewLoginUsername(g *libkb.GlobalContext, usernameOrEmail string) *LoginUsername {
	return &LoginUsername{
		Contextified:    libkb.NewContextified(g),
		usernameOrEmail: usernameOrEmail,
	}
}

// Name is the unique engine name.
func (e *LoginUsername) Name() string {
	return "LoginUsername"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginUsername) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginUsername) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginUsername) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *LoginUsername) Run(ctx *Context) error {
	username, err := e.findUsername(ctx)
	if err != nil {
		return err
	}

	e.G().Log.Debug("LoginUsername: found username %q", username)

	arg := libkb.NewLoadUserByNameArg(e.G(), username)
	arg.PublicKeyOptional = true
	user, err := libkb.LoadUser(arg)
	if err != nil {
		return e.convertNotFound(err)
	}
	e.user = user

	e.G().Log.Debug("LoginUsername: found user %s for username %q", e.user.GetUID(), username)

	return nil
}

func (e *LoginUsername) User() *libkb.User {
	return e.user
}

func (e *LoginUsername) findUsername(ctx *Context) (string, error) {
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

func (e *LoginUsername) prompt(ctx *Context) error {
	res, err := ctx.LoginUI.GetEmailOrUsername(ctx.GetNetContext(), 0)
	if err != nil {
		return err
	}
	e.usernameOrEmail = res
	return nil
}

// LoadUser and VerifyEmailAddress can return an AppStatusError when a user isn't found.
// Convert that to a libkb.NotFoundError.
func (e *LoginUsername) convertNotFound(in error) error {
	if aerr, ok := in.(libkb.AppStatusError); ok {
		if aerr.Code == libkb.SCNotFound || aerr.Code == libkb.SCBadLoginUserNotFound {
			return libkb.NotFoundError{}
		}
	}
	return in
}
