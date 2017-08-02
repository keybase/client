// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"strings"

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

var _ keybase1.TeamsInterface = (*TeamsHandler)(nil)

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

func (h *TeamsHandler) TeamList(ctx context.Context, arg keybase1.TeamListArg) (keybase1.AnnotatedTeamList, error) {
	x, err := teams.List(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamChangeMembership(ctx context.Context, arg keybase1.TeamChangeMembershipArg) error {
	return teams.ChangeRoles(ctx, h.G().ExternalG(), arg.Name, arg.Req)
}

func (h *TeamsHandler) sendTeamChatWelcomeMessage(ctx context.Context, team, user string) (res bool) {
	var err error
	defer func() {
		if err != nil {
			h.G().Log.CWarningf(ctx, "failed to send team welcome message: %s", err.Error())
		}
	}()
	teamDetails, err := teams.Details(ctx, h.G().ExternalG(), team, true)
	if err != nil {
		return false
	}

	var ownerNames, adminNames, writerNames, readerNames []string
	for _, owner := range teamDetails.Members.Owners {
		ownerNames = append(ownerNames, owner.Username)
	}
	for _, admin := range teamDetails.Members.Admins {
		adminNames = append(adminNames, admin.Username)
	}
	for _, writer := range teamDetails.Members.Writers {
		writerNames = append(writerNames, writer.Username)
	}
	for _, reader := range teamDetails.Members.Readers {
		readerNames = append(readerNames, reader.Username)
	}
	var lines []string
	if len(ownerNames) > 0 {
		lines = append(lines, fmt.Sprintf("  owners: %s", strings.Join(ownerNames, ",")))
	}
	if len(adminNames) > 0 {
		lines = append(lines, fmt.Sprintf("  admins: %s", strings.Join(adminNames, ",")))
	}
	if len(writerNames) > 0 {
		lines = append(lines, fmt.Sprintf("  writers: %s", strings.Join(writerNames, ",")))
	}
	if len(readerNames) > 0 {
		lines = append(lines, fmt.Sprintf("  readers: %s", strings.Join(readerNames, ",")))
	}
	memberBody := strings.Join(lines, "\n")
	body := fmt.Sprintf("I've just added @%s to this team. Current team membership: \n\n%s\n\nKeybase teams are in very early alpha, and more info is available here: https://keybase.io/docs/command_line/teams_alpha.",
		user, memberBody)
	gregorCli := h.gregor.GetClient()
	if err = chat.SendTextByName(ctx, h.G(), team, chat1.ConversationMembersType_TEAM,
		keybase1.TLFIdentifyBehavior_CHAT_CLI, body, gregorCli); err != nil {
		return false
	}

	return true
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

	result.ChatSent = h.sendTeamChatWelcomeMessage(ctx, arg.Name, result.User.Username)
	return result, nil
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
	return teams.RequestAccess(ctx, h.G().ExternalG(), arg.Name)
}

func (h *TeamsHandler) TeamListRequests(ctx context.Context, sessionID int) ([]keybase1.TeamJoinRequest, error) {
	return teams.ListRequests(ctx, h.G().ExternalG())
}

func (h *TeamsHandler) TeamIgnoreRequest(ctx context.Context, arg keybase1.TeamIgnoreRequestArg) error {
	return teams.IgnoreRequest(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamTree(ctx context.Context, arg keybase1.TeamTreeArg) (res keybase1.TeamTreeResult, err error) {
	return teams.TeamTree(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) LoadTeamPlusApplicationKeys(netCtx context.Context, arg keybase1.LoadTeamPlusApplicationKeysArg) (keybase1.TeamPlusApplicationKeys, error) {
	netCtx = libkb.WithLogTag(netCtx, "LTPAK")
	h.G().Log.CDebugf(netCtx, "+ TeamHandler#LoadTeamPlusApplicationKeys(%+v)", arg)
	return teams.LoadTeamPlusApplicationKeys(netCtx, h.G().ExternalG(), arg.Id, arg.Application, arg.Refreshers)
}

func (h *TeamsHandler) GetTeamRootID(ctx context.Context, id keybase1.TeamID) (keybase1.TeamID, error) {
	return teams.GetRootID(ctx, h.G().ExternalG(), id)
}
