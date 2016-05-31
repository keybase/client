package libkb

import (
	"strings"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol"
)

type resolveTestClock struct {
	now time.Time
}

func newResolveTestClock() *resolveTestClock {
	return &resolveTestClock{now: time.Now()}
}

func newTestResolverCache(g *GlobalContext) (*Resolver, *resolveTestClock) {
	clock := newResolveTestClock()
	res := NewResolver(g)
	res.EnableCaching()
	res.nowFunc = func() time.Time { return clock.now }
	return res, clock
}

func (r *resolveTestClock) tick(d time.Duration) {
	r.now = r.now.Add(d)
}

var tracyUID = keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")

func TestResolveSimple(t *testing.T) {
	tc := SetupTest(t, "resolveSimple", 1)
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
	if !r.stats.eq(0, 0, 0, 0, 0) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	goodResolve("t_tracy@keybase")
	if !r.stats.eq(1, 0, 0, 0, 0) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	goodResolve("t_tracy@keybase")
	if !r.stats.eq(1, 0, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	clock.tick(resolveCacheMaxAge * 10)
	goodResolve("t_tracy@keybase")
	if !r.stats.eq(1, 1, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	goodResolve("t_tracy@rooter")
	if !r.stats.eq(2, 1, 0, 0, 1) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	clock.tick(resolveCacheMaxAgeMutable / 2)
	goodResolve("t_tracy@rooter")
	if !r.stats.eq(2, 1, 0, 0, 2) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	clock.tick(resolveCacheMaxAgeMutable * 2)
	goodResolve("t_tracy@rooter")
	if !r.stats.eq(2, 1, 1, 0, 2) {
		t.Fatalf("Got bad cache stats: %+v\n", r.stats)
	}
	res := r.Resolve("tacovontaco@twitter")
	if err := res.GetError(); err == nil {
		t.Fatal("Expected an ambiguous error on taconvontaco")
	} else if terr, ok := err.(ResolutionError); !ok {
		t.Fatal("wrong error type")
	} else if !strings.Contains(terr.Msg, "ambiguous") {
		t.Fatal("didn't get ambiguous error")
	}
}
