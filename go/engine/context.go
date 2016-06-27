// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
)

type Context struct {
	GPGUI       libkb.GPGUI
	LogUI       libkb.LogUI
	LoginUI     libkb.LoginUI
	SecretUI    libkb.SecretUI
	IdentifyUI  libkb.IdentifyUI
	PgpUI       libkb.PgpUI
	ProveUI     libkb.ProveUI
	ProvisionUI libkb.ProvisionUI

	LoginContext libkb.LoginContext
	NetContext   context.Context
	SaltpackUI   libkb.SaltpackUI

	SessionID int
}

func (c *Context) HasUI(kind libkb.UIKind) bool {
	switch kind {
	case libkb.GPGUIKind:
		return c.GPGUI != nil
	case libkb.LogUIKind:
		return c.LogUI != nil
	case libkb.LoginUIKind:
		return c.LoginUI != nil
	case libkb.SecretUIKind:
		return c.SecretUI != nil
	case libkb.IdentifyUIKind:
		return c.IdentifyUI != nil
	case libkb.PgpUIKind:
		return c.PgpUI != nil
	case libkb.ProveUIKind:
		return c.ProveUI != nil
	case libkb.ProvisionUIKind:
		return c.ProvisionUI != nil
	case libkb.SaltpackUIKind:
		return c.SaltpackUI != nil
	}
	panic(fmt.Sprintf("unhandled kind:  %d", kind))
}

func (c *Context) GetNetContext() context.Context {
	if c.NetContext == nil {
		return context.TODO()
	}
	return c.NetContext
}

func (c *Context) SecretKeyPromptArg(ska libkb.SecretKeyArg, reason string) libkb.SecretKeyPromptArg {
	return libkb.SecretKeyPromptArg{
		LoginContext: c.LoginContext,
		SecretUI:     c.SecretUI,
		Ska:          ska,
		Reason:       reason,
	}
}
