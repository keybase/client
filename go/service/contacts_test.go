package service

import (
	"testing"
	"time"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
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
	user            *kbtest.FakeUser

	contactsCache *contacts.CachedContactsProvider
}

func setupContactSyncTest(t *testing.T) (tc libkb.TestContext, test contactSyncTest) {
	tc = libkb.SetupTest(t, "contacts", 3)
	tc.G.SyncedContactList = contacts.NewSavedContactsStore(tc.G)

	user, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
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
		user:            user,
		contactsCache:   contactsProv,
	}
}

func (c *contactSyncTest) clearCache(mctx libkb.MetaContext) error {
	return c.contactsCache.Store.ClearCache(mctx)
}

func TestContactSyncAndSearch(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	clock := clockwork.NewFakeClock()
	tc.G.SetClock(clock)

	all.searchMock.addUser(testAddUserArg{username: "alice2"})

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222332"),
		),
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
			contacts.MakeEmailComponent("email", "alice@example.org"),
		),
	}

	// Phone component from rawContacts will resolve to user `alice` but e-mail
	// will not. We are expecting to be able to search for both, but not see
	// both in user recommendations.

	_, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	// bust cache, new resolution should be returned
	clock.Advance(72 * time.Hour)
	all.contactsMock.PhoneNumbers["+48111222332"] = contacts.MakeMockLookupUser("alice", "")
	all.contactsMock.PhoneNumbers["+48111222333"] = contacts.MakeMockLookupUser("alice", "")
	result, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	newlyResolved := result.NewlyResolved
	// We should only have 1 resolved, since we dedupe.
	require.Len(t, newlyResolved, 1)
	require.Equal(t, newlyResolved[0].ContactName, "Alice A")
	require.Equal(t, newlyResolved[0].Username, "alice")
	require.Equal(t, newlyResolved[0].Assertion, "48111222333@phone")

	{
		// Try raw contact list lookup.
		list, err := all.contactsHandler.LookupSavedContactsList(context.Background(), 0)
		require.NoError(t, err)
		// We have two contacts with three components between them
		require.Len(t, list, 3)
	}

	{
		// We expect one "Alice A" show up as resolved. She should be the second one.
		list, err := all.contactsHandler.GetContactsForUserRecommendations(context.Background(), 0)
		require.NoError(t, err)
		require.Len(t, list, 1)
		require.Equal(t, "alice", list[0].DisplayName)
		require.Equal(t, "Alice A", list[0].DisplayLabel)
		require.Equal(t, "alice", list[0].Username)
		require.NotNil(t, list[0].Component.PhoneNumber)
		require.Equal(t, "48111222332@phone", list[0].Assertion)
	}

	{
		// When searching for "alice" in contacts, contact comes first because
		// it's a better match than `alice2` user.

		// NOTE: This test is very unrealistic because contact resolves to user
		// `alice` but that user is not provided by mocked search provider. If
		// it was, Keybase result would have precedence, and the first result
		// would not be SBS contact result.
		res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "alice",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 2)
		pres := pluckAllSearchResultForTest(res)
		require.Equal(t, "48111222332@phone", pres[0].id)
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
		require.NotNil(t, res[0].Contact)
		pres := pluckSearchResultForTest(res[0])
		require.Equal(t, "48111222333@phone", pres.id)
		require.Equal(t, "alice", pres.displayName)
		require.Equal(t, "+48111222333", pres.displayLabel)

		res, err = all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "alice@example.org",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Contact)
		pres = pluckSearchResultForTest(res[0])
		require.Equal(t, "[alice@example.org]@email", pres.id)
		require.Equal(t, "Alice A", pres.displayName)
		require.Equal(t, "alice@example.org (email)", pres.displayLabel)
	}
}

func TestContactShouldFilterOutSelf(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	all.searchMock.addUser(testAddUserArg{username: "alice2"})

	all.contactsMock.PhoneNumbers["+1555222"] = contacts.MakeMockLookupUser(all.user.Username, "")

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
			contacts.MakeEmailComponent("email", "alice@example.org"),
		),
		contacts.MakeContact("Charlie",
			contacts.MakePhoneComponent("mobile", "+1555222"),
		),
	}

	_, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	list, err := all.contactsHandler.GetContactsForUserRecommendations(context.Background(), 0)
	require.NoError(t, err)
	require.Len(t, list, 2)
	for _, v := range list {
		// Only first contact entries should be there
		require.Equal(t, "Alice A", v.ContactName)
		require.Equal(t, 0, v.ContactIndex)
	}
}

func TestRecommendationsPreferEmail(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	all.contactsMock.PhoneNumbers["+48111222333"] = contacts.MakeMockLookupUser("alice", "")
	all.contactsMock.Emails["alice@example.org"] = contacts.MakeMockLookupUser("alice", "")

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
			contacts.MakeEmailComponent("email", "alice@example.org"),
		),
	}

	_, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	list, err := all.contactsHandler.GetContactsForUserRecommendations(context.Background(), 0)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.True(t, list[0].Resolved)
	require.Equal(t, "alice", list[0].Username)
	require.Equal(t, "[alice@example.org]@email", list[0].Assertion)
}

func TestDuplicateContactAssertions(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
		),
		contacts.MakeContact("Mom",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
		),
	}

	_, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	{
		// We expect to see both contacts here.
		res, err := all.contactsHandler.GetContactsForUserRecommendations(context.Background(), 0)
		require.NoError(t, err)
		require.Len(t, res, 2)
	}

	{
		// Same when searching
		res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "111",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 2)
	}

	{
		// Make the number resolvable, re-import contacts.
		all.contactsMock.PhoneNumbers["+48111222333"] = contacts.MakeMockLookupUser("alice", "A. Alice")

		require.NoError(t, all.clearCache(tc.MetaContext()))
		_, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
			Contacts: rawContacts,
		})
		require.NoError(t, err)
	}

	{
		// We expect to see only one result here. Second contact is filtered out
		// because of username deduplication.
		res, err := all.contactsHandler.GetContactsForUserRecommendations(context.Background(), 0)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, "alice", res[0].DisplayName)
		require.Equal(t, "Alice A", res[0].DisplayLabel)
		require.Equal(t, "48111222333@phone", res[0].Assertion)
	}

	{
		// Only one contact when searching as well
		res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "111",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
		pres := pluckSearchResultForTest(res[0])
		require.Equal(t, "48111222333@phone", pres.id)
		require.Equal(t, "alice", pres.displayName)
		// Selecting query match to display label is still at play here.
		require.Equal(t, "+48111222333", pres.displayLabel)
	}
}

func TestSyncContactsWithServiceSummary(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	aliceMock := contacts.MakeMockLookupUser("alice", "Alice Keybase")
	aliceMock.ServiceMap = make(libkb.UserServiceSummary)
	aliceMock.ServiceMap["rooter"] = "alice123"
	aliceMock.ServiceMap["twitter"] = "tacovontaco"

	all.contactsMock.Emails["alice@keyba.se"] = aliceMock
	all.contactsMock.Emails["bob@keyba.se"] = contacts.MakeMockLookupUser("bob", "Bob Keybase")

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice",
			contacts.MakeEmailComponent("email", "alice@keyba.se"),
		),
		contacts.MakeContact("Bob",
			contacts.MakeEmailComponent("email", "bob@keyba.se"),
		),
	}

	_, err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "keybase",
		Query:           "keyba.se",
		MaxResults:      50,
	})
	require.NoError(t, err)
	require.Len(t, res, 2)
	// Bob (no service map because provider returned no services)
	require.NotNil(t, res[0].Contact)
	require.Equal(t, "Bob", res[0].Contact.ContactName)
	require.Nil(t, res[0].Contact.ServiceMap)
	// Alice (with service map)
	require.NotNil(t, res[1].Contact)
	require.Equal(t, "Alice", res[1].Contact.ContactName)
	require.NotNil(t, res[1].Contact.ServiceMap)
	require.Len(t, res[1].Contact.ServiceMap, 2)
	require.Equal(t, "alice123", res[1].Contact.ServiceMap["rooter"])
	require.Equal(t, "tacovontaco", res[1].Contact.ServiceMap["twitter"])
}

func TestUserSearchPhoneEmailWithResults(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	all.contactsMock.Emails["fermatp@keyba.se"] = contacts.MakeMockLookupUser("pierre", "Pierre de Fermat")
	all.contactsMock.PhoneNumbers["+1555165432"] = contacts.MakeMockLookupUser("lwg", "Gottfried Wilhelm Leibniz")

	doSearch := func(service, query string) []keybase1.APIUserSearchResult {
		res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: false,
			Service:         service,
			Query:           query,
			MaxResults:      10,
		})
		require.NoError(t, err)
		return res
	}

	// Do imptofu queries such that they will resolve when looked up by
	// contacts provider.

	{
		query := "+1555165432"
		res := doSearch("phone", query)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Imptofu)
		require.Equal(t, "1555165432@phone", res[0].Imptofu.Assertion)
		require.Equal(t, "lwg", res[0].Imptofu.KeybaseUsername)
		require.Equal(t, "Gottfried Wilhelm Leibniz", res[0].Imptofu.PrettyName)
	}

	{
		query := "fermatp@keyba.se"
		res := doSearch("email", query)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Imptofu)
		require.Equal(t, "[fermatp@keyba.se]@email", res[0].Imptofu.Assertion)
		require.Equal(t, "pierre", res[0].Imptofu.KeybaseUsername)
		require.Equal(t, "Pierre de Fermat", res[0].Imptofu.PrettyName)
	}
}
