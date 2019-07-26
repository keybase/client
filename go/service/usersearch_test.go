// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

type makeContactArg struct {
	N         string // name
	L         string // label
	username  string // will make a resolved contact
	assertion string
	following bool
}

func makeContact(arg makeContactArg) (res keybase1.ProcessedContact) {
	res.DisplayName = arg.N
	res.DisplayLabel = arg.L
	res.Assertion = arg.assertion
	if arg.username != "" {
		res.Username = arg.username
		res.Uid = libkb.UsernameToUID(arg.username)
		res.Resolved = true
		res.Following = arg.following
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
		makeContact(makeContactArg{N: "Test Contact 1", username: "tuser1"}),
		makeContact(makeContactArg{N: "Office Building", assertion: "123@phone"}),
		makeContact(makeContactArg{N: "Michal", L: "michal", username: "michal"}),
		makeContact(makeContactArg{N: "TEST", L: "+1555123456", assertion: "1555123456@phone"}),
	}

	contactsProv := NewCachedContactsProvider(tc.G)
	savedStore := contacts.NewSavedContactsStore(tc.G)
	err = savedStore.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)
	tc.G.SyncedContactList = savedStore

	searchHandler := NewUserSearchHandler(nil, tc.G, contactsProv)
	tc.G.TestOptions.DisableUserSearchSocialServices = true

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
	require.Contains(t, strList, "Test Contact 1,")

	res, err = searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "",
		Query:           "building",
	})
	require.NoError(t, err)
	require.Len(t, res, 1)
	strList = stringifyAPIResult(res)
	require.Contains(t, strList, "Office Building,")
}

func TestContactSearchWide(t *testing.T) {
	tc := libkb.SetupTest(t, "contacts", 3)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("lmu", tc.G)
	require.NoError(t, err)

	contactlist := []keybase1.ProcessedContact{
		makeContact(makeContactArg{N: "Test Contact 1", username: "tuser1"}),
		makeContact(makeContactArg{N: "🍱🍜🍪 Lunch", assertion: "48123@phone"}),
		makeContact(makeContactArg{N: "Michal", L: "michal", username: "michal"}),
		makeContact(makeContactArg{N: "高橋幸治", L: "+81123456555", assertion: "81123456555@phone"}),
	}

	contactsProv := NewCachedContactsProvider(tc.G)
	savedStore := contacts.NewSavedContactsStore(tc.G)
	err = savedStore.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)
	tc.G.SyncedContactList = savedStore

	searchHandler := NewUserSearchHandler(nil, tc.G, contactsProv)
	tc.G.TestOptions.DisableUserSearchSocialServices = true

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
