package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func LoadTeamTreeMemberships(mctx libkb.MetaContext, teamID keybase1.TeamID,
	username string) error {

	larg := libkb.NewLoadUserArgWithMetaContext(mctx).WithName(username).WithForcePoll(true)
	upak, _, err := mctx.G().GetUPAKLoader().LoadV2(larg)
	if err != nil {
		return err
	}
	uv := upak.Current.ToUserVersion()

	target, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return err
	}

	go loadTeamTreeMembershipsRecursive(mctx, teamID, target.Name(), uv)

	return nil
}

// add time tracing

// todo parents

// todo cancelling

// We pass teamName so we can give an intelligible error if the load fails.
// Not guaranteed to notify partials in any order, except that done will be last.
func loadTeamTreeMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion) {
	mctx.Warning("@@@ loadRecursive %s", teamName)

	node, res, err := loadTeamTreeMembershipsSingle(mctx, teamID, uv)
	if err != nil {
		mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
			TeamName: teamName,
			Result: keybase1.NewTeamTreeMembershipResultWithError(keybase1.GenericError{
				Message: err.Error(),
			}),
		})
		return
	}
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
		TeamName: teamName,
		Result:   res,
	})

	// do we need to subteam.SharedSecret()? see teams/teams.go:loadAllTransitvieSubteams

	for _, idAndName := range node.chain().ListSubteams() {
		loadTeamTreeMembershipsRecursive(mctx, idAndName.Id, idAndName.Name, uv)
	}
}

// is there lock contention with loading parent teams? or does cache work out

func loadTeamTreeMembershipsSingle(mctx libkb.MetaContext, teamID keybase1.TeamID,
	uv keybase1.UserVersion) (team *Team, res keybase1.TeamTreeMembershipResult, err error) {

	team, err = GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return team, res, err
	}

	role, err := team.MemberRole(mctx.Ctx(), uv)
	if err != nil {
		return team, res, err
	}
	var joinTime *keybase1.Time
	if t, err := team.UserLastJoinTime(uv); err == nil {
		joinTime = &t
	}
	return team, keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:                    role,
		JoinTime:                joinTime,
		IncreaseExpectedCountBy: len(team.chain().ListSubteams()),
	}), nil
}
