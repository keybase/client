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

func CheckUserOrTeamName(ctx context.Context, g *libkb.GlobalContext, name string) (res keybase1.UserOrTeamResult, err error) {
	cli, err := GetTeamsClient(g)
	if err != nil {
		return res, err
	}
	if _, err = cli.TeamGet(ctx, keybase1.TeamGetArg{Name: name}); err == nil {
		return keybase1.UserOrTeamResult_TEAM, nil
	}
	return keybase1.UserOrTeamResult_USER, nil
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
