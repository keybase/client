package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestProfileEdit(t *testing.T) {
	tc := SetupEngineTest(t, "TestProfileEdit")
	defer tc.Cleanup()
	fu := CreateAndSignupFakeUser(tc, "track")

	identify := func() keybase1.UserCard {
		i := newIdentify2WithUIDTester(tc.G)
		tc.G.SetProofServices(i)

		// add NoSkipSelf and NeedProofSet to go through with the full identify,
		// with RPCs to the outside and all.
		arg := &keybase1.Identify2Arg{
			Uid:              fu.UID(),
			NoSkipSelf:       true,
			NeedProofSet:     true,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
		}
		eng := NewIdentify2WithUID(tc.G, arg)
		uis := libkb.UIs{IdentifyUI: i}
		waiter := launchWaiter(t, i.finishCh)
		m := NewMetaContextForTest(tc).WithUIs(uis)
		err := eng.Run(m)
		if err != nil {
			t.Fatal(err)
		}
		waiter()
		return i.card
	}

	update := func(b, n, l string) {
		eng := NewProfileEdit(tc.G, keybase1.ProfileEditArg{Location: l, FullName: n, Bio: b})
		m := NewMetaContextForTest(tc)
		err := eng.Run(m)
		if err != nil {
			t.Fatal(err)
		}
	}

	check := func(card keybase1.UserCard, b, n, l string) {
		require.Equal(t, card.Bio, b, "bio")
		require.Equal(t, card.FullName, n, "fullname")
		require.Equal(t, card.Location, l, "location")
	}

	card := identify()
	check(card, "", "", "")

	updateAndCheck := func(b, n, l string) {
		update(b, n, l)
		card = identify()
		check(card, b, n, l)
	}

	updateAndCheck("An average homo sapien", "Celia", "Earth")
	updateAndCheck("An explorer", "Damon", "Mars")
}
