package teams

import (
	"fmt"
	"sync/atomic"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

type nodePosition int

const (
	nodePositionTarget = 0
	nodePositionChild  = 1
)

func LoadTeamTreeMemberships(mctx libkb.MetaContext,
	teamID keybase1.TeamID, username string) error {

	return LoadTeamTreeMembershipsWithConverter(mctx, teamID,
		username, &DefaultTreeloaderStateConverter{})
}

// LoadTeamTreeMembershipsWithConverter lets us mock load failures for tests.
func LoadTeamTreeMembershipsWithConverter(mctx libkb.MetaContext,
	teamID keybase1.TeamID,
	username string, converter TreeloaderStateConverter) error {
	defer mctx.TraceTimed(fmt.Sprintf("loadTeamTreeMembershipsRecursiveWithConverter(%s, %s, %d)",
		teamID, username, libkb.GetSessionIDOrZero(mctx.Ctx())), func() error { return nil })()

	start := time.Now()

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
		ctx := libkb.CopyTagsToBackground(mctx.Ctx())
		imctx := mctx.WithContext(ctx)
		expectedCount := loadTeamTreeMembershipsRecursive(imctx, teamID, teamID, target.Name(), uv,
			username,
			nodePositionTarget, converter)
		mctx.Debug("@@@ notify FINISHED w/ count %d", expectedCount)

		imctx.G().NotifyRouter.HandleTeamTreeMembershipsDone(mctx.Ctx(), keybase1.TeamTreeMembershipsDoneResult{
			SessionID:      int(libkb.GetSessionIDOrZero(ctx)),
			TargetTeamID:   teamID,
			TargetUsername: username,
			ExpectedCount:  int(expectedCount),
		})

		mctx.G().RuntimeStats.PushPerfEvent(keybase1.PerfEvent{
			EventType: keybase1.PerfEventType_TEAMTREELOAD,
			Message:   fmt.Sprintf("Loaded %d teams in tree for %s", expectedCount, teamID),
			Ctime:     keybase1.ToTime(start),
		})
	}()

	return nil
}

func loadTeamTreeMembershipsRecursive(mctx libkb.MetaContext,
	targetTeamID keybase1.TeamID,
	teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion, username string, np nodePosition,
	converter TreeloaderStateConverter) (nTeamsLoaded int32) {
	defer mctx.TraceTimed(fmt.Sprintf("loadTeamTreeMembershipsRecursive(%s, %s, %d)",
		teamName, uv, libkb.GetSessionIDOrZero(mctx.Ctx())), func() error { return nil })()

	// Load this team first
	node, res := loadTeamTreeMembershipsSingle(mctx, teamID, uv, converter)
	nTeamsLoaded = 1
	notifyTeamTreeMembershipResult(mctx, targetTeamID, username, teamName, res)
	s, _ := res.S()
	if s == keybase1.TeamTreeMembershipStatus_ERROR {
		mctx.Debug("loadTeamTreeMembershipsRecursive: short-circuiting load due to failure")
		return nTeamsLoaded
	}

	eg, ctx := errgroup.WithContext(mctx.Ctx())
	mctx = mctx.WithContext(ctx)
	// Load ancestors
	if np == nodePositionTarget && !teamName.IsRootTeam() {
		eg.Go(func() error {
			incr := loadTeamAncestorsMemberships(mctx, targetTeamID, teamID, teamName, uv, username, converter)
			mctx.Debug("loadTeamTreeMembershipsRecursive: loaded %d teams from ancestors", incr)
			atomic.AddInt32(&nTeamsLoaded, incr)
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
				mctx, targetTeamID, idAndName.Id, idAndName.Name, uv, username, nodePositionChild, converter,
			)
			mctx.Debug("loadTeamTreeMembershipsRecursive: loaded %d teams from subtree", incr)
			atomic.AddInt32(&nTeamsLoaded, incr)
			return nil
		})
	}
	// Should not return any errors since we did error handling ourselves
	_ = eg.Wait()

	return nTeamsLoaded
}

func loadTeamAncestorsMemberships(mctx libkb.MetaContext, targetTeamID keybase1.TeamID, teamID keybase1.TeamID,
	teamName keybase1.TeamName, uv keybase1.UserVersion, username string,
	converter TreeloaderStateConverter) (nTeamsLoaded int32) {
	defer mctx.TraceTimed(fmt.Sprintf("loadTeamAncestorsMemberships(%s, %s)", teamName, uv),
		func() error { return nil })()

	handleAncestor := func(t keybase1.TeamSigChainState, localTeamName keybase1.TeamName) error {
		res := converter.SigchainStateToTeamTreeMembership(mctx, &t, uv)
		s, err := res.S()
		if err != nil {
			return err
		}
		// Short-circuit ancestor load if this resulted in an error (though it shouldn't except for
		// in testing), to keep symmetry with behavior if the ancestor team load failed.
		if s == keybase1.TeamTreeMembershipStatus_ERROR {
			return fmt.Errorf("failed to load ancestor: %s", res.Error().Message)
		}
		notifyTeamTreeMembershipResult(mctx, targetTeamID, username, localTeamName, res)
		return nil
	}
	err := mctx.G().GetTeamLoader().MapTeamAncestors(
		mctx.Ctx(), handleAncestor, teamID, "LoadTeamTreeMemberships", nil)
	switch e := err.(type) {
	case nil:
		nTeamsLoaded = int32(teamName.Depth()) - 1
	case *MapAncestorsError:
		mctx.Debug("loadTeamAncestorsMemberships: map failed: %s at idx %d", e,
			e.failedLoadingAtAncestorIdx)

		// calculate the team name of the team it failed at
		// e.g. if failedLoadingAtAncestorIdx was 1 and the target team was A.B.C,
		// maxInt(0, 3 - 1 - 1) = 1, and A.B.C[:1+1] = A.B
		idx := maxInt(0, teamName.Depth()-1-e.failedLoadingAtAncestorIdx)
		nameFailedAt := keybase1.TeamName{Parts: teamName.Parts[:idx+1]}

		nTeamsLoaded = maxInt32(0, int32(e.failedLoadingAtAncestorIdx))
		notifyTeamTreeMembershipResult(mctx, targetTeamID, username, nameFailedAt, MakeLoadTeamTreeErrorResult(err))
	default:
		mctx.Debug("loadTeamAncestorsMemberships: map failed for unknown reason: %s", e)
		// Should never happen.
		// Not sure where the error failed: prompt to reload the entire thing
		notifyTeamTreeMembershipResult(mctx, targetTeamID, username, teamName, MakeLoadTeamTreeErrorResult(err))
	}
	return nTeamsLoaded
}

func loadTeamTreeMembershipsSingle(mctx libkb.MetaContext, teamID keybase1.TeamID,
	uv keybase1.UserVersion, converter TreeloaderStateConverter) (team *Team,
	res keybase1.TeamTreeMembershipResult) {
	defer mctx.TraceTimed(fmt.Sprintf("loadTeamTreeMembershipsSingle(%s, %s)", teamID, uv),
		func() error { return nil })()

	team, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return team, MakeLoadTeamTreeErrorResult(err)
	}

	return team, converter.SigchainStateToTeamTreeMembership(mctx, &team.chain().inner, uv)
}

// notifyTeamTreeMembershipResult requires teamName so it can give an intelligible error if the load
// fails.
func notifyTeamTreeMembershipResult(mctx libkb.MetaContext, targetTeamID keybase1.TeamID,
	username string,
	teamName keybase1.TeamName,
	res keybase1.TeamTreeMembershipResult) {
	mctx.Debug("@@@ notifyTeamTreeMembershipResult %#v", res)
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), keybase1.TeamTreeMembership{
		SessionID:      int(libkb.GetSessionIDOrZero(mctx.Ctx())),
		TargetTeamID:   targetTeamID,
		TargetUsername: username,
		TeamName:       teamName.String(),
		Result:         res,
	})
}
func MakeLoadTeamTreeErrorResult(err error) keybase1.TeamTreeMembershipResult {
	return keybase1.NewTeamTreeMembershipResultWithError(
		keybase1.GenericError{Message: fmt.Sprintf("%s", err)},
	)
}

// TreeloaderStateConverter allows us to mock load failures in tests.
type TreeloaderStateConverter interface {
	SigchainStateToTeamTreeMembership(mctx libkb.MetaContext, s *keybase1.TeamSigChainState,
		uv keybase1.UserVersion) (res keybase1.TeamTreeMembershipResult)
}

type DefaultTreeloaderStateConverter struct{}

func (t *DefaultTreeloaderStateConverter) SigchainStateToTeamTreeMembership(
	mctx libkb.MetaContext,
	s *keybase1.TeamSigChainState,
	uv keybase1.UserVersion,
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
		Role:        role,
		JoinTime:    joinTime,
		TeamID:      s.Id,
		MemberCount: len(s.GetAllUVs()),
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
