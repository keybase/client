// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
)

const userHandlerName = "userHandler"

type userHandler struct {
	libkb.Contextified
}

func newUserHandler(g *libkb.GlobalContext) *userHandler {
	return &userHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *userHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "user.key_change":
		return true, r.keyChange()
	case "user.identity_change":
		return true, r.identityChange()
	default:
		return false, fmt.Errorf("unknown userHandler category: %q", category)
	}
}

func (r *userHandler) keyChange() error {
	r.G().KeyfamilyChanged(r.G().Env.GetUID())

	// check if this device was just revoked and if so, logout
	return r.G().LogoutIfRevoked()
}

func (r *userHandler) identityChange() error {
	r.G().UserChanged(r.G().Env.GetUID())
	return nil
}

func (r *userHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *userHandler) IsAlive() bool {
	return true
}

func (r *userHandler) Name() string {
	return userHandlerName
}
