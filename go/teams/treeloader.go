package teams

import (
	"context"
	"fmt"
	"sync/atomic"
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
	guid           int

	includeAncestors bool

	// initial computed values
	targetUV       keybase1.UserVersion
	targetTeamName keybase1.TeamName

	// mock for error testing
	Converter TreeloaderStateConverter
}

var _ TreeloaderStateConverter = &Treeloader{}

func NewTreeloader(mctx libkb.MetaContext, targetUsername string,
	targetTeamID keybase1.TeamID, guid int, includeAncestors bool) (*Treeloader, error) {

	larg := libkb.NewLoadUserArgWithMetaContext(mctx).WithName(targetUsername).WithForcePoll(true)
	upak, _, err := mctx.G().GetUPAKLoader().LoadV2(larg)
	if err != nil {
		return nil, err
	}

	l := &Treeloader{
		targetUsername:   targetUsername,
		targetTeamID:     targetTeamID,
		guid:             guid,
		targetUV:         upak.Current.ToUserVersion(),
		includeAncestors: includeAncestors,
	}
	l.Converter = l
	return l, nil
}

// LoadSync requires all loads to succeed, or errors out.
func (l *Treeloader) LoadSync(mctx libkb.MetaContext) (res []keybase1.TeamTreeMembership,
	err error) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.LoadSync(%s, %s)",
		l.targetTeamID, l.targetUV), &err)()

	ch, cancel, err := l.loadAsync(mctx)
	if err != nil {
		return nil, err
	}
	// Stop load if we error out early
	defer cancel()
	for notification := range ch {
		switch notification.typ {
		case treeloaderNotificationTypePartial:
			s, err := notification.partialNotification.S()
			if err != nil {
				return nil, fmt.Errorf("Treeloader.LoadSync: failed to load subtree; bailing: %s",
					err)
			}
			if s == keybase1.TeamTreeMembershipStatus_ERROR {
				return nil, fmt.Errorf("Treeloader.LoadSync: failed to load subtree; bailing: %s",
					notification.partialNotification.Error().Message)
			}

			res = append(res, keybase1.TeamTreeMembership{
				Result:         *notification.partialNotification,
				TeamName:       notification.teamName.String(),
				TargetTeamID:   l.targetTeamID,
				TargetUsername: l.targetUsername,
				Guid:           l.guid,
			})
		default:
		}
	}

	return res, nil
}

func (l *Treeloader) LoadAsync(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.LoadAsync(%s, %s)",
		l.targetTeamID, l.targetUV), &err)()

	ch, _, err := l.loadAsync(mctx)
	if err != nil {
		return err
	}
	go func() {
		// Because Go channels can be closed, we don't need to check expectedCount against the
		// number of received partials like RPC clients do.
		for notification := range ch {
			switch notification.typ {
			case treeloaderNotificationTypeDone:
				l.notifyDone(mctx, *notification.doneNotification)
			case treeloaderNotificationTypePartial:
				l.notifyPartial(mctx, notification.teamName, *notification.partialNotification)
			}
		}
	}()

	return nil
}

type treeloaderNotificationType int

const (
	treeloaderNotificationTypeDone    = 0
	treeloaderNotificationTypePartial = 1
)

type notification struct {
	typ                 treeloaderNotificationType
	teamName            keybase1.TeamName
	partialNotification *keybase1.TeamTreeMembershipResult
	doneNotification    *int
}

func newPartialNotification(teamName keybase1.TeamName,
	result keybase1.TeamTreeMembershipResult) notification {
	return notification{
		typ:                 treeloaderNotificationTypePartial,
		teamName:            teamName,
		partialNotification: &result,
	}
}
func newDoneNotification(teamName keybase1.TeamName, expectedCount int) notification {
	return notification{
		typ:              treeloaderNotificationTypeDone,
		teamName:         teamName,
		doneNotification: &expectedCount,
	}
}

func (l *Treeloader) loadAsync(mctx libkb.MetaContext) (ch chan notification,
	cancel context.CancelFunc, err error) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.loadAsync(%s, %s)",
		l.targetTeamID, l.targetUV), nil)()

	start := time.Now()

	target, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(),
		l.targetTeamID, true /* needAdmin */)
	if err != nil {
		return nil, nil, err
	}

	l.targetTeamName = target.Name()

	ch = make(chan notification)
	imctx, cancel := mctx.BackgroundWithLogTags().WithContextCancel()

	// Load rest of team tree asynchronously.
	go func(imctx libkb.MetaContext, start time.Time, targetChainState *TeamSigChainState,
		ch chan notification) {
		expectedCount := l.loadRecursive(imctx, l.targetTeamID, l.targetTeamName,
			targetChainState, ch)
		ch <- newDoneNotification(l.targetTeamName, int(expectedCount))
		close(ch)
		imctx.G().RuntimeStats.PushPerfEvent(keybase1.PerfEvent{
			EventType: keybase1.PerfEventType_TEAMTREELOAD,
			Message: fmt.Sprintf("Loaded %d teams in tree for %s",
				expectedCount, l.targetTeamName),
			Ctime: keybase1.ToTime(start),
		})
	}(imctx, start, target.chain(), ch)

	return ch, cancel, nil
}

func (l *Treeloader) loadRecursive(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, targetChainState *TeamSigChainState,
	ch chan notification) (expectedCount int32) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.loadRecursive(%s, %s, %s)",
		l.targetTeamName, l.targetUV, l.targetUsername), nil)()

	var result keybase1.TeamTreeMembershipResult
	var subteams []keybase1.TeamIDAndName
	select {
	case <-mctx.Ctx().Done():
		result = l.NewErrorResult(mctx.Ctx().Err(), teamName)
	default:
		// If it is the initial call, the caller passes in the sigchain state so we don't need to reload
		// it. Otherwise, do a team load.
		if targetChainState != nil {
			result = l.Converter.ProcessSigchainState(mctx, teamName, &targetChainState.inner)
			subteams = targetChainState.ListSubteams()
		} else {
			team, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
			if err != nil {
				result = l.NewErrorResult(err, teamName)
			} else {
				result = l.Converter.ProcessSigchainState(mctx, teamName, &team.chain().inner)
				subteams = team.chain().ListSubteams()
			}
		}
	}
	expectedCount = 1
	ch <- newPartialNotification(teamName, result)
	s, _ := result.S()
	if s == keybase1.TeamTreeMembershipStatus_ERROR {
		mctx.Debug("Treeloader.loadRecursive: short-circuiting load due to failure: %+v", result)
		return expectedCount
	}

	np := l.getPosition(teamName)

	eg, ctx := errgroup.WithContext(mctx.Ctx())
	mctx = mctx.WithContext(ctx)
	// Load ancestors
	if l.includeAncestors && np == nodePositionTarget && !teamName.IsRootTeam() {
		eg.Go(func() error {
			incr := l.loadAncestors(mctx, teamID, teamName, ch)
			mctx.Debug("Treeloader.loadRecursive: loaded %d teams from ancestors", incr)
			atomic.AddInt32(&expectedCount, incr)
			return nil
		})
	}
	// Load subtree
	// Because we load parents before children, the child's load can use the cached parent's team
	// so we only make one team/get per team.
	for _, idAndName := range subteams {
		idAndName := idAndName
		// This is unbounded but assuming subteam spread isn't too high, should be ok.
		eg.Go(func() error {
			incr := l.loadRecursive(mctx, idAndName.Id, idAndName.Name, nil, ch)
			mctx.Debug("Treeloader.loadRecursive: loaded %d teams from subtree", incr)
			atomic.AddInt32(&expectedCount, incr)
			return nil
		})
	}
	// Should not return any errors since we did error handling ourselves
	_ = eg.Wait()

	return expectedCount
}

func (l *Treeloader) loadAncestors(mctx libkb.MetaContext, teamID keybase1.TeamID,
	teamName keybase1.TeamName, ch chan notification) (expectedCount int32) {
	defer mctx.Trace(fmt.Sprintf("Treeloader.loadAncestors"), nil)()

	handleAncestor := func(t keybase1.TeamSigChainState, ancestorTeamName keybase1.TeamName) error {
		result := l.Converter.ProcessSigchainState(mctx, ancestorTeamName, &t)
		s, err := result.S()
		if err != nil {
			return fmt.Errorf("failed to get result status: %w", err)
		}
		// Short-circuit ancestor load if this resulted in an error, to keep symmetry with behavior
		// if the ancestor team load failed. We can continue if the result was HIDDEN. The switch
		// statement below will catch the error and send a notification.
		if s == keybase1.TeamTreeMembershipStatus_ERROR {
			return fmt.Errorf("failed to load ancestor: %s", result.Error().Message)
		}
		ch <- newPartialNotification(ancestorTeamName, result)
		return nil
	}
	err := mctx.G().GetTeamLoader().MapTeamAncestors(
		mctx.Ctx(), handleAncestor, teamID, "Treeloader.Load", nil)

	switch e := err.(type) {
	case nil:
		expectedCount = int32(teamName.Depth()) - 1
	case *MapAncestorsError:
		mctx.Debug("loadTeamAncestorsMemberships: map failed: %s at idx %d", e,
			e.failedLoadingAtAncestorIdx)

		// Calculate the team name of the team it failed at
		// e.g. if failedLoadingAtAncestorIdx was 1 and the target team was A.B.C,
		// maxInt(0, 3 - 1 - 1) = 1, and A.B.C[:1+1] = A.B
		idx := maxInt(0, teamName.Depth()-1-e.failedLoadingAtAncestorIdx)
		nameFailedAt := keybase1.TeamName{Parts: teamName.Parts[:idx+1]}

		expectedCount = maxInt32(0, int32(e.failedLoadingAtAncestorIdx))
		ch <- newPartialNotification(nameFailedAt, l.NewErrorResult(err, nameFailedAt))
	default:
		// Should never happen, since MapTeamAncestors should wrap every error as a
		// MapAncestorsError.
		// Not sure where the error failed: prompt to reload the entire thing
		// Also not sure if it failed at a root for now, so say we didn't to err on the side of
		// caution.
		mctx.Debug("loadTeamAncestorsMemberships: map failed for unknown reason: %s", e)
		ch <- newPartialNotification(teamName, l.NewErrorResult(e, teamName))
	}
	return expectedCount
}

func (l *Treeloader) ProcessSigchainState(mctx libkb.MetaContext, teamName keybase1.TeamName,
	s *keybase1.TeamSigChainState) keybase1.TeamTreeMembershipResult {
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
	return keybase1.NewTeamTreeMembershipResultWithOk(keybase1.TeamTreeMembershipValue{
		Role:     role,
		JoinTime: joinTime,
		TeamID:   s.Id,
	})
}

func (l *Treeloader) NewErrorResult(err error,
	teamName keybase1.TeamName) keybase1.TeamTreeMembershipResult {
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

func (l *Treeloader) notifyDone(mctx libkb.MetaContext, expectedCount int) {
	doneResult := keybase1.TeamTreeMembershipsDoneResult{
		Guid:           l.guid,
		TargetTeamID:   l.targetTeamID,
		TargetUsername: l.targetUsername,
		ExpectedCount:  expectedCount,
	}
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsDone(mctx.Ctx(), doneResult)
}

func (l *Treeloader) notifyPartial(mctx libkb.MetaContext, teamName keybase1.TeamName,
	result keybase1.TeamTreeMembershipResult) {
	partial := keybase1.TeamTreeMembership{
		Guid:           l.guid,
		TargetTeamID:   l.targetTeamID,
		TargetUsername: l.targetUsername,
		TeamName:       teamName.String(),
		Result:         result,
	}
	mctx.G().NotifyRouter.HandleTeamTreeMembershipsPartial(mctx.Ctx(), partial)
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
