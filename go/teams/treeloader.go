package teams

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/sync/errgroup"
)

// Treeloader is an ephemeral struct for loading the memberships of `targetUsername` in the partial
// team tree surrounding `targetTeamID`.
// Its behavior is described at protocol/avdl/keybase1/teams.avdl:loadTeamTreeMemberships.
type Treeloader struct {
	// arguments
	targetUsername string
	targetTeamID   keybase1.TeamID

	includeAncestors bool

	// initial computed values
	targetUV       keybase1.UserVersion
	targetTeamName keybase1.TeamName

	// mock for error testing
	Converter TreeloaderStateConverter
}

var _ TreeloaderStateConverter = &Treeloader{}

func NewTreeloader(mctx libkb.MetaContext, targetUsername string,
	targetTeamID keybase1.TeamID, includeAncestors bool,
) (*Treeloader, error) {
	larg := libkb.NewLoadUserArgWithMetaContext(mctx).WithName(targetUsername).WithForcePoll(true)
	upak, _, err := mctx.G().GetUPAKLoader().LoadV2(larg)
	if err != nil {
		return nil, err
	}

	l := &Treeloader{
		targetUsername:   targetUsername,
		targetTeamID:     targetTeamID,
		targetUV:         upak.Current.ToUserVersion(),
		includeAncestors: includeAncestors,
	}
	l.Converter = l
	return l, nil
}

// Load returns a result for every team of the tree that it reached, sorted by team name. It errors
// only if the target team cannot be loaded; any other team that fails to load is an ERROR result.
func (l *Treeloader) Load(mctx libkb.MetaContext) (res []keybase1.TeamTreeMembership, err error) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.Load(%s, %s)",
		l.targetTeamID, l.targetUV), &err)()

	start := time.Now()

	target, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(),
		l.targetTeamID, true /* needAdmin */)
	if err != nil {
		return nil, err
	}
	l.targetTeamName = target.Name()

	res = l.loadTree(mctx, target.chain())
	mctx.G().RuntimeStats.PushPerfEvent(keybase1.PerfEvent{
		EventType: keybase1.PerfEventType_TEAMTREELOAD,
		Message: fmt.Sprintf("Loaded %d teams in tree for %s",
			len(res), l.targetTeamName),
		Ctime: keybase1.ToTime(start),
	})
	return res, nil
}

func (l *Treeloader) loadTree(mctx libkb.MetaContext,
	targetChainState *TeamSigChainState,
) (res []keybase1.TeamTreeMembership) {
	ch := make(chan keybase1.TeamTreeMembership)
	go func() {
		l.loadRecursive(mctx, l.targetTeamID, l.targetTeamName, targetChainState, ch)
		close(ch)
	}()
	for membership := range ch {
		res = append(res, membership)
	}
	sortTeamTreeMemberships(res)
	return res
}

// '.' sorts before every character a team name part can have, so each team comes right before
// its subteams
func sortTeamTreeMemberships(res []keybase1.TeamTreeMembership) {
	sort.Slice(res, func(i, j int) bool { return res[i].TeamName < res[j].TeamName })
}

// treeNode is one team's row, and the subteams to load next, from how its load went: chain if it
// loaded, loadErr if not. A team that failed to load is an ERROR row and none of its subteams are
// loaded; its siblings are not affected.
func (l *Treeloader) treeNode(mctx libkb.MetaContext, teamName keybase1.TeamName,
	chain *TeamSigChainState, loadErr error,
) (row keybase1.TeamTreeMembership, subteams []keybase1.TeamIDAndName) {
	if loadErr != nil {
		return newTeamTreeMembership(teamName, l.NewErrorResult(loadErr, teamName)), nil
	}
	result := l.Converter.ProcessSigchainState(mctx, teamName, &chain.inner)
	if s, _ := result.S(); s == keybase1.TeamTreeMembershipStatus_ERROR {
		return newTeamTreeMembership(teamName, result), nil
	}
	return newTeamTreeMembership(teamName, result), chain.ListSubteams()
}

func newTeamTreeMembership(teamName keybase1.TeamName,
	result keybase1.TeamTreeMembershipResult,
) keybase1.TeamTreeMembership {
	return keybase1.TeamTreeMembership{TeamName: teamName.String(), Result: result}
}

func (l *Treeloader) loadRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, targetChainState *TeamSigChainState,
	ch chan keybase1.TeamTreeMembership,
) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.loadRecursive(%s, %s, %s)",
		l.targetTeamName, l.targetUV, l.targetUsername), nil)()

	// If it is the initial call, the caller passes in the sigchain state so we don't need to reload
	// it. Otherwise, do a team load.
	chain := targetChainState
	var loadErr error
	if err := mctx.Ctx().Err(); err != nil {
		loadErr = err
	} else if chain == nil {
		var team *Team
		team, loadErr = GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
		if loadErr == nil {
			chain = team.chain()
		}
	}
	row, subteams := l.treeNode(mctx, teamName, chain, loadErr)
	ch <- row
	if s, _ := row.Result.S(); s == keybase1.TeamTreeMembershipStatus_ERROR {
		mctx.Debug("Treeloader.loadRecursive: short-circuiting load due to failure: %+v", row.Result)
		return
	}

	np := l.getPosition(teamName)

	eg, ctx := errgroup.WithContext(mctx.Ctx())
	mctx = mctx.WithContext(ctx)
	// Load ancestors
	if l.includeAncestors && np == nodePositionTarget && !teamName.IsRootTeam() {
		eg.Go(func() error {
			l.loadAncestors(mctx, teamID, teamName, ch)
			return nil
		})
	}
	// Load subtree
	// Because we load parents before children, the child's load can use the cached parent's team
	// so we only make one team/get per team.
	for _, idAndName := range subteams {
		// This is unbounded but assuming subteam spread isn't too high, should be ok.
		eg.Go(func() error {
			l.loadRecursive(mctx, idAndName.Id, idAndName.Name, nil, ch)
			return nil
		})
	}
	// Should not return any errors since we did error handling ourselves
	_ = eg.Wait()
}

func (l *Treeloader) loadAncestors(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, ch chan keybase1.TeamTreeMembership,
) {
	defer mctx.Trace("Treeloader.loadAncestors", nil)()

	handleAncestor := func(t keybase1.TeamSigChainState, ancestorTeamName keybase1.TeamName) error {
		result := l.Converter.ProcessSigchainState(mctx, ancestorTeamName, &t)
		s, err := result.S()
		if err != nil {
			return fmt.Errorf("failed to get result status: %w", err)
		}
		// Short-circuit ancestor load if this resulted in an error, to keep symmetry with behavior
		// if the ancestor team load failed. We can continue if the result was HIDDEN. The switch
		// statement below will catch the error and send its result.
		if s == keybase1.TeamTreeMembershipStatus_ERROR {
			return fmt.Errorf("failed to load ancestor: %s", result.Error().Message)
		}
		ch <- newTeamTreeMembership(ancestorTeamName, result)
		return nil
	}
	err := mctx.G().GetTeamLoader().MapTeamAncestors(
		mctx.Ctx(), handleAncestor, teamID, "Treeloader.Load", nil)

	switch e := err.(type) {
	case nil:
	case *MapAncestorsError:
		mctx.Debug("loadTeamAncestorsMemberships: map failed: %s at idx %d", e,
			e.failedLoadingAtAncestorIdx)

		// Calculate the team name of the team it failed at
		// e.g. if failedLoadingAtAncestorIdx was 1 and the target team was A.B.C,
		// maxInt(0, 3 - 1 - 1) = 1, and A.B.C[:1+1] = A.B
		idx := maxInt(0, teamName.Depth()-1-e.failedLoadingAtAncestorIdx)
		nameFailedAt := keybase1.TeamName{Parts: teamName.Parts[:idx+1]}

		ch <- newTeamTreeMembership(nameFailedAt, l.NewErrorResult(err, nameFailedAt))
	default:
		// Should never happen, since MapTeamAncestors should wrap every error as a
		// MapAncestorsError.
		// Not sure where the error failed: prompt to reload the entire thing
		// Also not sure if it failed at a root for now, so say we didn't to err on the side of
		// caution.
		mctx.Debug("loadTeamAncestorsMemberships: map failed for unknown reason: %s", e)
		ch <- newTeamTreeMembership(teamName, l.NewErrorResult(e, teamName))
	}
}

func (l *Treeloader) ProcessSigchainState(mctx libkb.MetaContext, teamName keybase1.TeamName,
	s *keybase1.TeamSigChainState,
) keybase1.TeamTreeMembershipResult {
	np := l.getPosition(teamName)

	if np == nodePositionAncestor {
		meUV, err := mctx.G().GetMeUV(mctx.Ctx())
		// Should never get an error here since we're logged in.
		if err != nil || s.UserRole(meUV) == keybase1.TeamRole_NONE {
			return keybase1.NewTeamTreeMembershipResultWithHidden()
		}
	}

	role := s.UserRole(l.targetUV)
	var joinTime *keybase1.Time
	if role != keybase1.TeamRole_NONE {
		t, err := s.GetUserLastJoinTime(l.targetUV)
		if err != nil {
			mctx.Debug("Treeloader.ProcessSigchainState: failed to compute join time for %s: %s",
				l.targetUV, err)
		} else {
			joinTime = &t
		}
	}
	var memberCount *int
	// the team load counted it already; count here only if that cache missed
	if count, ok := mctx.G().TeamMemberCountCache.Get(s.Id); ok {
		memberCount = &count
	} else if count, err := (TeamSigChainState{inner: *s}).memberCount(); err != nil {
		mctx.Debug("Treeloader.ProcessSigchainState: failed to count members of %s: %s",
			teamName, err)
	} else {
		memberCount = &count
	}
	return keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:        role,
		JoinTime:    joinTime,
		TeamID:      s.Id,
		MemberCount: memberCount,
	})
}

func (l *Treeloader) NewErrorResult(err error,
	teamName keybase1.TeamName,
) keybase1.TeamTreeMembershipResult {
	np := l.getPosition(teamName)
	return keybase1.NewTeamTreeMembershipResultWithError(keybase1.TeamTreeError{
		Message:           fmt.Sprintf("%s", err),
		WillSkipSubtree:   np != nodePositionAncestor,
		WillSkipAncestors: !teamName.IsRootTeam() && np != nodePositionChild,
	})
}

func (l *Treeloader) getPosition(teamName keybase1.TeamName) nodePosition {
	if l.targetTeamName.Eq(teamName) {
		return nodePositionTarget
	}
	if l.targetTeamName.IsAncestorOf(teamName) {
		return nodePositionChild
	}
	return nodePositionAncestor
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

type nodePosition int

const (
	nodePositionTarget   nodePosition = 0
	nodePositionChild    nodePosition = 1
	nodePositionAncestor nodePosition = 2
)

type TreeloaderStateConverter interface {
	ProcessSigchainState(libkb.MetaContext, keybase1.TeamName,
		*keybase1.TeamSigChainState) keybase1.TeamTreeMembershipResult
}
