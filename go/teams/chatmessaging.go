package teams

import (
	"context"
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func SendTeamChatWelcomeMessage(ctx context.Context, g *globals.Context, teamDetails keybase1.TeamDetails,
	team, user string) (res bool) {
	var err error
	defer func() {
		if err != nil {
			g.Log.CWarningf(ctx, "failed to send team welcome message: %s", err.Error())
		}
	}()

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
	g.StartStandaloneChat()

	if err = g.ChatHelper.SendTextByName(ctx, team, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, body); err != nil {
		return false
	}

	return true
}

func SendChatInviteWelcomeMessage(ctx context.Context, g *globals.Context, team string,
	category keybase1.TeamInviteCategory, inviter, invitee keybase1.UID) (res bool) {
	var msg string

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
	switch category {
	case keybase1.TeamInviteCategory_KEYBASE:
		msg = fmt.Sprintf("I just auto-added %s to this team, whom %s invited previously, but who was missing a new-enough version of the Keybase app. (This is an automated message; my app responded first.)",
			inviteeName, inviterName)
	case keybase1.TeamInviteCategory_EMAIL:
		msg = fmt.Sprintf("I just auto-added %s to this team, whom %s invited over email. (This is an automated message; my app responded first.)", inviteeName, inviterName)
	case keybase1.TeamInviteCategory_SBS:
		msg = fmt.Sprintf("I just auto-added %s to this team, whom %s invited with a social assertion. (This is an automated message; my app responded first.)", inviteeName, inviterName)
	}

	if err = g.ChatHelper.SendTextByName(ctx, team, &globals.DefaultTeamTopic,
		chat1.ConversationMembersType_TEAM, keybase1.TLFIdentifyBehavior_CHAT_CLI, msg); err != nil {
		return false
	}

	return true
}
