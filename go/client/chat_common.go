// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func CheckUserOrTeamName(ctx context.Context, g *libkb.GlobalContext, name string) (*keybase1.UserOrTeamResult, error) {
	resolver, err := newChatConversationResolver(g)
	if err != nil {
		return nil, err
	}
	var req chatConversationResolvingRequest
	req.ctx = new(chatConversationResolvingRequestContext)
	var tlfError error
	if tlfError = resolver.completeAndCanonicalizeTLFName(ctx, name, req); tlfError == nil {
		ret := keybase1.UserOrTeamResult_USER
		return &ret, nil
	}

	cli, teamError := GetTeamsClient(g)
	if teamError == nil {
		_, teamError = cli.TeamGet(ctx, keybase1.TeamGetArg{Name: name, ForceRepoll: false})
		if teamError == nil {
			ret := keybase1.UserOrTeamResult_TEAM
			return &ret, nil
		}
	}

	msg := `Unable to find conversation.
When considering %s as a username or a list of usernames, received error: %v.
When considering %s as a team name, received error: %v.`

	return nil, libkb.NotFoundError{Msg: fmt.Sprintf(msg, name, tlfError, name, teamError)}
}

// Post a retention policy
// Set's the channel policy if `setChannel`, otherwise sets the team-wide policy. `setChannel` is ignored if using a non-team.
// UI is optional if `doPrompt` is false.
func postRetentionPolicy(ctx context.Context, lcli chat1.LocalClient, tui libkb.TerminalUI,
	conv *chat1.ConversationLocal, policy chat1.RetentionPolicy, setChannel bool, doPrompt bool) (err error) {
	teamInvolved := (conv.Info.MembersType == chat1.ConversationMembersType_TEAM)
	teamWide := teamInvolved && !setChannel

	if doPrompt {
		promptText := fmt.Sprintf("Set the conversation retention policy?\nHit Enter, or Ctrl-C to cancel.")
		if teamInvolved {
			promptText = fmt.Sprintf("Set the channel retention policy?\nHit Enter, or Ctrl-C to cancel.")
		}
		if teamWide {
			promptText = fmt.Sprintf("Set the team-wide retention policy?\nHit Enter, or Ctrl-C to cancel.")
		}
		_, err = tui.Prompt(PromptDescriptorChatSetRetention, promptText)
		if err != nil {
			return err
		}
	}

	if teamWide {
		teamID, err := keybase1.TeamIDFromString(conv.Info.Triple.Tlfid.String())
		if err != nil {
			return err
		}
		return lcli.SetTeamRetentionLocal(ctx, chat1.SetTeamRetentionLocalArg{
			TeamID: teamID,
			Policy: policy})
	}
	return lcli.SetConvRetentionLocal(ctx, chat1.SetConvRetentionLocalArg{
		ConvID: conv.Info.Id,
		Policy: policy})
}
