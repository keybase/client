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

	savedStore := contacts.NewSavedContactsStore(tc.G)
	err = savedStore.SaveProcessedContacts(tc.MetaContext(), contactlist)
	require.NoError(t, err)

	searchHandler := NewUserSearchHandler(nil, tc.G, savedStore)
	res, err := searchHandler.UserSearch(context.Background(), keybase1.UserSearchArg{
		IncludeContacts: true,
		Service:         "",
		Query:           "test",
	})
	require.NoError(t, err)
	require.Len(t, res, 2)
	strList := stringifyAPIResult(res)
	require.Contains(t, strList, "TEST,+1555123456")
	require.Contains(t, strList, "Test Contact 1,")
}
