package teams

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"

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
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			res, err := cache.load(mctx, teamID, loader)
			require.NoError(t, err)
			results[i] = res
		}(i)
	}
	<-entered
	close(release)
	wg.Wait()

	require.EqualValues(t, 1, atomic.LoadInt32(&calls))
	for _, res := range results {
		require.Equal(t, "team.four", res.Name)
	}
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
