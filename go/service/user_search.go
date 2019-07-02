// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type UserSearchHandler struct {
	libkb.Contextified
	*BaseHandler
	savedContacts *contacts.SavedContactsStore
}

func NewUserSearchHandler(xp rpc.Transporter, g *libkb.GlobalContext, pbs *contacts.SavedContactsStore) *UserSearchHandler {
	handler := &UserSearchHandler{
		Contextified:  libkb.NewContextified(g),
		BaseHandler:   NewBaseHandler(g, xp),
		savedContacts: pbs,
	}
	return handler
}

var _ keybase1.UserSearchInterface = (*UserSearchHandler)(nil)

type rawSearchResults struct {
	libkb.AppStatusEmbed
	List []keybase1.APIUserSearchResult `json:"list"`
}

func doSearchRequest(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	service := arg.Service
	if service == "keybase" {
		service = ""
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/user_search",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"q":                        libkb.S{Val: arg.Query},
			"num_wanted":               libkb.I{Val: arg.MaxResults},
			"service":                  libkb.S{Val: service},
			"include_services_summary": libkb.B{Val: arg.IncludeServicesSummary},
		},
	}
	var response rawSearchResults
	err = mctx.G().API.GetDecode(mctx, apiArg, &response)
	if err != nil {
		return nil, err
	}
	return response.List, nil
}

func (h *UserSearchHandler) UserSearch(ctx context.Context, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("USEARCH")
	defer mctx.TraceTimed(fmt.Sprintf("UserSearch#UserSearch(s=%q, q=%q)", arg.Service, arg.Query),
		func() error { return err })()

	return doSearchRequest(mctx, arg)
}

func (h *UserSearchHandler) UserSearchKeybase(ctx context.Context, arg keybase1.UserSearchKeybaseArg) (res []keybase1.APIUserSearchResult, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("USEARCH2")
	defer mctx.TraceTimed(fmt.Sprintf("UserSearch#UserSearchKeybase(%q)", arg.Query),
		func() error { return err })()

	keybaseResults, err := doSearchRequest(mctx, keybase1.UserSearchArg{
		IncludeServicesSummary: arg.IncludeServicesSummary,
		MaxResults:             arg.MaxResults,
		Query:                  arg.Query,
		Service:                "keybase",
	})
	if err != nil {
		return res, err
	}

	contactsRes, err := h.savedContacts.RetrieveContacts(mctx)
	if err != nil {
		return res, err
	}

	_ = keybaseResults
	_ = contactsRes

	return res, nil
}
