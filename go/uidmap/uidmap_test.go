package uidmap

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"testing"
)

func TestLookup(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookup", 1)
	defer tc.Cleanup()

	var tests = []struct {
		uid      string
		username string
	}{
		{"afb5eda3154bc13c1df0189ce93ba119", "t_bob"},
		{"295a7eea607af32040647123732bc819", "t_alice"},
		{"9cbca30c38afba6ab02d76b206515919", "t_helen"},
		{"8cbca30c38afba6ab02d76b206515919", ""},
		{"dbb165b7879fe7b1174df73bed0b9500", "max"},
		{"95e88f2087e480cae28f08d81554bc00", "mikem"},
		{"acbca30c38afba6ab02d76b206515919", ""},
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
