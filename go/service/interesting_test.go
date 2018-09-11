package service

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestInterestingPeople(t *testing.T) {
	tc := libkb.SetupTest(t, "gregor", 3)
	defer tc.Cleanup()
	tc.G.SetService()

	maxUsers := 3
	var users []*kbtest.FakeUser
	for i := 0; i < maxUsers; i++ {
		u, err := kbtest.CreateAndSignupFakeUser("ppl", tc.G)
		require.NoError(t, err)
		users = append(users, u)
	}
	fn1 := func(uid keybase1.UID) (res []keybase1.UID, err error) {
		for _, u := range users {
			res = append(res, u.User.GetUID())
		}
		return res, nil
	}

	// Sign up an addition user
	u, err := kbtest.CreateAndSignupFakeUser("ppl", tc.G)
	require.NoError(t, err)
	users = append(users, u)

	fn2 := func(uid keybase1.UID) (res []keybase1.UID, err error) {
		for i := len(users) - 1; i >= 0; i-- {
			res = append(res, u.User.GetUID())
		}
		return res, nil
	}

	ip := newInterestingPeople(tc.G)
	ip.AddSource(fn1, 0.9)
	ip.AddSource(fn2, 0.1)

	res, err := ip.Get(context.TODO(), 20)
	require.NoError(t, err)
	require.Equal(t, maxUsers+1, len(res))
	require.Equal(t, users[0].GetUID(), res[0])
	require.Equal(t, users[len(users)-1].GetUID(), res[len(res)-1])

}
