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

func TestContactSyncing(t *testing.T) {
	tc, all := setupContactSyncTest(t)
	defer tc.Cleanup()

	all.contactsMock.PhoneNumbers["+48111222333"] = contacts.MakeMockLookupUser("alice", "")

	rawContacts := []keybase1.Contact{
		contacts.MakeContact("Alice A",
			contacts.MakePhoneComponent("mobile", "+48111222333"),
			contacts.MakeEmailComponent("email", "alice@example.org"),
		),
	}

	all.searchMock.addUser(testAddUserArg{username: "alice2"})

	err := all.contactsHandler.SaveContactList(context.Background(), keybase1.SaveContactListArg{
		Contacts: rawContacts,
	})
	require.NoError(t, err)

	list, err := all.contactsHandler.LookupSavedContactsList(context.Background(), 0)
	require.NoError(t, err)
	// Len == 1 right now because of contacts deduplicating during sync which we are changing.
	require.Len(t, list, 1)

	res, err := all.searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "keybase",
		Query:           "alice",
		MaxResults:      50,
	})
	require.NoError(t, err)
	require.Len(t, res, 2)
}
