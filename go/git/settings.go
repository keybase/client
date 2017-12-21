package git

import (
	"context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
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
	teamer := NewTeamer(g)
	teamIDVis, err := teamer.LookupOrCreate(ctx, arg.Folder)
	if err != nil {
		return keybase1.GitTeamRepoSettings{}, err
	}

	apiArg := libkb.APIArg{
		Endpoint:    "kbfs/git/team/settings",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"team_id": libkb.S{Val: string(teamIDVis.TeamID)},
			"repo_id": libkb.S{Val: string(arg.RepoID)},
		},
	}

	var resp settingsResponse
	if err := g.GetAPI().GetDecode(apiArg, &resp); err != nil {
		return keybase1.GitTeamRepoSettings{}, err
	}

	g.Log.Warning("response: %+v", resp)
	settings := keybase1.GitTeamRepoSettings{
		ChatDisabled: resp.ChatDisabled,
	}

	if !resp.ChatDisabled {
		if resp.ChatConvID == "" {
			// chat enabled, so use default team topic (#general)
			settings.ChannelName = &globals.DefaultTeamTopic
		} else {
			// XXX lookup the channel name
		}
	}

	return settings, nil
}

func SetTeamRepoSettings(ctx context.Context, g *libkb.GlobalContext, arg keybase1.SetTeamRepoSettingsArg) error {
	return nil
}
