// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func CheckUserOrTeamName(ctx context.Context, g *libkb.GlobalContext, name string) (res keybase1.UserOrTeamResult, err error) {
	cli, err := GetTeamsClient(g)
	if err != nil {
		return res, err
	}
	_, err = cli.TeamGet(ctx, keybase1.TeamGetArg{Name: name})
	if err != nil {
		// https://github.com/keybase/client/blob/249cfcb4b4bd6dcc50d207d0b88eee455a7f6c2d/go/protocol/keybase1/extras.go#L2249
		if strings.Contains(err.Error(), "team names must be between 2 and 16 characters long") ||
			strings.Contains(err.Error(), "Keybase team names must be letters") ||
			strings.Contains(err.Error(), "does not exist") {
			return keybase1.UserOrTeamResult_USER, nil
		}
		return res, err
	}
	return keybase1.UserOrTeamResult_TEAM, nil
}

// Post a retention policy
// Set's the channel policy if `setChannel`, otherwise sets the team-wide policy. `setChannel` is ignored if using a non-team.
// UI is optional if `doPrompt` is false.
func postRetentionPolicy(ctx context.Context, lcli chat1.LocalClient, tui libkb.TerminalUI,
	conv *chat1.ConversationLocal, policy chat1.RetentionPolicy, setChannel bool, doPrompt bool) (err error) {
	teamInvolved := (conv.Info.MembersType == chat1.ConversationMembersType_TEAM)
	teamWide := teamInvolved && !setChannel

	if doPrompt {
		promptText := fmt.Sprintf("Set the conversation retention policy?\nHit Enter to confirm, or Ctrl-C to cancel.")
		if teamInvolved {
			promptText = fmt.Sprintf("Set the channel retention policy?\nHit Enter to confirm, or Ctrl-C to cancel.")
		}
		if teamWide {
			promptText = fmt.Sprintf("Set the team-wide retention policy?\nHit Enter to confirm, or Ctrl-C to cancel.")
		}
		if _, err = tui.Prompt(PromptDescriptorChatSetRetention, promptText); err != nil {
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
			Policy: policy,
		})
	}
	return lcli.SetConvRetentionLocal(ctx, chat1.SetConvRetentionLocalArg{
		ConvID: conv.Info.Id,
		Policy: policy,
	})
}

// Post a min writer role for the given conversation
func postConvMinWriterRole(ctx context.Context, lcli chat1.LocalClient, tui libkb.TerminalUI,
	conv *chat1.ConversationLocal, role keybase1.TeamRole, doPrompt bool) (err error) {
	if doPrompt {
		promptText := fmt.Sprintf("Set the minimium writer role of %v for this conversation?\nHit Enter to confirm, or Ctrl-C to cancel.", role)
		if _, err = tui.Prompt(PromptDescriptorChatSetConvMinWriterRole, promptText); err != nil {
			return err
		}
	}
	return lcli.SetConvMinWriterRoleLocal(ctx, chat1.SetConvMinWriterRoleLocalArg{
		ConvID: conv.Info.Id,
		Role:   role,
	})
}

func CheckAndStartStandaloneChat(g *libkb.GlobalContext, mt chat1.ConversationMembersType) error {
	if !g.Standalone {
		return nil
	}
	// TODO: Right now this command cannot be run in standalone at
	// all, even though team chats should work, but there is a bug
	// in finding existing conversations.
	switch mt {
	case chat1.ConversationMembersType_TEAM, chat1.ConversationMembersType_IMPTEAMNATIVE,
		chat1.ConversationMembersType_IMPTEAMUPGRADE:
		g.StartStandaloneChat()
		return nil
	default:
		return CantRunInStandaloneError{}
	}
}
