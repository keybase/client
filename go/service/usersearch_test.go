// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"strings"
	"testing"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

// This file has mostly user search (also called "people search" in some
// places) test scaffolding. See usersearch_tests_test.go for more testing.

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

type makeContactArg struct {
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

func TestContactSearch(t *testing.T) {
	tc := libkb.SetupTest(t, "contacts", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{name: "Test Contact 1", username: "tuser1"}),
		makeContact(makeContactArg{name: "Office Building", phone: "+1123"}),
		makeContact(makeContactArg{name: "Michal", username: "michal"}),
		makeContact(makeContactArg{name: "TEST", phone: "+1555123456"}),
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
