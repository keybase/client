// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for team operations

package service

import (
	"fmt"
	"time"

	"github.com/go-errors/errors"
	"github.com/keybase/client/go/protocol/gregor1"

	"github.com/keybase/client/go/kbtime"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/offline"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type TeamsHandler struct {
	*BaseHandler
	globals.Contextified
	connID  libkb.ConnectionID
	service *Service
}

var _ keybase1.TeamsInterface = (*TeamsHandler)(nil)

func NewTeamsHandler(xp rpc.Transporter, id libkb.ConnectionID, g *globals.Context, service *Service) *TeamsHandler {
	return &TeamsHandler{
		BaseHandler:  NewBaseHandler(g.ExternalG(), xp),
		Contextified: globals.NewContextified(g),
		connID:       id,
		service:      service,
	}
}

func (h *TeamsHandler) UntrustedTeamExists(ctx context.Context, teamName keybase1.TeamName) (res keybase1.UntrustedTeamExistsResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("UntrustedTeamExists(%s)", teamName), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.GetUntrustedTeamExists(mctx, teamName)
}

func (h *TeamsHandler) TeamCreate(ctx context.Context, arg keybase1.TeamCreateArg) (res keybase1.TeamCreateResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	arg2 := keybase1.TeamCreateWithSettingsArg{
		SessionID:   arg.SessionID,
		Name:        arg.Name,
		JoinSubteam: arg.JoinSubteam,
	}
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}
	return h.TeamCreateWithSettings(ctx, arg2)
}

func (h *TeamsHandler) TeamCreateFancy(ctx context.Context, arg keybase1.TeamCreateFancyArg) (teamID keybase1.TeamID,
	err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	teamInfo := arg.TeamInfo
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamCreateFancy(%s)", teamInfo.Name), &err)()

	arg2 := keybase1.TeamCreateWithSettingsArg{
		Name:        teamInfo.Name,
		SessionID:   arg.SessionID,
		Settings:    teamInfo.OpenSettings,
		JoinSubteam: teamInfo.JoinSubteam,
	}
	teamCreateRes, err := h.TeamCreateWithSettings(ctx, arg2)
	teamID = teamCreateRes.TeamID
	if err != nil {
		return teamID, err
	}

	var errs []error
	err = teams.SetTeamShowcase(ctx, h.G().ExternalG(), teamID, &teamInfo.Showcase, &teamInfo.Description, nil)
	if err != nil {
		errs = append(errs, err)
	}
	if teamInfo.Avatar != nil {
		avatar := teamInfo.Avatar
		arg3 := keybase1.UploadTeamAvatarArg{Teamname: teamInfo.Name, Filename: avatar.AvatarFilename,
			Crop: avatar.Crop, SendChatNotification: false}
		err = teams.ChangeTeamAvatar(mctx, arg3)
		if err != nil {
			errs = append(errs, err)
		}
	}
	uid := gregor1.UID(h.G().GetMyUID().ToBytes())
	for _, topicName := range teamInfo.ChatChannels {
		_, _, err = h.G().ChatHelper.NewConversation(ctx, uid, teamInfo.Name,
			&topicName, chat1.TopicType_CHAT, chat1.ConversationMembersType_TEAM, keybase1.TLFVisibility_PRIVATE)
		if err != nil {
			errs = append(errs, err)
		}
	}
	for _, subteamName := range teamInfo.Subteams {
		name := teamInfo.Name + "." + subteamName
		_, err = h.TeamCreate(ctx, keybase1.TeamCreateArg{SessionID: arg.SessionID, Name: name})
		if err != nil {
			errs = append(errs, err)
		}
	}

	if len(teamInfo.Users) > 0 {
		arg4 := keybase1.TeamAddMembersMultiRoleArg{
			SessionID:            arg.SessionID,
			TeamID:               teamID,
			Users:                teamInfo.Users,
			SendChatNotification: false,
			EmailInviteMessage:   teamInfo.EmailInviteMessage,
			// Add users to the default channels.
			AddToChannels: nil,
		}

		unaddedUsers, err := h.TeamAddMembersMultiRole(ctx, arg4)
		if err != nil {
			errs = append(errs, err)
		}
		if len(unaddedUsers.NotAdded) > 0 {
			errs = append(errs, fmt.Errorf("could not add members to team: %v", unaddedUsers.NotAdded))
		}
	}

	if errs == nil {
		return teamID, nil
	}
	combinedErrString := ""
	for _, err := range errs {
		combinedErrString += ", " + err.Error()
	}
	return teamID, errors.New(combinedErrString)
}

func (h *TeamsHandler) TeamCreateWithSettings(ctx context.Context, arg keybase1.TeamCreateWithSettingsArg) (res keybase1.TeamCreateResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamCreate(%s)", arg.Name), &err)()

	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
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
		res.CreatorAdded = true

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
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamGet(%s)", arg.Name), &err)()

	t, err := teams.GetAnnotatedTeamByName(ctx, h.G().ExternalG(), arg.Name)
	if err != nil {
		return res, err
	}
	return t.ToLegacyTeamDetails(), nil
}

func (h *TeamsHandler) TeamGetByID(ctx context.Context, arg keybase1.TeamGetByIDArg) (res keybase1.TeamDetails, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamGetByID(%s)", arg.Id), &err)()

	t, err := teams.GetAnnotatedTeam(ctx, h.G().ExternalG(), arg.Id)
	if err != nil {
		return res, err
	}
	return t.ToLegacyTeamDetails(), nil
}

func (h *TeamsHandler) GetAnnotatedTeam(ctx context.Context, arg keybase1.TeamID) (res keybase1.AnnotatedTeam, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetAnnotatedTeam(%s)", arg), &err)()

	return teams.GetAnnotatedTeam(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) GetAnnotatedTeamByName(ctx context.Context, arg string) (res keybase1.AnnotatedTeam, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetAnnotatedTeam(%s)", arg), &err)()

	return teams.GetAnnotatedTeamByName(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) TeamGetMembersByID(ctx context.Context, arg keybase1.TeamGetMembersByIDArg) (res []keybase1.TeamMemberDetails, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamGetMembersByID(%s)", arg.Id), &err)()

	t, err := teams.GetAnnotatedTeam(ctx, h.G().ExternalG(), arg.Id)
	if err != nil {
		return res, err
	}
	return t.Members, nil
}

func (h *TeamsHandler) TeamListUnverified(ctx context.Context, arg keybase1.TeamListUnverifiedArg) (res keybase1.AnnotatedTeamList, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamList(%s)", arg.UserAssertion), &err)()
	x, err := teams.ListTeamsUnverified(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamListTeammates(ctx context.Context, arg keybase1.TeamListTeammatesArg) (res keybase1.AnnotatedTeamList, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamListTeammates(%t)", arg.IncludeImplicitTeams), &err)()
	x, err := teams.ListAll(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamListVerified(ctx context.Context, arg keybase1.TeamListVerifiedArg) (res keybase1.AnnotatedTeamList, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamListVerified(%s)", arg.UserAssertion), &err)()
	x, err := teams.ListTeamsVerified(ctx, h.G().ExternalG(), arg)
	if err != nil {
		return keybase1.AnnotatedTeamList{}, err
	}
	return *x, nil
}

func (h *TeamsHandler) TeamGetSubteamsUnverified(ctx context.Context, arg keybase1.TeamGetSubteamsUnverifiedArg) (res keybase1.SubteamListResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamGetSubteamsUnverified(%s)", arg.Name), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.ListSubteamsUnverified(mctx, arg.Name)
}

func (h *TeamsHandler) TeamListSubteamsRecursive(ctx context.Context, arg keybase1.TeamListSubteamsRecursiveArg) (res []keybase1.TeamIDAndName, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamListSubteamsRecursive(%s)", arg.ParentTeamName), &err)()
	return teams.ListSubteamsRecursive(ctx, h.G().ExternalG(), arg.ParentTeamName, arg.ForceRepoll)
}

func (h *TeamsHandler) TeamAddMember(ctx context.Context, arg keybase1.TeamAddMemberArg) (res keybase1.TeamAddMemberResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamAddMember(%s,username=%q,email=%q,phone=%q)", arg.TeamID, arg.Username, arg.Email, arg.Phone),
		&err)()

	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}

	assertion := arg.Username
	if arg.Email != "" || arg.Phone != "" {
		var assertionURL libkb.AssertionURL
		var err error
		if arg.Email != "" {
			assertionURL, err = libkb.ParseAssertionURLKeyValue(externals.MakeStaticAssertionContext(ctx), "email", arg.Email, true)
		} else {
			assertionURL, err = libkb.ParseAssertionURLKeyValue(externals.MakeStaticAssertionContext(ctx), "phone", arg.Phone, true)
		}
		if err != nil {
			return res, err
		}
		assertion = assertionURL.String()
	}

	result, err := teams.AddMemberByID(ctx, h.G().ExternalG(), arg.TeamID, assertion, arg.Role, arg.BotSettings, arg.EmailInviteMessage)
	if err != nil {
		return res, err
	}

	if !arg.SendChatNotification {
		return result, nil
	}

	if result.Invited {
		return result, nil
	}

	result.ChatSending = true
	go func() {
		ctx := libkb.WithLogTag(context.Background(), "BG")
		err := teams.SendTeamChatWelcomeMessage(ctx, h.G().ExternalG(), arg.TeamID, "",
			result.User.Username, chat1.ConversationMembersType_TEAM, arg.Role)
		if err != nil {
			h.G().Log.CDebugf(ctx, "send team welcome message: error: %v", err)
		} else {
			h.G().Log.CDebugf(ctx, "send team welcome message: success")
		}
	}()
	return result, nil
}

// TeamAddMembers returns err if adding members to team failed.
// Adding members is "all-or-nothing", except in the case that the 1st attempt
// fails due to some users having restrictive contact settings. In this
// situation, we retry adding just the non-restricted members. If this 2nd attempt
// succeeds, err=nil and TeamAddMembersResult contains a list of the users that
// weren't added. If the 2nd attempt fails, then an err is returned as usual.
func (h *TeamsHandler) TeamAddMembers(ctx context.Context, arg keybase1.TeamAddMembersArg) (res keybase1.TeamAddMembersResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamAddMembers(%+v", arg), &err)()

	var users []keybase1.UserRolePair
	for _, a := range arg.Assertions {
		users = append(users, keybase1.UserRolePair{Assertion: a, Role: arg.Role})
	}
	arg2 := keybase1.TeamAddMembersMultiRoleArg{
		TeamID:               arg.TeamID,
		Users:                users,
		SendChatNotification: arg.SendChatNotification,
		EmailInviteMessage:   arg.EmailInviteMessage,
	}
	return h.TeamAddMembersMultiRole(ctx, arg2)
}

func (h *TeamsHandler) TeamAddMembersMultiRole(ctx context.Context, arg keybase1.TeamAddMembersMultiRoleArg) (res keybase1.TeamAddMembersResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")

	debugString := "0"
	if len(arg.Users) > 0 {
		debugString = fmt.Sprintf("'%v'", arg.Users[0].Assertion)
		if len(arg.Users) > 1 {
			debugString = fmt.Sprintf("'%v' + %v more", arg.Users[0].Assertion, len(arg.Users)-1)
		}
	}

	defer h.G().CTrace(ctx, fmt.Sprintf("TeamAddMembers(%s, %s)", arg.TeamID, debugString),
		&err)()
	if len(arg.Users) == 0 {
		return res, fmt.Errorf("attempted to add 0 users to a team")
	}
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}

	added, notAdded, err := teams.AddMembers(ctx, h.G().ExternalG(), arg.TeamID, arg.Users, arg.EmailInviteMessage)
	switch err := err.(type) {
	case nil:
	case teams.AddMembersError:
		switch e := err.Err.(type) {
		case libkb.IdentifySummaryError:
			// Return the IdentifySummaryError, which is exportable.
			// Frontend presents this error specifically.
			return res, e
		default:
			return res, err
		}
	default:
		return res, err
	}
	res = keybase1.TeamAddMembersResult{NotAdded: notAdded}

	// AddMembers succeeded
	if arg.SendChatNotification {
		go func() {
			h.G().Log.CDebugf(ctx, "sending team welcome messages")
			ctx := libkb.WithLogTag(context.Background(), "BG")
			for i, res := range added {
				h.G().Log.CDebugf(ctx, "team welcome message for i:%v assertion:%v username:%v invite:%v, role: %v",
					i, arg.Users[i].Assertion, res.Username, res.Invite, arg.Users[i].Role)
				if !res.Invite && !res.Username.IsNil() {
					err := teams.SendTeamChatWelcomeMessage(ctx, h.G().ExternalG(), arg.TeamID, "",
						res.Username.String(), chat1.ConversationMembersType_TEAM, arg.Users[i].Role)
					if err != nil {
						h.G().Log.CDebugf(ctx, "send team welcome message [%v] err: %v", i, err)
					} else {
						h.G().Log.CDebugf(ctx, "send team welcome message [%v] success", i)
					}
				} else {
					h.G().Log.CDebugf(ctx, "send team welcome message [%v] skipped", i)
				}
			}
			h.G().Log.CDebugf(ctx, "done sending team welcome messages")
		}()
	}

	var usernames []string
	for _, user := range arg.Users {
		// the server handles bot membership, skip these users
		if !user.Role.IsBotLike() {
			usernames = append(usernames, user.Assertion)
		}
	}
	uid := gregor1.UID(h.G().GetMyUID().ToBytes())
	for _, convIDStr := range arg.AddToChannels {
		convID, err := chat1.MakeConvID(convIDStr)
		if err != nil {
			return res, err
		}
		err = h.G().ChatHelper.BulkAddToConv(ctx, uid, convID, usernames)
		if err != nil {
			return res, err
		}
	}
	return res, nil
}

func (h *TeamsHandler) TeamRemoveMember(ctx context.Context, arg keybase1.TeamRemoveMemberArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamRemoveMember(%s, %+v)", arg.TeamID, arg), &err)()

	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}

	return teams.RemoveMemberSingle(ctx, h.G().ExternalG(), arg.TeamID, arg.Member)
}

func (h *TeamsHandler) TeamRemoveMembers(ctx context.Context, arg keybase1.TeamRemoveMembersArg) (res keybase1.TeamRemoveMembersResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamRemoveMembers(%s, %v)", arg.TeamID, arg), &err)()
	if len(arg.Members) == 0 {
		return res, errors.New("no members provided to TeamRemoveMembers")
	}

	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}

	return teams.RemoveMembers(ctx, h.G().ExternalG(), arg.TeamID, arg.Members, arg.NoErrorOnPartialFailure)
}

func (h *TeamsHandler) TeamEditMember(ctx context.Context, arg keybase1.TeamEditMemberArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamEditMember(%s,%s,%s)", arg.Name, arg.Username, arg.Role),
		&err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.EditMember(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.Role, arg.BotSettings)
}

func (h *TeamsHandler) TeamEditMembers(ctx context.Context, arg keybase1.TeamEditMembersArg) (res keybase1.TeamEditMembersResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	debugString := "0"
	if len(arg.Users) > 0 {
		debugString = fmt.Sprintf("'%v, %v'", arg.Users[0].Assertion, arg.Users[0].Role)
		if len(arg.Users) > 1 {
			debugString = fmt.Sprintf("'%v' + %v more", arg.Users[0].Assertion, len(arg.Users)-1)
		}
	}
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamEditMembers(%s, %s)", arg.TeamID, debugString),
		&err)()
	if len(arg.Users) == 0 {
		return res, nil
	}

	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}

	return teams.EditMembers(ctx, h.G().ExternalG(), arg.TeamID, arg.Users)
}

func (h *TeamsHandler) TeamSetBotSettings(ctx context.Context, arg keybase1.TeamSetBotSettingsArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamSetBotSettings(%s,%s,%v)", arg.Name, arg.Username, arg.BotSettings),
		&err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.SetBotSettings(ctx, h.G().ExternalG(), arg.Name, arg.Username, arg.BotSettings)
}

func (h *TeamsHandler) TeamGetBotSettings(ctx context.Context, arg keybase1.TeamGetBotSettingsArg) (res keybase1.TeamBotSettings, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamGetBotSettings(%s,%s)", arg.Name, arg.Username),
		&err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}
	return teams.GetBotSettings(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamLeave(ctx context.Context, arg keybase1.TeamLeaveArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamLeave(%s)", arg.Name), &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.Leave(ctx, h.G().ExternalG(), arg.Name, arg.Permanent)
}

func (h *TeamsHandler) TeamRename(ctx context.Context, arg keybase1.TeamRenameArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamRename(%s)", arg.PrevName), &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.RenameSubteam(ctx, h.G().ExternalG(), arg.PrevName, arg.NewName)
}

func (h *TeamsHandler) TeamAcceptInvite(ctx context.Context, arg keybase1.TeamAcceptInviteArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, "TeamAcceptInvite", &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}

	// If token looks at all like Seitan, don't pass to functions that might
	// log or send to server.
	parsedToken, wasSeitany := teams.ParseSeitanTokenFromPaste(arg.Token)
	if wasSeitany {
		mctx := h.MetaContext(ctx)
		ui := h.getTeamsUI(arg.SessionID)
		_, err = teams.ParseAndAcceptSeitanToken(mctx, ui, parsedToken)
		return err
	}

	// Fallback to legacy email TOFU token
	return teams.AcceptServerTrustInvite(ctx, h.G().ExternalG(), arg.Token)
}

func (h *TeamsHandler) TeamRequestAccess(ctx context.Context, arg keybase1.TeamRequestAccessArg) (res keybase1.TeamRequestAccessResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	h.G().CTrace(ctx, "TeamRequestAccess", &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return keybase1.TeamRequestAccessResult{}, err
	}
	return teams.RequestAccess(ctx, h.G().ExternalG(), arg.Name)
}

func (h *TeamsHandler) TeamAcceptInviteOrRequestAccess(ctx context.Context, arg keybase1.TeamAcceptInviteOrRequestAccessArg) (res keybase1.TeamAcceptOrRequestResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, "TeamAcceptInviteOrRequestAccess", &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}
	ui := h.getTeamsUI(arg.SessionID)

	// If token looks at all like Seitan, don't pass to functions that might log or send to server.
	maybeSeitan, keepSecret := teams.ParseSeitanTokenFromPaste(arg.TokenOrName)
	if keepSecret {
		mctx := h.MetaContext(ctx)
		_, err = teams.ParseAndAcceptSeitanToken(mctx, ui, maybeSeitan)
		return keybase1.TeamAcceptOrRequestResult{WasSeitan: true, WasToken: true}, err
	}
	return teams.TeamAcceptInviteOrRequestAccess(ctx, h.G().ExternalG(), ui, arg.TokenOrName)
}

func (h *TeamsHandler) TeamListRequests(ctx context.Context, arg keybase1.TeamListRequestsArg) (res []keybase1.TeamJoinRequest, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, "TeamListRequests", &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return nil, err
	}
	return teams.ListRequests(ctx, h.G().ExternalG(), arg.TeamName)
}

func (h *TeamsHandler) TeamListMyAccessRequests(ctx context.Context, arg keybase1.TeamListMyAccessRequestsArg) (res []keybase1.TeamName, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, "TeamListMyAccessRequests", &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return nil, err
	}
	return teams.ListMyAccessRequests(ctx, h.G().ExternalG(), arg.TeamName)
}

func (h *TeamsHandler) TeamIgnoreRequest(ctx context.Context, arg keybase1.TeamIgnoreRequestArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, "TeamIgnoreRequest", &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.IgnoreRequest(ctx, h.G().ExternalG(), arg.Name, arg.Username)
}

func (h *TeamsHandler) TeamTreeUnverified(ctx context.Context, arg keybase1.TeamTreeUnverifiedArg) (res keybase1.TeamTreeResult, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, "TeamTreeUnverified", &err)()
	return teams.TeamTreeUnverified(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) TeamDelete(ctx context.Context, arg keybase1.TeamDeleteArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamDelete(%s)", arg.TeamID), &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	ui := h.getTeamsUI(arg.SessionID)
	return teams.Delete(ctx, h.G().ExternalG(), ui, arg.TeamID)
}

func (h *TeamsHandler) TeamSetSettings(ctx context.Context, arg keybase1.TeamSetSettingsArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamSetSettings(%s)", arg.TeamID), &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.ChangeTeamSettingsByID(ctx, h.G().ExternalG(), arg.TeamID, arg.Settings)
}

func (h *TeamsHandler) LoadTeamPlusApplicationKeys(ctx context.Context, arg keybase1.LoadTeamPlusApplicationKeysArg) (res keybase1.TeamPlusApplicationKeys, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	ctx = libkb.WithLogTag(ctx, "LTPAK")
	defer h.G().CTrace(ctx, fmt.Sprintf("LoadTeamPlusApplicationKeys(%s)", arg.Id), &err)()

	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	loader := func(mctx libkb.MetaContext) (interface{}, error) {
		return teams.LoadTeamPlusApplicationKeys(ctx, h.G().ExternalG(), arg.Id, arg.Application, arg.Refreshers,
			arg.IncludeKBFSKeys)
	}

	// argKey is a copy of arg that's going to be used for a cache key, so clear out
	// refreshers and sessionID, since they don't affect the cache key value.
	argKey := arg
	argKey.Refreshers = keybase1.TeamRefreshers{}
	argKey.SessionID = 0
	argKey.IncludeKBFSKeys = false

	servedRes, err := h.service.offlineRPCCache.Serve(mctx, arg.Oa, offline.Version(1), "teams.loadTeamPlusApplicationKeys", true, argKey, &res, loader)
	if err != nil {
		return keybase1.TeamPlusApplicationKeys{}, err
	}
	if s, ok := servedRes.(keybase1.TeamPlusApplicationKeys); ok {
		res = s
	}
	return res, nil
}

func (h *TeamsHandler) TeamCreateSeitanToken(ctx context.Context, arg keybase1.TeamCreateSeitanTokenArg) (token keybase1.SeitanIKey, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return "", err
	}
	return teams.CreateSeitanToken(ctx, h.G().ExternalG(), arg.Teamname, arg.Role, arg.Label)
}

func (h *TeamsHandler) TeamCreateSeitanTokenV2(ctx context.Context, arg keybase1.TeamCreateSeitanTokenV2Arg) (token keybase1.SeitanIKeyV2, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return "", err
	}
	return teams.CreateSeitanTokenV2(ctx, h.G().ExternalG(), arg.Teamname, arg.Role, arg.Label)
}

func (h *TeamsHandler) TeamCreateSeitanInvitelink(ctx context.Context,
	arg keybase1.TeamCreateSeitanInvitelinkArg) (invitelink keybase1.Invitelink, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return invitelink, err
	}
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.CreateInvitelink(mctx, arg.Teamname, arg.Role, arg.MaxUses, arg.Etime)
}

func (h *TeamsHandler) TeamCreateSeitanInvitelinkWithDuration(ctx context.Context,
	arg keybase1.TeamCreateSeitanInvitelinkWithDurationArg) (invitelink keybase1.Invitelink, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return invitelink, err
	}

	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())

	var etimeUnixPtr *keybase1.UnixTime
	if arg.ExpireAfter != nil {
		etime, err := kbtime.AddLongDuration(h.G().Clock().Now(), *arg.ExpireAfter)
		if err != nil {
			return invitelink, err
		}
		mctx.Debug("Etime from duration %q is: %s", arg.ExpireAfter, etime.String())
		etimeUnix := keybase1.ToUnixTime(etime)
		etimeUnixPtr = &etimeUnix
	}

	return teams.CreateInvitelink(mctx, arg.Teamname, arg.Role, arg.MaxUses, etimeUnixPtr)
}

func (h *TeamsHandler) GetTeamRootID(ctx context.Context, id keybase1.TeamID) (keybase1.TeamID, error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	return teams.GetRootID(ctx, h.G().ExternalG(), id)
}

func (h *TeamsHandler) LookupImplicitTeam(ctx context.Context, arg keybase1.LookupImplicitTeamArg) (res keybase1.LookupImplicitTeamRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("LookupImplicitTeam(%s)", arg.Name), &err)()
	var team *teams.Team
	team, res.Name, res.DisplayName, err =
		teams.LookupImplicitTeam(ctx, h.G().ExternalG(), arg.Name, arg.Public, teams.ImplicitTeamOptions{})
	if err == nil {
		res.TeamID = team.ID
		res.TlfID = team.LatestKBFSTLFID()
	}
	return res, err
}

func (h *TeamsHandler) LookupOrCreateImplicitTeam(ctx context.Context, arg keybase1.LookupOrCreateImplicitTeamArg) (res keybase1.LookupImplicitTeamRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("LookupOrCreateImplicitTeam(%s)", arg.Name),
		&err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return res, err
	}
	var team *teams.Team
	team, res.Name, res.DisplayName, err = teams.LookupOrCreateImplicitTeam(ctx, h.G().ExternalG(),
		arg.Name, arg.Public)
	if err == nil {
		res.TeamID = team.ID
		res.TlfID = team.LatestKBFSTLFID()
	}
	return res, err
}

func (h *TeamsHandler) TeamReAddMemberAfterReset(ctx context.Context, arg keybase1.TeamReAddMemberAfterResetArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamReAddMemberAfterReset(%s)", arg.Id), &err)()
	if err := assertLoggedIn(ctx, h.G().ExternalG()); err != nil {
		return err
	}
	return teams.ReAddMemberAfterReset(ctx, h.G().ExternalG(), arg.Id, arg.Username)
}

func (h *TeamsHandler) TeamAddEmailsBulk(ctx context.Context, arg keybase1.TeamAddEmailsBulkArg) (res keybase1.BulkRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamAddEmailsBulk(%s)", arg.Name), &err)()

	return teams.AddEmailsBulk(ctx, h.G().ExternalG(), arg.Name, arg.Emails, arg.Role)
}

func (h *TeamsHandler) GetTeamShowcase(ctx context.Context, teamID keybase1.TeamID) (ret keybase1.TeamShowcase, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetTeamShowcase(%s)", teamID), &err)()

	return teams.GetTeamShowcase(ctx, h.G().ExternalG(), teamID)
}

func (h *TeamsHandler) GetTeamAndMemberShowcase(ctx context.Context, id keybase1.TeamID) (ret keybase1.TeamAndMemberShowcase, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetTeamAndMemberShowcase(%s)", id), &err)()

	return teams.GetTeamAndMemberShowcase(ctx, h.G().ExternalG(), id)
}

func (h *TeamsHandler) SetTeamShowcase(ctx context.Context, arg keybase1.SetTeamShowcaseArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("SetTeamShowcase(%s)", arg.TeamID), &err)()

	err = teams.SetTeamShowcase(ctx, h.G().ExternalG(), arg.TeamID, arg.IsShowcased, arg.Description, arg.AnyMemberShowcase)
	return err
}

func (h *TeamsHandler) SetTeamMemberShowcase(ctx context.Context, arg keybase1.SetTeamMemberShowcaseArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("SetTeamMemberShowcase(%s)", arg.TeamID), &err)()

	err = teams.SetTeamMemberShowcase(ctx, h.G().ExternalG(), arg.TeamID, arg.IsShowcased)
	return err
}

func (h *TeamsHandler) CanUserPerform(ctx context.Context, teamname string) (ret keybase1.TeamOperation, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("CanUserPerform(%s)", teamname), &err)()
	// We never want to return an error from this, the frontend has no proper reaction to an error from
	// this RPC call. We retry until we work.
	for {
		if ret, err = teams.CanUserPerform(ctx, h.G().ExternalG(), teamname); err == nil {
			break
		}
		select {
		case <-ctx.Done():
			return ret, ctx.Err()
		default:
		}
		time.Sleep(5 * time.Second)
	}
	return ret, err
}

func (h *TeamsHandler) TeamRotateKey(ctx context.Context, arg keybase1.TeamRotateKeyArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamRotateKey(%v)", arg.TeamID), &err)()
	return teams.RotateKey(ctx, h.G().ExternalG(), arg)
}

func (h *TeamsHandler) TeamDebug(ctx context.Context, teamID keybase1.TeamID) (res keybase1.TeamDebugRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamDebug(%v)", teamID), &err)()

	return teams.TeamDebug(ctx, h.G().ExternalG(), teamID)
}

func (h *TeamsHandler) GetTarsDisabled(ctx context.Context, teamID keybase1.TeamID) (res bool, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetTarsDisabled(%s)", teamID), &err)()

	return teams.GetTarsDisabled(ctx, h.G().ExternalG(), teamID)
}

func (h *TeamsHandler) SetTarsDisabled(ctx context.Context, arg keybase1.SetTarsDisabledArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("SetTarsDisabled(%s,%t)", arg.TeamID, arg.Disabled), &err)()

	return teams.SetTarsDisabled(ctx, h.G().ExternalG(), arg.TeamID, arg.Disabled)
}

func (h *TeamsHandler) TeamProfileAddList(ctx context.Context, arg keybase1.TeamProfileAddListArg) (res []keybase1.TeamProfileAddEntry, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TeamProfileAddList(%v)", arg.Username), &err)()

	return teams.TeamProfileAddList(ctx, h.G().ExternalG(), arg.Username)
}

func (h *TeamsHandler) UploadTeamAvatar(ctx context.Context, arg keybase1.UploadTeamAvatarArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("UploadTeamAvatar(%s,%s)", arg.Teamname, arg.Filename), &err)()

	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.ChangeTeamAvatar(mctx, arg)
}

func (h *TeamsHandler) TryDecryptWithTeamKey(ctx context.Context, arg keybase1.TryDecryptWithTeamKeyArg) (ret []byte, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("TryDecryptWithTeamKey(teamID:%s)", arg.TeamID), &err)()

	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.TryDecryptWithTeamKey(mctx, arg)
}

func (h *TeamsHandler) FindNextMerkleRootAfterTeamRemoval(ctx context.Context, arg keybase1.FindNextMerkleRootAfterTeamRemovalArg) (res keybase1.NextMerkleRootRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("FindNextMerkleRootAfterTeamRemoval(%+v)", arg), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return libkb.FindNextMerkleRootAfterTeamRemoval(mctx, arg)
}

func (h *TeamsHandler) FindNextMerkleRootAfterTeamRemovalBySigningKey(ctx context.Context, arg keybase1.FindNextMerkleRootAfterTeamRemovalBySigningKeyArg) (res keybase1.NextMerkleRootRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("FindNextMerkleRootAfterTeamRemovalBySigningKey(%+v)", arg), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.FindNextMerkleRootAfterRemoval(mctx, arg)
}

func (h *TeamsHandler) ProfileTeamLoad(ctx context.Context, arg keybase1.LoadTeamArg) (res keybase1.ProfileTeamLoadRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("ProfileTeamLoad(%+v)", arg), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.ProfileTeamLoad(mctx, arg)
}

func (h *TeamsHandler) Ftl(ctx context.Context, arg keybase1.FastTeamLoadArg) (res keybase1.FastTeamLoadRes, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("Ftl(%+v)", arg), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.FTL(mctx, arg)

}

func (h *TeamsHandler) GetTeamID(ctx context.Context, teamName string) (res keybase1.TeamID, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetTeamIDByName(%s)", teamName), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.GetTeamIDByNameRPC(mctx, teamName)
}

func (h *TeamsHandler) GetTeamName(ctx context.Context, teamID keybase1.TeamID) (res keybase1.TeamName, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetTeamNameByID(%s)", teamID), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.ResolveIDToName(mctx.Ctx(), mctx.G(), teamID)
}

func (h *TeamsHandler) GetTeamRoleMap(ctx context.Context) (res keybase1.TeamRoleMapAndVersion, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return mctx.G().GetTeamRoleMapManager().Get(mctx, true /* retry on fail */)
}

func (h *TeamsHandler) GetUntrustedTeamInfo(ctx context.Context, name keybase1.TeamName) (info keybase1.UntrustedTeamInfo, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetUntrustedTeamInfo(%s)", name), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.GetUntrustedTeamInfo(mctx, name)
}

func (h *TeamsHandler) LoadTeamTreeMembershipsAsync(ctx context.Context,
	arg keybase1.LoadTeamTreeMembershipsAsyncArg) (res keybase1.TeamTreeInitial, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	ctx = libkb.WithLogTag(ctx, "TMTREE")
	defer h.G().CTrace(ctx, fmt.Sprintf("LoadTeamTreeMembershipsAsync(%s, %s, %d)",
		arg.TeamID, arg.Username, arg.SessionID), &err)()

	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	loader, err := teams.NewTreeloader(mctx, arg.Username, arg.TeamID,
		arg.SessionID, true /* includeAncestors */)
	if err != nil {
		return res, err
	}
	err = loader.LoadAsync(mctx)
	if err != nil {
		return res, err
	}
	return keybase1.TeamTreeInitial{Guid: arg.SessionID}, nil
}

func (h *TeamsHandler) GetInviteLinkDetails(ctx context.Context, inviteID keybase1.TeamInviteID) (details keybase1.InviteLinkDetails, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	defer h.G().CTrace(ctx, fmt.Sprintf("GetInviteLinkDetails(%s)", inviteID), &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.GetInviteLinkDetails(mctx, inviteID)
}

func (h *TeamsHandler) FindAssertionsInTeamNoResolve(ctx context.Context, arg keybase1.FindAssertionsInTeamNoResolveArg) (ret []string, err error) {
	ctx = libkb.WithLogTag(ctx, "TM")
	traceMsg := fmt.Sprintf("FindAssertionsInTeam(%s, %d)", arg.TeamID, len(arg.Assertions))
	defer h.G().CTrace(ctx, traceMsg, &err)()
	mctx := libkb.NewMetaContext(ctx, h.G().ExternalG())
	return teams.FindAssertionsInTeamNoResolve(mctx, arg.TeamID, arg.Assertions)
}
