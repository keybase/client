package service

import (
	"testing"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// Test "end-to-end" syncing contact (by using SaveContactList RPC with raw
// contact list) and interacting with it using UserSearch RPCs.

// Mock contact provider.

type contactSyncTest struct {
	searchHandler   *UserSearchHandler
	contactsHandler *ContactsHandler
	contactsMock    *contacts.MockContactsProvider
	searchMock      *testUserSearchProvider
}

func setupContactSyncTest(t *testing.T) (tc libkb.TestContext, test contactSyncTest) {
	tc = libkb.SetupTest(t, "contacts", 3)
	tc.G.SyncedContactList = contacts.NewSavedContactsStore(tc.G)

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	mockContactsProv := contacts.MakeMockProvider(t)
	contactsProv := &contacts.CachedContactsProvider{
		Provider: mockContactsProv,
		Store:    contacts.NewContactCacheStore(tc.G),
	}
	searchHandler := NewUserSearchHandler(nil, tc.G, contactsProv)
	searchProv := &testUserSearchProvider{T: t}
	searchHandler.searchProvider = searchProv

	contactsHandler := NewContactsHandler(nil, tc.G, contactsProv)
	return tc, contactSyncTest{
		searchHandler:   searchHandler,
		contactsHandler: contactsHandler,
		contactsMock:    mockContactsProv,
		searchMock:      searchProv,
	}
}

func TestContactSyncAndSearch(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	all.searchMock.addUser(testAddUserArg{username: "alice2"})

	all.contactsMock.PhoneNumbers["+48111222333"] = contacts.MakeMockLookupUser("alice", "")

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
			contacts.MakeEmailComponent("email", "alice@example.org"),
		),
	}

	// Phone component from rawContacts will resolve to user `alice` but e-mail
	// will not. We are expecting to be able to search for both, but not see
	// both in user recommendations.

	err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	{
		// Try raw contact list lookup.
		list, err := all.contactsHandler.LookupSavedContactsList(context.Background(), 0)
		require.NoError(t, err)
		// We have one contact with two components
		require.Len(t, list, 2)
	}

	{
		// We expect "Alice A" contact to only show up as only the resolved
		// component
		list, err := all.contactsHandler.GetContactsForUserRecommendations(context.Background(), 0)
		require.NoError(t, err)
		require.Len(t, list, 1)
		require.Equal(t, "alice", list[0].DisplayName)
		require.Equal(t, "Alice A", list[0].DisplayLabel)
		require.Equal(t, "alice", list[0].Username)
		require.NotNil(t, list[0].Component.PhoneNumber)
		require.Equal(t, "48111222333@phone", list[0].Assertion)
	}

	{
		// When searching for "alice" in contacts, it should skip the
		// unresolved contact because other one is resolved.
		res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "alice",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 2)
		pres := pluckAllSearchResultForTest(res)
		require.Equal(t, "48111222333@phone", pres[0].id)
		require.Equal(t, "alice", pres[0].keybaseUsername)
		require.Equal(t, "alice2", pres[1].id)
		require.Equal(t, "alice2", pres[1].keybaseUsername)
	}

	{
		// Should be possible to search for both alice's components - as long a
		// search don't yield both at the same time, then it's handled like in
		// the previous case.
		res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "111222333",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)

		res, err = all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "alice@example.org",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
	}
}
