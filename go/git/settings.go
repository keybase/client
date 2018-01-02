package git

import (
	"context"
	"encoding/hex"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type settingsResponse struct {
	ChatConvID   string          `json:"chat_conv_id"`
	ChatDisabled bool            `json:"chat_disabled"`
	Status       libkb.AppStatus `json:"status"`
}

func (r *settingsResponse) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func GetTeamRepoSettings(ctx context.Context, g *libkb.GlobalContext, arg keybase1.GetTeamRepoSettingsArg) (keybase1.GitTeamRepoSettings, error) {
	if arg.Folder.FolderType != keybase1.FolderType_TEAM {
		return keybase1.GitTeamRepoSettings{ChatDisabled: true}, nil
	}

	apiArg, err := settingsArg(ctx, g, arg.Folder, arg.RepoID)
	if err != nil {
		return keybase1.GitTeamRepoSettings{}, err
	}

	var resp settingsResponse
	if err := g.GetAPI().GetDecode(*apiArg, &resp); err != nil {
		return keybase1.GitTeamRepoSettings{}, err
	}

	settings := keybase1.GitTeamRepoSettings{
		ChatDisabled: resp.ChatDisabled,
	}

	if !settings.ChatDisabled {
		if resp.ChatConvID == "" {
			// chat enabled, so use default team topic (#general)
			settings.ChannelName = &globals.DefaultTeamTopic
		} else {
			// XXX lookup the channel name
			convID, err := hex.DecodeString(resp.ChatConvID)
			if err != nil {
				return keybase1.GitTeamRepoSettings{}, err
			}
			convs, err := g.ChatHelper.FindConversationsByID(ctx, []chat1.ConversationID{convID})
			if err != nil {
				return keybase1.GitTeamRepoSettings{}, err
			}
			if len(convs) == 0 {
				return keybase1.GitTeamRepoSettings{}, errors.New("no channel found")
			}
			if len(convs) > 1 {
				return keybase1.GitTeamRepoSettings{}, errors.New("multiple conversations found")
			}
			name := utils.GetTopicName(convs[0])
			settings.ChannelName = &name
		}
	}

	return settings, nil
}

func SetTeamRepoSettings(ctx context.Context, g *libkb.GlobalContext, arg keybase1.SetTeamRepoSettingsArg) error {
	if arg.Folder.FolderType != keybase1.FolderType_TEAM {
		return errors.New("SetTeamRepoSettings denied: this repo is not a team repo")
	}
	apiArg, err := settingsArg(ctx, g, arg.Folder, arg.RepoID)
	if err != nil {
		return err
	}
	apiArg.Args["chat_disabled"] = libkb.B{Val: arg.ChatDisabled}

	if arg.ChannelName != nil && *(arg.ChannelName) != "" {
		// lookup the conv id for the channel name
		vis := keybase1.TLFVisibility_PRIVATE
		if !arg.Folder.Private {
			vis = keybase1.TLFVisibility_PUBLIC
		}
		convs, err := g.ChatHelper.FindConversations(ctx, arg.Folder.Name, arg.ChannelName, chat1.TopicType_CHAT, chat1.ConversationMembersType_TEAM, vis)
		if err != nil {
			return err
		}
		if len(convs) == 0 {
			return errors.New("no channel found")
		}
		if len(convs) > 1 {
			return errors.New("multiple channels found")
		}
		convID := convs[0].Info.Id
		apiArg.Args["chat_conv_id"] = libkb.HexArg(convID)
	}

	_, err = g.GetAPI().Post(*apiArg)
	return err
}

func settingsArg(ctx context.Context, g *libkb.GlobalContext, folder keybase1.Folder, repoID keybase1.RepoID) (*libkb.APIArg, error) {
	teamer := NewTeamer(g)
	teamIDVis, err := teamer.LookupOrCreate(ctx, folder)
	if err != nil {
		return nil, err
	}

	arg := &libkb.APIArg{
		Endpoint:    "kbfs/git/team/settings",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamIDVis.TeamID)},
			"repo_id": libkb.S{Val: string(repoID)},
		},
	}

	return arg, nil
}
