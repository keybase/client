package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SendTeamChatWelcomeMessage(ctx context.Context, g *libkb.GlobalContext, team, user string) (err error) {
	teamDetails, err := Details(ctx, g, team)
	if err != nil {
		return fmt.Errorf("getting team details: %v", err)
	}

	var ownerNames, adminNames, writerNames, readerNames, botNames, restrictedBotNames []string
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
	for _, bot := range teamDetails.Members.Bots {
		botNames = append(botNames, bot.Username)
	}
	for _, restrictedBot := range teamDetails.Members.RestrictedBots {
		restrictedBotNames = append(restrictedBotNames, restrictedBot.Username)
	}
	username := g.Env.GetUsername()
	subBody := chat1.NewMessageSystemWithAddedtoteam(chat1.MessageSystemAddedToTeam{
		Adder:          username.String(),
		Addee:          user,
		Team:           team,
		Owners:         ownerNames,
		Admins:         adminNames,
		Writers:        writerNames,
		Readers:        readerNames,
		Bots:           botNames,
		RestrictedBots: restrictedBotNames,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	// Ensure we have chat available, since TeamAddMember may also be
	// coming from a standalone launch.
	g.StartStandaloneChat()

	return g.ChatHelper.SendMsgByName(ctx, team, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM)
}

func SendChatInviteWelcomeMessage(ctx context.Context, g *libkb.GlobalContext, team string,
	category keybase1.TeamInviteCategory, inviter, invitee keybase1.UID) (res bool) {

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
		InviteType: category,
	})
	body := chat1.NewMessageBodyWithSystem(subBody)

	if err = g.ChatHelper.SendMsgByName(ctx, team, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM); err != nil {
		g.Log.CDebugf(ctx, "sendChatInviteWelcomeMessage: failed to send message: %s", err)
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

	if err = g.ChatHelper.SendMsgByName(ctx, team, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM); err != nil {
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

	if err = mctx.G().ChatHelper.SendMsgByName(mctx.Ctx(), team, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body,
		chat1.MessageType_SYSTEM); err != nil {
		return false
	}

	return true
}
