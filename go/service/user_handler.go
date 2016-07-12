// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/gregor"
	gregor1 "github.com/keybase/gregor/protocol/gregor1"
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
		return true, r.G().LogoutIfRevoked()
	case "user.identity_change":
		return true, nil
	default:
		return false, fmt.Errorf("unknown userHandler category: %q", category)
	}
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
