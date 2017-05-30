// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
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

	// Usually set to `NONE`, meaning none specified.
	// But if we know it, specify the end client type here
	// since some things like GPG shell-out work differently
	// depending.
	ClientType keybase1.ClientType

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
		return context.Background()
	}
	return c.NetContext
}

func (c *Context) SetNetContext(netCtx context.Context) {
	c.NetContext = netCtx
}

// A copy of the Context with the NetContext swapped out
func (c *Context) WithNetContext(netCtx context.Context) *Context {
	c2 := *c
	c2.NetContext = netCtx
	return &c2
}

func (c *Context) SecretKeyPromptArg(ska libkb.SecretKeyArg, reason string) libkb.SecretKeyPromptArg {
	return libkb.SecretKeyPromptArg{
		LoginContext: c.LoginContext,
		SecretUI:     c.SecretUI,
		Ska:          ska,
		Reason:       reason,
	}
}

func (c *Context) CloneGlobalContextWithLogTags(g *libkb.GlobalContext, k string) *libkb.GlobalContext {
	netCtx := libkb.WithLogTag(c.GetNetContext(), k)
	c.NetContext = netCtx
	return g.CloneWithNetContextAndNewLogger(netCtx)
}
