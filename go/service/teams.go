// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for team operations

package service

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
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
	ctx = libkb.WithLogTag(ctx, "TM")
	arg2 := keybase1.TeamCreateWithSettingsArg{
		SessionID:   arg.SessionID,
		Name:        arg.Name,
		JoinSubteam: arg.JoinSubteam,
	}
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	return h.TeamCreateWithSettings(ctx, arg2)
}

func (h *TeamsHandler) TeamCreateWithSettings(ctx context.Context, arg keybase1.TeamCreateWithSettingsArg) (res keybase1.TeamCreateResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamCreate(%s)", arg.Name), func() error { return err })()

	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	teamName, err := keybase1.TeamNameFromString(arg.Name)
	if err != nil {
		return res, err
	}
	if teamName.Depth() == 0 {
		return res, fmt.Errorf("empty team name")
	}
	if !teamName.IsRootTeam() {
		h.G().Log.CDebugf(ctx, "TeamCreate: creating a new subteam: %s", arg.Name)
		parentName, err := teamName.Parent()
		if err != nil {
			return res, err
		}
		addSelfAs := keybase1.TeamRole_WRITER // writer is enough to init chat channel
		if arg.JoinSubteam {
			// but if user wants to stay in team, add as admin.
			addSelfAs = keybase1.TeamRole_ADMIN
		}

		teamID, err := teams.CreateSubteam(ctx, h.G().ExternalG(), string(teamName.LastPart()),
			parentName, addSelfAs)
		if err != nil {
			return res, err
		}
		res.TeamID = *teamID

		// join the team to send the Create message
		h.G().Log.CDebugf(ctx, "TeamCreate: created subteam %s with self in as %v", arg.Name, addSelfAs)
		username := h.G().Env.GetUsername().String()
		res.ChatSent = teams.SendTeamChatCreateMessage(ctx, h.G().ExternalG(), teamName.String(), username)

		if !arg.JoinSubteam {
			h.G().Log.CDebugf(ctx, "TeamCreate: leaving just-created subteam %s", arg.Name)
			if err := teams.Leave(ctx, h.G().ExternalG(), teamName.String(), false); err != nil {
				h.G().Log.CDebugf(ctx, "TeamCreate: error leaving new subteam %s: %s", arg.Name, err)
				return res, err
			}
			h.G().Log.CDebugf(ctx, "TeamCreate: left just-created subteam %s", arg.Name)
			res.CreatorAdded = false
		}
	} else {
		teamID, err := teams.CreateRootTeam(ctx, h.G().ExternalG(), teamName.String(), arg.Settings)
		if err != nil {
			return res, err
		}
		res.TeamID = *teamID
		res.CreatorAdded = true
		// send system message that team was created
		res.ChatSent = teams.SendTeamChatCreateMessage(ctx, h.G().ExternalG(), teamName.String(), h.G().Env.GetUsername().String())
	}

	return res, nil
}

func (h *TeamsHandler) TeamGet(ctx context.Context, arg keybase1.TeamGetArg) (res keybase1.TeamDetails, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamGet(%s)", arg.Name), func() error { return err })()
	return teams.Details(ctx, h.G().ExternalG(), arg.Name, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamImplicitAdmins(ctx context.Context, arg keybase1.TeamImplicitAdminsArg) (res []keybase1.TeamMemberDetails, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamImplicitAdmins(%s)", arg.TeamName), func() error { return err })()
	teamName, err := keybase1.TeamNameFromString(arg.TeamName)
	if err != nil {
		return nil, err
	}
	teamID, err := teams.ResolveNameToID(ctx, h.G().ExternalG(), teamName)
	if err != nil {
		return nil, err
	}
	return teams.ImplicitAdmins(ctx, h.G().ExternalG(), teamID)
}

func (h *TeamsHandler) TeamListUnverified(ctx context.Context, arg keybase1.TeamListUnverifiedArg) (res keybase1.AnnotatedTeamList, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamList(%s)", arg.UserAssertion), func() error { return err })()
	x, err := teams.ListTeamsUnverified(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamListTeammates(ctx context.Context, arg keybase1.TeamListTeammatesArg) (res keybase1.AnnotatedTeamList, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamListTeammates(%t)", arg.IncludeImplicitTeams), func() error { return err })()
	x, err := teams.ListAll(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamListVerified(ctx context.Context, arg keybase1.TeamListVerifiedArg) (res keybase1.AnnotatedTeamList, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamListVerified(%s)", arg.UserAssertion), func() error { return err })()
	x, err := teams.ListTeamsVerified(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamListSubteamsRecursive(ctx context.Context, arg keybase1.TeamListSubteamsRecursiveArg) (res []keybase1.TeamIDAndName, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamListSubteamsRecursive(%s)", arg.ParentTeamName), func() error { return err })()
	return teams.ListSubteamsRecursive(ctx, h.G().ExternalG(), arg.ParentTeamName, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamChangeMembership(ctx context.Context, arg keybase1.TeamChangeMembershipArg) error {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.ChangeRoles(ctx, h.G().ExternalG(), arg.Name, arg.Req)
}

func (h *TeamsHandler) TeamAddMember(ctx context.Context, arg keybase1.TeamAddMemberArg) (res keybase1.TeamAddMemberResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
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

	result.ChatSent = teams.SendTeamChatWelcomeMessage(ctx, h.G().ExternalG(), arg.Name,
		result.User.Username)
	return result, nil
}

func (h *TeamsHandler) TeamRemoveMember(ctx context.Context, arg keybase1.TeamRemoveMemberArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamRemoveMember(%s, u:%q, e:%q, i:%q)", arg.Name, arg.Username, arg.Email, arg.InviteID),
		func() error { return err })()

	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}

	var exclusiveActions []string
	if len(arg.Username) > 0 {
		exclusiveActions = append(exclusiveActions, "username")
	}
	if len(arg.Email) > 0 {
		exclusiveActions = append(exclusiveActions, "email")
	}
	if len(arg.InviteID) > 0 {
		exclusiveActions = append(exclusiveActions, "inviteID")
	}
	if len(exclusiveActions) > 1 {
		return fmt.Errorf("TeamRemoveMember can only do 1 of %v at a time", exclusiveActions)
	}

	if len(arg.Email) > 0 {
		h.G().Log.CDebugf(ctx, "TeamRemoveMember: received email address, using CancelEmailInvite for %q in team %q", arg.Email, arg.Name)
		return teams.CancelEmailInvite(ctx, h.G().ExternalG(), arg.Name, arg.Email)
	} else if len(arg.InviteID) > 0 {
		h.G().Log.CDebugf(ctx, "TeamRemoveMember: received inviteID, using CancelInviteByID for %q in team %q", arg.InviteID, arg.Name)
		return teams.CancelInviteByID(ctx, h.G().ExternalG(), arg.Name, arg.InviteID)
	}
	h.G().Log.CDebugf(ctx, "TeamRemoveMember: using RemoveMember for %q in team %q", arg.Username, arg.Name)
	return teams.RemoveMember(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamEditMember(ctx context.Context, arg keybase1.TeamEditMemberArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamEditMember(%s,%s,%s)", arg.Name, arg.Username, arg.Role),
		func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.EditMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role)
}

func (h *TeamsHandler) TeamLeave(ctx context.Context, arg keybase1.TeamLeaveArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamLeave(%s)", arg.Name), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.Leave(ctx, h.G().ExternalG(), arg.Name, arg.Permanent)
}

func (h *TeamsHandler) TeamRename(ctx context.Context, arg keybase1.TeamRenameArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamRename(%s)", arg.PrevName), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.RenameSubteam(ctx, h.G().ExternalG(), arg.PrevName, arg.NewName)
}

func (h *TeamsHandler) TeamAcceptInvite(ctx context.Context, arg keybase1.TeamAcceptInviteArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, "TeamAcceptInvite", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}

	// If token looks at all like Seitan, don't pass to functions that might log or send to server.
	maybeSeitan, keepSecret := teams.ParseSeitanTokenFromPaste(arg.Token)
	if keepSecret {
		_, err = teams.ParseAndAcceptSeitanToken(ctx, h.G().ExternalG(), maybeSeitan)
		return err
	}

	return teams.AcceptInvite(ctx, h.G().ExternalG(), arg.Token)
}

func (h *TeamsHandler) TeamRequestAccess(ctx context.Context, arg keybase1.TeamRequestAccessArg) (res keybase1.TeamRequestAccessResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	h.G().CTraceTimed(ctx, "TeamRequestAccess", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return keybase1.TeamRequestAccessResult{}, err
	}
	return teams.RequestAccess(ctx, h.G().ExternalG(), arg.Name)
}

func (h *TeamsHandler) TeamAcceptInviteOrRequestAccess(ctx context.Context, arg keybase1.TeamAcceptInviteOrRequestAccessArg) (res keybase1.TeamAcceptOrRequestResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, "TeamAcceptInviteOrRequestAccess", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}

	return teams.TeamAcceptInviteOrRequestAccess(ctx, h.G().ExternalG(), arg.TokenOrName)
}

func (h *TeamsHandler) TeamListRequests(ctx context.Context, sessionID int) (res []keybase1.TeamJoinRequest, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, "TeamListRequests", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return nil, err
	}
	return teams.ListRequests(ctx, h.G().ExternalG())
}

func (h *TeamsHandler) TeamListMyAccessRequests(ctx context.Context, arg keybase1.TeamListMyAccessRequestsArg) (res []keybase1.TeamName, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, "TeamListMyAccessRequests", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return nil, err
	}
	return teams.ListMyAccessRequests(ctx, h.G().ExternalG(), arg.TeamName)
}

func (h *TeamsHandler) TeamIgnoreRequest(ctx context.Context, arg keybase1.TeamIgnoreRequestArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, "TeamIgnoreRequest", func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.IgnoreRequest(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamTree(ctx context.Context, arg keybase1.TeamTreeArg) (res keybase1.TeamTreeResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, "TeamTree", func() error { return err })()
	return teams.TeamTree(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) TeamDelete(ctx context.Context, arg keybase1.TeamDeleteArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamDelete(%s)", arg.Name), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	ui := h.getTeamsUI(arg.SessionID)
	return teams.Delete(ctx, h.G().ExternalG(), ui, arg.Name)
}

func (h *TeamsHandler) TeamSetSettings(ctx context.Context, arg keybase1.TeamSetSettingsArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamSetSettings(%s)", arg.Name), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.ChangeTeamSettings(ctx, h.G().ExternalG(), arg.Name, arg.Settings)
}

func (h *TeamsHandler) LoadTeamPlusApplicationKeys(ctx context.Context, arg keybase1.LoadTeamPlusApplicationKeysArg) (res keybase1.TeamPlusApplicationKeys, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	ctx = libkb.WithLogTag(ctx, "LTPAK")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("LoadTeamPlusApplicationKeys(%s)", arg.Id), func() error { return err })()
	return teams.LoadTeamPlusApplicationKeys(ctx, h.G().ExternalG(), arg.Id, arg.Application, arg.Refreshers)
}

func (h *TeamsHandler) TeamCreateSeitanToken(ctx context.Context, arg keybase1.TeamCreateSeitanTokenArg) (token keybase1.SeitanIKey, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := h.assertLoggedIn(ctx); err != nil {
		return "", err
	}
	return teams.CreateSeitanToken(ctx, h.G().ExternalG(), arg.Name, arg.Role, arg.Label)
}

func (h *TeamsHandler) TeamCreateSeitanTokenV2(ctx context.Context, arg keybase1.TeamCreateSeitanTokenV2Arg) (token keybase1.SeitanIKeyV2, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := h.assertLoggedIn(ctx); err != nil {
		return "", err
	}
	return teams.CreateSeitanTokenV2(ctx, h.G().ExternalG(), arg.Name, arg.Role, arg.Label)
}

func (h *TeamsHandler) GetTeamRootID(ctx context.Context, id keybase1.TeamID) (keybase1.TeamID, error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	return teams.GetRootID(ctx, h.G().ExternalG(), id)
}

func (h *TeamsHandler) LookupImplicitTeam(ctx context.Context, arg keybase1.LookupImplicitTeamArg) (res keybase1.LookupImplicitTeamRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("LookupImplicitTeam(%s)", arg.Name), func() error { return err })()
	var team *teams.Team
	team, res.Name, res.DisplayName, err =
		teams.LookupImplicitTeam(ctx, h.G().ExternalG(), arg.Name, arg.Public)
	res.TeamID = team.ID
	res.TlfID = team.KBFSTLFID()
	return res, err
}

func (h *TeamsHandler) LookupOrCreateImplicitTeam(ctx context.Context, arg keybase1.LookupOrCreateImplicitTeamArg) (res keybase1.LookupImplicitTeamRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("LookupOrCreateImplicitTeam(%s)", arg.Name),
		func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return res, err
	}
	var team *teams.Team
	team, res.Name, res.DisplayName, err = teams.LookupOrCreateImplicitTeam(ctx, h.G().ExternalG(),
		arg.Name, arg.Public)
	res.TeamID = team.ID
	res.TlfID = team.KBFSTLFID()
	return res, err
}

func (h *TeamsHandler) TeamReAddMemberAfterReset(ctx context.Context, arg keybase1.TeamReAddMemberAfterResetArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamReAddMemberAfterReset(%s)", arg.Id), func() error { return err })()
	if err := h.assertLoggedIn(ctx); err != nil {
		return err
	}
	return teams.ReAddMemberAfterReset(ctx, h.G().ExternalG(), arg.Id, arg.Username)
}

func (h *TeamsHandler) TeamAddEmailsBulk(ctx context.Context, arg keybase1.TeamAddEmailsBulkArg) (res keybase1.BulkRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamAddEmailsBulk(%s)", arg.Name), func() error { return err })()

	return teams.AddEmailsBulk(ctx, h.G().ExternalG(), arg.Name, arg.Emails, arg.Role)
}

func (h *TeamsHandler) GetTeamShowcase(ctx context.Context, teamname string) (ret keybase1.TeamShowcase, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("GetTeamShowcase(%s)", teamname), func() error { return err })()

	return teams.GetTeamShowcase(ctx, h.G().ExternalG(), teamname)
}

func (h *TeamsHandler) GetTeamAndMemberShowcase(ctx context.Context, teamname string) (ret keybase1.TeamAndMemberShowcase, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("GetTeamAndMemberShowcase(%s)", teamname), func() error { return err })()

	return teams.GetTeamAndMemberShowcase(ctx, h.G().ExternalG(), teamname)
}

func (h *TeamsHandler) SetTeamShowcase(ctx context.Context, arg keybase1.SetTeamShowcaseArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("SetTeamShowcase(%s)", arg.Name), func() error { return err })()

	err = teams.SetTeamShowcase(ctx, h.G().ExternalG(), arg.Name, arg.IsShowcased, arg.Description, arg.AnyMemberShowcase)
	return err
}

func (h *TeamsHandler) SetTeamMemberShowcase(ctx context.Context, arg keybase1.SetTeamMemberShowcaseArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("SetTeamMemberShowcase(%s)", arg.Name), func() error { return err })()

	err = teams.SetTeamMemberShowcase(ctx, h.G().ExternalG(), arg.Name, arg.IsShowcased)
	return err
}

func (h *TeamsHandler) CanUserPerform(ctx context.Context, teamname string) (ret keybase1.TeamOperation, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("CanUserPerform(%s)", teamname), func() error { return err })()
	return teams.CanUserPerform(ctx, h.G().ExternalG(), teamname)
}

func (h *TeamsHandler) TeamRotateKey(ctx context.Context, teamID keybase1.TeamID) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamRotateKey(%v)", teamID), func() error { return err })()
	return teams.RotateKey(ctx, h.G().ExternalG(), teamID)
}

func (h *TeamsHandler) TeamDebug(ctx context.Context, teamID keybase1.TeamID) (res keybase1.TeamDebugRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("TeamDebug(%v)", teamID), func() error { return err })()

	return teams.TeamDebug(ctx, h.G().ExternalG(), teamID)
}

func (h *TeamsHandler) GetTarsDisabled(ctx context.Context, teamname string) (res bool, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("GetTarsDisabled(%s)", teamname), func() error { return err })()

	return teams.GetTarsDisabled(ctx, h.G().ExternalG(), teamname)
}

func (h *TeamsHandler) SetTarsDisabled(ctx context.Context, arg keybase1.SetTarsDisabledArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("SetTarsDisabled(%s,%t)", arg.Name, arg.Disabled), func() error { return err })()

	return teams.SetTarsDisabled(ctx, h.G().ExternalG(), arg.Name, arg.Disabled)
}
