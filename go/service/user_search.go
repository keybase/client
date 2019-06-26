// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type UserSearchHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewUserSearchHandler(xp rpc.Transporter, g *libkb.GlobalContext) *UserSearchHandler {
	handler := &UserSearchHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}
	return handler
}

var _ keybase1.UserSearchInterface = (*UserSearchHandler)(nil)

func (h *UserSearchHandler) UserSearch(ctx context.Context, arg keybase1.UserSearchArg) (res []keybase1.UserSearchResult, err error) {
	// mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("USEARCH")
	// defer mctx.TraceTimed(fmt.Sprintf("ContactsHandler#LookupContactList(len=%d)", len(arg.Contacts)),
	// 	func() error { return err })()
	return res, errors.New("not impl")
}
