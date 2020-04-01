package teams

import (
	"fmt"
	"sync/atomic"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

type NodePosition int

const (
	NodePositionTarget   = 0
	NodePositionAncestor = 1
	NodePositionChild    = 2
)

func LoadTeamTreeMemberships(mctx libkb.MetaContext, teamID keybase1.TeamID,
	username string) error {
	return LoadTeamTreeMembershipsWithConverter(mctx, teamID,
		username, &TreeloaderStateConverter{})
}

func LoadTeamTreeMembershipsWithConverter(mctx libkb.MetaContext, teamID keybase1.TeamID,
	username string, converter ITreeloaderStateConverter) error {

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

	go func() {
		expectedCount := loadTeamTreeMembershipsRecursive(mctx, teamID, target.Name(), uv,
			NodePositionTarget, converter)
		mctx.G().NotifyRouter.HandleTeamTreeMembershipsDone(mctx.Ctx(), int(expectedCount))
	}()

	return nil
}

func maxInt32(a, b int32) int32 {
	if a > b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// We pass teamName so we can give an intelligible error if the load fails.
func notifyTeamTreeMembershipResult(mctx libkb.MetaContext, teamName keybase1.TeamName,
	res keybase1.TeamTreeMembershipResult) {
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
		TeamName: teamName,
		Result:   res,
	})
}

func loadTeamAncestorsMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	targetTeamName keybase1.TeamName, uv keybase1.UserVersion,
	converter ITreeloaderStateConverter) (nTeamsLoaded int32) {

	handleAncestor := func(t keybase1.TeamSigChainState, teamName keybase1.TeamName) error {
		res := converter.SigchainStateToTeamTreeMembership(mctx, &t, uv, NodePositionAncestor)
		s, err := res.S()
		if err != nil {
			return err
		}
		// shortcircuit ancestor load if this resulted in an error, to keep symmetry with behavior
		// if the ancestor team load failed.
		if s == keybase1.TeamTreeMembershipStatus_ERROR {
			return fmt.Errorf("failed to load ancestor: %s", res.Error().Message)
		}
		notifyTeamTreeMembershipResult(mctx, teamName, res)
		return nil
	}
	err := mctx.G().GetTeamLoader().MapTeamAncestors(
		mctx.Ctx(), handleAncestor, teamID, "LoadTeamTreeMemberships", nil)
	mctx.Warning("@@@ Map Ances Err %#v %T", err, err)
	switch e := err.(type) {
	case nil:
		nTeamsLoaded = int32(targetTeamName.Depth()) - 1
	case *MapAncestorsError:
		mctx.Warning("@@@ Map Ances Err !!!%d", e.failedLoadingAtAncestorIdx)
		idx := maxInt(0, targetTeamName.Depth()-1-e.failedLoadingAtAncestorIdx)
		nTeamsLoaded = maxInt32(0, int32(e.failedLoadingAtAncestorIdx))
		name := keybase1.TeamName{Parts: targetTeamName.Parts[:idx+1]}
		mctx.Warning("@@@ Map Ances Err %d %d %s", idx, nTeamsLoaded, name)
		notifyTeamTreeMembershipResult(mctx, name, MakeLoadTeamTreeErrorResult(err))
	default:
		// Should never happen.
		// Not sure where the error failed: prompt to reload the entire thing
		notifyTeamTreeMembershipResult(mctx, targetTeamName, MakeLoadTeamTreeErrorResult(err))
	}
	return nTeamsLoaded
}

func loadTeamTreeMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion, np NodePosition,
	converter ITreeloaderStateConverter) (nTeamsLoaded int32) {

	mctx.Warning("@@@ Loading %s", teamName)

	node, res := loadTeamTreeMembershipsSingle(mctx, teamID, uv, np, converter)
	nTeamsLoaded = 1
	notifyTeamTreeMembershipResult(mctx, teamName, res)
	s, err := res.S()
	if err != nil {
		panic(err)
	}
	mctx.Warning("@@@ Loading %s: nteamsLoaded: 1, s: %v", teamName, s)
	if s == keybase1.TeamTreeMembershipStatus_ERROR {
		mctx.Warning("@@@ Loading %s: short circuiting due to error: %#v", res)
		return nTeamsLoaded
	}

	// do we need to subteam.SharedSecret()? see teams/teams.go:loadAllTransitvieSubteams

	eg, ctx := errgroup.WithContext(mctx.Ctx())
	mctx = mctx.WithContext(ctx)
	// Load ancestors
	if np == NodePositionTarget && !teamName.IsRootTeam() {
		eg.Go(func() error {
			incr := loadTeamAncestorsMembershipsRecursive(mctx, teamID, teamName, uv, converter)
			mctx.Warning("@@@ %s: Loaded %d more from ancestors", teamName, incr)
			atomic.AddInt32(&nTeamsLoaded, int32(incr))
			return nil
		})
	}
	// Load subtree
	// Because we load parents before children, the child's load can use the cached parent's team
	// so we only make one team/get per team.
	for _, idAndName := range node.chain().ListSubteams() {
		idAndName := idAndName
		// This is unbounded but assuming subteam spread isn't too high, should be ok.
		eg.Go(func() error {
			incr := loadTeamTreeMembershipsRecursive(
				mctx, idAndName.Id, idAndName.Name, uv, NodePositionChild, converter,
			)
			mctx.Warning("@@@ %s: Loaded %d more from descendant tree", teamName, incr)
			atomic.AddInt32(&nTeamsLoaded, int32(incr))

			// handle errors ourselves; we don't want the load to be short-circuited if one load
			// fails
			return nil
		})
	}
	eg.Wait()

	return nTeamsLoaded
}

func MakeLoadTeamTreeErrorResult(err error) keybase1.TeamTreeMembershipResult {
	return keybase1.NewTeamTreeMembershipResultWithError(
		keybase1.GenericError{Message: fmt.Sprintf("%s", err)},
	)
}

func loadTeamTreeMembershipsSingle(mctx libkb.MetaContext, teamID keybase1.TeamID,
	uv keybase1.UserVersion, np NodePosition, converter ITreeloaderStateConverter) (team *Team, res keybase1.TeamTreeMembershipResult) {

	team, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return team, MakeLoadTeamTreeErrorResult(err)
	}

	return team, converter.SigchainStateToTeamTreeMembership(mctx, &team.chain().inner, uv, np)
}

type ITreeloaderStateConverter interface {
	SigchainStateToTeamTreeMembership(mctx libkb.MetaContext, s *keybase1.TeamSigChainState,
		uv keybase1.UserVersion,
		np NodePosition,
	) (res keybase1.TeamTreeMembershipResult)
}

type TreeloaderStateConverter struct{}

func (t *TreeloaderStateConverter) SigchainStateToTeamTreeMembership(
	mctx libkb.MetaContext,
	s *keybase1.TeamSigChainState,
	uv keybase1.UserVersion,
	np NodePosition,
) (res keybase1.TeamTreeMembershipResult) {
	role := s.UserRole(uv)
	var joinTime *keybase1.Time
	if role != keybase1.TeamRole_NONE {
		t, err := s.GetUserLastJoinTime(uv)
		if err != nil {
			mctx.Debug("failed to compute join time for %s: %s", uv, err)
		} else {
			joinTime = &t
		}
	}
	increase := 0
	switch np {
	case NodePositionTarget, NodePositionAncestor:
		if s.NameDepth > 1 {
			increase += 1
		}
	default:
	}
	switch np {
	case NodePositionTarget, NodePositionChild:
		increase += len(s.ListSubteams())
	default:
	}
	return keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:     role,
		JoinTime: joinTime,
	})
}
