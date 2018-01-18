package chat

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
)

func LoadTeam(ctx context.Context, g *libkb.GlobalContext, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	loadTeamArgOverride func(keybase1.TeamID) keybase1.LoadTeamArg) (team *teams.Team, err error) {

	// Set up load team argument construction, possibly controlled by the caller
	ltarg := func(teamID keybase1.TeamID) keybase1.LoadTeamArg {
		return keybase1.LoadTeamArg{
			ID:     teamID,
			Public: public,
		}
	}
	if loadTeamArgOverride != nil {
		ltarg = loadTeamArgOverride
	}

	switch membersType {
	case chat1.ConversationMembersType_IMPTEAMNATIVE, chat1.ConversationMembersType_TEAM:
		teamID, err := keybase1.TeamIDFromString(tlfID.String())
		if err != nil {
			return team, err
		}
		return teams.Load(ctx, g, ltarg(teamID))
	case chat1.ConversationMembersType_IMPTEAMUPGRADE:
		res, err := g.API.Get(libkb.NewAPIArgWithNetContext(ctx, "team/id"))
		if err != nil {
			return team, err
		}
		st, err := res.Body.AtKey("team_id").GetString()
		if err != nil {
			return team, err
		}
		teamID, err := keybase1.TeamIDFromString(st)
		if err != nil {
			return team, err
		}
		team, err = teams.Load(ctx, g, ltarg(teamID))
		if err != nil {
			return team, err
		}
		// TODO: validate the tlfID on the team returned here is the same as the server
		// told us.
		return team, nil
	}
	return team, fmt.Errorf("invalid impteam members type: %v", membersType)
}
