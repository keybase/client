package uidmap

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"testing"
	"time"
)

type testPair struct {
	uid      string
	username string
}

const mikem = keybase1.UID("95e88f2087e480cae28f08d81554bc00")
const max = keybase1.UID("dbb165b7879fe7b1174df73bed0b9500")

func TestLookupUsernameOnly(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	var seed = []testPair{
		{"afb5eda3154bc13c1df0189ce93ba119", "t_bob"},
		{"00000000000000000000000000000119", ""},
		{"295a7eea607af32040647123732bc819", "t_alice"},
		{"00000000000000000000000000000219", ""},
		{"9cbca30c38afba6ab02d76b206515919", "t_helen"},
		{"00000000000000000000000000000319", ""},
		{string(max), "max"},
		{"00000000000000000000000000000419", ""},
		{string(mikem), "mikem"},
		{"00000000000000000000000000000519", ""},
		{"9f9611a4b7920637b1c2a839b2a0e119", "t_george"},
		{"00000000000000000000000000000619", ""},
		{"359c7644857203be38bfd3bf79bf1819", "t_frank"},
		{"00000000000000000000000000000719", ""},
	}

	var tests []testPair
	batchSize = 7
	for len(tests) < batchSize*10 {
		tests = append(tests, seed...)
	}

	var uids []keybase1.UID
	for _, test := range tests {
		uid, err := keybase1.UIDFromString(test.uid)
		require.NoError(t, err)
		uids = append(uids, uid)
	}

	uidMap := NewUIDMap(10)

	for i := 0; i < 4; i++ {
		results, err := uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, 0, 0, false)
		require.NoError(t, err)
		for j, test := range tests {
			require.True(t, results[j].NormalizedUsername.Eq(libkb.NewNormalizedUsername(test.username)))
		}
		if i == 2 {
			uidMap.Clear()
		}
	}
}

const tKB = keybase1.UID("7b7248a1c09d17451f9002d9edc8df19")

func TestRanOutOfTime(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	fakeClock := clockwork.NewFakeClockAt(time.Now())
	tc.G.SetClock(fakeClock)

	uidMap := NewUIDMap(10)
	uids := []keybase1.UID{tKB}
	errmsg := "ran out of time"

	// This hook runs at the beginning of every iteration though the batch-fetch loop.
	// It allows us to bump our fake clock forward.
	hit := false
	var cachedAt time.Time
	setCachedAt := false
	uidMap.testBatchIterHook = func() {
		hit = true
		fakeClock.Advance(time.Minute)
		if setCachedAt {
			cachedAt = fakeClock.Now()
		}
	}

	// user t_kb has a fullname, but we're not giving ourselves enough time to grab it
	results, err := uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, 0, time.Nanosecond, true)
	require.Error(t, err)
	require.True(t, hit)
	require.Equal(t, err.Error(), errmsg)
	require.True(t, results[0].NormalizedUsername.IsNil())
	require.Nil(t, results[0].FullName)

	// user mikem has a fullname, but we're again not giving ourselves enough time to grab it;
	// however, he has a hard-coded UID mapping so we should be able to still grab his username
	uids = []keybase1.UID{mikem}
	hit = false
	results, err = uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, 0, time.Nanosecond, true)
	require.Error(t, err)
	require.True(t, hit)
	require.Equal(t, err.Error(), errmsg)
	require.True(t, results[0].NormalizedUsername.Eq(libkb.NewNormalizedUsername("mikem")))
	require.Nil(t, results[0].FullName)

	// now success for user t_kb, who has a non-hardcoded username and a fullname on the
	// server
	uids = []keybase1.UID{tKB}
	hit = false
	results, err = uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, 0, 0, true)
	require.NoError(t, err)
	require.True(t, hit)
	require.Equal(t, results[0].NormalizedUsername, libkb.NewNormalizedUsername("t_kb"))
	require.Equal(t, results[0].FullName.FullName, keybase1.FullName("Joe Keybaser"))
	cachedAt = fakeClock.Now()

	// Now we're going to simulate that the fullname resolution became expired, and there
	// was an attempt to fetch it from the server, but that we ran out of network fetch time
	// budget. So we should see the stale result and also the error.
	fakeClock.Advance(time.Hour)
	hit = false
	results, err = uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, time.Second, time.Nanosecond, false)
	require.Error(t, err)
	require.Equal(t, err.Error(), errmsg)
	require.True(t, hit)
	require.Equal(t, results[0].NormalizedUsername, libkb.NewNormalizedUsername("t_kb"))
	require.Equal(t, results[0].FullName.FullName, keybase1.FullName("Joe Keybaser"))
	require.Equal(t, results[0].FullName.CachedAt, keybase1.ToTime(cachedAt))

	// Same as above, but give enough time to refresh the name from the server
	hit = false
	setCachedAt = true
	results, err = uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, time.Second, 0, false)
	require.NoError(t, err)
	require.True(t, hit)
	require.Equal(t, results[0].NormalizedUsername, libkb.NewNormalizedUsername("t_kb"))
	require.Equal(t, results[0].FullName.FullName, keybase1.FullName("Joe Keybaser"))
	require.Equal(t, results[0].FullName.CachedAt, keybase1.ToTime(cachedAt))

	// In this case, there's not enough time to make any fetches, but it doesn't matter, since our
	// previous fetch is fresh enough. We should never even hit testBatchIterHook
	fakeClock.Advance(time.Minute)
	hit = false
	setCachedAt = false
	results, err = uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, time.Hour, time.Nanosecond, false)
	require.NoError(t, err)
	require.False(t, hit)
	require.Equal(t, results[0].NormalizedUsername, libkb.NewNormalizedUsername("t_kb"))
	require.Equal(t, results[0].FullName.FullName, keybase1.FullName("Joe Keybaser"))
	require.Equal(t, results[0].FullName.CachedAt, keybase1.ToTime(cachedAt))

	// Do a happy path for several users:
	uids = []keybase1.UID{mikem, tKB, max}
	results, err = uidMap.MapUIDsToUsernamePackages(context.TODO(), tc.G, uids, 0, 0, false)
	require.NoError(t, err)

	// Everyone gets back a normalized username
	require.Equal(t, results[0].NormalizedUsername, libkb.NewNormalizedUsername("mikem"))
	require.Equal(t, results[1].NormalizedUsername, libkb.NewNormalizedUsername("t_kb"))
	require.Equal(t, results[2].NormalizedUsername, libkb.NewNormalizedUsername("max"))

	// But only t_kb has a fullname that's found
	require.Nil(t, results[0].FullName)
	require.Equal(t, results[1].FullName.FullName, keybase1.FullName("Joe Keybaser"))
	require.Equal(t, results[1].FullName.CachedAt, keybase1.ToTime(cachedAt))
	require.Nil(t, results[2].FullName)
}
