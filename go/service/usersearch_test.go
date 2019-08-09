// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

type emptyUserSearchProvider struct{}

func (*emptyUserSearchProvider) MakeSearchRequest(mctx libkb.MetaContext, arg keybase1.UserSearchArg) ([]keybase1.APIUserSearchResult, error) {
	return nil, nil
}

type searchResultForTest struct {
	id              string
	displayName     string
	displayLabel    string
	keybaseUsername string
}

// pluckSearchResultForTest normalizes APIUserSearchResult data for making test
// assertion code simpler.
func pluckSearchResultForTest(apiRes keybase1.APIUserSearchResult) searchResultForTest {
	// TODO: For Y2K-310, usersearch handler will just return data like this,
	// so this kind of normalization will not be needed.
	switch {
	case apiRes.Service != nil:
		// Logic from shared/constants/team-building.tsx
		var keybaseUsername string
		var id string
		label := apiRes.Service.FullName
		if apiRes.Keybase != nil {
			keybaseUsername = apiRes.Keybase.Username
			id = keybaseUsername
			if label == "" {
				if apiRes.Keybase.FullName != nil {
					label = *apiRes.Keybase.FullName
				} else {
					label = keybaseUsername
				}
			}
		} else {
			id = fmt.Sprintf("%s@%s", apiRes.Service.Username, apiRes.Service.ServiceName)
		}
		return searchResultForTest{
			id:              id,
			displayName:     apiRes.Service.Username,
			displayLabel:    label,
			keybaseUsername: keybaseUsername,
		}
	case apiRes.Contact != nil:
		return searchResultForTest{
			id:              apiRes.Contact.Assertion,
			displayName:     apiRes.Contact.DisplayName,
			displayLabel:    apiRes.Contact.DisplayLabel,
			keybaseUsername: apiRes.Contact.Username,
		}
	case apiRes.Imptofu != nil:
		return searchResultForTest{
			id:              apiRes.Imptofu.Assertion,
			displayName:     apiRes.Imptofu.PrettyName,
			displayLabel:    apiRes.Imptofu.Label,
			keybaseUsername: apiRes.Imptofu.KeybaseUsername,
		}
	case apiRes.Keybase != nil:
		var fullName string
		if apiRes.Keybase.FullName != nil {
			fullName = *apiRes.Keybase.FullName
		}
		return searchResultForTest{
			id:              apiRes.Keybase.Username,
			displayName:     apiRes.Keybase.Username,
			displayLabel:    fullName,
			keybaseUsername: apiRes.Keybase.Username,
		}
	default:
		panic("unexpected APIUserSearchResult for pluckSearchResultForTest")
	}
}

func pluckAllSearchResultForTest(apiRes []keybase1.APIUserSearchResult) (res []searchResultForTest) {
	res = make([]searchResultForTest, len(apiRes))
	for i, v := range apiRes {
		res[i] = pluckSearchResultForTest(v)
	}
	return res
}

type makeContactArg struct {
	index int

	name  string
	label string
	phone string
	email string

	// if resolved
	username  string
	fullname  string
	following bool
}

func makeContact(arg makeContactArg) (res keybase1.ProcessedContact) {
	res.ContactIndex = arg.index
	res.ContactName = arg.name
	res.Component.Label = arg.label
	var componentValue string
	if arg.phone != "" {
		componentValue = arg.phone
		phone := keybase1.RawPhoneNumber(arg.phone)
		res.Component.PhoneNumber = &phone
		res.Assertion = fmt.Sprintf("%s@phone", strings.TrimLeft(componentValue, "+"))
	} else if arg.email != "" {
		componentValue = arg.email
		email := keybase1.EmailAddress(arg.email)
		res.Component.Email = &email
		res.Assertion = fmt.Sprintf("[%s]@email", componentValue)
	}
	if arg.username != "" {
		res.Username = arg.username
		res.Uid = libkb.UsernameToUID(arg.username)
		res.Resolved = true
		res.Following = arg.following
	}
	// Emulate contact sync display name/label generation. Will not be needed
	// once Y2K-310 is done where we move all that logic to usersearch.
	if arg.username != "" {
		res.DisplayName = arg.username
		if arg.following && arg.fullname != "" {
			res.DisplayLabel = arg.fullname
		} else if arg.name != "" {
			res.DisplayLabel = arg.name
		} else {
			res.DisplayLabel = componentValue
		}
	} else {
		res.DisplayName = arg.name
		if arg.label != "" {
			res.DisplayLabel = fmt.Sprintf("%s (%s)", componentValue, arg.label)
		} else {
			res.DisplayLabel = componentValue
		}
	}
	return res
}

func stringifyAPIResult(list []keybase1.APIUserSearchResult) (res []string) {
	res = make([]string, 0, len(list))
	for _, v := range list {
		if v.Contact != nil {
			res = append(res, fmt.Sprintf("%s,%s", v.Contact.DisplayName, v.Contact.DisplayLabel))
		}
	}
	return res
}

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
	keybase1.RegionCode) (res contacts.ContactLookupResults, err error) {
	return res, errors.New("unexpected errorContactsProvider call")
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

func TestContactSearch(t *testing.T) {
	tc := libkb.SetupTest(t, "contacts", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{index: 0, name: "Test Contact 1", username: "tuser1"}),
		makeContact(makeContactArg{index: 1, name: "Office Building", phone: "+1123"}),
		makeContact(makeContactArg{index: 2, name: "Michal", username: "michal"}),
		makeContact(makeContactArg{index: 3, name: "TEST", phone: "+1555123456"}),
	}

	contactsProv := NewCachedContactsProvider(tc.G)
	savedStore := contacts.NewSavedContactsStore(tc.G)
	err = savedStore.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)
	tc.G.SyncedContactList = savedStore

	searchHandler := NewUserSearchHandler(nil, tc.G, contactsProv)
	searchHandler.searchProvider = &emptyUserSearchProvider{}

	res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "",
		Query:           "",
	})
	require.NoError(t, err)
	require.Empty(t, res)

	res, err = searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "keybase",
		Query:           "test",
		MaxResults:      50,
	})
	require.NoError(t, err)
	require.Len(t, res, 2)
	strList := stringifyAPIResult(res)
	require.Contains(t, strList, "TEST,+1555123456")
	require.Contains(t, strList, "tuser1,Test Contact 1")

	res, err = searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "",
		Query:           "building",
	})
	require.NoError(t, err)
	require.Len(t, res, 1)
	strList = stringifyAPIResult(res)
	require.Contains(t, strList, "Office Building,+1123")
}

func TestContactSearchWide(t *testing.T) {
	tc := libkb.SetupTest(t, "contacts", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{name: "Test Contact 1", username: "tuser1"}),
		makeContact(makeContactArg{name: "🍱🍜🍪 Lunch", phone: "+48123"}),
		makeContact(makeContactArg{name: "Michal", username: "michal"}),
		makeContact(makeContactArg{name: "高橋幸治", phone: "+81123456555"}),
	}

	contactsProv := NewCachedContactsProvider(tc.G)
	savedStore := contacts.NewSavedContactsStore(tc.G)
	err = savedStore.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)
	tc.G.SyncedContactList = savedStore

	searchHandler := NewUserSearchHandler(nil, tc.G, contactsProv)
	searchHandler.searchProvider = &emptyUserSearchProvider{}

	res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "",
		Query:           "高橋",
	})
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "高橋幸治", res[0].Contact.DisplayName)

	for _, v := range []string{"🍜", "🍱", "lunch"} {
		res, err = searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "",
			Query:           v,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Equal(t, "🍱🍜🍪 Lunch", res[0].Contact.DisplayName)
	}
}

func TestUserSearchResolvedUsersShouldGoFirst(t *testing.T) {
	tc, searchHandler, searchProv := setupUserSearchTest(t)
	defer tc.Cleanup()

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{index: 0, name: "TEST", phone: "+1555123456"}),
		makeContact(makeContactArg{index: 1, name: "Michal", email: "michal@example.com", username: "michal"}),
		makeContact(makeContactArg{index: 2, name: "Test Contact 1", phone: "+1555165432", username: "tuser1", fullname: "Test User 123"}),
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

	// If we have a username match coming from the service, prefer it instead
	// of contact result for the same user but with SBS assertion in it.
	res, err = searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "keybase",
		Query:           "tuser",
		MaxResults:      50,
	})
	require.Equal(t, searchResultForTest{
		id:              "tuser1",
		displayName:     "tuser1",
		displayLabel:    "Test User 123",
		keybaseUsername: "tuser1",
	}, pluckSearchResultForTest(res[0]))
}

func TestSearchContactDeduplicateNameAndLabel(t *testing.T) {
	tc, searchHandler, _ := setupUserSearchTest(t)
	defer tc.Cleanup()

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{index: 0, name: "Alice", email: "a@example.org", username: "alice"}),
		makeContact(makeContactArg{index: 1, name: "Mary Elizabeth Smith", email: "smith@example.com", username: "keybasetester"}),
		makeContact(makeContactArg{index: 2, name: "Mary Elizabeth Smith", email: "mary.smith@example.com", username: "keybasetester"}),
		makeContact(makeContactArg{index: 3, name: "Mary Elizabeth Smith", phone: "+1555123456", username: "keybasetester"}),
	}

	err := tc.G.SyncedContactList.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)

	{
		// Best match here is `smith@example.com` and we expect to see only that
		// because they all resolve to same user.
		res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "smith",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Contact)
		require.Equal(t, "[smith@example.com]@email", res[0].Contact.Assertion)
	}

	{
		// But others are still findable
		res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "555123456",
			MaxResults:      50,
		})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.NotNil(t, res[0].Contact)
		require.Equal(t, "1555123456@phone", res[0].Contact.Assertion)
	}
}

func TestContactSearchMixing(t *testing.T) {
	tc, searchHandler, searchProv := setupUserSearchTest(t)
	defer tc.Cleanup()

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{index: 0, name: "Isaac Newton", phone: "+1555123456"}),
		makeContact(makeContactArg{index: 1, name: "Pierre de Fermat", email: "fermatp@keyba.se", username: "pierre"}),
		makeContact(makeContactArg{index: 2, name: "Gottfried Wilhelm Leibniz", phone: "+1555165432"}),
	}

	searchProv.addUser(testAddUserArg{username: "pierre"}) // the one we have in contacts
	for i := 0; i < 5; i++ {
		searchProv.addUser(testAddUserArg{fmt.Sprintf("isaac%d", i), fmt.Sprintf("The Isaac %d", i)})
		// Longer names score lower
		searchProv.addUser(testAddUserArg{fmt.Sprintf("isaac_____%d", i), fmt.Sprintf("The Isaac %d", i)})
		searchProv.addUser(testAddUserArg{fmt.Sprintf("isaacsxzzz%d", i), fmt.Sprintf("The Isaac %d", i)})
	}

	err := tc.G.SyncedContactList.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)

	{
		// Expecting to see our contact within the results. All the `isaacX`
		// users will score higher than our contact, so it will come 6th on the
		// list.
		res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           "isaac",
			MaxResults:      10,
		})
		require.NoError(t, err)
		require.Len(t, res, 10)
		require.NotNil(t, res[5].Contact)
		require.Equal(t, "1555123456@phone", res[5].Contact.Assertion)
		require.Equal(t, "Isaac Newton", res[5].Contact.DisplayName)
	}
}

func TestUserSearchDirectTofu(t *testing.T) {
	tc, searchHandler, _ := setupUserSearchTest(t)
	defer tc.Cleanup()

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{index: 1, name: "Pierre de Fermat", email: "fermatp@keyba.se", username: "pierre"}),
		makeContact(makeContactArg{index: 2, name: "Gottfried Wilhelm Leibniz", phone: "+1555165432", username: "lwg"}),
	}

	err := tc.G.SyncedContactList.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)

	doSearch := func(query string, tofu keybase1.ImpTofuQuery) []keybase1.APIUserSearchResult {
		res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
			IncludeContacts: true,
			Service:         "keybase",
			Query:           query,
			ImpTofuQuery:    &tofu,
			MaxResults:      10,
		})
		require.NoError(t, err)
		return res
	}

	{
		// Even though we are doing an imp tofu query, we should get our contact back.
		query := "+1555165432"
		tofu := keybase1.NewImpTofuQueryWithPhone(keybase1.PhoneNumber(query))
		res := doSearch(query, tofu)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Imptofu)
		require.NotNil(t, res[0].Contact)
		require.Equal(t, "Gottfried Wilhelm Leibniz", res[0].Contact.ContactName)
		require.Equal(t, "1555165432@phone", res[0].Contact.Assertion)
	}

	{
		// Same with e-mail.
		query := "fermatp@keyba.se"
		tofu := keybase1.NewImpTofuQueryWithEmail(keybase1.EmailAddress(query))
		res := doSearch(query, tofu)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Imptofu)
		require.NotNil(t, res[0].Contact)
		require.Equal(t, "Pierre de Fermat", res[0].Contact.ContactName)
		require.Equal(t, "[fermatp@keyba.se]@email", res[0].Contact.Assertion)
	}

	{
		// Ask for a different number and get an imptofu result.
		query := "+1201555201"
		tofu := keybase1.NewImpTofuQueryWithPhone(keybase1.PhoneNumber(query))
		res := doSearch(query, tofu)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Contact)
		require.NotNil(t, res[0].Imptofu)
		require.Empty(t, res[0].Imptofu.KeybaseUsername)
		require.Equal(t, "1201555201@phone", res[0].Imptofu.Assertion)
		require.Equal(t, "+1201555201", res[0].Imptofu.PrettyName)
		require.Empty(t, res[0].Imptofu.Label)
	}

	{
		// Imp tofu email.
		query := "test@keyba.se"
		tofu := keybase1.NewImpTofuQueryWithEmail(keybase1.EmailAddress(query))
		res := doSearch(query, tofu)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Contact)
		require.NotNil(t, res[0].Imptofu)
		require.Empty(t, res[0].Imptofu.KeybaseUsername)
		require.Equal(t, "[test@keyba.se]@email", res[0].Imptofu.Assertion)
		require.Equal(t, "test@keyba.se", res[0].Imptofu.PrettyName)
		require.Empty(t, res[0].Imptofu.Label)
	}

	{
		// Email should be lowercased when returning search result.
		query := "TEST@keyba.se"
		tofu := keybase1.NewImpTofuQueryWithEmail(keybase1.EmailAddress(query))
		res := doSearch(query, tofu)
		require.Len(t, res, 1)
		require.Nil(t, res[0].Contact)
		require.NotNil(t, res[0].Imptofu)
		require.Empty(t, res[0].Imptofu.KeybaseUsername)
		require.Equal(t, "[test@keyba.se]@email", res[0].Imptofu.Assertion)
		require.Equal(t, "TEST@keyba.se", res[0].Imptofu.PrettyName)
		require.Empty(t, res[0].Imptofu.Label)
	}
}
