// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type TeamsHandler struct {
	*BaseHandler
	globals.Contextified
	gregor *gregorHandler
	connID libkb.ConnectionID
}

func NewTeamsHandler(xp rpc.Transporter, id libkb.ConnectionID, g *globals.Context, gregor *gregorHandler) *TeamsHandler {
	return &TeamsHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: globals.NewContextified(g),
		gregor:       gregor,
		connID:       id,
	}
}

func (h *TeamsHandler) TeamCreate(ctx context.Context, arg keybase1.TeamCreateArg) (err error) {
	return teams.CreateRootTeam(ctx, h.G().ExternalG(), arg.Name)
}

func (h *TeamsHandler) TeamGet(ctx context.Context, arg keybase1.TeamGetArg) (keybase1.TeamDetails, error) {
	return teams.Details(ctx, h.G().ExternalG(), arg.Name, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamChangeMembership(ctx context.Context, arg keybase1.TeamChangeMembershipArg) error {
	return teams.ChangeRoles(ctx, h.G().ExternalG(), arg.Name, arg.Req)
}

func (h *TeamsHandler) TeamAddMember(ctx context.Context, arg keybase1.TeamAddMemberArg) error {
	if err := teams.AddMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role); err != nil {
		return err
	}
	if !arg.SendChatNotification {
		return nil
	}

	body := fmt.Sprintf("Hi %s, I've invited you to a new team, %s.", arg.Username, arg.Name)
	gregorCli := h.gregor.GetClient()
	return chat.SendTextByName(ctx, h.G(), arg.Username, chat1.ConversationMembersType_KBFS,
		keybase1.TLFIdentifyBehavior_CHAT_CLI, body, gregorCli)
}

func (h *TeamsHandler) TeamRemoveMember(ctx context.Context, arg keybase1.TeamRemoveMemberArg) error {
	return teams.RemoveMember(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamEditMember(ctx context.Context, arg keybase1.TeamEditMemberArg) error {
	return teams.EditMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role)
}

func (h *TeamsHandler) LoadTeamPlusApplicationKeys(netCtx context.Context, arg keybase1.LoadTeamPlusApplicationKeysArg) (keybase1.TeamPlusApplicationKeys, error) {
	netCtx = libkb.WithLogTag(netCtx, "LTPAK")
	h.G().Log.CDebugf(netCtx, "+ TeamHandler#LoadTeamPlusApplicationKeys(%+v)", arg)
	return teams.LoadTeamPlusApplicationKeys(netCtx, h.G().ExternalG(), arg.Id, arg.Application, arg.Refreshers)
}
