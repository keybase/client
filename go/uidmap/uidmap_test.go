package uidmap

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"testing"
)

type testPair struct {
	uid      string
	username string
}

func TestLookup(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	var seed = []testPair{
		{"afb5eda3154bc13c1df0189ce93ba119", "t_bob"},
		{"00000000000000000000000000000119", ""},
		{"295a7eea607af32040647123732bc819", "t_alice"},
		{"00000000000000000000000000000219", ""},
		{"9cbca30c38afba6ab02d76b206515919", "t_helen"},
		{"00000000000000000000000000000319", ""},
		{"dbb165b7879fe7b1174df73bed0b9500", "max"},
		{"00000000000000000000000000000419", ""},
		{"95e88f2087e480cae28f08d81554bc00", "mikem"},
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

	uidMap := NewUIDMap()

	for i := 0; i < 4; i++ {
		usernames, err := uidMap.MapUIDsToUsernames(context.TODO(), tc.G, uids)
		require.NoError(t, err)
		for j, test := range tests {
			require.True(t, usernames[j].Eq(libkb.NewNormalizedUsername(test.username)))
		}
		if i == 2 {
			uidMap.Clear()
		}
	}
}
