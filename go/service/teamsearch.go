// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for team search operations

package service

import (
	"context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type TeamSearchHandler struct {
	*BaseHandler
	libkb.Contextified
}

var _ keybase1.TeamsInterface = (*TeamsHandler)(nil)

func newTeamSearchHandler(xp rpc.Transporter, g *libkb.GlobalContext) *TeamSearchHandler {
	return &TeamSearchHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *TeamSearchHandler) TeamSearch(ctx context.Context, arg keybase1.TeamSearchArg) (res keybase1.TeamSearchRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TS")
	if err := assertLoggedIn(ctx, h.G()); err != nil {
		return res, err
	}

	hits, err := teams.Search(ctx, h.G(), arg.Query, arg.Limit)
	if err != nil {
		return res, err
	}

	res.Results = hits
	return res, nil
}
