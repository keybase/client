package externals

import (
	"context"
	"strings"
	"testing"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	clockwork "github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

func newTestResolverCache(g *libkb.GlobalContext) (*libkb.ResolverImpl, clockwork.FakeClock) {
	clock := clockwork.NewFakeClockAt(time.Now())
	g.SetClock(clock)
	res := libkb.NewResolverImpl()
	res.EnableCaching(libkb.NewMetaContextBackground(g))
	return res, clock
}

var tracyUID = keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")

func TestResolveSimple(t *testing.T) {
	tc := setupTest(t, "resolveSimple", 1)
	defer tc.Cleanup()

	r, clock := newTestResolverCache(tc.G)
	m := libkb.NewMetaContextForTest(tc)

	goodResolve := func(s string) {
		res := r.Resolve(m, s)
		err := res.GetError()
		require.NoError(t, err)
		require.Equal(t, res.GetUID(), tracyUID)
	}

	goodResolve("eb72f49f2dde6429e5d78003dae0c919@uid")
	require.True(t, r.Stats.Eq(0, 0, 0, 0, 0))

	goodResolve("t_tracy@keybase")
	require.True(t, r.Stats.Eq(1, 0, 0, 0, 0))

	goodResolve("t_tracy@keybase")
	require.True(t, r.Stats.Eq(1, 0, 0, 0, 1))

	clock.Advance(libkb.ResolveCacheMaxAge * 10)
	goodResolve("t_tracy@keybase")
	require.True(t, r.Stats.Eq(1, 1, 0, 0, 1))

	goodResolve("t_tracy@rooter")
	require.True(t, r.Stats.Eq(2, 1, 0, 0, 1))

	clock.Advance(libkb.ResolveCacheMaxAgeMutable / 2)
	goodResolve("t_tracy@rooter")
	require.True(t, r.Stats.Eq(2, 1, 0, 0, 2))

	clock.Advance(libkb.ResolveCacheMaxAgeMutable * 2)
	goodResolve("t_tracy@rooter")
	require.True(t, r.Stats.Eq(2, 1, 1, 0, 2))

	res := r.Resolve(m, "tacovontaco@twitter")
	err := res.GetError()
	require.Error(t, err)
	terr, ok := err.(libkb.ResolutionError)
	require.True(t, ok)
	require.True(t, strings.Contains(terr.Msg, "ambiguous"))
}

func TestResolveNeedUsername(t *testing.T) {
	ctx := context.Background()
	tc := setupTest(t, "resolveSimple", 1)
	defer tc.Cleanup()

	r, clock := newTestResolverCache(tc.G)
	goodResolve := func(s string) {
		lctx := libkb.WithLogTag(ctx, "RSLV")
		res := r.ResolveFullExpressionNeedUsername(libkb.NewMetaContext(lctx, tc.G), s)
		err := res.GetError()
		require.NoError(t, err)
		require.Equal(t, res.GetUID(), tracyUID)
	}
	goodResolve("t_tracy")
	require.True(t, r.Stats.Eq(1, 0, 0, 0, 0))

	goodResolve("t_tracy")
	require.True(t, r.Stats.Eq(1, 0, 0, 0, 1))

	clock.Advance(libkb.ResolveCacheMaxAge * 10)
	goodResolve("t_tracy")
	require.True(t, r.Stats.EqWithDiskHits(1, 1, 0, 0, 1, 1))

	goodResolve("uid:" + string(tracyUID))
	require.True(t, r.Stats.EqWithDiskHits(2, 1, 0, 0, 1, 1))

	goodResolve("uid:" + string(tracyUID))
	require.True(t, r.Stats.EqWithDiskHits(2, 1, 0, 0, 2, 1))

	clock.Advance(libkb.ResolveCacheMaxAge * 10)

	// At this point, the uid resolution is out of memory cache,
	// and we don't write it to disk. So we're going to totally miss
	// the cache here.
	goodResolve("uid:" + string(tracyUID))
	require.True(t, r.Stats.EqWithDiskHits(2, 2, 0, 0, 2, 1))
}
