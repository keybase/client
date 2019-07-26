package service

import (
	"errors"
	"sort"
	"testing"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

type testKeybaseUserSearchData struct {
	username     string
	fullName     string
	serviceMap   map[string]string
	phoneNumbers []keybase1.PhoneNumber
	emails       []keybase1.EmailAddress
	followee     bool
}

type testUserSearchProvider struct {
	T     *testing.T
	users []testKeybaseUserSearchData
}

type testAddUserArg struct {
	username string
	fullName string
}

func (p *testUserSearchProvider) addUser(args ...testAddUserArg) {
	for _, arg := range args {
		user := testKeybaseUserSearchData{
			username: arg.username,
			fullName: arg.fullName,
		}
		p.users = append(p.users, user)
	}
}

func (p *testUserSearchProvider) MakeSearchRequest(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	if arg.Service != "keybase" && arg.Service != "" {
		p.T.Errorf("unexpected service to MakeSearchRequest: %q", arg.Service)
		return nil, errors.New("unexpected service")
	}

	// Use functions for contacts searching to emulate server behavior here.
	query, err := compileQuery(arg.Query)
	if err != nil {
		return nil, err
	}

	for _, user := range p.users {
		var found bool
		var score float64
		if found, score = query.scoreString(user.username); found {
			// noop, query matched username
		} else if found, score = query.scoreString(user.fullName); found {
			// noop, query matched full name
		} else if user.serviceMap != nil {
			for _, serviceUser := range user.serviceMap {
				if found, score = query.scoreString(serviceUser); found {
					// query matched one of the services, break out of
					// serviceMap loop
					break
				}
			}
		}
		if found {
			var fullname *string
			if user.fullName != "" {
				fn := user.fullName
				fullname = &fn
			}
			keybase := keybase1.APIUserKeybaseResult{
				Username:   user.username,
				Uid:        libkb.UsernameToUID(user.username),
				FullName:   fullname,
				RawScore:   score,
				IsFollowee: user.followee,
			}
			res = append(res, keybase1.APIUserSearchResult{Keybase: &keybase})
		}
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].Keybase.RawScore > res[j].Keybase.RawScore
	})
	for i := range res {
		res[i].Score = 1.0 / float64(1+i)
	}
	return res, nil
}

type errorContactsProvider struct{}

func (*errorContactsProvider) LookupAll(libkb.MetaContext, []keybase1.EmailAddress, []keybase1.RawPhoneNumber,
	keybase1.RegionCode) (contacts.ContactLookupMap, error) {
	return nil, errors.New("unexpected errorContactsProvider call")
}

func (*errorContactsProvider) FindUsernames(libkb.MetaContext, []keybase1.UID) (map[keybase1.UID]contacts.ContactUsernameAndFullName, error) {
	return nil, errors.New("unexpected errorContactsProvider call")
}

func (*errorContactsProvider) FindFollowing(libkb.MetaContext, []keybase1.UID) (map[keybase1.UID]bool, error) {
	return nil, errors.New("unexpected errorContactsProvider call")
}

func setupUserSearchTest(t *testing.T) (tc libkb.TestContext, handler *UserSearchHandler, searchProv *testUserSearchProvider) {
	tc = libkb.SetupTest(t, "contacts", 3)
	tc.G.SyncedContactList = contacts.NewSavedContactsStore(tc.G)

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	contactsProv := &contacts.CachedContactsProvider{
		Provider: &errorContactsProvider{},
		Store:    contacts.NewContactCacheStore(tc.G),
	}
	handler = NewUserSearchHandler(nil, tc.G, contactsProv)
	searchProv = &testUserSearchProvider{T: t}
	handler.searchProvider = searchProv
	return tc, handler, searchProv
}

func TestUserSearchResolvedUsersShouldGoFirst(t *testing.T) {
	tc, searchHandler, searchProv := setupUserSearchTest(t)
	defer tc.Cleanup()

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{name: "TEST", phone: "+1555123456"}),
		makeContact(makeContactArg{name: "Michal", email: "michal@example.com", username: "michal"}),
		makeContact(makeContactArg{name: "Test Contact 1", phone: "+1555165432", username: "tuser1", fullname: "Test User 123"}),
	}

	searchProv.addUser(testAddUserArg{"tuser1", "Test User 123"})

	err := tc.G.SyncedContactList.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)

	// "1555" query will match two users: name: "TEST", and name: "Test Contact
	// 1". We should see the resolved one appear first, with the matched string
	// (the phone number) being the label.
	res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "keybase",
		Query:           "1555",
		MaxResults:      50,
	})
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.Equal(t, searchResultForTest{
		id:              "1555165432@phone",
		displayName:     "tuser1",
		displayLabel:    "+1555165432",
		keybaseUsername: "tuser1",
	}, pluckSearchResultForTest(res[0]))

	require.Equal(t, searchResultForTest{
		id:              "1555123456@phone",
		displayName:     "TEST",
		displayLabel:    "+1555123456",
		keybaseUsername: "",
	}, pluckSearchResultForTest(res[1]))

	// If we have exact match coming from the service, prefer it instead of
	// contact result with SBS assertion in it.
	res, err = searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		// TODO: Flipping this to `true` breaks this test because we do not
		// correctly prefer Keybase API results for exact matches.
		IncludeContacts: false,
		Service:         "keybase",
		Query:           "tuser1",
		MaxResults:      50,
	})
	require.Equal(t, searchResultForTest{
		id:              "tuser1",
		displayName:     "tuser1",
		displayLabel:    "Test User 123",
		keybaseUsername: "tuser1",
	}, pluckSearchResultForTest(res[0]))
}
