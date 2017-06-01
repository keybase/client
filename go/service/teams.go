// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type TeamsHandler struct {
	*BaseHandler
	libkb.Contextified
	connID libkb.ConnectionID
}

func NewTeamsHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext) *TeamsHandler {
	return &TeamsHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		connID:       id,
	}
}

func (h *TeamsHandler) TeamCreate(ctx context.Context, arg keybase1.TeamCreateArg) (err error) {
	return teams.CreateRootTeam(ctx, h.G(), arg.Name)
}

func (h *TeamsHandler) TeamGet(ctx context.Context, arg keybase1.TeamGetArg) (keybase1.TeamMembers, error) {
	return teams.Members(ctx, h.G(), arg.Name)
}

func (h *TeamsHandler) TeamChangeMembership(ctx context.Context, arg keybase1.TeamChangeMembershipArg) error {
	return teams.ChangeRoles(ctx, h.G(), arg.Name, arg.Req)
}

func (h *TeamsHandler) TeamAddMember(ctx context.Context, arg keybase1.TeamAddMemberArg) error {
	return teams.AddMember(ctx, h.G(), arg.Name, arg.Username, arg.Role)
}
