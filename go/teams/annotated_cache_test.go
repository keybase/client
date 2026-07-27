package teams

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func annotatedCacheTestSetup(t *testing.T) (libkb.TestContext, libkb.MetaContext, *annotatedTeamCache, clockwork.FakeClock) {
	tc := SetupTest(t, "annotated_cache", 1)
	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)
	cache, ok := tc.G.GetAnnotatedTeamCacher().(*annotatedTeamCache)
	require.True(t, ok, "ServiceInit should install an annotatedTeamCache")
	return tc, libkb.NewMetaContextForTest(tc), cache, clock
}

func TestAnnotatedTeamCacheReusesWithinTTL(t *testing.T) {
	tc, mctx, cache, clock := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("aaa")
	var calls int32
	loader := func(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.AnnotatedTeam, error) {
		atomic.AddInt32(&calls, 1)
		return keybase1.AnnotatedTeam{TeamID: id, Name: "team.one"}, nil
	}

	for i := 0; i < 5; i++ {
		res, err := cache.load(mctx, teamID, loader)
		require.NoError(t, err)
		require.Equal(t, "team.one", res.Name)
	}
	require.EqualValues(t, 1, atomic.LoadInt32(&calls))

	clock.Advance(annotatedTeamCacheTTL + 1)
	_, err := cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	require.EqualValues(t, 2, atomic.LoadInt32(&calls))
}

func TestAnnotatedTeamCacheInvalidation(t *testing.T) {
	tc, mctx, cache, _ := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("bbb")
	var calls int32
	loader := func(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.AnnotatedTeam, error) {
		atomic.AddInt32(&calls, 1)
		return keybase1.AnnotatedTeam{TeamID: id}, nil
	}

	_, err := cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	cache.Remove(teamID)
	_, err = cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	require.EqualValues(t, 2, atomic.LoadInt32(&calls))

	cache.Clear()
	_, err = cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	require.EqualValues(t, 3, atomic.LoadInt32(&calls))
}

// A load that was in flight when the team changed must not be cached, or we would
// serve pre-change data for the whole TTL.
func TestAnnotatedTeamCacheDropsRacedLoad(t *testing.T) {
	tc, mctx, cache, _ := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("ccc")
	var calls int32
	loader := func(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.AnnotatedTeam, error) {
		atomic.AddInt32(&calls, 1)
		cache.Remove(teamID)
		return keybase1.AnnotatedTeam{TeamID: id}, nil
	}

	_, err := cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	_, ok := cache.Get(mctx, teamID)
	require.False(t, ok, "a load raced by an invalidation should not be cached")
	require.EqualValues(t, 1, atomic.LoadInt32(&calls))
}

func TestAnnotatedTeamCacheSingleFlight(t *testing.T) {
	tc, mctx, cache, _ := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("ddd")
	var calls int32
	release := make(chan struct{})
	entered := make(chan struct{}, 1)
	loader := func(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.AnnotatedTeam, error) {
		atomic.AddInt32(&calls, 1)
		entered <- struct{}{}
		<-release
		return keybase1.AnnotatedTeam{TeamID: id, Name: "team.four"}, nil
	}

	var wg sync.WaitGroup
	results := make([]keybase1.AnnotatedTeam, 8)
	errs := make(chan error, len(results))
	// Hold every caller until the leader is inside the loader, so they cannot
	// serialize and take plain TTL hits instead - that would let this pass with
	// in-flight coalescing deleted entirely. require/assert are not used off the
	// test goroutine: testify's FailNow calls runtime.Goexit there, which skips
	// wg.Done and hangs the test instead of reporting it.
	start := make(chan struct{})
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			res, err := cache.load(mctx, teamID, loader)
			if err != nil {
				errs <- err
				return
			}
			results[i] = res
		}(i)
	}
	// The leader has to be in the loader before the rest are let go, so run it
	// first and only then release them onto the in-flight slot.
	go func() { close(start) }()
	<-entered
	// Everyone still to arrive now finds a populated inflight entry and waits.
	require.Eventually(t, func() bool {
		cache.Lock()
		defer cache.Unlock()
		_, ok := cache.inflight[teamID]
		return ok
	}, time.Second, time.Millisecond, "expected an in-flight slot for the leader")
	close(release)
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	require.EqualValues(t, 1, atomic.LoadInt32(&calls))
	for _, res := range results {
		require.Equal(t, "team.four", res.Name)
	}
}

// A load slower than the TTL is stored already expired unless storeLoad floors
// its age, which turns the cache into pure overhead for exactly the teams whose
// loads are slow enough to be worth memoizing.
func TestAnnotatedTeamCacheSlowLoadIsStillUsable(t *testing.T) {
	tc, mctx, cache, clock := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("slow")
	var calls int32
	loader := func(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.AnnotatedTeam, error) {
		atomic.AddInt32(&calls, 1)
		// the load itself takes longer than the whole TTL
		clock.Advance(annotatedTeamCacheTTL * 2)
		return keybase1.AnnotatedTeam{TeamID: id, Name: "team.slow"}, nil
	}

	res, err := cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	require.Equal(t, "team.slow", res.Name)

	res, err = cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	require.Equal(t, "team.slow", res.Name)
	require.EqualValues(t, 1, atomic.LoadInt32(&calls), "a slow load must still be cached")

	// It gets the floor, not a full fresh TTL.
	clock.Advance(minAnnotatedTeamCacheLifetime + 1)
	_, err = cache.load(mctx, teamID, loader)
	require.NoError(t, err)
	require.EqualValues(t, 2, atomic.LoadInt32(&calls))
}

// Clear has no team to key on, so a load whose team is in neither entries nor
// inflight - one running alongside a leader that already finished - is invisible
// to a per-team generation bump.
func TestAnnotatedTeamCacheClearDropsUntrackedLoad(t *testing.T) {
	tc, mctx, cache, clock := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("untracked")

	// A leader claims the slot.
	_, _, _, lead, _, _ := cache.beginLoad(mctx, teamID, true)
	require.NotNil(t, lead)

	// A caller out of waits proceeds alongside it.
	_, _, wait, alsoLead, gen, epoch := cache.beginLoad(mctx, teamID, false)
	require.Nil(t, wait)
	require.Nil(t, alsoLead)

	// The leader errors, so it releases the slot and caches nothing. The team is
	// now in neither entries nor inflight.
	cache.endLoad(teamID, lead)

	cache.Clear()

	// The straggler finishes with data read before the Clear.
	cache.storeLoad(mctx, teamID, keybase1.AnnotatedTeam{TeamID: teamID, Name: "stale.team"},
		clock.Now(), gen, epoch)

	_, ok := cache.Get(mctx, teamID)
	require.False(t, ok, "a load that started before Clear must not be cached after it")
}

func TestAnnotatedTeamCacheDoesNotRegressToOlderResult(t *testing.T) {
	tc, mctx, cache, clock := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("ordering")
	older := clock.Now()
	newer := older.Add(time.Second)

	cache.storeLoad(mctx, teamID, keybase1.AnnotatedTeam{TeamID: teamID, Name: "newer"}, newer, 0, 0)
	// An older load that started first but finished last must not win.
	cache.storeLoad(mctx, teamID, keybase1.AnnotatedTeam{TeamID: teamID, Name: "older"}, older, 0, 0)

	res, ok := cache.Get(mctx, teamID)
	require.True(t, ok)
	require.Equal(t, "newer", res.Name)
}

func TestAnnotatedTeamCacheBoundsResidentEntries(t *testing.T) {
	tc, mctx, cache, clock := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	for i := 0; i < annotatedTeamCacheSize*2; i++ {
		teamID := keybase1.TeamID(fmt.Sprintf("team%d", i))
		cache.storeLoad(mctx, teamID, keybase1.AnnotatedTeam{TeamID: teamID}, clock.Now(), 0, 0)
	}
	require.Equal(t, annotatedTeamCacheSize, cache.entries.Len())

	// The oldest are the ones dropped.
	_, ok := cache.Get(mctx, keybase1.TeamID("team0"))
	require.False(t, ok)
	_, ok = cache.Get(mctx, keybase1.TeamID(fmt.Sprintf("team%d", annotatedTeamCacheSize*2-1)))
	require.True(t, ok)
}

func TestAnnotatedTeamCacheDoesNotCacheErrors(t *testing.T) {
	tc, mctx, cache, _ := annotatedCacheTestSetup(t)
	defer tc.Cleanup()

	teamID := keybase1.TeamID("eee")
	var calls int32
	loadErr := errors.New("nope")
	loader := func(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.AnnotatedTeam, error) {
		atomic.AddInt32(&calls, 1)
		return keybase1.AnnotatedTeam{}, loadErr
	}

	for i := 0; i < 3; i++ {
		_, err := cache.load(mctx, teamID, loader)
		require.ErrorIs(t, err, loadErr)
	}
	require.EqualValues(t, 3, atomic.LoadInt32(&calls))
}
