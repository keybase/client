package home

import (
	"context"
	"github.com/keybase/client/go/contacts"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// General coverage over public methods and covers an issue where we previously
// referenced a null cache.
func TestHome(t *testing.T) {
	tc := libkb.SetupTest(t, "home", 2)
	defer tc.Cleanup()
	_, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)

	ctx := context.TODO()
	home := NewHome(tc.G)

	// test we run without error for markViewed true/false
	numPeopleWanted := 0 // makes mock cache easier
	for _, markViewed := range []bool{true, false} {
		_, err = home.Get(ctx, markViewed, numPeopleWanted)
		require.NoError(t, err)

		// setup caches so we test those branches
		newPeopleCache := &peopleCache{
			all: []keybase1.HomeUserSummary{
				{},
			},
			cachedAt: tc.G.GetClock().Now(),
		}
		home.peopleCache = newPeopleCache
		home.homeCache = &homeCache{
			cachedAt: tc.G.GetClock().Now(),
			obj: keybase1.HomeScreen{
				Items: []keybase1.HomeScreenItem{
					{
						Badged: true,
						Data:   keybase1.NewHomeScreenItemDataWithPeople(keybase1.HomeScreenPeopleNotification{}),
					},
				},
			},
		}
		useCache, _ := home.peopleCache.isValid(ctx, tc.G, numPeopleWanted)
		require.True(t, useCache)
		require.True(t, home.homeCache.isValid(ctx, tc.G))
		_, err = home.Get(ctx, markViewed, numPeopleWanted)
		require.NoError(t, err)
	}

	for typ := range keybase1.HomeScreenTodoTypeRevMap {
		switch typ {
		case keybase1.HomeScreenTodoType_NONE:
			require.Error(t, home.SkipTodoType(ctx, typ))
		default:
			require.NoError(t, home.SkipTodoType(ctx, typ))
		}
	}

	require.NoError(t, home.MarkViewed(ctx))
	require.NoError(t, home.ActionTaken(ctx))
}

func TestContactResolutionPeoplePage(t *testing.T) {
	tc := libkb.SetupTest(t, "home", 2)
	defer tc.Cleanup()
	tc2 := libkb.SetupTest(t, "home", 2)
	defer tc2.Cleanup()

	// Make one user with two devices
	u, err := kbtest.CreateAndSignupFakeUser("t", tc.G)
	require.NoError(t, err)
	err = u.Login(tc.G)
	require.NoError(t, err)
	kbtest.ProvisionNewDeviceKex(&tc, &tc2, u, keybase1.DeviceTypeV2_DESKTOP)

	resolutions := []contacts.ContactResolution{{
		Description: "Jakob - (216) 555-2222",
		ResolvedUser: keybase1.User{
			Uid:      keybase1.UID(34),
			Username: "jakob223",
		},
	}}

	// Send resolution to server
	err = contacts.SendEncryptedContactResolutionToServer(tc.MetaContext(), resolutions)
	require.NoError(t, err)

	// Get people page from server as second device,
	// check it has the right contents
	h := NewHome(tc2.G)
	err = h.getToCache(tc2.MetaContext().Ctx(), false, 0, true)
	require.NoError(t, err)
	require.Len(t, h.homeCache.obj.Items, 3)
	item := h.homeCache.obj.Items[2].Data.People().Contact()
	require.Equal(t, resolutions[0].Description, item.Description)
	require.Equal(t, resolutions[0].ResolvedUser.Username, item.Username)
}
