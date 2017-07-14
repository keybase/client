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
	return teams.CreateRootTeam(ctx, h.G().ExternalG(), arg.Name.String())
}

func (h *TeamsHandler) TeamCreateSubteam(ctx context.Context, arg keybase1.TeamCreateSubteamArg) (err error) {
	if arg.Name.Depth() == 0 {
		return fmt.Errorf("empty team name")
	}
	if arg.Name.IsRootTeam() {
		return fmt.Errorf("cannot create subteam with root team name")
	}
	parentName, err := arg.Name.Parent()
	if err != nil {
		return err
	}
	_, err = teams.CreateSubteam(ctx, h.G().ExternalG(), string(arg.Name.LastPart()), parentName)
	return err
}

func (h *TeamsHandler) TeamGet(ctx context.Context, arg keybase1.TeamGetArg) (keybase1.TeamDetails, error) {
	return teams.Details(ctx, h.G().ExternalG(), arg.Name, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamList(ctx context.Context, arg keybase1.TeamListArg) (keybase1.TeamList, error) {
	x, err := teams.List(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.TeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamChangeMembership(ctx context.Context, arg keybase1.TeamChangeMembershipArg) error {
	return teams.ChangeRoles(ctx, h.G().ExternalG(), arg.Name, arg.Req)
}

func (h *TeamsHandler) TeamAddMember(ctx context.Context, arg keybase1.TeamAddMemberArg) (keybase1.TeamAddMemberResult, error) {
	if arg.Email != "" {
		if err := teams.InviteEmailMember(ctx, h.G().ExternalG(), arg.Name, arg.Email, arg.Role); err != nil {
			return keybase1.TeamAddMemberResult{}, err
		}
		return keybase1.TeamAddMemberResult{Invited: true, EmailSent: true}, nil
	}
	result, err := teams.AddMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role)
	if err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	if !arg.SendChatNotification {
		return result, nil
	}

	if result.Invited {
		return result, nil
	}

	body := fmt.Sprintf("Hi %s, I've added you to a new team, %s.", result.User.Username, arg.Name)
	gregorCli := h.gregor.GetClient()
	err = chat.SendTextByName(ctx, h.G(), result.User.Username, chat1.ConversationMembersType_KBFS, keybase1.TLFIdentifyBehavior_CHAT_CLI, body, gregorCli)
	if err == nil {
		result.ChatSent = true
	}
	return result, err
}

func (h *TeamsHandler) TeamRemoveMember(ctx context.Context, arg keybase1.TeamRemoveMemberArg) error {
	return teams.RemoveMember(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamEditMember(ctx context.Context, arg keybase1.TeamEditMemberArg) error {
	return teams.EditMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role)
}

func (h *TeamsHandler) TeamLeave(ctx context.Context, arg keybase1.TeamLeaveArg) error {
	return teams.Leave(ctx, h.G().ExternalG(), arg.Name, arg.Permanent)
}

func (h *TeamsHandler) TeamRename(ctx context.Context, arg keybase1.TeamRenameArg) error {
	return teams.RenameSubteam(ctx, h.G().ExternalG(), arg.PrevName, arg.NewName)
}

func (h *TeamsHandler) TeamAcceptInvite(ctx context.Context, arg keybase1.TeamAcceptInviteArg) error {
	return teams.AcceptInvite(ctx, h.G().ExternalG(), arg.Token)
}

func (h *TeamsHandler) TeamRequestAccess(ctx context.Context, arg keybase1.TeamRequestAccessArg) error {
	return nil
}

func (h *TeamsHandler) TeamListRequests(ctx context.Context, sessionID int) ([]keybase1.TeamJoinRequest, error) {
	return nil, nil
}

func (h *TeamsHandler) TeamIgnoreRequest(ctx context.Context, arg keybase1.TeamIgnoreRequestArg) error {
	return nil
}

func (h *TeamsHandler) LoadTeamPlusApplicationKeys(netCtx context.Context, arg keybase1.LoadTeamPlusApplicationKeysArg) (keybase1.TeamPlusApplicationKeys, error) {
	netCtx = libkb.WithLogTag(netCtx, "LTPAK")
	h.G().Log.CDebugf(netCtx, "+ TeamHandler#LoadTeamPlusApplicationKeys(%+v)", arg)
	return teams.LoadTeamPlusApplicationKeys(netCtx, h.G().ExternalG(), arg.Id, arg.Application, arg.Refreshers)
}
