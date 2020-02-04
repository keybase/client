// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package service

import (
	"github.com/keybase/client/go/install"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func (c *CtlHandler) SetOnLoginStartup(_ context.Context, enabled bool) (err error) {
	return install.ToggleAutostart(c.G(), enabled, false)
}

func (c *CtlHandler) GetOnLoginStartup(_ context.Context) (keybase1.OnLoginStartupStatus, error) {
	return install.GetAutostart(c.G()), nil
}
