package externals

import (
	"strings"
	"testing"
	"time"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type resolveTestClock struct {
	now time.Time
}

func newResolveTestClock() *resolveTestClock {
	return &resolveTestClock{now: time.Now()}
}

func newTestResolverCache(g *libkb.GlobalContext) (*libkb.Resolver, *resolveTestClock) {
	clock := newResolveTestClock()
	res := libkb.NewResolver(g)
	res.EnableCaching()
	res.NowFunc = func() time.Time { return clock.now }
	return res, clock
}

func (r *resolveTestClock) tick(d time.Duration) {
	r.now = r.now.Add(d)
}

var tracyUID = keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")

func TestResolveSimple(t *testing.T) {
	tc := libkb.SetupTest(t, "resolveSimple", 1)
	tc.G.Services = GetServices()
	r, clock := newTestResolverCache(tc.G)

	goodResolve := func(s string) {
		res := r.Resolve(s)
		if err := res.GetError(); err != nil {
			t.Fatal(err)
		}
		if res.GetUID() != tracyUID {
			t.Fatalf("Got wrong UID; wanted %s but got %s", tracyUID, res.GetUID())
		}
	}
	goodResolve("eb72f49f2dde6429e5d78003dae0c919@uid")
	if !r.Stats.Eq(0, 0, 0, 0, 0) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	goodResolve("t_tracy@keybase")
	if !r.Stats.Eq(1, 0, 0, 0, 0) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	goodResolve("t_tracy@keybase")
	if !r.Stats.Eq(1, 0, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	clock.tick(libkb.ResolveCacheMaxAge * 10)
	goodResolve("t_tracy@keybase")
	if !r.Stats.Eq(1, 1, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	goodResolve("t_tracy@rooter")
	if !r.Stats.Eq(2, 1, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	clock.tick(libkb.ResolveCacheMaxAgeMutable / 2)
	goodResolve("t_tracy@rooter")
	if !r.Stats.Eq(2, 1, 0, 0, 2) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	clock.tick(libkb.ResolveCacheMaxAgeMutable * 2)
	goodResolve("t_tracy@rooter")
	if !r.Stats.Eq(2, 1, 1, 0, 2) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	res := r.Resolve("tacovontaco@twitter")
	if err := res.GetError(); err == nil {
		t.Fatal("Expected an ambiguous error on taconvontaco")
	} else if terr, ok := err.(libkb.ResolutionError); !ok {
		t.Fatal("wrong error type")
	} else if !strings.Contains(terr.Msg, "ambiguous") {
		t.Fatal("didn't get ambiguous error")
	}
}

func TestResolveNeedUsername(t *testing.T) {
	ctx := context.Background()
	tc := libkb.SetupTest(t, "resolveSimple", 1)
	tc.G.Services = GetServices()
	r, clock := newTestResolverCache(tc.G)
	goodResolve := func(s string) {
		lctx := libkb.WithLogTag(ctx, "RSLV")
		res := r.ResolveFullExpressionNeedUsername(lctx, s)
		if err := res.GetError(); err != nil {
			t.Fatal(err)
		}
		if res.GetUID() != tracyUID {
			t.Fatalf("Got wrong UID; wanted %s but got %s", tracyUID, res.GetUID())
		}
	}
	goodResolve("t_tracy")
	if !r.Stats.Eq(1, 0, 0, 0, 0) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	goodResolve("t_tracy")
	if !r.Stats.Eq(1, 0, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	clock.tick(libkb.ResolveCacheMaxAge * 10)
	goodResolve("t_tracy")
	if !r.Stats.EqWithDiskHits(1, 1, 0, 0, 1, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}

	goodResolve("uid:" + string(tracyUID))
	if !r.Stats.EqWithDiskHits(2, 1, 0, 0, 1, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
	goodResolve("uid:" + string(tracyUID))
	if !r.Stats.EqWithDiskHits(2, 1, 0, 0, 2, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}

	clock.tick(libkb.ResolveCacheMaxAge * 10)

	// At this point, the uid resolution is out of memory cache,
	// and we don't write it to disk. So we're going to totally miss
	// the cache here.
	goodResolve("uid:" + string(tracyUID))
	if !r.Stats.EqWithDiskHits(2, 2, 0, 0, 2, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.Stats)
	}
}
