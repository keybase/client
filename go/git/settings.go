package git

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
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
	mctx := libkb.NewMetaContext(ctx, g)
	if arg.Folder.FolderType != keybase1.FolderType_TEAM {
		return keybase1.GitTeamRepoSettings{ChatDisabled: true}, nil
	}

	apiArg, teamID, err := settingsArg(ctx, g, arg.Folder, arg.RepoID)
	if err != nil {
		return keybase1.GitTeamRepoSettings{}, err
	}

	var resp settingsResponse
	if err := g.GetAPI().GetDecode(mctx, *apiArg, &resp); err != nil {
		return keybase1.GitTeamRepoSettings{}, err
	}

	return convertTeamRepoSettings(ctx, g, teamID, resp.ChatConvID, resp.ChatDisabled)
}

func convertTeamRepoSettings(ctx context.Context, g *libkb.GlobalContext,
	teamID keybase1.TeamID, chatConvID string, chatDisabled bool) (keybase1.GitTeamRepoSettings, error) {
	settings := keybase1.GitTeamRepoSettings{
		ChatDisabled: chatDisabled,
	}

	if !settings.ChatDisabled {
		if chatConvID == "" {
			// chat enabled, so use default team topic (#general)
			settings.ChannelName = &globals.DefaultTeamTopic
		} else {
			// lookup the channel name
			convID, err := chat1.MakeConvID(chatConvID)
			if err != nil {
				return keybase1.GitTeamRepoSettings{}, err
			}
			channelName, err := g.ChatHelper.GetChannelTopicName(ctx, teamID,
				chat1.TopicType_CHAT, convID)
			if err != nil {
				return keybase1.GitTeamRepoSettings{}, err
			}
			settings.ChannelName = &channelName
		}
	}

	return settings, nil

}

func SetTeamRepoSettings(ctx context.Context, g *libkb.GlobalContext, arg keybase1.SetTeamRepoSettingsArg) error {
	mctx := libkb.NewMetaContext(ctx, g)
	if arg.Folder.FolderType != keybase1.FolderType_TEAM {
		return errors.New("SetTeamRepoSettings denied: this repo is not a team repo")
	}
	apiArg, _, err := settingsArg(ctx, g, arg.Folder, arg.RepoID)
	if err != nil {
		return err
	}
	apiArg.Args["chat_disabled"] = libkb.B{Val: arg.ChatDisabled}

	if arg.ChannelName != nil && *(arg.ChannelName) != "" {
		// lookup the conv id for the channel name
		vis := keybase1.TLFVisibility_PRIVATE
		if arg.Folder.FolderType == keybase1.FolderType_PUBLIC {
			vis = keybase1.TLFVisibility_PUBLIC
		}
		convs, err := g.ChatHelper.FindConversations(ctx, arg.Folder.Name, arg.ChannelName,
			chat1.TopicType_CHAT, chat1.ConversationMembersType_TEAM, vis)
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
		apiArg.AppStatusCodes = []int{libkb.SCOk, libkb.SCTeamWritePermDenied}
	}

	apiRes, err := g.GetAPI().Post(mctx, *apiArg)
	if err != nil {
		return err
	}
	switch apiRes.AppStatus.Code {
	case libkb.SCTeamWritePermDenied:
		return libkb.TeamWritePermDeniedError{}
	}
	return nil
}

func settingsArg(ctx context.Context, g *libkb.GlobalContext,
	folder keybase1.FolderHandle, repoID keybase1.RepoID) (apiArg *libkb.APIArg, teamID keybase1.TeamID, err error) {
	teamer := NewTeamer(g)
	teamIDVis, err := teamer.LookupOrCreate(ctx, folder)
	if err != nil {
		return nil, teamID, err
	}
	apiArg = &libkb.APIArg{
		Endpoint:    "kbfs/git/team/settings",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamIDVis.TeamID)},
			"repo_id": libkb.S{Val: string(repoID)},
		},
	}
	return apiArg, teamIDVis.TeamID, nil
}
