package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SendTeamChatWelcomeMessage(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, team,
	user string, membersType chat1.ConversationMembersType, role keybase1.TeamRole) (err error) {
	if team == "" && !teamID.IsNil() {
		teamname, err := ResolveIDToName(ctx, g, teamID)
		if err != nil {
			return fmt.Errorf("getting team name: %v", err)
		}
		team = teamname.String()
	}
	username := g.Env.GetUsername()
	subBody := chat1.NewMessageSystemWithAddedtoteam(chat1.MessageSystemAddedToTeam{
		Adder: username.String(),
		Addee: user,
		Role:  role,
		Team:  team,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	// Ensure we have chat available, since TeamAddMember may also be
	// coming from a standalone launch.
	g.StartStandaloneChat()
	var topicName *string
	if membersType == chat1.ConversationMembersType_TEAM {
		topicName = &globals.DefaultTeamTopic
	}

	_, err = g.ChatHelper.SendMsgByNameNonblock(ctx, team,
		topicName, membersType, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM, nil)
	return err
}

func SendChatInviteWelcomeMessage(ctx context.Context, g *libkb.GlobalContext, team string,
	category keybase1.TeamInviteCategory, inviter, invitee keybase1.UID, role keybase1.TeamRole) (res bool) {

	if !g.Env.SendSystemChatMessages() {
		g.Log.CDebugf(ctx, "Skipping SentChatInviteWelcomeMessage via environment flag")
		return false
	}

	inviterName, err := g.GetUPAKLoader().LookupUsername(ctx, inviter)
	if err != nil {
		g.Log.CDebugf(ctx, "sendChatInviteWelcomeMessage: failed to lookup inviter username: %s", err)
		return false
	}
	inviteeName, err := g.GetUPAKLoader().LookupUsername(ctx, invitee)
	if err != nil {
		g.Log.CDebugf(ctx, "sendChatInviteWelcomeMessage: failed to lookup invitee username: %s", err)
		return false
	}

	username := g.Env.GetUsername()
	subBody := chat1.NewMessageSystemWithInviteaddedtoteam(chat1.MessageSystemInviteAddedToTeam{
		Team:       team,
		Inviter:    inviterName.String(),
		Invitee:    inviteeName.String(),
		Adder:      username.String(),
		Role:       role,
		InviteType: category,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	if _, err = g.ChatHelper.SendMsgByNameNonblock(ctx, team,
		&globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM, nil); err != nil {
		g.Log.CDebugf(ctx, "sendChatInviteWelcomeMessage: failed to send message: %s", err)
		return false
	}
	return true
}

func SendChatSBSResolutionMessage(ctx context.Context, g *libkb.GlobalContext,
	team, assertionUser, assertionService string,
	prover keybase1.UID) (res bool) {

	if !g.Env.SendSystemChatMessages() {
		g.Log.CDebugf(ctx, "Skipping SentChatInviteWelcomeMessage via environment flag")
		return false
	}

	proverName, err := g.GetUPAKLoader().LookupUsername(ctx, prover)
	if err != nil {
		g.Log.CDebugf(ctx, "SendChatSBSResolutionMessage: failed to lookup invitee username: %s", err)
		return false
	}

	subBody := chat1.NewMessageSystemWithSbsresolve(chat1.
		MessageSystemSbsResolve{
		Prover:            proverName.String(),
		AssertionUsername: assertionUser,
		AssertionService:  assertionService,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	g.StartStandaloneChat()

	if _, err = g.ChatHelper.SendMsgByNameNonblock(ctx, team, nil,
		chat1.ConversationMembersType_IMPTEAMNATIVE,
		keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM, nil); err != nil {
		g.Log.CDebugf(ctx, "SendChatSBSResolutionMessage: failed to send message: %s", err)
		return false
	}
	return true
}

func SendTeamChatCreateMessage(ctx context.Context, g *libkb.GlobalContext, team, creator string) bool {
	var err error

	if !g.Env.SendSystemChatMessages() {
		g.Log.CDebugf(ctx, "Skipping SendTeamChatCreateMessage via environment flag")
		return false
	}

	defer func() {
		if err != nil {
			g.Log.CWarningf(ctx, "failed to send team create message: %s", err.Error())
		}
	}()

	subBody := chat1.NewMessageSystemWithCreateteam(chat1.MessageSystemCreateTeam{
		Team:    team,
		Creator: creator,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	// Ensure we have chat available
	g.StartStandaloneChat()

	if _, err = g.ChatHelper.SendMsgByNameNonblock(ctx, team,
		&globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM, nil); err != nil {
		return false
	}

	return true
}

func SendTeamChatChangeAvatar(mctx libkb.MetaContext, team, username string) bool {
	var err error

	if !mctx.G().Env.SendSystemChatMessages() {
		mctx.Debug("Skipping SendTeamChatChangeAvatar via environment flag")
		return false
	}

	defer func() {
		if err != nil {
			mctx.Warning("failed to send team change avatar message: %s", err.Error())
		}
	}()

	subBody := chat1.NewMessageSystemWithChangeavatar(chat1.MessageSystemChangeAvatar{
		Team: team,
		User: username,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	// Ensure we have chat available
	mctx.G().StartStandaloneChat()

	if _, err = mctx.G().ChatHelper.SendMsgByNameNonblock(mctx.Ctx(), team,
		&globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM, nil); err != nil {
		return false
	}

	return true
}
