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
			ret[i] = fmt.Sprintf("%s (%s)", r.Username, r.Uid)
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
		keybase1.Contact{
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

	// At least one of the components resolves the user, return just that one
	// contact.
	provider.PhoneNumbers["+1111222"] = MockLookupUser{UID: keybase1.UID("1"), Username: "joe", Fullname: "JOE"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "joe", res[0].DisplayName)
	require.Equal(t, "JOE", res[0].FullName)
	require.Equal(t, "Home", res[0].Component.Label)
	require.NotNil(t, res[0].Component.PhoneNumber)
	require.Nil(t, res[0].Component.Email)
	require.EqualValues(t, "+1111222", *res[0].Component.PhoneNumber)
	require.True(t, res[0].Resolved)
	require.EqualValues(t, "1", res[0].Uid)

	// More than one components resolve, still return only the first resolution.
	provider.PhoneNumbers["+199123"] = MockLookupUser{UID: keybase1.UID("1"), Username: "joe"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)

	// Suddenly this number resolves to someone else, despite being in same contact.
	provider.PhoneNumbers["+199123"] = MockLookupUser{UID: keybase1.UID("2"), Username: "ed"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.Equal(t, []string{
		"joe (1)",
		"ed (2)",
	}, stringifyResults(res))
	// Even if contact resolves to a Keybase user, assertion should still be an
	// imptofu assertion (rather than username or username@keybase). This is
	// required, so resolver is involved when starting a conversation.
	require.Equal(t, "1111222@phone", res[0].Assertion)
	require.Equal(t, "199123@phone", res[1].Assertion)

	// Test with email
	provider = MakeMockProvider(t)
	provider.Emails["joe@linux.org"] = MockLookupUser{UID: keybase1.UID("1"), Username: "joe"}
	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 1)
	require.Equal(t, "joe", res[0].DisplayName)
	require.Equal(t, "E-mail", res[0].Component.Label)
	require.Nil(t, res[0].Component.PhoneNumber)
	require.NotNil(t, res[0].Component.Email)
	require.EqualValues(t, "joe@linux.org", *res[0].Component.Email)
	require.True(t, res[0].Resolved)
	require.EqualValues(t, "1", res[0].Uid)
}

func TestLookupContactsMultipleUsers(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("Home", "+1111222"),
				MakePhoneComponent("Work", "+199123"),
			},
		},
		keybase1.Contact{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("Home", "+123456"),
			},
		},
		keybase1.Contact{
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

	provider.PhoneNumbers["+123456"] = MockLookupUser{UID: keybase1.UID("1"), Username: "bob"}
	provider.Emails["charlie+test@keyba.se"] = MockLookupUser{UID: keybase1.UID("2"), Username: "charlie"}

	res, err = ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	expected = []string{
		"charlie (2)",
		"bob (1)",
		"Alice +1111222 (Home)",
		"Alice +199123 (Work)",
	}
	require.Equal(t, expected, stringifyResults(res))
	expected = []string{
		`"charlie" "Charlie"`,
		`"bob" "Bob"`,
		`"Alice" "+1111222 (Home)"`,
		`"Alice" "+199123 (Work)"`,
	}
	require.Equal(t, expected, displayResults(res))

	require.Equal(t, "[charlie+test@keyba.se]@email", res[0].Assertion)
	require.Equal(t, "123456@phone", res[1].Assertion)
	require.Equal(t, "1111222@phone", res[2].Assertion)
	require.Equal(t, "199123@phone", res[3].Assertion)
}

func TestEmptyComponentLabels(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
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
	require.Len(t, res, 1)
	require.True(t, res[0].Resolved)
	require.Equal(t, "alice", res[0].Username)
	require.Equal(t, "A L I C E", res[0].FullName)
	require.EqualValues(t, "1111", res[0].Uid)
	require.False(t, res[0].Following)
	require.Equal(t, "alice", res[0].DisplayName)
	require.Equal(t, "Alice", res[0].DisplayLabel) // Because we are not following, contact name is used instead of full name.
}

func TestFollowing(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("", "+1111222"),
			},
		},
		keybase1.Contact{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "bob+test@keyba.se"),
			},
		},
		keybase1.Contact{
			Name: "Charlie",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "charlie+test@keyba.se"),
			},
		},
		keybase1.Contact{
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
		`"bob" "Bob"`,                 // not followed, no full name, take contact name
		`"charlie" "Charlie"`,         // followed but no full name, take contact name
		`"doug" "doug+test@keyba.se"`, // not followed, no full name, no contact name, take component
		`"alice" "CryptoAlice"`,       // followed and have full name, take full name
	}
	require.Equal(t, expected, displayResults(res))
}

func TestErrorsInResolution(t *testing.T) {
	tc := libkb.SetupTest(t, "TestLookupContacts", 1)
	defer tc.Cleanup()

	contactList := []keybase1.Contact{
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("home", "+1111222"),
				MakePhoneComponent("work", "444"),
			},
		},
		keybase1.Contact{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("", "bob+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)
	provider.PhoneNumbers["+1111222"] = MockLookupUser{UID: keybase1.UID("1111"), Username: "alice", Fullname: "CryptoAlice"}
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
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("home", "+1111222"),
				MakePhoneComponent("car", "+1111222"),
				MakePhoneComponent("car", "+1111222"),
			},
		},
		// "Duplicated" contacts with the same name and same component.
		keybase1.Contact{
			Name: "Alice",
			Components: []keybase1.ContactComponent{
				MakePhoneComponent("home", "+1111222"),
			},
		},
		// Two contacts with same component that's going to get resolved -
		// resolution should appear only once in results.
		keybase1.Contact{
			Name: "Bob",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("email", "bob+test@keyba.se"),
			},
		},
		keybase1.Contact{
			Name: "Robert B.",
			Components: []keybase1.ContactComponent{
				MakeEmailComponent("E-Mail", "bob+test@keyba.se"),
			},
		},
	}

	provider := MakeMockProvider(t)
	provider.Emails["bob+test@keyba.se"] = MockLookupUser{UID: keybase1.UID("2222"), Username: "bob", Fullname: "Bobby"}

	// We expect to see one resolution for "bob+test@keyba.se" from "Bob"
	// contact (comes first), and one unresolved entry for Alice for "+1111222"
	// (one even though there are 3 components with the same phone number, and
	// a duplicate "Alice" contact).
	res, err := ResolveContacts(libkb.NewMetaContextForTest(tc), provider, contactList, keybase1.RegionCode(""))
	require.NoError(t, err)
	require.Len(t, res, 2)
	require.True(t, res[0].Resolved)
	require.False(t, res[1].Resolved)
	expected := []string{
		`"bob" "Bob"`,
		`"Alice" "+1111222 (home)"`,
	}
	require.Equal(t, expected, displayResults(res))
}
