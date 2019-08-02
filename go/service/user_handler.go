// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"strings"

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
	m := libkb.NewMetaContext(ctx, r.G())
	switch category {
	case "user.key_change":
		return true, r.keyChange(m)
	case "user.identity_change":
		return true, r.identityChange(m)
	case "user.password_change":
		return true, r.passwordChange(m, cli, category, item)
	default:
		if strings.HasPrefix(category, "user.") {
			return false, fmt.Errorf("unknown userHandler category: %q", category)
		}
		return false, nil
	}
}

func (r *userHandler) keyChange(m libkb.MetaContext) error {
	m.G().KeyfamilyChanged(m.Ctx(), m.G().Env.GetUID())

	// check if this device was just revoked and if so, log out
	return m.LogoutAndDeprovisionIfRevoked()
}

func (r *userHandler) identityChange(m libkb.MetaContext) error {
	m.G().UserChanged(m.Ctx(), m.G().Env.GetUID())
	return nil
}

func (r *userHandler) passwordChange(m libkb.MetaContext, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	m.Debug("userHandler: %s received", category)

	cacheKey := libkb.DbKey{
		Typ: libkb.DBHasRandomPW,
		Key: m.CurrentUID().String(),
	}
	hasRandomPW := false
	if err := m.G().GetKVStore().PutObj(cacheKey, nil, hasRandomPW); err == nil {
		m.Debug("Adding HasRandomPW=%t to KVStore after %s notification", hasRandomPW, category)
	} else {
		m.Debug("Unable to add HasRandomPW state to KVStore after %s notification", category)
	}

	r.G().NotifyRouter.HandlePasswordChanged(m.Ctx())
	return r.G().GregorState.DismissItem(m.Ctx(), cli, item.Metadata().MsgID())
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
