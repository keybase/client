// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"context"
	"fmt"
	"testing"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func stringifyResults(res []keybase1.ProcessedContact) (ret []string) {
	ret = make([]string, len(res))
	for i, r := range res {
		if r.Resolved {
			ret[i] = fmt.Sprintf("keybase:%s", r.Username)
		} else {
			var phoneOrEmail string
			if r.Component.PhoneNumber != nil {
				phoneOrEmail = string(*r.Component.PhoneNumber)
			} else if r.Component.Email != nil {
				phoneOrEmail = string(*r.Component.Email)
			}
			ret[i] = fmt.Sprintf("%s %s (%s)", r.DisplayName, phoneOrEmail, r.Component.Label)
		}
	}
	return ret
}

func displayResults(res []keybase1.ProcessedContact) (ret []string) {
	ret = make([]string, len(res))
	for i, v := range res {
		ret[i] = fmt.Sprintf("%q %q", v.DisplayName, v.DisplayLabel)
	}
	return ret
}

func TestLookupEmptyList(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	provider := &ErrorContactsProvider{t}
	contactList := []keybase1.Contact{}

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 0)
}

func TestLookupContacts(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		{
			Name: "Joe",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("Home", "+1111222"),
				MakePhoneComponent("Work", "+199123"),
				MakeEmailComponent("E-mail", "joe@linux.org"),
			},
		},
	}

	provider := MakeMockProvider(t)

	actx := externals.MakeStaticAssertionContext(context.Background())

	// None of the contact components resolved (empty mock provider). Return all
	// 3 unresolved components to the caller.
	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	for i, r := range res {
		require.Equal(t, "Joe", r.DisplayName)
		require.False(t, r.Resolved)
		require.True(t, r.Uid.IsNil())
		component := contactList[0].Components[i]
		assertion, err := AssertionFromComponent(actx, component, "")
		require.NoError(t, err)
		require.Equal(t, assertion, r.Assertion)
	}

	// Phone number component will not resolve. Still save all 3 components.
	mockJoe := MakeMockLookupUser("joe", "JOE")
	provider.PhoneNumbers["+1111222"] = mockJoe

	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	require.True(t, res[0].Resolved)
	require.NotNil(t, res[0].Component.PhoneNumber)
	require.Equal(t, "1111222@phone", res[0].Assertion)
	for i, v := range res {
		if i != 0 {
			require.False(t, v.Resolved)
			require.Equal(t, "Joe", v.DisplayName)
			assertion, err := AssertionFromComponent(actx, v.Component, "")
			require.NoError(t, err)
			require.Equal(t, assertion, v.Assertion)
		}
	}

	// Second number also belongs to joe now. Still save all entries.
	provider.PhoneNumbers["+199123"] = mockJoe
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	for i, v := range res {
		if i == 2 {
			require.False(t, v.Resolved)
			require.Equal(t, "Joe", v.DisplayName)
			assertion, err := AssertionFromComponent(actx, v.Component, "")
			require.NoError(t, err)
			require.Equal(t, assertion, v.Assertion)
		}
	}

	// Suddenly this number resolves to someone else, despite being in same contact.
	provider.PhoneNumbers["+199123"] = MakeMockLookupUser("ed", "")
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	require.Equal(t, []string{
		"keybase:joe",
		"keybase:ed",
		"Joe joe@linux.org (E-mail)",
	}, stringifyResults(res))
	// Even if contact resolves to a Keybase user, assertion should still be an
	// imptofu assertion (rather than username or username@keybase). This is
	// required, so resolver is involved when starting a conversation.
	require.Equal(t, "1111222@phone", res[0].Assertion)
	require.Equal(t, "199123@phone", res[1].Assertion)
	require.Equal(t, "[joe@linux.org]@email", res[2].Assertion)

	// Test with email
	provider = MakeMockProvider(t) // *new provider*
	provider.Emails["joe@linux.org"] = mockJoe
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	// Only last component (the one with email) resolves, rest is unresolved.
	for i, v := range res {
		if i != 2 {
			require.False(t, v.Resolved)
			require.Equal(t, "Joe", v.DisplayName)
			assertion, err := AssertionFromComponent(actx, v.Component, "")
			require.NoError(t, err)
			require.Equal(t, assertion, v.Assertion)
		}
	}
	require.Equal(t, "joe", res[2].DisplayName)
	require.Equal(t, "E-mail", res[2].Component.Label)
	require.Nil(t, res[2].Component.PhoneNumber)
	require.NotNil(t, res[2].Component.Email)
	require.EqualValues(t, "joe@linux.org", *res[2].Component.Email)
	require.True(t, res[2].Resolved)
	require.Equal(t, mockJoe.UID, res[2].Uid)
}

func TestLookupContactsMultipleUsers(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("Home", "+1111222"),
				MakePhoneComponent("Work", "+199123"),
			},
		},
		{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("Home", "+123456"),
			},
		},
		{
			Name: "Charlie",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("E-mail", "charlie+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected := []string{
		"Alice +1111222 (Home)",
		"Alice +199123 (Work)",
		"Bob +123456 (Home)",
		"Charlie charlie+test@keyba.se (E-mail)",
	}
	require.Equal(t, expected, stringifyResults(res))

	provider.PhoneNumbers["+123456"] = MakeMockLookupUser("bob", "")
	provider.Emails["charlie+test@keyba.se"] = MakeMockLookupUser("charlie", "")

	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected = []string{
		"Alice +1111222 (Home)",
		"Alice +199123 (Work)",
		"keybase:bob",
		"keybase:charlie",
	}
	require.Equal(t, expected, stringifyResults(res))
	expected = []string{
		`"Alice" "+1111222 (Home)"`,
		`"Alice" "+199123 (Work)"`,
		`"bob" "Bob"`,
		`"charlie" "Charlie"`,
	}
	require.Equal(t, expected, displayResults(res))

	require.Equal(t, "1111222@phone", res[0].Assertion)
	require.Equal(t, "199123@phone", res[1].Assertion)
	require.Equal(t, "123456@phone", res[2].Assertion)
	require.Equal(t, "[charlie+test@keyba.se]@email", res[3].Assertion)
}

func TestEmptyComponentLabels(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("", "+1111222"),
				MakeEmailComponent("", "alice+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected := []string{
		"Alice +1111222 ()",
		"Alice alice+test@keyba.se ()",
	}
	require.Equal(t, expected, stringifyResults(res))
	expected = []string{
		`"Alice" "+1111222"`,
		`"Alice" "alice+test@keyba.se"`,
	}
	require.Equal(t, expected, displayResults(res))

	provider.Emails["alice+test@keyba.se"] = MockLookupUser{UID: keybase1.UID("1111"), Username: "alice", Fullname: "A L I C E"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 2)
	// First component did not resolve
	require.False(t, res[0].Resolved)
	require.Equal(t, "1111222@phone", res[0].Assertion)
	// Second component resolved
	require.True(t, res[1].Resolved)
	require.Equal(t, "alice", res[1].Username)
	require.Equal(t, "A L I C E", res[1].FullName)
	require.EqualValues(t, "1111", res[1].Uid)
	require.False(t, res[1].Following)
	require.Equal(t, "alice", res[1].DisplayName)
	require.Equal(t, "Alice", res[1].DisplayLabel) // Because we are not following, contact name is used instead of full name.
	require.Equal(t, "[alice+test@keyba.se]@email", res[1].Assertion)
}

func TestFollowing(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("", "+1111222"),
			},
		},
		{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "bob+test@keyba.se"),
			},
		},
		{
			Name: "Charlie",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "charlie+test@keyba.se"),
			},
		},
		{
			Name: "",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "doug+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)

	provider.PhoneNumbers["+1111222"] = MockLookupUser{UID: keybase1.UID("1111"), Username: "alice", Fullname: "CryptoAlice"}
	provider.Emails["bob+test@keyba.se"] = MockLookupUser{UID: keybase1.UID("2222"), Username: "bob", Fullname: ""}
	provider.Emails["charlie+test@keyba.se"] = MockLookupUser{UID: keybase1.UID("3333"), Username: "charlie", Fullname: ""}
	provider.Emails["doug+test@keyba.se"] = MockLookupUser{UID: keybase1.UID("4444"), Username: "doug", Fullname: ""}

	provider.Following[keybase1.UID("1111")] = true
	provider.Following[keybase1.UID("3333")] = true

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 4)
	expected := []string{
		`"alice" "CryptoAlice"`,       // followed and have full name, take full name
		`"bob" "Bob"`,                 // not followed, no full name, take contact name
		`"charlie" "Charlie"`,         // followed but no full name, take contact name
		`"doug" "doug+test@keyba.se"`, // not followed, no full name, no contact name, take component
	}
	require.Equal(t, expected, displayResults(res))
}

func TestErrorsInResolution(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("home", "+1111222"),
				MakePhoneComponent("work", "444"),
			},
		},
		{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "bob+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)
	provider.PhoneNumbers["+1111222"] = MakeMockLookupUser("alice", "CryptoAlice")
	provider.PhoneNumberErrors["444"] = "Mock error for number 444"

	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.True(t, res[0].Resolved)
	require.False(t, res[1].Resolved)
	expected := []string{
		`"alice" "Alice"`,
		`"Bob" "bob+test@keyba.se"`,
	}
	require.Equal(t, expected, displayResults(res))

	delete(provider.PhoneNumbers, "+1111222")

	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.False(t, res[0].Resolved)
	require.False(t, res[1].Resolved)
	expected = []string{
		`"Alice" "+1111222 (home)"`,
		`"Bob" "bob+test@keyba.se"`,
	}
	require.Equal(t, expected, displayResults(res))
}

func TestDuplicateEntries(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		// Contact with multiple components that will yield the same assertion.
		{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("home", "+1111222"),
				MakePhoneComponent("car", "+1111222"),
				MakePhoneComponent("car", "+1111222"),
			},
		},
		// "Duplicated" contacts with the same name and same component.
		{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("home", "+1111222"),
			},
		},
		// Two contacts with same component that's going to get resolved -
		// resolution should appear only once in results.
		{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("email", "bob+test@keyba.se"),
			},
		},
		{
			Name: "Robert B.",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("E-Mail", "bob+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)
	provider.Emails["bob+test@keyba.se"] = MakeMockLookupUser("bob", "Bobby")

	// We expect one entry for Alice, +1111222 - because there is only one
	// unique combination of "Alice" contact name ane component value
	// "+1111222". Both "bob+test@keyba.se" values for Bob/Robert should have
	// own, resolved, entry.
	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 3)
	expected := []string{
		`"Alice" "+1111222 (home)"`,
		`"bob" "Bob"`,
		`"bob" "Robert B."`,
	}
	require.Equal(t, expected, displayResults(res))
	require.False(t, res[0].Resolved)
	require.True(t, res[1].Resolved)
	require.True(t, res[2].Resolved)
}
