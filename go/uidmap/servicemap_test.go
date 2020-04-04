package uidmap

import (
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type timeoutAPIMock struct {
	libkb.API
	callCount int
}

func (n *timeoutAPIMock) PostDecodeCtx(context.Context, libkb.APIArg, libkb.APIResponseWrapper) error {
	n.callCount++
	return libkb.APINetError{Err: errors.New("timeoutAPIMock")}
}

const tTracy = keybase1.UID("eb72f49f2dde6429e5d78003dae0c919")
const tAlice = keybase1.UID("295a7eea607af32040647123732bc819")

func TestServiceMapLookupKnown(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	now := keybase1.ToTime(fakeClock.Now())

	serviceMapper := NewServiceSummaryMap(10)
	uids := []keybase1.UID{tKB, tAlice, tTracy}
	const zeroDuration = time.Duration(0)
	pkgs := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
		zeroDuration /* freshness */, DefaultNetworkBudget /* networkBudget */)

	require.Len(t, pkgs, 3)
	require.Contains(t, pkgs, tKB)
	require.Contains(t, pkgs, tAlice)
	require.Contains(t, pkgs, tTracy)
	for _, v := range pkgs {
		require.True(t, v.CachedAt >= now)
		require.NotNil(t, v.ServiceMap)
	}

	// Exact maps depend on remote_identities on the test server.
	require.Equal(t, "gbrltest", pkgs[tKB].ServiceMap["twitter"])
	require.Equal(t, "tacovontaco", pkgs[tAlice].ServiceMap["twitter"])
	require.Equal(t, "tacoplusplus", pkgs[tTracy].ServiceMap["github"])
	require.Equal(t, "t_tracy", pkgs[tTracy].ServiceMap["rooter"])
	require.Equal(t, "tacovontaco", pkgs[tTracy].ServiceMap["twitter"])

	timeoutAPI := &timeoutAPIMock{}
	tc.G.API = timeoutAPI

	// Doesn't matter for the API itself because we are mocking it, but make
	// sure serviceMapper does not do anything funky when budget is anything
	// other than default.
	networkBudget := 1 * time.Second

	{
		pkgs2 := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
			zeroDuration /* freshness */, networkBudget)
		require.Equal(t, pkgs, pkgs2)
		// Should not have to call API with freshness set to "always fresh".
		require.Equal(t, 0, timeoutAPI.callCount)
	}

	{
		// Same, but advance fake clock and provide `freshness` argument. We
		// should fail to get data with always-timeouting API.
		fakeClock.Advance(24 * time.Hour)

		pkgs2 := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
			12*time.Hour /* freshness */, networkBudget)
		require.Len(t, pkgs2, 0)
		require.Equal(t, 1, timeoutAPI.callCount)
	}

	{
		// Similar, but with DisallowNetworkBudget which should skip request completely.
		pkgs2 := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
			12*time.Hour /* freshness */, DisallowNetworkBudget /* networkBudget */)
		require.Len(t, pkgs2, 0)
		require.Equal(t, 1, timeoutAPI.callCount) // same count as after previous call
	}
}

func TestServiceMapLookupEmpty(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	now := keybase1.ToTime(time.Now())
	serviceMapper := NewServiceSummaryMap(10)

	const tFrank = keybase1.UID("359c7644857203be38bfd3bf79bf1819")
	uids := []keybase1.UID{tFrank}
	const zeroDuration = time.Duration(0)
	pkgs := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
		zeroDuration /* freshness */, zeroDuration /* networkBudget */)

	// t_frank has no services, expecting to see t_frank in result map but with
	// nil ServiceMap field.
	require.Len(t, pkgs, 1)
	require.Contains(t, pkgs, tFrank)
	require.Nil(t, pkgs[tFrank].ServiceMap)
	require.True(t, pkgs[tFrank].CachedAt >= now)

	timeoutAPI := &timeoutAPIMock{}
	tc.G.API = timeoutAPI

	{
		// Query again with very strict network budget hoping to hit cache.
		pkgs2 := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
			zeroDuration /* freshness */, DefaultNetworkBudget /* networkBudget */)
		require.Equal(t, pkgs, pkgs2)
		// should not hit the API due to freshness parameter.
		require.Equal(t, 0, timeoutAPI.callCount)
	}
}

type mockAPI struct {
	libkb.API
	t       *testing.T
	results map[keybase1.UID]libkb.UserServiceSummary
}

func (m *mockAPI) PostDecodeCtx(ctx context.Context, arg libkb.APIArg, resp libkb.APIResponseWrapper) error {
	require.Equal(m.t, "user/service_maps", arg.Endpoint)

	ps := reflect.ValueOf(resp)
	elem := ps.Elem()
	field := elem.FieldByName("ServiceMaps")
	field.Set(reflect.ValueOf(m.results))

	m.t.Logf("mockAPI is returning for user/service_maps: %s", spew.Sdump(m.results))
	return nil
}

func TestServiceMapBecomesEmpty(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	now := keybase1.ToTime(fakeClock.Now())

	results := make(map[keybase1.UID]libkb.UserServiceSummary)
	sumsum := make(libkb.UserServiceSummary)
	sumsum["twitter"] = "tracy"
	sumsum["github"] = "tracerz"
	results[tTracy] = sumsum
	apiMock := &mockAPI{nil, t, results}

	tc.G.API = apiMock

	const freshness = 24 * time.Hour
	serviceMapper := NewServiceSummaryMap(10)
	uids := []keybase1.UID{tTracy}
	pkgs := serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
		freshness, DefaultNetworkBudget)

	require.Len(t, pkgs, 1)
	require.Contains(t, pkgs, tTracy)
	require.True(t, pkgs[tTracy].CachedAt >= now)
	require.Equal(t, sumsum, pkgs[tTracy].ServiceMap)

	// Now the service returns empty service map because someone has revoked
	// all their proofs (or reset).

	fakeClock.Advance(30 * time.Hour)

	// Server returns empty result because user's proofs are all gone.
	results = make(map[keybase1.UID]libkb.UserServiceSummary)
	apiMock.results = results

	// Do a normal call with network budget to allow for cache refresh.
	pkgs = serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
		freshness, DefaultNetworkBudget)

	var nilMap libkb.UserServiceSummary

	require.Len(t, pkgs, 1)
	require.Contains(t, pkgs, tTracy)
	require.True(t, pkgs[tTracy].CachedAt >= now)
	require.Equal(t, nilMap, pkgs[tTracy].ServiceMap)

	fakeClock.Advance(1 * time.Hour)

	// Now do a call without network budget to force read from cache.
	pkgs = serviceMapper.MapUIDsToServiceSummaries(context.TODO(), tc.G, uids,
		freshness, DisallowNetworkBudget)

	require.Len(t, pkgs, 1)
	require.Contains(t, pkgs, tTracy)
	require.True(t, pkgs[tTracy].CachedAt >= now)
	require.Equal(t, nilMap, pkgs[tTracy].ServiceMap)
}
