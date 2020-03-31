package teams

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

type nodePosition int

const (
	nodePositionTarget   = 0
	nodePositionAncestor = 1
	nodePositionChild    = 2
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

	go loadTeamTreeMembershipsRecursive(mctx, teamID, target.Name(), uv, nodePositionTarget)

	return nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// add time tracing

// todo cancelling

// We pass teamName so we can give an intelligible error if the load fails.
// Not guaranteed to notify partials in any order, except that done will be last.
func notifyTeamTreeMembershipResult(mctx libkb.MetaContext, teamName keybase1.TeamName,
	res keybase1.TeamTreeMembershipResult) {
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
		TeamName: teamName,
		Result:   res,
	})
}

// notification order still a problem...what if subteam notif comes before parent saying how many
// more?

func loadTeamAncestorsMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion) {

	handleAncestor := func(t keybase1.TeamSigChainState, teamName keybase1.TeamName) error {
		res := sigchainStateToTeamTreeMembership(&t, uv, nodePositionAncestor)
		notifyTeamTreeMembershipResult(mctx, teamName, res)
		return nil
	}
	// put entire thing in a goroutine, also do the additionalneeded thing
	err := mctx.G().GetTeamLoader().MapTeamAncestors(
		mctx.Ctx(), handleAncestor, teamID, "LoadTeamTreeMemberships", nil)
	switch e := err.(type) {
	case nil:
	case *MapAncestorsError:
		idx := maxInt(0, teamName.Depth()-1-e.failedLoadingAtAncestorIdx)
		name := keybase1.TeamName{Parts: teamName.Parts[:idx+1]}
		notifyTeamTreeMembershipResult(mctx, name, makeLoadTeamTreeErrorResult(err))
	default:
		// Not sure where the error failed: prompt to reload the entire thing
		notifyTeamTreeMembershipResult(mctx, teamName, makeLoadTeamTreeErrorResult(err))
	}
}

// Inclusive
func loadTeamTreeMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion, np nodePosition) {
	mctx.Warning("@@@ loadRecursive %s", teamName)

	node, res := loadTeamTreeMembershipsSingle(mctx, teamID, uv, np)
	notifyTeamTreeMembershipResult(mctx, teamName, res)
	s, _ := res.S()
	if s == keybase1.TeamTreeMembershipStatus_ERROR {
		return
	}

	// do we need to subteam.SharedSecret()? see teams/teams.go:loadAllTransitvieSubteams

	eg, ctx := errgroup.WithContext(mctx.Ctx())

	// Load ancestors
	if np == nodePositionTarget {
		eg.Go(func() error {
			loadTeamAncestorsMembershipsRecursive(mctx, teamID, teamName, uv)
			return nil
		})
	}
	// Load subtree
	// Because we load parents before children, the child's load can use the cached parent's team
	// so we only make one team/get per team.
	for _, idAndName := range node.chain().ListSubteams() {
		idAndName := idAndName
		// This is technically unbounded but assuming subteam spread isn't too high, should be ok.
		eg.Go(func() error {
			loadTeamTreeMembershipsRecursive(
				mctx.WithContext(ctx), idAndName.Id, idAndName.Name, uv, nodePositionChild,
			)
			// handle errors ourselves, we don't want the load to be short-circuited if one load fails
			return nil
		})
	}
	eg.Wait()
}

// is there lock contention with loading parent teams? or does cache work out

func makeLoadTeamTreeErrorResult(err error) keybase1.TeamTreeMembershipResult {
	return keybase1.NewTeamTreeMembershipResultWithError(
		keybase1.GenericError{Message: fmt.Sprintf("%s", err)},
	)
}

func loadTeamTreeMembershipsSingle(mctx libkb.MetaContext, teamID keybase1.TeamID,
	uv keybase1.UserVersion, np nodePosition) (team *Team, res keybase1.TeamTreeMembershipResult) {

	team, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return team, makeLoadTeamTreeErrorResult(err)
	}

	return team, sigchainStateToTeamTreeMembership(&team.chain().inner, uv, np)
}

func sigchainStateToTeamTreeMembership(
	s *keybase1.TeamSigChainState,
	uv keybase1.UserVersion,
	np nodePosition,
) (res keybase1.TeamTreeMembershipResult) {
	role := s.UserRole(uv)
	var joinTime *keybase1.Time
	if t, err := s.GetUserLastJoinTime(uv); err == nil {
		joinTime = &t
	}
	increase := 0
	switch np {
	case nodePositionTarget, nodePositionAncestor:
		if s.NameDepth > 1 {
			increase += 1
		}
	default:
	}
	switch np {
	case nodePositionTarget, nodePositionChild:
		increase += len(s.ListSubteams())
	default:
	}
	return keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:                    role,
		JoinTime:                joinTime,
		IncreaseExpectedCountBy: increase,
	})
}
