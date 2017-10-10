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
		BaseHandler:  NewBaseHandler(g.ExternalG(), xp),
		Contextified: globals.NewContextified(g),
		gregor:       gregor,
		connID:       id,
	}
}

func (h *TeamsHandler) assertLoggedIn(ctx context.Context) error {
	loggedIn := h.G().ExternalG().ActiveDevice.Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (h *TeamsHandler) TeamCreate(ctx context.Context, arg keybase1.TeamCreateArg) (res keybase1.TeamCreateResult, err error) {
	arg2 := keybase1.TeamCreateWithSettingsArg{
		SessionID:            arg.SessionID,
		Name:                 arg.Name,
		SendChatNotification: arg.SendChatNotification,
	}
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	return h.TeamCreateWithSettings(ctx, arg2)
}

func (h *TeamsHandler) TeamCreateWithSettings(ctx context.Context, arg keybase1.TeamCreateWithSettingsArg) (res keybase1.TeamCreateResult, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamCreate(%s)", arg.Name), func() error { return err })()

	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	teamName, err := keybase1.TeamNameFromString(arg.Name)
	if err != nil {
		return res, err
	}
	if !teamName.IsRootTeam() {
		h.G().Log.CDebugf(ctx, "TeamCreate: creating a new subteam: %s", arg.Name)
		if teamName.Depth() == 0 {
			return res, fmt.Errorf("empty team name")
		}
		parentName, err := teamName.Parent()
		if err != nil {
			return res, err
		}
		if _, err = teams.CreateSubteam(ctx, h.G().ExternalG(), string(teamName.LastPart()), parentName); err != nil {
			return res, err
		}
	} else {
		if err := teams.CreateRootTeam(ctx, h.G().ExternalG(), teamName.String(), arg.Settings); err != nil {
			return res, err
		}
		res.CreatorAdded = true
	}

	if arg.SendChatNotification {
		res.ChatSent = h.sendTeamChatWelcomeMessage(ctx, teamName.String(), h.G().Env.GetUsername().String())
	}
	return res, nil
}

func (h *TeamsHandler) TeamGet(ctx context.Context, arg keybase1.TeamGetArg) (res keybase1.TeamDetails, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamGet(%s)", arg.Name), func() error { return err })()
	return teams.Details(ctx, h.G().ExternalG(), arg.Name, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamList(ctx context.Context, arg keybase1.TeamListArg) (res keybase1.AnnotatedTeamList, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamList(%s)", arg.UserAssertion), func() error { return err })()
	x, err := teams.List(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamListSubteamsRecursive(ctx context.Context, arg keybase1.TeamListSubteamsRecursiveArg) (res []keybase1.TeamIDAndName, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamListSubteamsRecursive(%s)", arg.ParentTeamName), func() error { return err })()
	return teams.ListSubteamsRecursive(ctx, h.G().ExternalG(), arg.ParentTeamName, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamChangeMembership(ctx context.Context, arg keybase1.TeamChangeMembershipArg) error {
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
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
	body := fmt.Sprintf("Hello! I've just added @%s to this team. Current members:\n\n```​%s```\n\n_More info on teams:_ keybase.io/blog/introducing-keybase-teams\n_To leave this team, visit the team tab or run `keybase team leave %s`_",
		user, memberBody, team)

	// Ensure we have chat available, since TeamAddMember may also be
	// coming from a standalone launch.
	h.G().ExternalG().StartStandaloneChat()

	if err = chat.SendTextByName(ctx, h.G(), team, &chat.DefaultTeamTopic, chat1.ConversationMembersType_TEAM,
		keybase1.TLFIdentifyBehavior_CHAT_CLI, body, h.gregor.GetClient); err != nil {
		return false
	}

	return true
}

func (h *TeamsHandler) TeamAddMember(ctx context.Context, arg keybase1.TeamAddMemberArg) (res keybase1.TeamAddMemberResult, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamAddMember(%s,%s)", arg.Name, arg.Username),
		func() error { return err })()

	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

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

func (h *TeamsHandler) TeamRemoveMember(ctx context.Context, arg keybase1.TeamRemoveMemberArg) (err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamRemoveMember(%s,%s)", arg.Name, arg.Username),
		func() error { return err })()

	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	if len(arg.Email) > 0 {
		h.G().Log.CDebugf(ctx, "TeamRemoveMember: received email address, using CancelEmailInvite for %q in team %q", arg.Email, arg.Name)
		return teams.CancelEmailInvite(ctx, h.G().ExternalG(), arg.Name, arg.Email)
	}
	h.G().Log.CDebugf(ctx, "TeamRemoveMember: using RemoveMember for %q in team %q", arg.Username, arg.Name)
	return teams.RemoveMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Permanent)
}

func (h *TeamsHandler) TeamEditMember(ctx context.Context, arg keybase1.TeamEditMemberArg) (err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamEditMember(%s,%s)", arg.Name, arg.Username),
		func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.EditMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role)
}

func (h *TeamsHandler) TeamLeave(ctx context.Context, arg keybase1.TeamLeaveArg) (err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamLeave(%s)", arg.Name), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.Leave(ctx, h.G().ExternalG(), arg.Name, arg.Permanent)
}

func (h *TeamsHandler) TeamRename(ctx context.Context, arg keybase1.TeamRenameArg) (err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamRename(%s)", arg.PrevName), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.RenameSubteam(ctx, h.G().ExternalG(), arg.PrevName, arg.NewName)
}

func (h *TeamsHandler) TeamAcceptInvite(ctx context.Context, arg keybase1.TeamAcceptInviteArg) (err error) {
	defer h.G().CTraceTimed(ctx, "TeamAcceptInvite", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.AcceptInvite(ctx, h.G().ExternalG(), arg.Token)
}

func (h *TeamsHandler) TeamRequestAccess(ctx context.Context, arg keybase1.TeamRequestAccessArg) (err error) {
	h.G().CTraceTimed(ctx, "TeamRequestAccess", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.RequestAccess(ctx, h.G().ExternalG(), arg.Name)
}

func (h *TeamsHandler) TeamAcceptInviteOrRequestAccess(ctx context.Context, arg keybase1.TeamAcceptInviteOrRequestAccessArg) (err error) {
	defer h.G().CTraceTimed(ctx, "TeamAcceptInviteOrRequestAccess", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.TeamAcceptInviteOrRequestAccess(ctx, h.G().ExternalG(), arg.TokenOrName)
}

func (h *TeamsHandler) TeamListRequests(ctx context.Context, sessionID int) (res []keybase1.TeamJoinRequest, err error) {
	defer h.G().CTraceTimed(ctx, "TeamListRequests", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return nil, err
	}
	return teams.ListRequests(ctx, h.G().ExternalG())
}

func (h *TeamsHandler) TeamIgnoreRequest(ctx context.Context, arg keybase1.TeamIgnoreRequestArg) (err error) {
	defer h.G().CTraceTimed(ctx, "TeamIgnoreRequest", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.IgnoreRequest(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamTree(ctx context.Context, arg keybase1.TeamTreeArg) (res keybase1.TeamTreeResult, err error) {
	defer h.G().CTraceTimed(ctx, "TeamTree", func() error { return err })()
	return teams.TeamTree(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) TeamDelete(ctx context.Context, arg keybase1.TeamDeleteArg) (err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamDelete(%s)", arg.Name), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	ui := h.getTeamsUI(arg.SessionID)
	return teams.Delete(ctx, h.G().ExternalG(), ui, arg.Name)
}

func (h *TeamsHandler) TeamSetSettings(ctx context.Context, arg keybase1.TeamSetSettingsArg) (err error) {
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.ChangeTeamSettings(ctx, h.G().ExternalG(), arg.Name, arg.Settings)
}

func (h *TeamsHandler) LoadTeamPlusApplicationKeys(netCtx context.Context, arg keybase1.LoadTeamPlusApplicationKeysArg) (keybase1.TeamPlusApplicationKeys, error) {
	netCtx = libkb.WithLogTag(netCtx, "LTPAK")
	h.G().Log.CDebugf(netCtx, "+ TeamHandler#LoadTeamPlusApplicationKeys(%+v)", arg)
	return teams.LoadTeamPlusApplicationKeys(netCtx, h.G().ExternalG(), arg.Id, arg.Application, arg.Refreshers)
}

func (h *TeamsHandler) GetTeamRootID(ctx context.Context, id keybase1.TeamID) (keybase1.TeamID, error) {
	return teams.GetRootID(ctx, h.G().ExternalG(), id)
}

func (h *TeamsHandler) LookupImplicitTeam(ctx context.Context, arg keybase1.LookupImplicitTeamArg) (res keybase1.LookupImplicitTeamRes, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("LookupImplicitTeam(%s)", arg.Name), func() error { return err })()
	res.TeamID, res.Name, res.DisplayName, err = teams.LookupImplicitTeam(ctx, h.G().ExternalG(), arg.Name,
		arg.Public)
	return res, err
}

func (h *TeamsHandler) LookupOrCreateImplicitTeam(ctx context.Context, arg keybase1.LookupOrCreateImplicitTeamArg) (res keybase1.LookupImplicitTeamRes, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("LookupOrCreateImplicitTeam(%s)", arg.Name),
		func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	res.TeamID, res.Name, res.DisplayName, err = teams.LookupOrCreateImplicitTeam(ctx, h.G().ExternalG(),
		arg.Name, arg.Public)
	return res, err
}

func (h *TeamsHandler) TeamReAddMemberAfterReset(ctx context.Context, arg keybase1.TeamReAddMemberAfterResetArg) error {
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.ReAddMemberAfterReset(ctx, h.G().ExternalG(), arg.Id, arg.Username)
}

func (h *TeamsHandler) TeamAddEmailsBulk(ctx context.Context, arg keybase1.TeamAddEmailsBulkArg) (res keybase1.BulkRes, err error) {
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamAddEmailsBulk(%s)", arg.Name), func() error { return err })()

	return teams.AddEmailsBulk(ctx, h.G().ExternalG(), arg.Name, arg.Emails, arg.Role)
}
