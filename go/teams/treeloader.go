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

// LoadTeamTreeMemberships takes a teamID and a username and asynchronously spawns notifications
// indicating the role of the user in each of the teams of the partial tree wrt the teamID.
// The partial tree of a teamID contains that team, all of its direct ancestors, and all the
// subteams (recursively). For example, in the team tree
//    A
// B      C
//      D    E
//     F G    H
//    I
// if teamID were C, then the partial tree contains A, C, D, E, F, G, H, I.
//
// The logged in user must be an admin of teamID in order to call this function. This is so
// it can get memberships for all subteams. If this were not the case, then the client would be OK
// with the server stubbing out subteams that the user is not allowed to view. Since the stubbing is
// not verified, the server has the ability to elide subteam memberships even if the user actually
// does have the rights to view that team's memberships. We avoid this problem by requiring
// adminship, and thus no stubbing.
//
// After sending n TeamTreeMembershipPartial notifications, it will send TeamTreeMembershipDone
// indicating the number of TeamTreeMembershipPartial notifications (which is unknown prior
// to beginning the process). There are no specific guarantees about notification ordering from the
// RPC layer, so the user should wait for the TeamTreeMembershipDone notification (which will always
// get sent), and then wait for the specified number of TeamTreeMembershipPartial notifications (if
// they have not already arrived). These invariants will hold true even if there is an error
// that causes some subtree to not be loaded. In the example above, if the tree load were
// started at D and (for whatever reason) the load failed at C and F, then this function
// would not attempt to load A or I, but would continue to load the rest of the tree.
// In this case, there would only be 6 Partial notifications instead of all 8.
func LoadTeamTreeMemberships(mctx libkb.MetaContext,
	teamID keybase1.TeamID, username string) error {

	return LoadTeamTreeMembershipsWithConverter(mctx, teamID,
		username, &TreeloaderStateConverter{})
}

// LoadTeamTreeMembershipsWithConverter lets us mock load failures for tests.
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

func loadTeamTreeMembershipsRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion, np NodePosition,
	converter ITreeloaderStateConverter) (nTeamsLoaded int32) {
	defer mctx.TraceTimed(fmt.Sprintf("loadTeamTreeMembershipsRecursive(%s, %s)", teamName, uv),
		func() error { return nil })()

	// Load this team first
	node, res := loadTeamTreeMembershipsSingle(mctx, teamID, uv, np, converter)
	nTeamsLoaded = 1
	notifyTeamTreeMembershipResult(mctx, teamName, res)
	s, _ := res.S()
	if s == keybase1.TeamTreeMembershipStatus_ERROR {
		mctx.Debug("loadTeamTreeMembershipsRecursive: short-circuiting load due to failure")
		return nTeamsLoaded
	}

	eg, ctx := errgroup.WithContext(mctx.Ctx())
	mctx = mctx.WithContext(ctx)
	// Load ancestors
	if np == NodePositionTarget && !teamName.IsRootTeam() {
		eg.Go(func() error {
			incr := loadTeamAncestorsMemberships(mctx, teamID, teamName, uv, converter)
			mctx.Debug("loadTeamTreeMembershipsRecursive: loaded %d teams from ancestors", incr)
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
			mctx.Debug("loadTeamTreeMembershipsRecursive: loaded %d teams from subtree", incr)
			atomic.AddInt32(&nTeamsLoaded, int32(incr))
			return nil
		})
	}
	eg.Wait()

	return nTeamsLoaded
}

func loadTeamAncestorsMemberships(mctx libkb.MetaContext, teamID keybase1.TeamID,
	targetTeamName keybase1.TeamName, uv keybase1.UserVersion,
	converter ITreeloaderStateConverter) (nTeamsLoaded int32) {
	defer mctx.TraceTimed(fmt.Sprintf("loadTeamAncestorsMemberships(%s, %s)", targetTeamName, uv),
		func() error { return nil })()

	handleAncestor := func(t keybase1.TeamSigChainState, teamName keybase1.TeamName) error {
		res := converter.SigchainStateToTeamTreeMembership(mctx, &t, uv, NodePositionAncestor)
		s, err := res.S()
		if err != nil {
			return err
		}
		// Short-circuit ancestor load if this resulted in an error (though it shouldn't except for
		// in testing), to keep symmetry with behavior if the ancestor team load failed.
		if s == keybase1.TeamTreeMembershipStatus_ERROR {
			return fmt.Errorf("failed to load ancestor: %s", res.Error().Message)
		}
		notifyTeamTreeMembershipResult(mctx, teamName, res)
		return nil
	}
	err := mctx.G().GetTeamLoader().MapTeamAncestors(
		mctx.Ctx(), handleAncestor, teamID, "LoadTeamTreeMemberships", nil)
	switch e := err.(type) {
	case nil:
		nTeamsLoaded = int32(targetTeamName.Depth()) - 1
	case *MapAncestorsError:
		mctx.Debug("loadTeamAncestorsMemberships: map failed: %s at idx %d", e,
			e.failedLoadingAtAncestorIdx)

		// calculate the team name of the team it failed at
		// e.g. if failedLoadingAtAncestorIdx was 1 and the target team was A.B.C,
		// maxInt(0, 3 - 1 - 1) = 1, and A.B.C[:1+1] = A.B
		idx := maxInt(0, targetTeamName.Depth()-1-e.failedLoadingAtAncestorIdx)
		name := keybase1.TeamName{Parts: targetTeamName.Parts[:idx+1]}

		nTeamsLoaded = maxInt32(0, int32(e.failedLoadingAtAncestorIdx))
		notifyTeamTreeMembershipResult(mctx, name, MakeLoadTeamTreeErrorResult(err))
	default:
		mctx.Debug("loadTeamAncestorsMemberships: map failed for unknown reason: %s", e)
		// Should never happen.
		// Not sure where the error failed: prompt to reload the entire thing
		notifyTeamTreeMembershipResult(mctx, targetTeamName, MakeLoadTeamTreeErrorResult(err))
	}
	return nTeamsLoaded
}

func loadTeamTreeMembershipsSingle(mctx libkb.MetaContext, teamID keybase1.TeamID,
	uv keybase1.UserVersion, np NodePosition, converter ITreeloaderStateConverter) (team *Team, res keybase1.TeamTreeMembershipResult) {

	team, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return team, MakeLoadTeamTreeErrorResult(err)
	}

	return team, converter.SigchainStateToTeamTreeMembership(mctx, &team.chain().inner, uv, np)
}

// notifyTeamTreeMembershipResult requires teamName so it can give an intelligible error if the load
// fails.
func notifyTeamTreeMembershipResult(mctx libkb.MetaContext, teamName keybase1.TeamName,
	res keybase1.TeamTreeMembershipResult) {
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
		TeamName: teamName,
		Result:   res,
	})
}
func MakeLoadTeamTreeErrorResult(err error) keybase1.TeamTreeMembershipResult {
	return keybase1.NewTeamTreeMembershipResultWithError(
		keybase1.GenericError{Message: fmt.Sprintf("%s", err)},
	)
}

// ITreeloaderStateConverter allows us to mock load failures in tests.
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
			mctx.Debug("SigchainStateToTeamTreeMembership: failed to compute join time for %s: %s",
				uv, err)
		} else {
			joinTime = &t
		}
	}
	return keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:     role,
		JoinTime: joinTime,
	})
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
