package teams

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
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


	handleAncestor := func(t keybase1.TeamSigChainState) error {
		notifyTeamTreeMembershipResult
	}

	// err = mctx.G().GetTeamLoader().MapTeamAncestors(mctx.Ctx(), func(t keybase1.TeamSigChainState) error {

	// })

	// func (l *TeamLoader) MapTeamAncestors(ctx context.Context, f func(t keybase1.TeamSigChainState) error, teamID keybase1.TeamID, reason string, forceFullReloadOnceToAssert func(t keybase1.TeamSigChainState) bool) (err error) {



	return nil
}

// add time tracing

// todo parents

// todo cancelling

// We pass teamName so we can give an intelligible error if the load fails.
// Not guaranteed to notify partials in any order, except that done will be last.
func notifyTeamTreeMembershipResult(teamName keybase1.TeamName, res keybase1.TeamTreeMembershipResult) {
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
		TeamName: teamName,
		Result:   res,
	})
}

func loadTeamTreeMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion) {
	mctx.Warning("@@@ loadRecursive %s", teamName)

	node, res := loadTeamTreeMembershipsSingle(mctx, teamID, uv)
	notifyTeamTreeMembershipResult(teamname, res)
	if res.S() == keybase1.TeamTreeMembershipResultStatus_ERROR {
		return
	}

	// do we need to subteam.SharedSecret()? see teams/teams.go:loadAllTransitvieSubteams

	// var _ errgroup.Group
	// ctx := mctx.Ctx()
	// for _, idAndName := range node.chain().ListSubteams() {
	// 	loadTeamTreeMembershipsRecursive(mctx.WithContext(ctx), idAndName.Id, idAndName.Name, uv)
	// }

	eg, ctx := errgroup.WithContext(mctx.Ctx())
	// Because we load parents before children, the child's load can use the cached parent's team
	// so we only make one team/get per team.
	for _, idAndName := range node.chain().ListSubteams() {
		idAndName := idAndName
		// This is technically unbounded but assuming subteam spread isn't too high, should be ok.
		eg.Go(func() error {
			loadTeamTreeMembershipsRecursive(mctx.WithContext(ctx), idAndName.Id, idAndName.Name, uv)
			// handle errors ourselves, we don't want the load to be short-circuited if one load fails
			return nil
		})
	}
	eg.Wait()

}

// is there lock contention with loading parent teams? or does cache work out

func makeLoadTeamTreeErrorResult(err error) keybase1.TeamTreeMembershipResult{
	return keybase1.TeamTreeMembershipResultWithError(
			keybase1.GenericError{Message:fmt.Sprintf("%s", err)}
		)
}

func loadTeamTreeMembershipsSingle(mctx libkb.MetaContext, teamID keybase1.TeamID,
	uv keybase1.UserVersion) (team *Team, res keybase1.TeamTreeMembershipResult) {

	team, err = GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return team, makeLoadTeamTreeErrorResult(err)
	}

	role, err := team.MemberRole(mctx.Ctx(), uv)
	if err != nil {
		return team, makeLoadTeamTreeErrorResult(err)
	}
	var joinTime *keybase1.Time
	if t, err := team.UserLastJoinTime(uv); err == nil {
		joinTime = &t
	}
	return team, keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:                    role,
		JoinTime:                joinTime,
		IncreaseExpectedCountBy: len(team.chain().ListSubteams()),
	})
}
